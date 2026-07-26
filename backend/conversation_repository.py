from __future__ import annotations

from datetime import datetime, timezone


class SupabaseConversationRepository:
    def __init__(self, client):
        self._client = client

    def list_conversations(self, user_id: str) -> list[dict]:
        response = (
            self._client.table("conversations")
            .select("id,title,document_ids,pinned,created_at,updated_at")
            .eq("user_id", user_id)
            .is_("deleted_at", "null")
            .order("pinned", desc=True)
            .order("updated_at", desc=True)
            .execute()
        )
        return response.data

    def get_owned_conversation(self, conversation_id: str, user_id: str) -> dict | None:
        response = (
            self._client.table("conversations")
            .select("id,title,document_ids,pinned,created_at,updated_at")
            .eq("id", conversation_id)
            .eq("user_id", user_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    def create_conversation(
        self, user_id: str, document_ids: list[str], title: str = "New inquiry"
    ) -> dict:
        response = self._client.table("conversations").insert({
            "user_id": user_id,
            "title": title.strip() or "New inquiry",
            "document_ids": document_ids,
        }).execute()
        return response.data[0]

    def update_conversation(
        self,
        conversation_id: str,
        user_id: str,
        *,
        title: str | None = None,
        pinned: bool | None = None,
        document_ids: list[str] | None = None,
    ) -> bool:
        values = {"updated_at": datetime.now(timezone.utc).isoformat()}
        if title is not None:
            values["title"] = title.strip() or "New inquiry"
        if pinned is not None:
            values["pinned"] = pinned
        if document_ids is not None:
            values["document_ids"] = document_ids
        response = (
            self._client.table("conversations")
            .update(values)
            .eq("id", conversation_id)
            .eq("user_id", user_id)
            .is_("deleted_at", "null")
            .execute()
        )
        return bool(response.data)

    def delete_conversation(self, conversation_id: str, user_id: str) -> bool:
        response = (
            self._client.table("conversations")
            .update({"deleted_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", conversation_id)
            .eq("user_id", user_id)
            .is_("deleted_at", "null")
            .execute()
        )
        return bool(response.data)

    def recent_messages(
        self, conversation_id: str, user_id: str, limit: int = 6
    ) -> list[dict]:
        response = (
            self._client.table("conversation_messages")
            .select("role,content,sources,trace_id,created_at")
            .eq("conversation_id", conversation_id)
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return list(reversed(response.data))

    def add_message(
        self,
        conversation_id: str,
        user_id: str,
        role: str,
        content: str,
        sources: list[dict] | None = None,
        trace_id: str | None = None,
    ) -> dict:
        response = self._client.table("conversation_messages").insert({
            "conversation_id": conversation_id,
            "user_id": user_id,
            "role": role,
            "content": content,
            "sources": sources or [],
            "trace_id": trace_id,
        }).execute()
        return response.data[0]
