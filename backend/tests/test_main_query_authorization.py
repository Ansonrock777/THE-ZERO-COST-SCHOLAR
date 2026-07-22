import importlib.util
import io
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import Mock

import pytest
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

    def get_owned_document(self, document_id, user_id):
        self.get_owned_document_calls.append((document_id, user_id))
        return self.document

    def get_owned_documents(self, document_ids, user_id):
        self.get_owned_documents_calls.append((document_ids, user_id))
        return self.document

    def soft_delete_document(self, document_id, user_id):
        self.soft_delete_calls.append((document_id, user_id))
        return self.document is not None


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


@pytest.mark.asyncio
async def test_deleting_owned_document_removes_file_and_soft_deletes(app_module):
    repository = FakeRepository(
        document=OwnedDocument("doc-1", "guide.pdf", "stored-collection")
    )
    app_module.document_repository = repository
    app_module.pdf_storage = Mock()
    app_module.pdf_storage.delete.return_value = True

    result = await app_module.delete_document("doc-1", user_id="owner")

    assert result == {"deleted": True, "document_id": "doc-1"}
    app_module.pdf_storage.delete.assert_called_once_with("owner", "doc-1")
    assert repository.soft_delete_calls == [("doc-1", "owner")]


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
