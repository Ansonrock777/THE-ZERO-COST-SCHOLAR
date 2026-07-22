from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from time import perf_counter
from typing import Callable

from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from openai import OpenAI

from bm25 import BM25Index, index_path_for_collection, load_bm25_index, tokenize
from document_repository import OwnedDocument
from prompting import (
    INSUFFICIENT_EVIDENCE_RESPONSE,
    PromptPolicy,
    build_messages,
    contains_injection_signal,
    estimate_tokens,
    select_context,
)
from retrieval import RetrievalCandidate, reciprocal_rank_fusion, rerank_candidates
from telemetry import QueryTrace, SQLiteTelemetryStore, stage_timer


CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_store")
BM25_INDEX_PATH = os.getenv("BM25_INDEX_PATH", "./bm25_store")
TELEMETRY_DB_PATH = os.getenv("TELEMETRY_DB_PATH", "./data/telemetry.sqlite3")
EMBEDDING_MODEL = os.getenv(
    "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
)
TOP_K = int(os.getenv("TOP_K_RESULTS", 5))
MAX_CONTEXT_TOKENS = int(os.getenv("MAX_CONTEXT_TOKENS", 6000))
MAX_RERANKED_RESULTS = int(os.getenv("MAX_RERANKED_RESULTS", 10))
PER_DOCUMENT_RESULTS = int(os.getenv("PER_DOCUMENT_RESULTS", 3))
LLM_MODEL = os.getenv("LLM_MODEL", "deepseek/deepseek-r1:free")


@dataclass(frozen=True)
class QueryDependencies:
    vectorstore_factory: Callable[[str], object]
    bm25_loader: Callable[[str], BM25Index]
    generator: Callable[[list[dict[str, str]]], tuple[str, str]]
    telemetry_store: SQLiteTelemetryStore


@lru_cache(maxsize=1)
def _embedding_function():
    return HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)


def _open_vectorstore(collection_name: str):
    return Chroma(
        persist_directory=CHROMA_DB_PATH,
        embedding_function=_embedding_function(),
        collection_name=collection_name,
    )


def _load_document_bm25(collection_name: str) -> BM25Index:
    path = index_path_for_collection(collection_name, BM25_INDEX_PATH)
    return load_bm25_index(path)


def _generate(messages: list[dict[str, str]]) -> tuple[str, str]:
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY"),
    )
    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=messages,
        temperature=0.1,
        max_tokens=1024,
    )
    return response.choices[0].message.content or "", LLM_MODEL


@lru_cache(maxsize=1)
def _telemetry_store() -> SQLiteTelemetryStore:
    return SQLiteTelemetryStore(Path(TELEMETRY_DB_PATH))


def default_dependencies() -> QueryDependencies:
    return QueryDependencies(
        vectorstore_factory=_open_vectorstore,
        bm25_loader=_load_document_bm25,
        generator=_generate,
        telemetry_store=_telemetry_store(),
    )


def _interleave(rankings: list[list[RetrievalCandidate]]) -> list[RetrievalCandidate]:
    interleaved = []
    for index in range(max((len(ranking) for ranking in rankings), default=0)):
        for ranking in rankings:
            if index < len(ranking):
                interleaved.append(ranking[index])
    return interleaved


def _vector_candidates(
    document: OwnedDocument, hits: list[tuple[object, float]]
) -> list[RetrievalCandidate]:
    candidates = []
    for hit, score in hits:
        metadata = getattr(hit, "metadata", {})
        chunk_index = metadata.get("chunk_index")
        if not isinstance(chunk_index, int) or isinstance(chunk_index, bool):
            continue
        page = metadata.get("page")
        candidates.append(RetrievalCandidate(
            document_id=document.id,
            filename=document.filename,
            chunk_index=chunk_index,
            page=page + 1 if isinstance(page, int) and not isinstance(page, bool) else "?",
            text=str(getattr(hit, "page_content", "")),
            vector_score=float(score),
        ))
    return candidates


def _bm25_candidates(
    document: OwnedDocument, index: BM25Index, question: str
) -> list[RetrievalCandidate]:
    return [
        RetrievalCandidate(
            document_id=document.id,
            filename=document.filename,
            chunk_index=hit.chunk_index,
            page=hit.page + 1 if isinstance(hit.page, int) and not isinstance(hit.page, bool) else hit.page,
            text=hit.text,
            bm25_score=hit.score,
        )
        for hit in index.search(question, limit=TOP_K)
    ]


def _serialize_sources(candidates: list[RetrievalCandidate]) -> list[dict]:
    return [
        {
            "label": f"[Source {index}]",
            "document_id": candidate.document_id,
            "filename": candidate.filename,
            "chunk_index": candidate.chunk_index,
            "page": candidate.page,
            "text": candidate.text,
            "score": round(candidate.fused_score, 6),
            "vector_score": (
                round(candidate.vector_score, 6)
                if candidate.vector_score is not None
                else None
            ),
            "bm25_score": (
                round(candidate.bm25_score, 6)
                if candidate.bm25_score is not None
                else None
            ),
        }
        for index, candidate in enumerate(candidates, start=1)
    ]


def query_document(
    question: str,
    documents: list[OwnedDocument],
    conversation: list[dict] | tuple[dict, ...] = (),
    *,
    user_id: str = "anonymous",
    dependencies: QueryDependencies | None = None,
    answer_style: str = "balanced",
) -> dict:
    if not documents:
        raise ValueError("At least one owned document is required")
    policy = PromptPolicy(context_token_budget=MAX_CONTEXT_TOKENS)
    normalized_question = policy.validate_question(question)
    dependencies = dependencies or default_dependencies()
    trace = QueryTrace.create(user_id=user_id, document_count=len(documents))
    started = perf_counter()

    try:
        semantic_rankings = []
        lexical_rankings = []
        with stage_timer(trace, "vector_retrieval"):
            for document in documents:
                vectorstore = dependencies.vectorstore_factory(document.chroma_collection)
                hits = vectorstore.similarity_search_with_score(
                    normalized_question, k=TOP_K
                )
                semantic_rankings.append(_vector_candidates(document, hits))
        with stage_timer(trace, "bm25_retrieval"):
            for document in documents:
                index = dependencies.bm25_loader(document.chroma_collection)
                lexical_rankings.append(
                    _bm25_candidates(document, index, normalized_question)
                )

        semantic = _interleave(semantic_rankings)
        lexical = _interleave(lexical_rankings)
        trace.add_metric("vector_candidates", len(semantic))
        trace.add_metric("bm25_candidates", len(lexical))

        with stage_timer(trace, "fusion"):
            fused = reciprocal_rank_fusion([semantic, lexical])
            reranked = rerank_candidates(
                fused,
                query_terms=tokenize(normalized_question),
                limit=MAX_RERANKED_RESULTS,
                per_document_limit=PER_DOCUMENT_RESULTS,
            )
        context = select_context(reranked, policy.context_token_budget)
        trace.add_metric("fused_candidates", len(fused))
        trace.add_metric("context_chunks", len(context))
        trace.add_metric("context_tokens", sum(estimate_tokens(item.text) for item in context))
        trace.add_metric(
            "injection_signals",
            sum(1 for item in context if contains_injection_signal(item.text)),
        )

        if context:
            messages = build_messages(
                normalized_question,
                context,
                list(conversation),
                max_conversation_messages=policy.max_conversation_messages,
                answer_style=answer_style,
            )
            trace.add_metric(
                "prompt_tokens",
                sum(estimate_tokens(message["content"]) for message in messages),
            )
            with stage_timer(trace, "generation"):
                answer, model = dependencies.generator(messages)
        else:
            answer, model = INSUFFICIENT_EVIDENCE_RESPONSE, LLM_MODEL

        trace.status = "completed"
        trace.add_metric("source_count", len(context))
        trace.add_metric("response_characters", len(answer))
        trace.add_metric("total_ms", (perf_counter() - started) * 1000)
        dependencies.telemetry_store.record(trace)
        return {
            "answer": answer,
            "sources": _serialize_sources(context),
            "model": model,
            "trace_id": trace.trace_id,
        }
    except Exception as error:
        trace.status = "failed"
        trace.error_code = type(error).__name__
        trace.add_metric("total_ms", (perf_counter() - started) * 1000)
        dependencies.telemetry_store.record(trace)
        raise
