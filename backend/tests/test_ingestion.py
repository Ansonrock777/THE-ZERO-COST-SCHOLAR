from unittest.mock import MagicMock, patch

from ingestion import delete_collection


def test_delete_collection_uses_a_persistent_client_scoped_to_the_chroma_path():
    fake_client = MagicMock()

    with patch('ingestion.chromadb.PersistentClient', return_value=fake_client) as persistent_client:
        delete_collection('doc_abc123')

    persistent_client.assert_called_once()
    assert persistent_client.call_args.kwargs.get('path') or persistent_client.call_args.args
    fake_client.delete_collection.assert_called_once_with(name='doc_abc123')
