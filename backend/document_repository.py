from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol


@dataclass(frozen=True)
class OwnedDocument:
    id: str
    filename: str
    chroma_collection: str


class DocumentRepository(Protocol):
    def get_owned_document(self, document_id: str, user_id: str) -> OwnedDocument | None: ...
    def get_owned_documents(
        self, document_ids: list[str], user_id: str
    ) -> list[OwnedDocument] | None: ...
    def list_documents(self, user_id: str) -> list[dict]: ...
    def delete_document(self, document_id: str, user_id: str) -> None: ...
    def save_summary(self, document_id: str, user_id: str, summary: str) -> bool: ...


class SupabaseDocumentRepository:
    def __init__(self, client):
        self._client = client

    def get_owned_document(self, document_id: str, user_id: str) -> OwnedDocument | None:
        response = (
            self._client.table("user_documents")
            .select("id,filename,chroma_collection")
            .eq("id", document_id)
            .eq("user_id", user_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        if not response.data:
            return None
        row = response.data[0]
        return OwnedDocument(str(row["id"]), row["filename"], row["chroma_collection"])

    def get_owned_documents(
        self, document_ids: list[str], user_id: str
    ) -> list[OwnedDocument] | None:
        response = (
            self._client.table("user_documents")
            .select("id,filename,chroma_collection")
            .in_("id", document_ids)
            .eq("user_id", user_id)
            .is_("deleted_at", "null")
            .execute()
        )
        by_id = {
            str(row["id"]): OwnedDocument(
                str(row["id"]), row["filename"], row["chroma_collection"]
            )
            for row in response.data
        }
        if any(document_id not in by_id for document_id in document_ids):
            return None
        return [by_id[document_id] for document_id in document_ids]

    def list_documents(self, user_id: str) -> list[dict]:
        response = (
            self._client.table("user_documents")
            .select("id,filename,file_size,chunk_count,created_at,summary")
            .eq("user_id", user_id)
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
            .execute()
        )
        return response.data

    def delete_document(self, document_id: str, user_id: str) -> None:
        self._client.table("user_documents") \
            .delete() \
            .eq("id", document_id) \
            .eq("user_id", user_id) \
            .execute()

    def save_summary(self, document_id: str, user_id: str, summary: str) -> bool:
        response = (
            self._client.table("user_documents")
            .update({"summary": summary})
            .eq("id", document_id)
            .eq("user_id", user_id)
            .is_("deleted_at", "null")
            .execute()
        )
        return bool(response.data)
