from __future__ import annotations

from collections.abc import Callable


def _safe_ratio(numerator: int, denominator: int) -> float:
    return numerator / denominator if denominator else 0.0


def run_retrieval_evaluation(
    cases: list[dict],
    retriever: Callable[[str], list[dict]],
    *,
    warning_threshold: float = 0.8,
) -> dict:
    expected_document_total = 0
    recovered_document_total = 0
    expected_page_total = 0
    recovered_page_total = 0
    expected_term_total = 0
    recovered_term_total = 0
    reciprocal_ranks = []

    for case in cases:
        results = retriever(case["question"])
        expected_documents = set(case.get("expected_documents", []))
        result_documents = [result.get("document_id") for result in results]
        expected_document_total += len(expected_documents)
        recovered_document_total += len(expected_documents & set(result_documents))

        first_relevant_rank = next(
            (
                index
                for index, document_id in enumerate(result_documents, start=1)
                if document_id in expected_documents
            ),
            None,
        )
        reciprocal_ranks.append(1 / first_relevant_rank if first_relevant_rank else 0.0)

        expected_pages = {
            (item["document_id"], item["page"])
            for item in case.get("expected_pages", [])
        }
        result_pages = {
            (result.get("document_id"), result.get("page")) for result in results
        }
        expected_page_total += len(expected_pages)
        recovered_page_total += len(expected_pages & result_pages)

        combined_text = " ".join(str(result.get("text", "")) for result in results).lower()
        expected_terms = [str(term).lower() for term in case.get("expected_terms", [])]
        expected_term_total += len(expected_terms)
        recovered_term_total += sum(term in combined_text for term in expected_terms)

    metrics = {
        "document_recall": _safe_ratio(
            recovered_document_total, expected_document_total
        ),
        "mean_reciprocal_rank": _safe_ratio(
            sum(reciprocal_ranks), len(reciprocal_ranks)
        ),
        "page_accuracy": _safe_ratio(recovered_page_total, expected_page_total),
        "term_coverage": _safe_ratio(recovered_term_total, expected_term_total),
    }
    warnings = [
        f"{name} is below {warning_threshold:.2f}: {value:.2f}"
        for name, value in metrics.items()
        if value < warning_threshold
    ]
    return {**metrics, "case_count": len(cases), "warnings": warnings}
