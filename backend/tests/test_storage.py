import pytest
from storage3.exceptions import StorageApiError

from storage import (
    DOCUMENT_BUCKET,
    delete_document_pdf,
    document_storage_path,
    download_document_pdf,
    ensure_bucket_exists,
    upload_document_pdf,
)


class FakeBucket:
    def __init__(self, id):
        self.id = id


class FakeBucketProxy:
    def __init__(self):
        self.files = {}
        self.upload_calls = []
        self.remove_calls = []

    def upload(self, path, file, file_options=None):
        self.upload_calls.append((path, file, file_options))
        self.files[path] = file

    def download(self, path, options=None, query_params=None):
        if path not in self.files:
            raise StorageApiError('Object not found', 'not_found', 404)
        return self.files[path]

    def remove(self, paths):
        self.remove_calls.append(paths)
        for path in paths:
            self.files.pop(path, None)
        return [{'name': path} for path in paths]


class FakeStorage:
    def __init__(self, existing_buckets=None, create_bucket=None):
        self.existing_buckets = list(existing_buckets or [])
        self.create_bucket_calls = []
        self.bucket_proxy = FakeBucketProxy()
        if create_bucket is not None:
            self.create_bucket = create_bucket

    def list_buckets(self):
        return [FakeBucket(bucket_id) for bucket_id in self.existing_buckets]

    def create_bucket(self, id, name=None, options=None):
        self.create_bucket_calls.append((id, options))
        self.existing_buckets.append(id)

    def from_(self, bucket_id):
        return self.bucket_proxy


class FakeClient:
    def __init__(self, existing_buckets=None, create_bucket=None):
        self.storage = FakeStorage(existing_buckets, create_bucket)


def test_document_storage_path_scopes_by_user_and_document():
    assert document_storage_path('user-1', 'doc-1') == 'user-1/doc-1.pdf'


def test_ensure_bucket_exists_skips_create_when_bucket_present():
    client = FakeClient(existing_buckets=[DOCUMENT_BUCKET])

    ensure_bucket_exists(client)

    assert client.storage.create_bucket_calls == []


def test_ensure_bucket_exists_creates_private_bucket_when_missing():
    client = FakeClient(existing_buckets=[])

    ensure_bucket_exists(client)

    assert client.storage.create_bucket_calls == [(DOCUMENT_BUCKET, {'public': False})]


def test_ensure_bucket_exists_tolerates_already_exists_race():
    def raise_conflict(id, name=None, options=None):
        raise StorageApiError('Bucket already exists', 'already_exists', 409)

    client = FakeClient(existing_buckets=[], create_bucket=raise_conflict)

    ensure_bucket_exists(client)  # must not raise


def test_ensure_bucket_exists_reraises_unexpected_error():
    def raise_server_error(id, name=None, options=None):
        raise StorageApiError('Internal error', 'internal', 500)

    client = FakeClient(existing_buckets=[], create_bucket=raise_server_error)

    with pytest.raises(StorageApiError):
        ensure_bucket_exists(client)


def test_upload_document_pdf_writes_to_scoped_path():
    client = FakeClient()

    upload_document_pdf(client, 'user-1', 'doc-1', b'%PDF-bytes')

    assert client.storage.bucket_proxy.upload_calls == [(
        'user-1/doc-1.pdf',
        b'%PDF-bytes',
        {'content-type': 'application/pdf', 'upsert': 'true'},
    )]


def test_download_document_pdf_returns_bytes_when_present():
    client = FakeClient()
    client.storage.bucket_proxy.files['user-1/doc-1.pdf'] = b'%PDF-bytes'

    assert download_document_pdf(client, 'user-1', 'doc-1') == b'%PDF-bytes'


def test_download_document_pdf_returns_none_when_missing():
    client = FakeClient()

    assert download_document_pdf(client, 'user-1', 'doc-1') is None


def test_delete_document_pdf_removes_the_scoped_path():
    client = FakeClient()
    client.storage.bucket_proxy.files['user-1/doc-1.pdf'] = b'%PDF-bytes'

    delete_document_pdf(client, 'user-1', 'doc-1')

    assert client.storage.bucket_proxy.remove_calls == [['user-1/doc-1.pdf']]
    assert 'user-1/doc-1.pdf' not in client.storage.bucket_proxy.files
