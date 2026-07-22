from pathlib import Path

import pytest

from pdf_storage import LocalPdfStorage


def test_save_and_resolve_owned_pdf(tmp_path):
    storage = LocalPdfStorage(tmp_path)

    stored = storage.save("user-1", "doc-1", b"%PDF-1.7\ncontent")

    assert stored == tmp_path / "user-1" / "doc-1.pdf"
    assert storage.path_for("user-1", "doc-1").read_bytes() == b"%PDF-1.7\ncontent"


@pytest.mark.parametrize("user_id,document_id", [
    ("../other", "doc-1"),
    ("user-1", "../../secret"),
    ("user/child", "doc-1"),
])
def test_unsafe_identifiers_are_rejected(tmp_path, user_id, document_id):
    storage = LocalPdfStorage(tmp_path)

    with pytest.raises(ValueError, match="identifier"):
        storage.path_for(user_id, document_id)


def test_save_is_atomic_and_leaves_no_temporary_file(tmp_path):
    storage = LocalPdfStorage(tmp_path)

    path = storage.save("user-1", "doc-1", b"first")
    storage.save("user-1", "doc-1", b"second")

    assert path.read_bytes() == b"second"
    assert not Path(f"{path}.tmp").exists()


def test_delete_is_idempotent_and_removes_empty_user_directory(tmp_path):
    storage = LocalPdfStorage(tmp_path)
    path = storage.save("user-1", "doc-1", b"pdf")

    assert storage.delete("user-1", "doc-1") is True
    assert storage.delete("user-1", "doc-1") is False
    assert not path.parent.exists()
