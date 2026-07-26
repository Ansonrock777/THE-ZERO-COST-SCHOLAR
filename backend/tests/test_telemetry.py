from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest

from telemetry import QueryTrace, SQLiteTelemetryStore, stage_timer


def test_trace_uses_uuid_and_accepts_numeric_metrics():
    trace = QueryTrace.create(user_id="user-1", document_count=2)
    trace.add_metric("vector_candidates", 12)

    assert UUID(trace.trace_id)
    assert trace.metrics == {"vector_candidates": 12}


@pytest.mark.parametrize("field", ["question", "prompt_tokens_text", "answer", "excerpt", "content"])
def test_trace_rejects_content_fields(field):
    trace = QueryTrace.create(user_id="user-1", document_count=1)

    with pytest.raises(ValueError, match="content field"):
        trace.add_metric(field, 1)


def test_trace_rejects_non_numeric_metric_values():
    trace = QueryTrace.create(user_id="user-1", document_count=1)

    with pytest.raises(ValueError, match="numeric"):
        trace.add_metric("vector_candidates", "twelve")


def test_numeric_prompt_token_count_is_allowed():
    trace = QueryTrace.create(user_id="user-1", document_count=1)

    trace.add_metric("prompt_tokens", 512)

    assert trace.metrics["prompt_tokens"] == 512


def test_stage_timer_records_elapsed_milliseconds(monkeypatch):
    values = iter([10.0, 10.125])
    monkeypatch.setattr("telemetry.perf_counter", lambda: next(values))
    trace = QueryTrace.create(user_id="user-1", document_count=1)

    with stage_timer(trace, "bm25"):
        pass

    assert trace.metrics["bm25_ms"] == pytest.approx(125.0)


def test_sqlite_store_round_trip_and_aggregate(tmp_path):
    store = SQLiteTelemetryStore(tmp_path / "telemetry.sqlite3")
    first = QueryTrace.create(user_id="user-1", document_count=2)
    first.add_metric("total_ms", 100)
    second = QueryTrace.create(user_id="user-1", document_count=1)
    second.add_metric("total_ms", 300)
    store.record(first)
    store.record(second)

    recent = store.recent(limit=2)
    aggregate = store.aggregate("total_ms")

    assert {item["trace_id"] for item in recent} == {first.trace_id, second.trace_id}
    assert aggregate == {"count": 2, "average": 200.0, "p95": 300.0}


def test_retention_purges_records_older_than_thirty_days(tmp_path):
    store = SQLiteTelemetryStore(tmp_path / "telemetry.sqlite3", retention_days=30)
    old = QueryTrace.create(user_id="user-1", document_count=1)
    old.started_at = datetime.now(timezone.utc) - timedelta(days=31)
    current = QueryTrace.create(user_id="user-1", document_count=1)
    store.record(old)
    store.record(current)

    removed = store.purge_expired()

    assert removed == 1
    assert [item["trace_id"] for item in store.recent(limit=10)] == [current.trace_id]
