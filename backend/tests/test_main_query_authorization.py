import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from document_repository import OwnedDocument


class FakeRepository:
    def __init__(self, document):
        self.document = document
        self.get_owned_document_calls = []
        self.get_owned_documents_calls = []

    def get_owned_document(self, document_id, user_id):
        self.get_owned_document_calls.append((document_id, user_id))
        return self.document

    def get_owned_documents(self, document_ids, user_id):
        self.get_owned_documents_calls.append((document_ids, user_id))
        return self.document


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
