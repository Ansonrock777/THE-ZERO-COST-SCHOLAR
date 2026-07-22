from conversation_repository import SupabaseConversationRepository


class Response:
    def __init__(self, data):
        self.data = data


class Builder:
    def __init__(self, data):
        self.data = data
        self.calls = []

    def select(self, columns): self.calls.append(("select", columns)); return self
    def eq(self, column, value): self.calls.append(("eq", column, value)); return self
    def is_(self, column, value): self.calls.append(("is", column, value)); return self
    def order(self, column, desc=False): self.calls.append(("order", column, desc)); return self
    def limit(self, value): self.calls.append(("limit", value)); return self
    def insert(self, value): self.calls.append(("insert", value)); return self
    def update(self, value): self.calls.append(("update", value)); return self
    def execute(self): self.calls.append(("execute",)); return Response(self.data)


class Client:
    def __init__(self, data):
        self.builder = Builder(data)

    def table(self, name):
        self.builder.calls.append(("table", name))
        return self.builder


def test_list_conversations_filters_owner_and_deleted_rows():
    client = Client([])
    repository = SupabaseConversationRepository(client)

    repository.list_conversations("user-1")

    assert ("eq", "user_id", "user-1") in client.builder.calls
    assert ("is", "deleted_at", "null") in client.builder.calls
    assert ("order", "pinned", True) in client.builder.calls
    assert ("order", "updated_at", True) in client.builder.calls


def test_get_owned_conversation_returns_none_for_no_match():
    repository = SupabaseConversationRepository(Client([]))

    assert repository.get_owned_conversation("foreign", "user-1") is None


def test_recent_messages_are_returned_in_chronological_order():
    client = Client([
        {"role": "assistant", "content": "new", "sources": [], "trace_id": None},
        {"role": "user", "content": "old", "sources": [], "trace_id": None},
    ])
    repository = SupabaseConversationRepository(client)

    messages = repository.recent_messages("conversation-1", "user-1", limit=6)

    assert [message["content"] for message in messages] == ["old", "new"]
    assert ("limit", 6) in client.builder.calls


def test_update_allows_title_pin_and_document_selection_only():
    client = Client([{"id": "conversation-1"}])
    repository = SupabaseConversationRepository(client)

    assert repository.update_conversation(
        "conversation-1",
        "user-1",
        title="Pinned research",
        pinned=True,
        document_ids=["doc-a", "doc-b"],
    ) is True

    update = next(call[1] for call in client.builder.calls if call[0] == "update")
    assert update["title"] == "Pinned research"
    assert update["pinned"] is True
    assert update["document_ids"] == ["doc-a", "doc-b"]
    assert "updated_at" in update


def test_add_message_snapshots_sources_and_trace_id():
    client = Client([{"id": "message-1"}])
    repository = SupabaseConversationRepository(client)

    repository.add_message(
        "conversation-1", "user-1", "assistant", "answer", [{"page": 2}], "trace-1"
    )

    inserted = next(call[1] for call in client.builder.calls if call[0] == "insert")
    assert inserted == {
        "conversation_id": "conversation-1",
        "user_id": "user-1",
        "role": "assistant",
        "content": "answer",
        "sources": [{"page": 2}],
        "trace_id": "trace-1",
    }
