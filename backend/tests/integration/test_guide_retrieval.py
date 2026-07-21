import os
import math
import re
import sys
from collections import Counter
from pathlib import Path

import pytest
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter

sys.path.insert(0, str(Path(__file__).parents[2]))

from retrieval import expand_with_neighbors


pytestmark = pytest.mark.integration

GUIDE_PDF_PATH = os.getenv("GUIDE_PDF_PATH")
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", 500))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", 50))


class DeterministicLexicalEmbeddings:
    """Keeps the guide regression local while exercising Chroma retrieval."""

    def __init__(self, texts):
        documents = [self._tokens(text) for text in texts]
        self.vocabulary = {
            token: index
            for index, token in enumerate(sorted({token for document in documents for token in document}))
        }
        document_frequency = Counter(token for document in documents for token in set(document))
        total_documents = len(documents)
        self.idf = {
            token: math.log((total_documents + 1) / (frequency + 1)) + 1
            for token, frequency in document_frequency.items()
        }

    def embed_documents(self, texts):
        return [self._embed(text) for text in texts]

    def embed_query(self, text):
        return self._embed(text)

    def _embed(self, text):
        vector = [0.0] * len(self.vocabulary)
        for token, frequency in Counter(self._tokens(text)).items():
            if token in self.vocabulary:
                vector[self.vocabulary[token]] = frequency * self.idf[token]
        magnitude = math.sqrt(sum(value * value for value in vector))
        return [value / magnitude for value in vector] if magnitude else vector

    @staticmethod
    def _tokens(text):
        return re.findall(r"[a-z0-9]+", text.lower())


@pytest.mark.skipif(not GUIDE_PDF_PATH, reason="GUIDE_PDF_PATH is required for guide regression")
def test_milestone_four_tasks_are_retrieved_with_neighbors(tmp_path):
    guide_path = Path(GUIDE_PDF_PATH)
    assert guide_path.is_file(), f"Guide PDF does not exist: {guide_path}"

    pages = PyPDFLoader(str(guide_path)).load()
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_documents(pages)
    for index, chunk in enumerate(chunks):
        chunk.metadata["chunk_index"] = index
        chunk.metadata["filename"] = guide_path.name
        chunk.metadata["user_id"] = "integration-test-user"

    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=DeterministicLexicalEmbeddings([chunk.page_content for chunk in chunks]),
        persist_directory=str(tmp_path),
        collection_name="guide-retrieval-regression",
    )
    semantic_hits = vectorstore.similarity_search_with_score(
        "What are the tasks in Milestone 4 - Polish & Testing?", k=5
    )
    expanded = expand_with_neighbors(vectorstore, semantic_hits)
    expanded_text = "\n".join(document.page_content for document, _ in expanded).lower()

    assert re.search(
        r"task status\s+20\b.*\b21\b.*\b22\b.*\b23\b.*\b24\b",
        expanded_text,
        flags=re.DOTALL,
    )
    for expected_text in (
        "document selector",
        "loading spinners",
        "3 different pdfs",
        "verify rls",
        "model selector dropdown",
    ):
        assert expected_text in expanded_text
