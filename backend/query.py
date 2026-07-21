# backend/query.py
import os
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from openai import OpenAI  # OpenRouter uses the OpenAI SDK format
from retrieval import expand_with_neighbors, serialize_sources

embeddings = HuggingFaceEmbeddings(model_name=os.getenv('EMBEDDING_MODEL'))
CHROMA_DB_PATH = os.getenv('CHROMA_DB_PATH', './chroma_store')
TOP_K = int(os.getenv('TOP_K_RESULTS', 5))

# OpenRouter client — identical interface to OpenAI SDK
client = OpenAI(
    base_url='https://openrouter.ai/api/v1',
    api_key=os.getenv('OPENROUTER_API_KEY'),
)

SYSTEM_PROMPT = """
You are a precise document analyst. Answer the user's question using ONLY
the context chunks provided below. Each chunk has a [Source X] label.

Rules:
1. Cite your sources using [Source X] inline in your answer.
2. If the answer is not in the context, say: 'I cannot find this in the document.'
3. Do not use any external knowledge. Stay grounded in the provided text.
4. Be concise but complete.
"""


def query_document(question: str, collection_name: str) -> dict:
    # Phase 1: Retrieval — find the top-K most semantically similar chunks
    vectorstore = Chroma(
        persist_directory=CHROMA_DB_PATH,
        embedding_function=embeddings,
        collection_name=collection_name
    )
    semantic_results = vectorstore.similarity_search_with_score(question, k=TOP_K)
    results = expand_with_neighbors(vectorstore, semantic_results)
    sources = serialize_sources(results)

    # Build the context string with source labels
    context_parts = [f"{source['label']}\n{source['text']}" for source in sources]

    context = '\n\n---\n\n'.join(context_parts)

    # Phase 2: Generation — send context + question to the LLM
    response = client.chat.completions.create(
        model=os.getenv('LLM_MODEL', 'deepseek/deepseek-r1:free'),
        messages=[
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': f'Context:\n{context}\n\nQuestion: {question}'}
        ],
        temperature=0.1,  # Low temperature = more factual, less creative
        max_tokens=1024
    )

    return {
        'answer': response.choices[0].message.content,
        'sources': sources,
        'model': os.getenv('LLM_MODEL')
    }
