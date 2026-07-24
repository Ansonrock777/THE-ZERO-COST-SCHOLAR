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
        self.delete_document_calls = []

    def get_owned_document(self, document_id, user_id):
        self.get_owned_document_calls.append((document_id, user_id))
        return self.document

    def delete_document(self, document_id, user_id):
        self.delete_document_calls.append((document_id, user_id))


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
    spec = importlib.util.spec_from_file_location("main_under_test_document_delete", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.asyncio
async def test_foreign_document_is_rejected_before_any_deletion(app_module):
    repository = FakeRepository(document=None)
    app_module.document_repository = repository
    app_module.delete_collection = Mock()
    app_module.delete_document_pdf = Mock()

    with pytest.raises(HTTPException) as error:
        await app_module.delete_document("foreign", user_id="attacker")

    assert error.value.status_code == 404
    assert error.value.detail == "Document not found"
    assert repository.get_owned_document_calls == [("foreign", "attacker")]
    assert repository.delete_document_calls == []
    app_module.delete_collection.assert_not_called()
    app_module.delete_document_pdf.assert_not_called()


@pytest.mark.asyncio
async def test_owned_document_is_deleted_with_full_cleanup(app_module):
    document = OwnedDocument("doc-1", "guide.pdf", "collection-1")
    repository = FakeRepository(document=document)
    app_module.document_repository = repository
    app_module.delete_collection = Mock()
    app_module.delete_document_pdf = Mock()

    result = await app_module.delete_document("doc-1", user_id="owner")

    assert result == {"deleted": True}
    assert repository.delete_document_calls == [("doc-1", "owner")]
    app_module.delete_collection.assert_called_once_with("collection-1")
    app_module.delete_document_pdf.assert_called_once_with(app_module.supabase, "owner", "doc-1")


@pytest.mark.asyncio
async def test_deletion_succeeds_even_if_chroma_cleanup_fails(app_module):
    document = OwnedDocument("doc-1", "guide.pdf", "collection-1")
    repository = FakeRepository(document=document)
    app_module.document_repository = repository
    app_module.delete_collection = Mock(side_effect=Exception("collection missing"))
    app_module.delete_document_pdf = Mock()

    result = await app_module.delete_document("doc-1", user_id="owner")

    assert result == {"deleted": True}
    assert repository.delete_document_calls == [("doc-1", "owner")]
    app_module.delete_document_pdf.assert_called_once()


@pytest.mark.asyncio
async def test_deletion_succeeds_even_if_storage_cleanup_fails(app_module):
    document = OwnedDocument("doc-1", "guide.pdf", "collection-1")
    repository = FakeRepository(document=document)
    app_module.document_repository = repository
    app_module.delete_collection = Mock()
    app_module.delete_document_pdf = Mock(side_effect=Exception("storage down"))

    result = await app_module.delete_document("doc-1", user_id="owner")

    assert result == {"deleted": True}
    assert repository.delete_document_calls == [("doc-1", "owner")]
