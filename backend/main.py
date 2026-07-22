# backend/main.py
from dotenv import load_dotenv
load_dotenv()  # Must run before any module-level os.getenv() in auth/ingestion/query/database

from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, model_validator
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
    document_id: str | None = None
    document_ids: list[str] | None = None

    @model_validator(mode='after')
    def validate_document_selection(self):
        if (self.document_id is None) == (self.document_ids is None):
            raise ValueError('Provide exactly one of document_id or document_ids')
        if self.document_ids is not None:
            if not 1 <= len(self.document_ids) <= 10:
                raise ValueError('Select between 1 and 10 documents')
            if len(set(self.document_ids)) != len(self.document_ids):
                raise ValueError('Duplicate document IDs are not allowed')
        return self

    @property
    def selected_document_ids(self) -> list[str]:
        return self.document_ids if self.document_ids is not None else [self.document_id]


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
    documents = document_repository.get_owned_documents(
        body.selected_document_ids, user_id
    )
    if documents is None:
        raise HTTPException(404, 'Document not found')

    result = query_document(body.question, documents, user_id=user_id)

    # Save the query to history
    supabase.table('query_logs').insert({
        'user_id': user_id,
        'document_id': body.selected_document_ids[0],
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
