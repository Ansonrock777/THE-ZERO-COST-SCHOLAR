from dataclasses import dataclass


@dataclass
class RetrievedDocument:
    page_content: str
    metadata: dict


def _chunk_index(document) -> int | None:
    metadata = getattr(document, "metadata", {})
    if not isinstance(metadata, dict):
        return None

    chunk_index = metadata.get("chunk_index")
    return chunk_index if isinstance(chunk_index, int) and not isinstance(chunk_index, bool) else None


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
