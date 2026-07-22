from types import SimpleNamespace

from bm25 import BM25Document, BM25Index
from document_repository import OwnedDocument
from query import QueryDependencies, query_document
from telemetry import SQLiteTelemetryStore


class FakeVectorDocument:
    def __init__(self, text, chunk_index, page):
        self.page_content = text
        self.metadata = {"chunk_index": chunk_index, "page": page}


class FakeVectorStore:
    def __init__(self, document):
        self.document = document
        self.queries = []

    def similarity_search_with_score(self, question, k):
        self.queries.append((question, k))
        return [(self.document, 0.2)]


class RecordingTelemetryStore(SQLiteTelemetryStore):
    def __init__(self, path):
        super().__init__(path)
        self.recorded = []

    def record(self, trace):
        self.recorded.append(trace)
        super().record(trace)


def test_multi_document_pipeline_fuses_sources_and_records_content_free_trace(tmp_path):
    documents = [
        OwnedDocument("doc-a", "alpha.pdf", "collection-a"),
        OwnedDocument("doc-b", "beta.pdf", "collection-b"),
    ]
    vectorstores = {
        "collection-a": FakeVectorStore(FakeVectorDocument("semantic alpha evidence", 0, 0)),
        "collection-b": FakeVectorStore(FakeVectorDocument("semantic beta evidence", 0, 2)),
    }
    bm25_indexes = {
        "collection-a": BM25Index.from_documents([
            BM25Document("collection-a", 1, 1, "ZXQ 419 alpha procedure")
        ]),
        "collection-b": BM25Index.from_documents([
            BM25Document("collection-b", 1, 3, "ZXQ 419 beta comparison")
        ]),
    }
    generated_messages = []
    telemetry = RecordingTelemetryStore(tmp_path / "telemetry.sqlite3")

    def generate(messages):
        generated_messages.extend(messages)
        return "Both documents discuss ZXQ 419 [Source 1] [Source 2]", "free-model"

    dependencies = QueryDependencies(
        vectorstore_factory=lambda collection: vectorstores[collection],
        bm25_loader=lambda collection: bm25_indexes[collection],
        generator=generate,
        telemetry_store=telemetry,
    )

    result = query_document(
        "Compare ZXQ 419",
        documents,
        user_id="user-1",
        dependencies=dependencies,
    )

    assert {source["document_id"] for source in result["sources"]} == {"doc-a", "doc-b"}
    assert all(store.queries == [("Compare ZXQ 419", 5)] for store in vectorstores.values())
    assert result["model"] == "free-model"
    assert result["trace_id"] == telemetry.recorded[0].trace_id
    assert "UNTRUSTED_DOCUMENT_EVIDENCE" in generated_messages[1]["content"]
    assert telemetry.recorded[0].status == "completed"
    assert all(isinstance(value, (int, float)) for value in telemetry.recorded[0].metrics.values())
    assert not ({"question", "prompt", "answer", "text", "content"} & telemetry.recorded[0].metrics.keys())


def test_empty_retrieval_skips_generation(tmp_path):
    document = OwnedDocument("doc-a", "alpha.pdf", "collection-a")
    store = FakeVectorStore(SimpleNamespace(page_content="", metadata={"chunk_index": 0, "page": 0}))
    store.similarity_search_with_score = lambda question, k: []
    generated = []
    dependencies = QueryDependencies(
        vectorstore_factory=lambda collection: store,
        bm25_loader=lambda collection: BM25Index.from_documents([]),
        generator=lambda messages: generated.append(messages),
        telemetry_store=RecordingTelemetryStore(tmp_path / "telemetry.sqlite3"),
    )

    result = query_document(
        "What is missing?",
        [document],
        user_id="user-1",
        dependencies=dependencies,
    )

    assert result["answer"] == "I couldn't verify that from the selected documents."
    assert result["sources"] == []
    assert generated == []
