from dataclasses import dataclass

from retrieval import expand_with_neighbors, one_based_page, serialize_sources


@dataclass
class FakeDocument:
    page_content: str
    metadata: dict


def doc(chunk_index, text, page):
    return FakeDocument(text, {"chunk_index": chunk_index, "page": page})


class FakeVectorStore:
    def __init__(self, documents):
        self.documents = documents
        self.get_calls = 0
        self.requested_indexes = []

    def get(self, where, include):
        self.get_calls += 1
        self.requested_indexes = where["chunk_index"]["$in"]
        requested = set(self.requested_indexes)
        matching = [
            document for document in self.documents
            if document.metadata["chunk_index"] in requested
        ]
        return {
            "documents": [document.page_content for document in matching],
            "metadatas": [document.metadata for document in matching],
        }


def test_expands_each_semantic_hit_with_ordered_neighbors_and_deduplicates():
    hits = [(doc(2, "two", page=0), 0.2), (doc(3, "three", page=0), 0.3)]
    store = FakeVectorStore([
        doc(1, "one", 0), doc(2, "two", 0), doc(3, "three", 0), doc(4, "four", 1)
    ])

    expanded = expand_with_neighbors(store, hits)

    assert [(item.metadata["chunk_index"], score) for item, score in expanded] == [
        (1, None), (2, 0.2), (3, 0.3), (4, None)
    ]
    assert store.requested_indexes == [1, 2, 3, 4]


def test_chunk_zero_does_not_request_or_emit_a_negative_neighbor():
    hits = [(doc(0, "zero", page=0), 0.2)]
    store = FakeVectorStore([doc(0, "zero", 0), doc(1, "one", 0)])

    expanded = expand_with_neighbors(store, hits)

    assert store.requested_indexes == [0, 1]
    assert [(item.metadata["chunk_index"], score) for item, score in expanded] == [
        (0, 0.2), (1, None)
    ]


def test_missing_chunk_index_keeps_semantic_hit_without_get():
    hit = FakeDocument("anchor", {"page": 0})
    store = FakeVectorStore([])

    assert expand_with_neighbors(store, [(hit, 0.4)]) == [(hit, 0.4)]
    assert store.get_calls == 0


def test_boolean_chunk_index_is_not_used_for_neighbor_lookup():
    hit = FakeDocument("anchor", {"chunk_index": True, "page": 0})
    store = FakeVectorStore([])

    assert expand_with_neighbors(store, [(hit, 0.4)]) == [(hit, 0.4)]
    assert store.get_calls == 0


def test_negative_chunk_index_is_not_used_for_neighbor_lookup():
    hit = FakeDocument("anchor", {"chunk_index": -1, "page": 0})
    store = FakeVectorStore([])

    assert expand_with_neighbors(store, [(hit, 0.4)]) == [(hit, 0.4)]
    assert store.get_calls == 0


def test_page_numbers_are_one_based_and_unknown_is_preserved():
    assert one_based_page({"page": 0}) == 1
    assert one_based_page({"page": 23}) == 24
    assert one_based_page({}) == "?"


def test_serialize_sources_keeps_neighbor_score_null():
    sources = serialize_sources([(doc(0, "neighbor", page=0), None)])

    assert sources == [{
        "label": "[Source 1]",
        "text": "neighbor",
        "page": 1,
        "score": None,
    }]
