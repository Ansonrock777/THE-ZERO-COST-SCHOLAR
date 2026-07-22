# backend/main.py
from dotenv import load_dotenv
load_dotenv()  # Must run before any module-level os.getenv() in auth/ingestion/query/database

from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from auth import get_current_user
from document_repository import SupabaseDocumentRepository
from ingestion import ingest_pdf
from query import query_document
from database import supabase

app = FastAPI(title='Zero-Cost Scholar API', version='2.0')

app.add_middleware(CORSMiddleware,
    allow_origins=['http://localhost:5173'],  # React dev server
    allow_credentials=True,
    allow_methods=['*'], allow_headers=['*']
)

document_repository = SupabaseDocumentRepository(supabase)


class QueryRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    question: str
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
    document = document_repository.get_owned_document(body.document_id, user_id)
    if document is None:
        raise HTTPException(404, 'Document not found')

    result = query_document(body.question, document.chroma_collection)

    # Save the query to history
    supabase.table('query_logs').insert({
        'user_id': user_id,
        'document_id': body.document_id,
        'question': body.question,
        'answer': result['answer'],
        'sources': result['sources'],
        'model_used': result['model']
    }).execute()

    return result


@app.get('/documents')
async def list_documents(user_id: str = Depends(get_current_user)):
    return document_repository.list_documents(user_id)


@app.get('/history')
async def query_history(user_id: str = Depends(get_current_user)):
    logs = supabase.table('query_logs') \
        .select('*, user_documents(filename)') \
        .eq('user_id', user_id) \
        .order('created_at', desc=True).limit(50).execute()
    return logs.data
