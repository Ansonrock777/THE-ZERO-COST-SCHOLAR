import json
from pathlib import Path

from evaluation import run_retrieval_evaluation


FIXTURE = Path(__file__).parent / "fixtures" / "retrieval_fixture.json"


def test_fixture_contains_keyword_semantic_and_multi_document_cases():
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))

    assert len(payload["documents"]) == 2
    assert len(payload["cases"]) == 3
    assert any(len(case["expected_documents"]) > 1 for case in payload["cases"])


def test_evaluator_reports_deterministic_retrieval_metrics():
    cases = json.loads(FIXTURE.read_text(encoding="utf-8"))["cases"]
    results = {
        cases[0]["question"]: [
            {"document_id": "catalogue", "page": 2, "text": "ZXQ-419 cobalt calibration"}
        ],
        cases[1]["question"]: [
            {"document_id": "handbook", "page": 1, "text": "precision and semantic recall"}
        ],
        cases[2]["question"]: [
            {"document_id": "handbook", "page": 2, "text": "every selected document"},
            {"document_id": "catalogue", "page": 2, "text": "ZXQ-419"},
        ],
    }

    report = run_retrieval_evaluation(cases, lambda question: results[question])

    assert report["document_recall"] == 1.0
    assert report["mean_reciprocal_rank"] == 1.0
    assert report["page_accuracy"] == 1.0
    assert report["term_coverage"] == 1.0
    assert report["warnings"] == []


def test_threshold_regressions_warn_without_raising():
    cases = [{
        "question": "missing",
        "expected_documents": ["doc-a"],
        "expected_pages": [{"document_id": "doc-a", "page": 1}],
        "expected_terms": ["evidence"],
    }]

    report = run_retrieval_evaluation(cases, lambda question: [])

    assert report["document_recall"] == 0.0
    assert report["warnings"]
