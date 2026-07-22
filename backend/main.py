# backend/main.py
from dotenv import load_dotenv
load_dotenv()  # Must run before any module-level os.getenv() in auth/ingestion/query/database

import os
import uuid
import asyncio
import json
import math
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict, model_validator
from typing import Literal
from auth import get_current_user
from document_repository import SupabaseDocumentRepository
from conversation_repository import SupabaseConversationRepository
from ingestion import ingest_pdf
from query import query_document
from database import supabase
from pdf_storage import LocalPdfStorage
from rate_limit import SlidingWindowRateLimiter

app = FastAPI(title='Zero-Cost Scholar API', version='2.0')

app.add_middleware(CORSMiddleware,
    allow_origins=['http://localhost:5173'],  # React dev server
    allow_credentials=True,
    allow_methods=['*'], allow_headers=['*']
)

document_repository = SupabaseDocumentRepository(supabase)
conversation_repository = SupabaseConversationRepository(supabase)
pdf_storage = LocalPdfStorage(os.getenv('PDF_STORAGE_PATH', './data/pdfs'))
MAX_PDF_BYTES = int(os.getenv('MAX_PDF_BYTES', str(50 * 1024 * 1024)))
query_rate_limiter = SlidingWindowRateLimiter(int(os.getenv('QUERY_REQUESTS_PER_MINUTE', '30')))
upload_rate_limiter = SlidingWindowRateLimiter(int(os.getenv('UPLOADS_PER_MINUTE', '10')))


def enforce_rate_limit(limiter, user_id: str):
    if not limiter.allow(user_id):
        raise HTTPException(429, 'Rate limit exceeded. Try again shortly.')


class QueryRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    question: str
    document_id: str | None = None
    document_ids: list[str] | None = None
    conversation_id: str | None = None
    answer_style: Literal['concise', 'balanced', 'academic'] = 'balanced'

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


class ConversationCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    document_ids: list[str]
    title: str = 'New inquiry'


class ConversationUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    title: str | None = None
    pinned: bool | None = None
    document_ids: list[str] | None = None


@app.post('/upload')
async def upload_pdf(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user)  # JWT verified here
):
    enforce_rate_limit(upload_rate_limiter, user_id)
    if not file.filename.endswith('.pdf'):
        raise HTTPException(400, 'Only PDF files are accepted')

    file_bytes = await file.read()
    if len(file_bytes) > MAX_PDF_BYTES:
        raise HTTPException(413, 'PDF exceeds the 50 MB upload limit')
    document_id = str(uuid.uuid4())
    pdf_storage.save(user_id, document_id, file_bytes)
    try:
        result = ingest_pdf(file_bytes, file.filename, user_id)
        record = supabase.table('user_documents').insert({
            'id': document_id,
            'user_id': user_id,
            'filename': file.filename,
            'file_size': len(file_bytes),
            'chunk_count': result['chunk_count'],
            'chroma_collection': result['collection_name']
        }).execute()
    except Exception:
        pdf_storage.delete(user_id, document_id)
        raise

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
    enforce_rate_limit(query_rate_limiter, user_id)
    documents = document_repository.get_owned_documents(
        body.selected_document_ids, user_id
    )
    if documents is None:
        raise HTTPException(404, 'Document not found')

    conversation = []
    if body.conversation_id is not None:
        owned_conversation = conversation_repository.get_owned_conversation(
            body.conversation_id, user_id
        )
        if owned_conversation is None:
            raise HTTPException(404, 'Conversation not found')
        conversation = conversation_repository.recent_messages(
            body.conversation_id, user_id, limit=6
        )
        query_options = {'user_id': user_id}
        if body.answer_style != 'balanced':
            query_options['answer_style'] = body.answer_style
        result = query_document(
            body.question, documents, conversation=conversation, **query_options
        )
        conversation_repository.add_message(
            body.conversation_id, user_id, 'user', body.question
        )
        conversation_repository.add_message(
            body.conversation_id,
            user_id,
            'assistant',
            result['answer'],
            result['sources'],
            result.get('trace_id'),
        )
        conversation_repository.update_conversation(
            body.conversation_id,
            user_id,
            document_ids=body.selected_document_ids,
        )
    else:
        query_options = {'user_id': user_id}
        if body.answer_style != 'balanced':
            query_options['answer_style'] = body.answer_style
        result = query_document(body.question, documents, **query_options)

    # Save the query to history
    supabase.table('query_logs').insert({
        'user_id': user_id,
        'document_id': body.selected_document_ids[0],
        'question': body.question,
        'answer': result['answer'],
        'sources': result['sources'],
        'model_used': result['model'],
        'document_ids': body.selected_document_ids,
        'document_snapshot': [
            {'id': document.id, 'filename': document.filename}
            for document in documents
        ],
        'trace_id': result.get('trace_id'),
    }).execute()

    return result


@app.post('/query/stream')
async def stream_question(
    body: QueryRequest,
    user_id: str = Depends(get_current_user),
):
    enforce_rate_limit(query_rate_limiter, user_id)
    """Stream coarse pipeline progress, then the complete grounded answer."""
    async def events():
        yield json.dumps({'type': 'status', 'stage': 'validating'}) + '\n'
        documents = document_repository.get_owned_documents(body.selected_document_ids, user_id)
        if documents is None:
            yield json.dumps({'type': 'error', 'detail': 'Document not found'}) + '\n'
            return
        conversation = []
        if body.conversation_id:
            owned = conversation_repository.get_owned_conversation(body.conversation_id, user_id)
            if owned is None:
                yield json.dumps({'type': 'error', 'detail': 'Conversation not found'}) + '\n'
                return
            conversation = conversation_repository.recent_messages(body.conversation_id, user_id, limit=6)
        yield json.dumps({'type': 'status', 'stage': 'retrieving'}) + '\n'
        yield json.dumps({'type': 'status', 'stage': 'generating'}) + '\n'
        try:
            query_options = {'user_id': user_id}
            if body.answer_style != 'balanced':
                query_options['answer_style'] = body.answer_style
            result = await asyncio.to_thread(
                query_document, body.question, documents,
                conversation, **query_options,
            )
            if body.conversation_id:
                conversation_repository.add_message(body.conversation_id, user_id, 'user', body.question)
                conversation_repository.add_message(
                    body.conversation_id, user_id, 'assistant', result['answer'],
                    result['sources'], result.get('trace_id'),
                )
                conversation_repository.update_conversation(
                    body.conversation_id, user_id, document_ids=body.selected_document_ids,
                )
            supabase.table('query_logs').insert({
                'user_id': user_id,
                'document_id': body.selected_document_ids[0],
                'question': body.question,
                'answer': result['answer'],
                'sources': result['sources'],
                'model_used': result['model'],
                'document_ids': body.selected_document_ids,
                'document_snapshot': [
                    {'id': document.id, 'filename': document.filename}
                    for document in documents
                ],
                'trace_id': result.get('trace_id'),
            }).execute()
            yield json.dumps({'type': 'result', **result}) + '\n'
        except Exception as error:
            yield json.dumps({'type': 'error', 'detail': type(error).__name__}) + '\n'

    return StreamingResponse(events(), media_type='application/x-ndjson')


@app.post('/documents/{document_id}/summary')
async def summarize_document(
    document_id: str,
    user_id: str = Depends(get_current_user),
):
    enforce_rate_limit(query_rate_limiter, user_id)
    document = document_repository.get_owned_document(document_id, user_id)
    if document is None:
        raise HTTPException(404, 'Document not found')
    result = await asyncio.to_thread(
        query_document,
        'Summarize this document in one concise paragraph, covering its purpose, main ideas, and conclusion.',
        [document],
        user_id=user_id,
    )
    summary = ' '.join(result['answer'].split())
    document_repository.save_summary(document_id, user_id, summary)
    return {'document_id': document_id, 'summary': summary, 'trace_id': result.get('trace_id')}


@app.get('/developer/telemetry')
async def developer_telemetry(user_id: str = Depends(get_current_user)):
    if os.getenv('DEV_MODE', '').lower() not in {'1', 'true', 'yes'}:
        raise HTTPException(404, 'Not found')
    store = __import__('query').default_dependencies().telemetry_store
    traces = [trace for trace in store.recent(limit=100) if trace['user_id'] == user_id]
    metric_names = sorted({name for trace in traces for name in trace['metrics']})
    aggregates = {}
    for name in metric_names:
        values = sorted(float(trace['metrics'][name]) for trace in traces if name in trace['metrics'])
        index = max(0, math.ceil(len(values) * .95) - 1)
        aggregates[name] = {
            'count': len(values),
            'average': sum(values) / len(values),
            'p95': values[index],
        }
    return {
        'traces': traces,
        'aggregates': aggregates,
    }


@app.get('/documents')
async def list_documents(user_id: str = Depends(get_current_user)):
    return document_repository.list_documents(user_id)


@app.get('/documents/{document_id}/file')
async def get_document_file(
    document_id: str,
    user_id: str = Depends(get_current_user),
):
    document = document_repository.get_owned_document(document_id, user_id)
    if document is None:
        raise HTTPException(404, 'Document not found')
    path = pdf_storage.path_for(user_id, document_id)
    if not path.is_file():
        raise HTTPException(404, 'PDF file not found')
    return FileResponse(path, media_type='application/pdf', filename=document.filename)


@app.delete('/documents/{document_id}')
async def delete_document(
    document_id: str,
    user_id: str = Depends(get_current_user),
):
    document = document_repository.get_owned_document(document_id, user_id)
    if document is None:
        raise HTTPException(404, 'Document not found')
    if not document_repository.soft_delete_document(document_id, user_id):
        raise HTTPException(404, 'Document not found')
    pdf_storage.delete(user_id, document_id)
    return {'deleted': True, 'document_id': document_id}


@app.get('/history')
async def query_history(user_id: str = Depends(get_current_user)):
    logs = supabase.table('query_logs') \
        .select('*, user_documents(filename)') \
        .eq('user_id', user_id) \
        .order('created_at', desc=True).limit(50).execute()
    return logs.data


@app.get('/conversations')
async def list_conversations(user_id: str = Depends(get_current_user)):
    return conversation_repository.list_conversations(user_id)


@app.post('/conversations')
async def create_conversation(
    body: ConversationCreate,
    user_id: str = Depends(get_current_user),
):
    documents = document_repository.get_owned_documents(body.document_ids, user_id)
    if documents is None:
        raise HTTPException(404, 'Document not found')
    return conversation_repository.create_conversation(
        user_id, body.document_ids, body.title
    )


@app.patch('/conversations/{conversation_id}')
async def update_conversation(
    conversation_id: str,
    body: ConversationUpdate,
    user_id: str = Depends(get_current_user),
):
    if body.document_ids is not None:
        documents = document_repository.get_owned_documents(body.document_ids, user_id)
        if documents is None:
            raise HTTPException(404, 'Document not found')
    updated = conversation_repository.update_conversation(
        conversation_id,
        user_id,
        title=body.title,
        pinned=body.pinned,
        document_ids=body.document_ids,
    )
    if not updated:
        raise HTTPException(404, 'Conversation not found')
    return {'updated': True, 'conversation_id': conversation_id}


@app.delete('/conversations/{conversation_id}')
async def delete_conversation(
    conversation_id: str,
    user_id: str = Depends(get_current_user),
):
    if not conversation_repository.delete_conversation(conversation_id, user_id):
        raise HTTPException(404, 'Conversation not found')
    return {'deleted': True, 'conversation_id': conversation_id}


@app.get('/conversations/{conversation_id}/messages')
async def list_conversation_messages(
    conversation_id: str,
    user_id: str = Depends(get_current_user),
):
    if conversation_repository.get_owned_conversation(conversation_id, user_id) is None:
        raise HTTPException(404, 'Conversation not found')
    return conversation_repository.recent_messages(conversation_id, user_id, limit=100)
