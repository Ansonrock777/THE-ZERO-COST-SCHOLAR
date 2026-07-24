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

    def in_(self, column, values):
        self.calls.append(("in", column, values))
        return self

    def is_(self, column, value):
        self.calls.append(("is", column, value))
        return self

    def update(self, values):
        self.calls.append(("update", values))
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
    assert ("is", "deleted_at", "null") in client.builder.calls


def test_get_owned_document_returns_none_for_no_match():
    repository = SupabaseDocumentRepository(FakeClient(data=[]))

    assert repository.get_owned_document("foreign", "user-1") is None


def test_list_documents_does_not_select_chroma_collection():
    client = FakeClient(data=[])

    SupabaseDocumentRepository(client).list_documents("user-1")

    selected = next(call[1] for call in client.builder.calls if call[0] == "select")
    assert "chroma_collection" not in selected


<<<<<<< HEAD
def test_get_owned_documents_preserves_request_order():
    client = FakeClient(data=[
        {"id": "doc-b", "filename": "b.pdf", "chroma_collection": "collection-b"},
        {"id": "doc-a", "filename": "a.pdf", "chroma_collection": "collection-a"},
    ])
    repository = SupabaseDocumentRepository(client)

    documents = repository.get_owned_documents(["doc-a", "doc-b"], "user-1")

    assert [document.id for document in documents] == ["doc-a", "doc-b"]
    assert ("in", "id", ["doc-a", "doc-b"]) in client.builder.calls
    assert ("eq", "user_id", "user-1") in client.builder.calls


def test_get_owned_documents_returns_none_when_any_document_is_missing():
    client = FakeClient(data=[
        {"id": "doc-a", "filename": "a.pdf", "chroma_collection": "collection-a"},
    ])
    repository = SupabaseDocumentRepository(client)

    assert repository.get_owned_documents(["doc-a", "foreign"], "user-1") is None


def test_soft_delete_filters_by_owner_and_document():
    client = FakeClient(data=[{"id": "doc-a"}])
    repository = SupabaseDocumentRepository(client)

    assert repository.soft_delete_document("doc-a", "user-1") is True
    assert any(call[0] == "update" and "deleted_at" in call[1] for call in client.builder.calls)
    assert ("eq", "id", "doc-a") in client.builder.calls
=======
def test_delete_document_scopes_by_document_and_user():
    client = FakeClient(data=[])
    repository = SupabaseDocumentRepository(client)

    repository.delete_document("doc-1", "user-1")

    assert ("table", "user_documents") in client.builder.calls
    assert ("delete",) in client.builder.calls
    assert ("eq", "id", "doc-1") in client.builder.calls
>>>>>>> c47bfeb9ff1ca81127b0cc132698d99ad075ecf5
    assert ("eq", "user_id", "user-1") in client.builder.calls
