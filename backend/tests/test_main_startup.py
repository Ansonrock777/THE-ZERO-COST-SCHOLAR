import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import Mock

import pytest


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
    spec = importlib.util.spec_from_file_location("main_under_test_startup", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.asyncio
async def test_startup_provisions_the_pdf_bucket(app_module):
    ensure_bucket_exists = Mock()
    app_module.ensure_bucket_exists = ensure_bucket_exists

    async with app_module.lifespan(app_module.app):
        pass

    ensure_bucket_exists.assert_called_once_with(app_module.supabase)


@pytest.mark.asyncio
async def test_startup_survives_an_unreachable_pdf_bucket(app_module):
    # The PDF preview bucket is a best-effort enhancement (see upload_pdf), so a
    # Supabase Storage outage must not take the whole API down — otherwise every
    # frontend request fails as an opaque "Network Error".
    app_module.ensure_bucket_exists = Mock(
        side_effect=ConnectionError("target machine actively refused it")
    )

    async with app_module.lifespan(app_module.app):
        pass  # must not raise
