import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from document_repository import OwnedDocument


class FakeRepository:
    def __init__(self, document):
        self.document = document
        self.get_owned_document_calls = []

    def get_owned_document(self, document_id, user_id):
        self.get_owned_document_calls.append((document_id, user_id))
        return self.document


@pytest.fixture
def app_module(monkeypatch):
    ingestion = ModuleType("ingestion")
    ingestion.ingest_pdf = Mock()
    ingestion.delete_collection = Mock()
    query = ModuleType("query")
    query.query_document = Mock()
    database = ModuleType("database")
    database.supabase = SimpleNamespace()
    auth = ModuleType("auth")
    auth.get_current_user = Mock()

    monkeypatch.setitem(sys.modules, "ingestion", ingestion)
    monkeypatch.setitem(sys.modules, "query", query)
    monkeypatch.setitem(sys.modules, "database", database)
    monkeypatch.setitem(sys.modules, "auth", auth)

    module_path = Path(__file__).parents[1] / "main.py"
    spec = importlib.util.spec_from_file_location("main_under_test_document_file", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.asyncio
async def test_foreign_document_is_rejected_before_any_storage_call(app_module):
    repository = FakeRepository(document=None)
    app_module.document_repository = repository
    app_module.download_document_pdf = Mock()

    with pytest.raises(HTTPException) as error:
        await app_module.get_document_file("foreign", user_id="attacker")

    assert error.value.status_code == 404
    assert error.value.detail == "Document not found"
    assert repository.get_owned_document_calls == [("foreign", "attacker")]
    app_module.download_document_pdf.assert_not_called()


@pytest.mark.asyncio
async def test_owned_document_without_stored_file_returns_404(app_module):
    repository = FakeRepository(document=OwnedDocument("doc-1", "guide.pdf", "collection"))
    app_module.document_repository = repository
    app_module.download_document_pdf = Mock(return_value=None)

    with pytest.raises(HTTPException) as error:
        await app_module.get_document_file("doc-1", user_id="owner")

    assert error.value.status_code == 404
    assert error.value.detail == "PDF file not available for this document"


@pytest.mark.asyncio
async def test_owned_document_with_stored_file_streams_pdf_bytes(app_module):
    repository = FakeRepository(document=OwnedDocument("doc-1", "guide.pdf", "collection"))
    app_module.document_repository = repository
    app_module.download_document_pdf = Mock(return_value=b"%PDF-1.4 fake bytes")

    response = await app_module.get_document_file("doc-1", user_id="owner")

    assert response.status_code == 200
    assert response.media_type == "application/pdf"
    assert response.body == b"%PDF-1.4 fake bytes"
    app_module.download_document_pdf.assert_called_once_with(app_module.supabase, "owner", "doc-1")
