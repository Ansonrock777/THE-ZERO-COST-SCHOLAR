from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class OwnedDocument:
    id: str
    filename: str
    chroma_collection: str


class DocumentRepository(Protocol):
    def get_owned_document(self, document_id: str, user_id: str) -> OwnedDocument | None: ...
    def list_documents(self, user_id: str) -> list[dict]: ...


class SupabaseDocumentRepository:
    def __init__(self, client):
        self._client = client

    def get_owned_document(self, document_id: str, user_id: str) -> OwnedDocument | None:
        response = (
            self._client.table("user_documents")
            .select("id,filename,chroma_collection")
            .eq("id", document_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not response.data:
            return None
        row = response.data[0]
        return OwnedDocument(str(row["id"]), row["filename"], row["chroma_collection"])

    def list_documents(self, user_id: str) -> list[dict]:
        response = (
            self._client.table("user_documents")
            .select("id,filename,file_size,chunk_count,created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return response.data
