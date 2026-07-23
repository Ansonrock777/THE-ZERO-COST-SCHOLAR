# backend/main.py
from dotenv import load_dotenv
load_dotenv()  # Must run before any module-level os.getenv() in auth/ingestion/query/database

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from auth import get_current_user
from document_repository import SupabaseDocumentRepository
from ingestion import ingest_pdf, delete_collection
from query import query_document
from database import supabase
from guardrails import check_question, enforce_rate_limit, GuardrailError, MAX_RAW_QUESTION_LENGTH
from storage import ensure_bucket_exists, upload_document_pdf, download_document_pdf, delete_document_pdf

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_bucket_exists(supabase)
    yield


app = FastAPI(title='Zero-Cost Scholar API', version='2.0', lifespan=lifespan)

app.add_middleware(CORSMiddleware,
    allow_origins=['http://localhost:5173'],  # React dev server
    allow_credentials=True,
    allow_methods=['*'], allow_headers=['*']
)

document_repository = SupabaseDocumentRepository(supabase)


class QueryRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    # min_length/max_length here are the cheap first layer: they reject empty
    # and multi-KB payloads at parse time (422) before any work. guardrails.
    # check_question() enforces the real post-strip bounds and injection checks.
    question: str = Field(min_length=1, max_length=MAX_RAW_QUESTION_LENGTH)
    document_id: str  # UUID from user_documents table


@app.post('/upload')
async def upload_pdf(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user)  # JWT verified here
):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(400, 'Only PDF files are accepted')

    file_bytes = await file.read()
    result = ingest_pdf(file_bytes, file.filename, user_id)

    # Log the upload to Supabase
    record = supabase.table('user_documents').insert({
        'user_id': user_id,
        'filename': file.filename,
        'file_size': len(file_bytes),
        'chunk_count': result['chunk_count'],
        'chroma_collection': result['collection_name']
    }).execute()

    # Best-effort: the PDF preview is an enhancement, embeddings are the core
    # feature, so a storage outage shouldn't fail the upload itself.
    try:
        upload_document_pdf(supabase, user_id, record.data[0]['id'], file_bytes)
    except Exception:
        logger.warning('Failed to store PDF for document %s', record.data[0]['id'], exc_info=True)

    return {
        'document_id': record.data[0]['id'],
        'filename': file.filename,
        'chunk_count': result['chunk_count'],
        'page_count': result['page_count']
    }


@app.post('/query')
async def ask_question(
    body: QueryRequest,
    user_id: str = Depends(get_current_user)
):
    # Guardrails run before any expensive retrieval/LLM work. Rate limit first
    # (cheapest), then validate + sanitise the question (length, control chars,
    # prompt-injection). GuardrailError carries its own HTTP status.
    try:
        enforce_rate_limit(user_id)
        question = check_question(body.question)
    except GuardrailError as exc:
        raise HTTPException(exc.status_code, exc.message)

    document = document_repository.get_owned_document(body.document_id, user_id)
    if document is None:
        raise HTTPException(404, 'Document not found')

    result = query_document(question, document.chroma_collection)

    # Save the query to history
    supabase.table('query_logs').insert({
        'user_id': user_id,
        'document_id': body.document_id,
        'question': question,
        'answer': result['answer'],
        'sources': result['sources'],
        'model_used': result['model']
    }).execute()

    return result


@app.get('/documents')
async def list_documents(user_id: str = Depends(get_current_user)):
    return document_repository.list_documents(user_id)


@app.get('/documents/{document_id}/file')
async def get_document_file(document_id: str, user_id: str = Depends(get_current_user)):
    document = document_repository.get_owned_document(document_id, user_id)
    if document is None:
        raise HTTPException(404, 'Document not found')

    pdf_bytes = download_document_pdf(supabase, user_id, document_id)
    if pdf_bytes is None:
        raise HTTPException(404, 'PDF file not available for this document')

    return Response(content=pdf_bytes, media_type='application/pdf')


@app.delete('/documents/{document_id}')
async def delete_document(document_id: str, user_id: str = Depends(get_current_user)):
    document = document_repository.get_owned_document(document_id, user_id)
    if document is None:
        raise HTTPException(404, 'Document not found')

    # Drop the DB row first (also cascades query_logs) — that's what makes
    # the document actually gone from the user's perspective. Embeddings and
    # the stored PDF are internal cleanup; a failure there shouldn't undo it.
    document_repository.delete_document(document_id, user_id)

    try:
        delete_collection(document.chroma_collection)
    except Exception:
        logger.warning('Failed to delete Chroma collection %s', document.chroma_collection, exc_info=True)

    try:
        delete_document_pdf(supabase, user_id, document_id)
    except Exception:
        logger.warning('Failed to delete stored PDF for document %s', document_id, exc_info=True)

    return {'deleted': True}


@app.get('/history')
async def query_history(user_id: str = Depends(get_current_user)):
    logs = supabase.table('query_logs') \
        .select('*, user_documents(filename)') \
        .eq('user_id', user_id) \
        .order('created_at', desc=True).limit(50).execute()
    return logs.data
