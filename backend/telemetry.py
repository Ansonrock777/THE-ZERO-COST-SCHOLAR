from __future__ import annotations

import json
import math
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from time import perf_counter
from uuid import uuid4


CONTENT_KEYS = {"question", "answer", "text", "excerpt", "content"}


def _is_content_key(name: str) -> bool:
    normalized = name.lower()
    parts = set(normalized.split("_"))
    return (
        normalized == "prompt"
        or bool(parts & CONTENT_KEYS)
        or normalized.endswith("_text")
    )


@dataclass
class QueryTrace:
    trace_id: str
    user_id: str
    document_count: int
    started_at: datetime
    status: str = "started"
    parent_trace_id: str | None = None
    error_code: str | None = None
    metrics: dict[str, int | float] = field(default_factory=dict)

    @classmethod
    def create(
        cls,
        user_id: str,
        document_count: int,
        parent_trace_id: str | None = None,
    ) -> "QueryTrace":
        return cls(
            trace_id=str(uuid4()),
            user_id=user_id,
            document_count=document_count,
            started_at=datetime.now(timezone.utc),
            parent_trace_id=parent_trace_id,
        )

    def add_metric(self, name: str, value: int | float) -> None:
        if _is_content_key(name):
            raise ValueError(f"Telemetry content field is forbidden: {name}")
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("Telemetry metric values must be numeric")
        self.metrics[name] = value


@contextmanager
def stage_timer(trace: QueryTrace, name: str):
    started = perf_counter()
    try:
        yield
    finally:
        trace.add_metric(f"{name}_ms", (perf_counter() - started) * 1000)


class SQLiteTelemetryStore:
    def __init__(self, path: str | Path, retention_days: int = 30):
        self.path = Path(path)
        self.retention_days = retention_days
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()
        self.purge_expired()

    def _connect(self):
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute("""
                CREATE TABLE IF NOT EXISTS query_traces (
                    trace_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    document_count INTEGER NOT NULL,
                    started_at TEXT NOT NULL,
                    status TEXT NOT NULL,
                    parent_trace_id TEXT,
                    error_code TEXT,
                    metrics_json TEXT NOT NULL
                )
            """)

    def record(self, trace: QueryTrace) -> None:
        for name, value in trace.metrics.items():
            if _is_content_key(name):
                raise ValueError(f"Telemetry content field is forbidden: {name}")
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ValueError("Telemetry metric values must be numeric")
        with self._connect() as connection:
            connection.execute(
                """
                INSERT OR REPLACE INTO query_traces (
                    trace_id, user_id, document_count, started_at, status,
                    parent_trace_id, error_code, metrics_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    trace.trace_id,
                    trace.user_id,
                    trace.document_count,
                    trace.started_at.astimezone(timezone.utc).isoformat(),
                    trace.status,
                    trace.parent_trace_id,
                    trace.error_code,
                    json.dumps(trace.metrics, sort_keys=True),
                ),
            )

    def recent(self, limit: int = 50) -> list[dict]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM query_traces ORDER BY started_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [
            {
                **{key: row[key] for key in row.keys() if key != "metrics_json"},
                "metrics": json.loads(row["metrics_json"]),
            }
            for row in rows
        ]

    def aggregate(self, metric_name: str) -> dict[str, int | float]:
        values = sorted(
            float(item["metrics"][metric_name])
            for item in self.recent(limit=10000)
            if metric_name in item["metrics"]
        )
        if not values:
            return {"count": 0, "average": 0.0, "p95": 0.0}
        percentile_index = max(0, math.ceil(len(values) * 0.95) - 1)
        return {
            "count": len(values),
            "average": sum(values) / len(values),
            "p95": values[percentile_index],
        }

    def purge_expired(self) -> int:
        cutoff = datetime.now(timezone.utc) - timedelta(days=self.retention_days)
        with self._connect() as connection:
            cursor = connection.execute(
                "DELETE FROM query_traces WHERE started_at < ?",
                (cutoff.isoformat(),),
            )
            return cursor.rowcount
