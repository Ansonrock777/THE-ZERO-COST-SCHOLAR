from bm25 import (
    BM25Document,
    BM25Index,
    build_bm25_index_from_chunks,
    load_bm25_index,
    save_bm25_index,
    tokenize,
)


def test_missing_index_is_treated_as_empty_index(tmp_path):
    missing_path = tmp_path / "missing.json"

    restored = load_bm25_index(missing_path, allow_missing=True)

    assert restored.documents == ()


def chunk(document_id, chunk_index, text, page=0):
    return BM25Document(
        document_id=document_id,
        chunk_index=chunk_index,
        page=page,
        text=text,
    )


def test_bm25_prioritizes_exact_rare_term():
    index = BM25Index.from_documents([
        chunk("doc-a", 0, "general retrieval quality"),
        chunk("doc-a", 1, "ZXQ-419 calibration procedure"),
    ])

    hits = index.search("ZXQ-419", limit=1)

    assert hits[0].chunk_index == 1
    assert hits[0].score > 0


def test_empty_or_punctuation_only_query_returns_no_hits():
    index = BM25Index.from_documents([chunk("doc-a", 0, "some text")])

    assert index.search("", limit=5) == []
    assert index.search("---", limit=5) == []


def test_tokenize_is_stable_and_splits_hyphenated_identifiers():
    assert tokenize("ZXQ-419, zxq-419!") == ["zxq", "419", "zxq", "419"]


def test_equal_scores_are_ordered_by_document_then_chunk():
    index = BM25Index.from_documents([
        chunk("doc-b", 0, "shared"),
        chunk("doc-a", 2, "shared"),
        chunk("doc-a", 1, "shared"),
    ])

    hits = index.search("shared", limit=3)

    assert [(hit.document_id, hit.chunk_index) for hit in hits] == [
        ("doc-a", 1),
        ("doc-a", 2),
        ("doc-b", 0),
    ]


def test_index_round_trip_preserves_search_results(tmp_path):
    index = BM25Index.from_documents([
        chunk("doc-a", 0, "alpha beta", page=3),
        chunk("doc-a", 1, "gamma delta", page=4),
    ])
    path = tmp_path / "doc-a.json"

    save_bm25_index(index, path)
    restored = load_bm25_index(path)

    assert restored.search("gamma", limit=1) == index.search("gamma", limit=1)
    assert not path.with_suffix(".json.tmp").exists()


def test_build_index_from_chunks_uses_server_document_metadata():
    class Chunk:
        page_content = "retrieval evidence"
        metadata = {"chunk_index": 7, "page": 2}

    index = build_bm25_index_from_chunks("doc-owned", [Chunk()])

    assert index.documents == (
        BM25Document("doc-owned", 7, 2, "retrieval evidence"),
    )
