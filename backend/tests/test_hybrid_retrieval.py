import pytest

from retrieval import (
    RetrievalCandidate,
    reciprocal_rank_fusion,
    rerank_candidates,
)


def candidate(document_id, chunk_index, text="shared evidence", **scores):
    return RetrievalCandidate(
        document_id=document_id,
        filename=f"{document_id}.pdf",
        chunk_index=chunk_index,
        page=chunk_index + 1,
        text=text,
        **scores,
    )


def test_rrf_combines_rankings_and_deduplicates_the_same_chunk():
    semantic = [candidate("doc-a", 0, vector_score=0.2), candidate("doc-a", 1)]
    lexical = [candidate("doc-a", 1, bm25_score=4.0), candidate("doc-a", 0)]

    fused = reciprocal_rank_fusion([semantic, lexical], rrf_k=60)

    assert [(item.document_id, item.chunk_index) for item in fused] == [
        ("doc-a", 0),
        ("doc-a", 1),
    ]
    assert fused[0].fused_score == pytest.approx(fused[1].fused_score)
    assert fused[0].vector_score == 0.2
    assert fused[1].bm25_score == 4.0


def test_same_chunk_index_from_different_documents_is_not_deduplicated():
    fused = reciprocal_rank_fusion([
        [candidate("doc-a", 0), candidate("doc-b", 0)],
        [candidate("doc-b", 0), candidate("doc-a", 0)],
    ])

    assert {(item.document_id, item.chunk_index) for item in fused} == {
        ("doc-a", 0),
        ("doc-b", 0),
    }


def test_reranking_represents_each_document_before_filling_by_rank():
    candidates = [
        candidate("doc-a", 0, fused_score=0.9),
        candidate("doc-a", 1, fused_score=0.8),
        candidate("doc-b", 0, fused_score=0.4),
        candidate("doc-b", 1, fused_score=0.3),
    ]

    reranked = rerank_candidates(
        candidates,
        query_terms=["evidence"],
        limit=3,
        per_document_limit=2,
    )

    assert [(item.document_id, item.chunk_index) for item in reranked] == [
        ("doc-a", 0),
        ("doc-b", 0),
        ("doc-a", 1),
    ]


def test_exact_term_coverage_breaks_equal_fusion_scores():
    reranked = rerank_candidates(
        [
            candidate("doc-a", 0, text="generic retrieval", fused_score=0.5),
            candidate("doc-a", 1, text="ZXQ 419 procedure", fused_score=0.5),
        ],
        query_terms=["zxq", "419"],
        limit=2,
        per_document_limit=2,
    )

    assert [item.chunk_index for item in reranked] == [1, 0]
    assert reranked[0].term_coverage == 1.0


def test_per_document_limit_is_enforced():
    reranked = rerank_candidates(
        [candidate("doc-a", index, fused_score=1 - index / 10) for index in range(4)],
        query_terms=[],
        limit=4,
        per_document_limit=2,
    )

    assert len(reranked) == 2
