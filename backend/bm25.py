from __future__ import annotations

import json
import math
import os
import re
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


TOKEN_PATTERN = re.compile(r"[a-z0-9]+")


def tokenize(text: str) -> list[str]:
    return TOKEN_PATTERN.findall(text.lower())


@dataclass(frozen=True)
class BM25Document:
    document_id: str
    chunk_index: int
    page: int | str
    text: str


@dataclass(frozen=True)
class BM25Hit:
    document_id: str
    chunk_index: int
    page: int | str
    text: str
    score: float


class BM25Index:
    def __init__(
        self,
        documents: Iterable[BM25Document],
        *,
        k1: float = 1.5,
        b: float = 0.75,
    ):
        self.documents = tuple(documents)
        self.k1 = k1
        self.b = b
        self._tokens = tuple(tokenize(document.text) for document in self.documents)
        self._term_frequencies = tuple(Counter(tokens) for tokens in self._tokens)
        self._average_length = (
            sum(len(tokens) for tokens in self._tokens) / len(self._tokens)
            if self._tokens
            else 0.0
        )
        document_frequency = Counter(
            token for tokens in self._tokens for token in set(tokens)
        )
        count = len(self.documents)
        self._idf = {
            token: math.log(1 + (count - frequency + 0.5) / (frequency + 0.5))
            for token, frequency in document_frequency.items()
        }

    @classmethod
    def from_documents(cls, documents: Iterable[BM25Document]) -> "BM25Index":
        return cls(documents)

    def search(self, query: str, limit: int) -> list[BM25Hit]:
        query_terms = tokenize(query)
        if not query_terms or limit <= 0 or not self.documents:
            return []

        scored = []
        for document, frequencies, tokens in zip(
            self.documents, self._term_frequencies, self._tokens
        ):
            length = len(tokens)
            score = 0.0
            for term in query_terms:
                frequency = frequencies.get(term, 0)
                if not frequency:
                    continue
                length_ratio = length / self._average_length if self._average_length else 0
                denominator = frequency + self.k1 * (1 - self.b + self.b * length_ratio)
                score += self._idf.get(term, 0.0) * (
                    frequency * (self.k1 + 1) / denominator
                )
            if score > 0:
                scored.append(BM25Hit(
                    document_id=document.document_id,
                    chunk_index=document.chunk_index,
                    page=document.page,
                    text=document.text,
                    score=score,
                ))

        return sorted(
            scored,
            key=lambda hit: (-hit.score, hit.document_id, hit.chunk_index),
        )[:limit]

    def to_dict(self) -> dict:
        return {
            "version": 1,
            "k1": self.k1,
            "b": self.b,
            "documents": [asdict(document) for document in self.documents],
        }

    @classmethod
    def from_dict(cls, value: dict) -> "BM25Index":
        if value.get("version") != 1:
            raise ValueError("Unsupported BM25 index version")
        return cls(
            (BM25Document(**document) for document in value.get("documents", [])),
            k1=float(value.get("k1", 1.5)),
            b=float(value.get("b", 0.75)),
        )


def save_bm25_index(index: BM25Index, path: str | Path) -> None:
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    temporary.write_text(json.dumps(index.to_dict(), ensure_ascii=False), encoding="utf-8")
    os.replace(temporary, destination)


def load_bm25_index(path: str | Path) -> BM25Index:
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    return BM25Index.from_dict(value)


def build_bm25_index_from_chunks(document_id: str, chunks: Iterable[object]) -> BM25Index:
    documents = []
    for chunk in chunks:
        metadata = getattr(chunk, "metadata", {})
        documents.append(BM25Document(
            document_id=document_id,
            chunk_index=int(metadata["chunk_index"]),
            page=metadata.get("page", "?"),
            text=str(getattr(chunk, "page_content", "")),
        ))
    return BM25Index.from_documents(documents)


def index_path_for_collection(collection_name: str, directory: str | Path) -> Path:
    if not re.fullmatch(r"[A-Za-z0-9_-]+", collection_name):
        raise ValueError("Invalid collection name")
    return Path(directory) / f"{collection_name}.json"
