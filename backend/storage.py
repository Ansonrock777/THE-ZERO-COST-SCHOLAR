# backend/storage.py
# Persists the raw uploaded PDF bytes in Supabase Storage so the frontend can
# render a real PDF viewer. ingestion.py only keeps embeddings, not the file
# itself, so without this the file is gone as soon as /upload finishes.
from storage3.exceptions import StorageApiError

DOCUMENT_BUCKET = 'documents'


def document_storage_path(user_id: str, document_id: str) -> str:
    return f'{user_id}/{document_id}.pdf'


def ensure_bucket_exists(client) -> None:
    existing = {bucket.id for bucket in client.storage.list_buckets()}
    if DOCUMENT_BUCKET in existing:
        return
    try:
        client.storage.create_bucket(DOCUMENT_BUCKET, options={'public': False})
    except StorageApiError as error:
        # Tolerate a race between concurrent workers creating the bucket at
        # the same time — anything else is a real failure.
        if error.status not in (400, 409):
            raise


def upload_document_pdf(client, user_id: str, document_id: str, file_bytes: bytes) -> None:
    path = document_storage_path(user_id, document_id)
    client.storage.from_(DOCUMENT_BUCKET).upload(
        path, file_bytes,
        file_options={'content-type': 'application/pdf', 'upsert': 'true'},
    )


def download_document_pdf(client, user_id: str, document_id: str) -> bytes | None:
    path = document_storage_path(user_id, document_id)
    try:
        return client.storage.from_(DOCUMENT_BUCKET).download(path)
    except StorageApiError:
        return None


def delete_document_pdf(client, user_id: str, document_id: str) -> None:
    path = document_storage_path(user_id, document_id)
    client.storage.from_(DOCUMENT_BUCKET).remove([path])
