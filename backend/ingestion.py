# backend/ingestion.py
import os
import uuid
import tempfile
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', 'sentence-transformers/all-MiniLM-L6-v2')
CHROMA_DB_PATH = os.getenv('CHROMA_DB_PATH', './chroma_store')
CHUNK_SIZE = int(os.getenv('CHUNK_SIZE', 500))
CHUNK_OVERLAP = int(os.getenv('CHUNK_OVERLAP', 50))

# Load the embedding model ONCE at module level (not per request)
embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)


def ingest_pdf(file_bytes: bytes, filename: str, user_id: str) -> dict:
    """
    Full ingestion pipeline:
    1. Write bytes to a temp file (PyPDFLoader needs a filepath)
    2. Load and parse each page
    3. Recursively split into chunks
    4. Embed each chunk and store in ChromaDB
    """
    # Step 1: Write to temp file
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        # Step 2: Load PDF pages
        loader = PyPDFLoader(tmp_path)
        pages = loader.load()  # List of Document objects, one per page

        # Step 3: Split into overlapping chunks
        # RecursiveCharacterTextSplitter tries to split on paragraphs first,
        # then sentences, then words — preserving semantic meaning.
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            separators=['\n\n', '\n', '. ', ' ', '']
        )
        chunks = splitter.split_documents(pages)

        # Add metadata to each chunk so we can cite page numbers later
        for i, chunk in enumerate(chunks):
            chunk.metadata['chunk_index'] = i
            chunk.metadata['filename'] = filename
            chunk.metadata['user_id'] = user_id

        # Step 4: Create a unique ChromaDB collection per document
        collection_name = f'doc_{user_id[:8]}_{uuid.uuid4().hex[:8]}'
        Chroma.from_documents(
            documents=chunks,
            embedding=embeddings,
            persist_directory=CHROMA_DB_PATH,
            collection_name=collection_name
        )

        return {
            'collection_name': collection_name,
            'chunk_count': len(chunks),
            'page_count': len(pages)
        }
    finally:
        os.unlink(tmp_path)  # Always clean up the temp file
