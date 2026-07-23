from document_repository import OwnedDocument, SupabaseDocumentRepository


class FakeResponse:
    def __init__(self, data):
        self.data = data


class FakeQueryBuilder:
    def __init__(self, data):
        self._data = data
        self.calls = []

    def select(self, columns):
        self.calls.append(("select", columns))
        return self

    def delete(self):
        self.calls.append(("delete",))
        return self

    def eq(self, column, value):
        self.calls.append(("eq", column, value))
        return self

    def limit(self, count):
        self.calls.append(("limit", count))
        return self

    def order(self, column, desc=False):
        self.calls.append(("order", column, desc))
        return self

    def execute(self):
        self.calls.append(("execute",))
        return FakeResponse(self._data)


class FakeClient:
    def __init__(self, data):
        self.builder = FakeQueryBuilder(data)

    def table(self, name):
        self.builder.calls.append(("table", name))
        return self.builder


def test_get_owned_document_filters_by_document_and_user():
    client = FakeClient(data=[{
        "id": "doc-1", "filename": "guide.pdf", "chroma_collection": "private-collection"
    }])
    repository = SupabaseDocumentRepository(client)

    document = repository.get_owned_document("doc-1", "user-1")

    assert document == OwnedDocument("doc-1", "guide.pdf", "private-collection")
    assert ("eq", "id", "doc-1") in client.builder.calls
    assert ("eq", "user_id", "user-1") in client.builder.calls
    assert ("limit", 1) in client.builder.calls


def test_get_owned_document_returns_none_for_no_match():
    repository = SupabaseDocumentRepository(FakeClient(data=[]))

    assert repository.get_owned_document("foreign", "user-1") is None


def test_list_documents_does_not_select_chroma_collection():
    client = FakeClient(data=[])

    SupabaseDocumentRepository(client).list_documents("user-1")

    selected = next(call[1] for call in client.builder.calls if call[0] == "select")
    assert "chroma_collection" not in selected


def test_delete_document_scopes_by_document_and_user():
    client = FakeClient(data=[])
    repository = SupabaseDocumentRepository(client)

    repository.delete_document("doc-1", "user-1")

    assert ("table", "user_documents") in client.builder.calls
    assert ("delete",) in client.builder.calls
    assert ("eq", "id", "doc-1") in client.builder.calls
    assert ("eq", "user_id", "user-1") in client.builder.calls
