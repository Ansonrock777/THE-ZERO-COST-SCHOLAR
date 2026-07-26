import importlib.util
import io
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import Mock

import pytest
import json
from fastapi import HTTPException
from fastapi import UploadFile
from pydantic import ValidationError

from document_repository import OwnedDocument


class FakeRepository:
    def __init__(self, document):
        self.document = document
        self.get_owned_document_calls = []
        self.get_owned_documents_calls = []
        self.soft_delete_calls = []
        self.summaries = []

    def get_owned_document(self, document_id, user_id):
        self.get_owned_document_calls.append((document_id, user_id))
        return self.document

    def get_owned_documents(self, document_ids, user_id):
        self.get_owned_documents_calls.append((document_ids, user_id))
        return self.document

    def soft_delete_document(self, document_id, user_id):
        self.soft_delete_calls.append((document_id, user_id))
        return self.document is not None

    def save_summary(self, document_id, user_id, summary):
        self.summaries.append((document_id, user_id, summary))
        return True


class FakeConversationRepository:
    def __init__(self, conversation=None, messages=None):
        self.conversation = conversation
        self.messages = messages or []
        self.recent_calls = []
        self.added = []

    def get_owned_conversation(self, conversation_id, user_id):
        return self.conversation

    def recent_messages(self, conversation_id, user_id, limit=6):
        self.recent_calls.append((conversation_id, user_id, limit))
        return self.messages

    def add_message(self, conversation_id, user_id, role, content, sources=None, trace_id=None):
        self.added.append((conversation_id, user_id, role, content, sources or [], trace_id))
        return {"id": f"message-{len(self.added)}"}

    def update_conversation(self, *args, **kwargs):
        return True


class FakeLoggingClient:
    def __init__(self):
        self.inserted = []

    def table(self, name):
        return self

    def insert(self, record):
        self.inserted.append(record)
        return self

    def execute(self):
        return SimpleNamespace(data=[])


class UploadLoggingClient(FakeLoggingClient):
    def execute(self):
        return SimpleNamespace(data=[self.inserted[-1]])


@pytest.fixture
def app_module(monkeypatch):
    ingestion = ModuleType("ingestion")
    ingestion.ingest_pdf = Mock()
    ingestion.delete_collection = Mock()
    query = ModuleType("query")
    query.query_document = Mock()
    database = ModuleType("database")
    database.supabase = FakeLoggingClient()
    auth = ModuleType("auth")
    auth.get_current_user = Mock()

    monkeypatch.setitem(sys.modules, "ingestion", ingestion)
    monkeypatch.setitem(sys.modules, "query", query)
    monkeypatch.setitem(sys.modules, "database", database)
    monkeypatch.setitem(sys.modules, "auth", auth)

    module_path = Path(__file__).parents[1] / "main.py"
    spec = importlib.util.spec_from_file_location("main_under_test", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.asyncio
async def test_foreign_document_is_rejected_before_query_or_logging(app_module):
    repository = FakeRepository(document=None)
    app_module.document_repository = repository
    app_module.query_document = Mock()
    app_module.supabase = FakeLoggingClient()

    with pytest.raises(HTTPException) as error:
        await app_module.ask_question(
            app_module.QueryRequest(question="secret?", document_id="foreign"),
            user_id="attacker",
        )

    assert error.value.status_code == 404
    assert error.value.detail == "Document not found"
    assert repository.get_owned_documents_calls == [(["foreign"], "attacker")]
    app_module.query_document.assert_not_called()
    assert app_module.supabase.inserted == []


@pytest.mark.asyncio
async def test_owner_query_uses_server_collection_and_logs(app_module):
    owned = OwnedDocument("doc-1", "guide.pdf", "stored-collection")
    repository = FakeRepository(document=[owned])
    app_module.document_repository = repository
    app_module.query_document = Mock(return_value={
        "answer": "answer", "sources": [], "model": "configured-model"
    })
    app_module.supabase = FakeLoggingClient()

    await app_module.ask_question(
        app_module.QueryRequest(question="question", document_id="doc-1"),
        user_id="owner",
    )

    app_module.query_document.assert_called_once_with("question", [owned], user_id="owner")
    assert repository.get_owned_documents_calls == [(["doc-1"], "owner")]
    assert app_module.supabase.inserted[0]["document_id"] == "doc-1"


@pytest.mark.asyncio
async def test_multiple_owned_documents_are_authorized_together(app_module):
    owned = [
        OwnedDocument("doc-1", "one.pdf", "collection-one"),
        OwnedDocument("doc-2", "two.pdf", "collection-two"),
    ]
    repository = FakeRepository(document=owned)
    app_module.document_repository = repository
    app_module.query_document = Mock(return_value={
        "answer": "answer", "sources": [], "model": "configured-model"
    })
    app_module.supabase = FakeLoggingClient()

    await app_module.ask_question(
        app_module.QueryRequest(question="compare", document_ids=["doc-1", "doc-2"]),
        user_id="owner",
    )

    app_module.query_document.assert_called_once_with("compare", owned, user_id="owner")
    assert repository.get_owned_documents_calls == [(["doc-1", "doc-2"], "owner")]


@pytest.mark.asyncio
async def test_foreign_pdf_file_is_rejected_before_storage_access(app_module):
    repository = FakeRepository(document=None)
    app_module.document_repository = repository
    app_module.pdf_storage = Mock()

    with pytest.raises(HTTPException) as error:
        await app_module.get_document_file("foreign", user_id="attacker")

    assert error.value.status_code == 404
    app_module.pdf_storage.path_for.assert_not_called()


def test_query_request_rejects_collection_name(app_module):
    with pytest.raises(ValidationError):
        app_module.QueryRequest(
            question="question", document_id="doc-1", collection_name="client-value"
        )


def test_query_request_normalizes_legacy_document(app_module):
    request = app_module.QueryRequest(question="question", document_id="doc-1")

    assert request.selected_document_ids == ["doc-1"]


def test_query_request_normalizes_multiple_documents(app_module):
    request = app_module.QueryRequest(question="compare", document_ids=["a", "b"])

    assert request.selected_document_ids == ["a", "b"]


def test_query_request_accepts_conversation_id(app_module):
    request = app_module.QueryRequest(
        question="follow up", document_ids=["a"], conversation_id="conversation-1"
    )

    assert request.conversation_id == "conversation-1"


@pytest.mark.parametrize("values", [[], ["a", "a"], [str(i) for i in range(11)]])
def test_query_request_rejects_invalid_document_lists(app_module, values):
    with pytest.raises(ValidationError):
        app_module.QueryRequest(question="question", document_ids=values)


def test_query_request_rejects_legacy_and_list_fields_together(app_module):
    with pytest.raises(ValidationError):
        app_module.QueryRequest(
            question="question", document_id="doc-1", document_ids=["doc-2"]
        )


@pytest.mark.asyncio
async def test_upload_persists_original_under_server_generated_document_id(app_module):
    app_module.ingest_pdf = Mock(return_value={
        "collection_name": "stored-collection",
        "chunk_count": 4,
        "page_count": 2,
    })
    app_module.pdf_storage = Mock()
    app_module.supabase = UploadLoggingClient()
    uploaded = UploadFile(filename="guide.pdf", file=io.BytesIO(b"%PDF-1.7"))

    result = await app_module.upload_pdf(uploaded, user_id="owner")

    inserted = app_module.supabase.inserted[0]
    assert inserted["id"] == result["document_id"]
    app_module.pdf_storage.save.assert_called_once_with(
        "owner", result["document_id"], b"%PDF-1.7"
    )
    app_module.ingest_pdf.assert_called_once_with(b"%PDF-1.7", "guide.pdf", "owner")


@pytest.mark.asyncio
async def test_upload_rejects_files_over_configured_limit_before_storage(app_module):
    app_module.MAX_PDF_BYTES = 4
    app_module.pdf_storage = Mock()
    uploaded = UploadFile(filename="large.pdf", file=io.BytesIO(b"12345"))

    with pytest.raises(HTTPException) as error:
        await app_module.upload_pdf(uploaded, user_id="owner")

    assert error.value.status_code == 413
    app_module.pdf_storage.save.assert_not_called()


@pytest.mark.asyncio
async def test_foreign_conversation_is_rejected_before_generation(app_module):
    owned = [OwnedDocument("doc-1", "one.pdf", "collection-one")]
    app_module.document_repository = FakeRepository(document=owned)
    app_module.conversation_repository = FakeConversationRepository(conversation=None)
    app_module.query_document = Mock()

    with pytest.raises(HTTPException) as error:
        await app_module.ask_question(
            app_module.QueryRequest(
                question="follow up",
                document_ids=["doc-1"],
                conversation_id="foreign",
            ),
            user_id="owner",
        )

    assert error.value.status_code == 404
    app_module.query_document.assert_not_called()


@pytest.mark.asyncio
async def test_follow_up_uses_bounded_context_and_persists_exchange(app_module):
    owned = [OwnedDocument("doc-1", "one.pdf", "collection-one")]
    conversation_messages = [
        {"role": "user", "content": "earlier"},
        {"role": "assistant", "content": "earlier answer"},
    ]
    conversations = FakeConversationRepository(
        conversation={"id": "conversation-1", "document_ids": ["doc-1"]},
        messages=conversation_messages,
    )
    app_module.document_repository = FakeRepository(document=owned)
    app_module.conversation_repository = conversations
    app_module.query_document = Mock(return_value={
        "answer": "follow-up answer",
        "sources": [{"page": 1}],
        "model": "free-model",
        "trace_id": "trace-1",
    })
    app_module.supabase = FakeLoggingClient()

    await app_module.ask_question(
        app_module.QueryRequest(
            question="follow up",
            document_ids=["doc-1"],
            conversation_id="conversation-1",
        ),
        user_id="owner",
    )

    app_module.query_document.assert_called_once_with(
        "follow up", owned, conversation=conversation_messages, user_id="owner"
    )
    assert conversations.recent_calls == [("conversation-1", "owner", 6)]
    assert [item[2] for item in conversations.added] == ["user", "assistant"]


@pytest.mark.asyncio
async def test_stream_query_emits_statuses_then_complete_result(app_module):
    owned = [OwnedDocument("doc-1", "one.pdf", "collection-one")]
    app_module.document_repository = FakeRepository(document=owned)
    app_module.conversation_repository = FakeConversationRepository()
    app_module.query_document = Mock(return_value={
        "answer": "grounded answer", "sources": [], "model": "free-model", "trace_id": "trace-1"
    })
    app_module.supabase = FakeLoggingClient()

    response = await app_module.stream_question(
        app_module.QueryRequest(question="question", document_ids=["doc-1"]),
        user_id="stream-owner",
    )
    events = [json.loads(chunk) async for chunk in response.body_iterator]

    assert [event["type"] for event in events] == ["status", "status", "status", "result"]
    assert events[-1]["answer"] == "grounded answer"
    assert events[-1]["trace_id"] == "trace-1"


@pytest.mark.asyncio
async def test_summary_is_normalized_to_one_paragraph_and_saved(app_module):
    owned = OwnedDocument("doc-1", "one.pdf", "collection-one")
    repository = FakeRepository(document=owned)
    app_module.document_repository = repository
    app_module.query_document = Mock(return_value={
        "answer": "First line.\n\nSecond line.", "sources": [], "model": "free-model", "trace_id": "trace-2"
    })

    result = await app_module.summarize_document("doc-1", user_id="summary-owner")

    assert result["summary"] == "First line. Second line."
    assert repository.summaries == [("doc-1", "summary-owner", "First line. Second line.")]


@pytest.mark.asyncio
async def test_developer_telemetry_is_gated_and_scoped_to_owner(app_module, monkeypatch):
    # main.py calls load_dotenv() at import, so a developer's own DEV_MODE=true
    # in backend/.env would otherwise leak in and hide the gate.
    monkeypatch.delenv("DEV_MODE", raising=False)

    with pytest.raises(HTTPException) as error:
        await app_module.developer_telemetry(user_id="owner")
    assert error.value.status_code == 404

    traces = [
        {"trace_id": "owned", "user_id": "owner", "status": "completed", "document_count": 1, "metrics": {"total_ms": 12.0}},
        {"trace_id": "foreign", "user_id": "other", "status": "completed", "document_count": 1, "metrics": {"total_ms": 999.0}},
    ]
    store = SimpleNamespace(recent=lambda limit: traces)
    sys.modules["query"].default_dependencies = lambda: SimpleNamespace(telemetry_store=store)
    monkeypatch.setenv("DEV_MODE", "true")

    result = await app_module.developer_telemetry(user_id="owner")

    assert [trace["trace_id"] for trace in result["traces"]] == ["owned"]
    assert result["aggregates"]["total_ms"] == {"count": 1, "average": 12.0, "p95": 12.0}
