import re
from dataclasses import dataclass, replace


@dataclass
class RetrievedDocument:
    page_content: str
    metadata: dict


@dataclass(frozen=True)
class RetrievalCandidate:
    document_id: str
    filename: str
    chunk_index: int
    page: int | str
    text: str
    vector_score: float | None = None
    bm25_score: float | None = None
    fused_score: float = 0.0
    term_coverage: float = 0.0

    @property
    def identity(self) -> tuple[str, int]:
        return self.document_id, self.chunk_index


def reciprocal_rank_fusion(
    rankings: list[list[RetrievalCandidate]],
    rrf_k: int = 60,
) -> list[RetrievalCandidate]:
    if rrf_k < 1:
        raise ValueError("rrf_k must be positive")

    candidates = {}
    scores = {}
    first_seen = {}
    seen_count = 0
    for ranking in rankings:
        for rank, candidate in enumerate(ranking, start=1):
            identity = candidate.identity
            if identity not in first_seen:
                first_seen[identity] = seen_count
                seen_count += 1
            scores[identity] = scores.get(identity, 0.0) + 1 / (rrf_k + rank)
            current = candidates.get(identity)
            if current is None:
                candidates[identity] = candidate
            else:
                candidates[identity] = replace(
                    current,
                    vector_score=(
                        candidate.vector_score
                        if candidate.vector_score is not None
                        else current.vector_score
                    ),
                    bm25_score=(
                        candidate.bm25_score
                        if candidate.bm25_score is not None
                        else current.bm25_score
                    ),
                )

    fused = [
        replace(candidate, fused_score=scores[identity])
        for identity, candidate in candidates.items()
    ]
    return sorted(
        fused,
        key=lambda item: (-item.fused_score, first_seen[item.identity]),
    )


def _term_coverage(text: str, query_terms: list[str]) -> float:
    normalized_terms = {term.lower() for term in query_terms if term}
    if not normalized_terms:
        return 0.0
    text_terms = set(re.findall(r"[a-z0-9]+", text.lower()))
    return len(normalized_terms & text_terms) / len(normalized_terms)


def rerank_candidates(
    candidates: list[RetrievalCandidate],
    query_terms: list[str],
    limit: int,
    per_document_limit: int,
) -> list[RetrievalCandidate]:
    if limit <= 0 or per_document_limit <= 0:
        return []

    enriched = [
        replace(candidate, term_coverage=_term_coverage(candidate.text, query_terms))
        for candidate in candidates
    ]
    document_order = []
    grouped = {}
    for candidate in enriched:
        if candidate.document_id not in grouped:
            document_order.append(candidate.document_id)
            grouped[candidate.document_id] = []
        grouped[candidate.document_id].append(candidate)
    for group in grouped.values():
        group.sort(key=lambda item: (-item.fused_score, -item.term_coverage, item.chunk_index))

    selected = []
    round_index = 0
    while len(selected) < limit and round_index < per_document_limit:
        added = False
        for document_id in document_order:
            group = grouped[document_id]
            if round_index < len(group):
                selected.append(group[round_index])
                added = True
                if len(selected) == limit:
                    break
        if not added:
            break
        round_index += 1
    return selected


def _chunk_index(document) -> int | None:
    metadata = getattr(document, "metadata", {})
    if not isinstance(metadata, dict):
        return None

    chunk_index = metadata.get("chunk_index")
    return (
        chunk_index
        if isinstance(chunk_index, int) and not isinstance(chunk_index, bool) and chunk_index >= 0
        else None
    )


def expand_with_neighbors(vectorstore, semantic_hits) -> list[tuple[object, float | None]]:
    semantic_results = list(semantic_hits)
    anchors = [
        (document, score, chunk_index)
        for document, score in semantic_results
        if (chunk_index := _chunk_index(document)) is not None
    ]
    if not anchors:
        return semantic_results

    anchor_documents = {}
    anchor_scores = {}
    for document, score, chunk_index in anchors:
        anchor_documents.setdefault(chunk_index, document)
        anchor_scores.setdefault(chunk_index, score)

    requested_indexes = sorted({
        neighbor_index
        for _, _, chunk_index in anchors
        for neighbor_index in (chunk_index - 1, chunk_index, chunk_index + 1)
        if neighbor_index >= 0
    })
    stored = vectorstore.get(
        where={"chunk_index": {"$in": requested_indexes}},
        include=["documents", "metadatas"],
    )
    stored_documents = {}
    for page_content, metadata in zip(stored.get("documents", []), stored.get("metadatas", [])):
        if not isinstance(metadata, dict):
            continue
        chunk_index = metadata.get("chunk_index")
        if isinstance(chunk_index, int) and not isinstance(chunk_index, bool):
            stored_documents.setdefault(chunk_index, RetrievedDocument(page_content, metadata))

    expanded = []
    seen_indexes = set()
    for document, score in semantic_results:
        chunk_index = _chunk_index(document)
        if chunk_index is None:
            expanded.append((document, score))
            continue

        for neighbor_index in (chunk_index - 1, chunk_index, chunk_index + 1):
            if neighbor_index < 0:
                continue
            if neighbor_index in seen_indexes:
                continue

            neighbor = anchor_documents.get(neighbor_index) or stored_documents.get(neighbor_index)
            if neighbor is None:
                continue

            seen_indexes.add(neighbor_index)
            expanded.append((neighbor, anchor_scores.get(neighbor_index)))

    return expanded


def one_based_page(metadata: dict) -> int | str:
    page = metadata.get("page")
    return page + 1 if isinstance(page, int) and not isinstance(page, bool) else "?"


def serialize_sources(results) -> list[dict]:
    return [
        {
            "label": f"[Source {index}]",
            "text": document.page_content,
            "page": one_based_page(document.metadata),
            "score": round(float(score), 4) if score is not None else None,
        }
        for index, (document, score) in enumerate(results, start=1)
    ]
