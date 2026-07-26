# Fix Test Findings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the document-authorization gap, make retrieval boundary-aware, correct citations and pages, add saved-document selection, and remove the Vite advisory without changing OpenRouter behavior.

**Architecture:** Browser requests identify a document only by its database ID. An application-owned repository maps Supabase rows into internal document records and the API derives the Chroma collection after an ownership lookup. A pure retrieval helper expands semantic hits with adjacent chunk indexes before the existing OpenRouter generation boundary.

**Tech Stack:** Python 3, FastAPI, Pydantic 2, Supabase Python, LangChain Chroma, Pytest, React 18, Axios, Vitest, Testing Library, Vite 8.

## Global Constraints

- Do not change the OpenRouter client, base URL, API-key handling, `LLM_MODEL`, system prompt, temperature, token limit, or completion-call parameters.
- Do not add a model selector or models endpoint.
- Use `404 Document not found` for both absent and foreign documents.
- Never accept or return a Chroma collection name through the browser-facing API.
- Vite must resolve to 8.1.5 and `@vitejs/plugin-react` to 6.0.3; Node must remain at least 22.12 (the current runtime is 22.17.1).
- External tests must remain read-only: no Supabase users, document rows, or query logs may be created by verification.

## Provider boundaries

- **Supabase interface owned by the app:** `DocumentRepository` consumes document/user IDs and returns normalized `OwnedDocument` or document-summary dictionaries. `SupabaseDocumentRepository` contains PostgREST field names and response mapping.
- **Chroma interface owned by the app:** `expand_with_neighbors(vectorstore, semantic_hits)` consumes only `similarity_search_with_score()` results plus `vectorstore.get()` and returns normalized `(document, score_or_none)` pairs.
- **Mapping tests:** captured redacted in-memory responses cover Supabase `data` lists and Chroma column-oriented `documents`/`metadatas` results.
- **Liveness checks:** final verification performs a read-only Supabase select and a local real-Chroma retrieval regression separately from unit tests.
- **Failure behavior:** missing Supabase data maps to `None` and a 404; Supabase exceptions remain server errors; malformed/missing Chroma metadata keeps the semantic hit and skips expansion; provider timeouts/errors propagate through the existing FastAPI error path.
- **Configuration boundary:** the existing `database.py` creates the Supabase client and `CHROMA_DB_PATH` selects Chroma storage. Business logic receives repository/vector-store objects rather than provider credentials.

---

### Task 1: Secure the query boundary with an owned-document repository

**Files:**
- Create: `backend/document_repository.py`
- Create: `backend/tests/test_document_repository.py`
- Create: `backend/tests/test_main_query_authorization.py`
- Create: `backend/requirements-dev.txt`
- Modify: `backend/main.py`

**Interfaces:**
- Produces: `OwnedDocument(id: str, filename: str, chroma_collection: str)`.
- Produces: `DocumentRepository.get_owned_document(document_id: str, user_id: str) -> OwnedDocument | None`.
- Produces: `DocumentRepository.list_documents(user_id: str) -> list[dict]`.
- Changes: `QueryRequest` contains only `question` and `document_id` and forbids extra fields.

- [ ] **Step 1: Add the backend test dependency declaration**

Create `backend/requirements-dev.txt`:

```text
-r requirements.txt
pytest>=8,<9
pytest-asyncio>=0.23,<2
```

Install it with the existing shared virtual environment:

```powershell
& 'C:\Users\ronan\OneDrive\Documents\GitHub\THE-ZERO-COST-SCHOLAR\backend\venv\Scripts\python.exe' -m pip install -r requirements-dev.txt
```

Expected: installation exits 0 and `python -m pytest --version` reports pytest 8.x.

- [ ] **Step 2: Write failing repository mapping tests**

Create `backend/tests/test_document_repository.py` with a fluent fake query builder that records `.select()`, `.eq()`, `.limit()`, and `.order()` calls. Add these tests:

```python
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
```

- [ ] **Step 3: Run the repository tests and observe the expected failure**

Run:

```powershell
python -m pytest tests/test_document_repository.py -q
```

Expected: collection fails because `document_repository` does not exist.

- [ ] **Step 4: Implement the repository adapter**

Create `backend/document_repository.py` with:

```python
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class OwnedDocument:
    id: str
    filename: str
    chroma_collection: str


class DocumentRepository(Protocol):
    def get_owned_document(self, document_id: str, user_id: str) -> OwnedDocument | None: ...
    def list_documents(self, user_id: str) -> list[dict]: ...


class SupabaseDocumentRepository:
    def __init__(self, client):
        self._client = client

    def get_owned_document(self, document_id: str, user_id: str) -> OwnedDocument | None:
        response = (
            self._client.table("user_documents")
            .select("id,filename,chroma_collection")
            .eq("id", document_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not response.data:
            return None
        row = response.data[0]
        return OwnedDocument(str(row["id"]), row["filename"], row["chroma_collection"])

    def list_documents(self, user_id: str) -> list[dict]:
        response = (
            self._client.table("user_documents")
            .select("id,filename,file_size,chunk_count,created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return response.data
```

- [ ] **Step 5: Run the repository tests until green**

Run `python -m pytest tests/test_document_repository.py -q`.

Expected: 3 passed.

- [ ] **Step 6: Write failing route-orchestration tests**

Create `backend/tests/test_main_query_authorization.py`. Load `main.py` with stubbed `ingestion`, `query`, and `database` modules so importing the route does not initialize embedding or network clients. Test the route function directly:

```python
@pytest.mark.asyncio
async def test_foreign_document_is_rejected_before_query_or_logging(app_module):
    app_module.document_repository = FakeRepository(document=None)
    app_module.query_document = Mock()
    app_module.supabase = FakeLoggingClient()

    with pytest.raises(HTTPException) as error:
        await app_module.ask_question(
            app_module.QueryRequest(question="secret?", document_id="foreign"),
            user_id="attacker",
        )

    assert error.value.status_code == 404
    assert error.value.detail == "Document not found"
    app_module.query_document.assert_not_called()
    assert app_module.supabase.inserted == []


@pytest.mark.asyncio
async def test_owner_query_uses_server_collection_and_logs(app_module):
    app_module.document_repository = FakeRepository(
        document=OwnedDocument("doc-1", "guide.pdf", "stored-collection")
    )
    app_module.query_document = Mock(return_value={
        "answer": "answer", "sources": [], "model": "configured-model"
    })
    app_module.supabase = FakeLoggingClient()

    await app_module.ask_question(
        app_module.QueryRequest(question="question", document_id="doc-1"),
        user_id="owner",
    )

    app_module.query_document.assert_called_once_with("question", "stored-collection")
    assert app_module.supabase.inserted[0]["document_id"] == "doc-1"


def test_query_request_rejects_collection_name(app_module):
    with pytest.raises(ValidationError):
        app_module.QueryRequest(
            question="question", document_id="doc-1", collection_name="client-value"
        )
```

- [ ] **Step 7: Run authorization tests and observe failure**

Run `python -m pytest tests/test_main_query_authorization.py -q`.

Expected: failures show that the current request requires `collection_name` and performs no repository lookup.

- [ ] **Step 8: Update the FastAPI routes**

In `backend/main.py`:

```python
from pydantic import BaseModel, ConfigDict
from document_repository import SupabaseDocumentRepository

document_repository = SupabaseDocumentRepository(supabase)


class QueryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: str
    document_id: str
```

At the start of `ask_question`:

```python
document = document_repository.get_owned_document(body.document_id, user_id)
if document is None:
    raise HTTPException(404, "Document not found")
result = query_document(body.question, document.chroma_collection)
```

Return upload metadata without `collection_name`, and replace `/documents` implementation with `return document_repository.list_documents(user_id)`.

- [ ] **Step 9: Run the focused and full backend suites**

Run:

```powershell
python -m pytest tests/test_document_repository.py tests/test_main_query_authorization.py -q
python -m pytest -q
```

Expected: all tests pass.

- [ ] **Step 10: Commit the authorization fix**

```powershell
git add backend/document_repository.py backend/main.py backend/requirements-dev.txt backend/tests
git commit -m "fix: enforce document ownership on queries"
```

---

### Task 2: Expand semantic hits with adjacent chunks and normalize pages

**Files:**
- Create: `backend/retrieval.py`
- Create: `backend/tests/test_retrieval.py`
- Modify: `backend/query.py`

**Interfaces:**
- Produces: `expand_with_neighbors(vectorstore, semantic_hits) -> list[tuple[document, float | None]]`.
- Produces: `one_based_page(metadata: dict) -> int | str`.
- Produces: `serialize_sources(results) -> list[dict]` with labels, text, one-based pages, and nullable distances.
- Consumes: a vector store whose `get(where=..., include=["documents", "metadatas"])` returns aligned lists.

- [ ] **Step 1: Write failing pure retrieval tests**

Create `backend/tests/test_retrieval.py` using a small `FakeDocument` dataclass and `FakeVectorStore`. Cover:

```python
def test_expands_each_semantic_hit_with_ordered_neighbors_and_deduplicates():
    hits = [(doc(2, "two", page=0), 0.2), (doc(3, "three", page=0), 0.3)]
    store = FakeVectorStore([doc(1, "one", 0), doc(2, "two", 0), doc(3, "three", 0), doc(4, "four", 1)])

    expanded = expand_with_neighbors(store, hits)

    assert [(item.metadata["chunk_index"], score) for item, score in expanded] == [
        (1, None), (2, 0.2), (3, 0.3), (4, None)
    ]
    assert store.requested_indexes == [1, 2, 3, 4]


def test_missing_chunk_index_keeps_semantic_hit_without_get():
    hit = FakeDocument("anchor", {"page": 0})
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
```

- [ ] **Step 2: Run the test and observe the expected import failure**

Run `python -m pytest tests/test_retrieval.py -q`.

Expected: collection fails because `retrieval` does not exist.

- [ ] **Step 3: Implement the pure retrieval helper**

Create `backend/retrieval.py`. Parse integer chunk indexes without treating booleans as integers. Build one batch `$in` request, align returned documents/metadatas into an index map, then iterate semantic hits in rank order and neighbor indexes in `(n - 1, n, n + 1)` order. Prefer the original semantic document for `n`; give a chunk its semantic score if it is any anchor hit, otherwise `None`. If no valid indexes exist, return semantic hits unchanged.

The page helper is:

```python
def one_based_page(metadata: dict):
    page = metadata.get("page")
    return page + 1 if isinstance(page, int) and not isinstance(page, bool) else "?"
```

`serialize_sources` enumerates the expanded results from one, assigns `[Source N]`, copies `page_content`, calls `one_based_page`, and rounds only non-null scores to four decimal places.

- [ ] **Step 4: Run the retrieval tests until green**

Run `python -m pytest tests/test_retrieval.py -q`.

Expected: all retrieval tests pass.

- [ ] **Step 5: Integrate expansion without changing OpenRouter configuration**

In `backend/query.py`, import the helpers, rename the initial result to `semantic_results`, expand it, and serialize it:

```python
semantic_results = vectorstore.similarity_search_with_score(question, k=TOP_K)
results = expand_with_neighbors(vectorstore, semantic_results)
sources = serialize_sources(results)
```

Build `context_parts` from the serialized records so labels in the prompt and API stay identical:

```python
context_parts = [f"{source['label']}\n{source['text']}" for source in sources]
```

Do not edit the `OpenAI(...)` constructor, `SYSTEM_PROMPT`, model expression, messages, temperature, or max-token settings.

- [ ] **Step 6: Run focused and full backend tests**

Run:

```powershell
python -m pytest tests/test_retrieval.py -q
python -m pytest -q
```

Expected: all tests pass.

- [ ] **Step 7: Commit retrieval changes**

```powershell
git add backend/retrieval.py backend/query.py backend/tests
git commit -m "fix: expand rag retrieval across chunk boundaries"
```

---

### Task 3: Correct citation whitespace and source-card semantics

**Files:**
- Create: `frontend/src/components/Dashboard/FormattedAnswer.test.jsx`
- Create: `frontend/src/components/Dashboard/SourceChunks.test.jsx`
- Create: `frontend/src/test/setup.js`
- Modify: `frontend/src/components/Dashboard/FormattedAnswer.jsx`
- Modify: `frontend/src/components/Dashboard/SourceChunks.jsx`
- Modify: `frontend/vite.config.js`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

**Interfaces:**
- `FormattedAnswer` recognizes `[Source<Unicode whitespace>N]` and `【N】`.
- `SourceChunks` treats numeric `score` as distance and null `score` as adjacent context.

- [ ] **Step 1: Install test tooling and secure Vite versions**

Run:

```powershell
npm install --save-dev vite@8.1.5 @vitejs/plugin-react@6.0.3 vitest@latest jsdom@latest @testing-library/react@latest @testing-library/jest-dom@latest
```

Add `"test": "vitest run"` to scripts and add this block to `vite.config.js`:

```js
test: {
  environment: 'jsdom',
  setupFiles: './src/test/setup.js',
}
```

Create `frontend/src/test/setup.js`:

```js
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 2: Write failing citation and source-card tests**

`FormattedAnswer.test.jsx` must render `Answer [Source\u202f2]`, assert badge text `2` exists, and assert the raw source marker is absent. It must also assert `stripMarkdown('Answer [Source\u00a02]') === 'Answer'`.

`SourceChunks.test.jsx` must render page `1` with `score: null` and assert `Page 1` plus `adjacent context`, then render `score: 0.25` and assert `distance 0.25`.

- [ ] **Step 3: Run tests and observe failures**

Run:

```powershell
npm test -- --run src/components/Dashboard/FormattedAnswer.test.jsx src/components/Dashboard/SourceChunks.test.jsx
```

Expected: Unicode citation and adjacent-context assertions fail.

- [ ] **Step 4: Implement citation and source-card corrections**

Change the citation expression to:

```js
const CITATION_RE = /\[Source\s+(\d+)\]|【(\d+)】/gu
```

In `SourceChunks`, replace the current relevance text with:

```jsx
<span className='text-slate-400'>
  {typeof source.score === 'number' ? `distance ${source.score}` : 'adjacent context'}
</span>
```

- [ ] **Step 5: Run focused tests and the production build**

Run:

```powershell
npm test -- --run src/components/Dashboard/FormattedAnswer.test.jsx src/components/Dashboard/SourceChunks.test.jsx
npm run build
```

Expected: tests pass and Vite 8.1.5 produces `dist/`.

- [ ] **Step 6: Commit citation, page-card, and toolchain changes**

```powershell
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js frontend/src/test frontend/src/components/Dashboard/FormattedAnswer.jsx frontend/src/components/Dashboard/FormattedAnswer.test.jsx frontend/src/components/Dashboard/SourceChunks.jsx frontend/src/components/Dashboard/SourceChunks.test.jsx
git commit -m "fix: normalize citations and update vite"
```

---

### Task 4: Add the saved-document selector and safe query payload

**Files:**
- Create: `frontend/src/components/Dashboard/DocumentSelector.jsx`
- Create: `frontend/src/components/Dashboard/DocumentSelector.test.jsx`
- Create: `frontend/src/components/Dashboard/Dashboard.test.jsx`
- Create: `frontend/src/components/Dashboard/QueryPanel.test.jsx`
- Modify: `frontend/src/components/Dashboard/Dashboard.jsx`
- Modify: `frontend/src/components/Dashboard/QueryPanel.jsx`

**Interfaces:**
- `DocumentSelector({ documents, selectedId, onChange, loading, error })` emits a document ID.
- `createQueryPayload(question, document) -> { question, document_id }`.
- Upload responses use `{ document_id, filename, chunk_count, page_count }`.

- [ ] **Step 1: Write failing selector and payload tests**

`DocumentSelector.test.jsx` renders two documents, asserts a visible `Document` label, changes the native select, and checks `onChange('doc-2')`.

`QueryPanel.test.jsx` imports `createQueryPayload` and asserts:

```js
expect(createQueryPayload('Question?', {
  document_id: 'doc-1',
  collection_name: 'must-not-leak',
})).toEqual({ question: 'Question?', document_id: 'doc-1' })
```

`Dashboard.test.jsx` mocks `api.get('/documents')` with newest-first rows, asserts the newest is selected after loading, invokes a mocked upload callback, and asserts the uploaded document becomes selected.

- [ ] **Step 2: Run tests and observe failures**

Run:

```powershell
npm test -- --run src/components/Dashboard/DocumentSelector.test.jsx src/components/Dashboard/QueryPanel.test.jsx src/components/Dashboard/Dashboard.test.jsx
```

Expected: failures because the selector and safe payload helper do not exist and Dashboard does not load documents.

- [ ] **Step 3: Implement the selector**

Create a labeled native select with these states:

```jsx
if (loading) return <p role='status'>Loading documents...</p>
if (error) return <p role='alert'>{error}</p>
if (documents.length === 0) return <p>No uploaded documents yet.</p>
```

The select must use `id='document-selector'`, `value={selectedId}`, and `onChange={event => onChange(event.target.value)}`. Keep the existing slate visual language, keyboard behavior, and a minimum 40-pixel control height.

- [ ] **Step 4: Load and manage documents in Dashboard**

Use `useEffect` to call `/documents`, normalize each row to `document_id: row.id`, store newest-first results, and select the first ID. On upload, prepend/replace the uploaded record and set its ID as selected. Derive `currentDocument` from the list and render `DocumentSelector` before `QueryPanel`.

- [ ] **Step 5: Remove collection names from query payloads**

Export and use:

```js
export function createQueryPayload(question, document) {
  return { question, document_id: document.document_id }
}
```

Replace the current inline request body with `createQueryPayload(question, document)`.

- [ ] **Step 6: Run selector tests and full frontend checks**

Run:

```powershell
npm test
npm run build
```

Expected: all tests pass and the production build succeeds.

- [ ] **Step 7: Commit document-selector changes**

```powershell
git add frontend/src/components/Dashboard
git commit -m "feat: add saved document selector"
```

---

### Task 5: Run real-data regressions, security checks, and final review

**Files:**
- Create: `backend/tests/integration/test_guide_retrieval.py`
- Modify: `C:\Users\ronan\OneDrive\Documents\Portfolio.md`

**Interfaces:**
- The integration test accepts `GUIDE_PDF_PATH` and uses a temporary Chroma directory.
- No OpenRouter call is made; the assertion stops at the unchanged generation boundary.

- [ ] **Step 1: Add the supplied-guide retrieval regression**

Create an integration test marked `integration`. Load the supplied PDF, use the production splitter metadata, retrieve for `What are the tasks in Milestone 4 - Polish & Testing?`, run `expand_with_neighbors`, and assert the expanded text contains tasks 20 through 24, including `document selector`, `loading spinners`, `3 different PDFs`, `Verify RLS`, and `model selector dropdown`.

The test must use `tmp_path` for Chroma and never invoke `query_document` or OpenRouter.

- [ ] **Step 2: Run the complete verification matrix**

Run from the worktree:

```powershell
& 'C:\Users\ronan\OneDrive\Documents\GitHub\THE-ZERO-COST-SCHOLAR\backend\venv\Scripts\python.exe' -m pytest backend/tests -q
& 'C:\Users\ronan\OneDrive\Documents\GitHub\THE-ZERO-COST-SCHOLAR\backend\venv\Scripts\python.exe' -m py_compile backend/auth.py backend/database.py backend/document_repository.py backend/ingestion.py backend/main.py backend/query.py backend/retrieval.py
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend audit --audit-level=high
```

Expected: all tests pass, compilation exits 0, build exits 0, and audit reports 0 high/critical vulnerabilities.

- [ ] **Step 3: Run read-only contract and security probes**

- Load the existing backend env file without printing values.
- Perform a read-only Supabase `user_documents?select=id&limit=1` request and require HTTP 200.
- Re-run the focused foreign-document test with verbose output.
- Run the guide integration test with `GUIDE_PDF_PATH=C:\Users\ronan\Downloads\Zero_Cost_Scholar_Internship_Guide.pdf`.
- Search tracked changes for secret-like assignments and confirm no real credential values are present.

- [ ] **Step 4: Inspect the final diff and confirm OpenRouter is unchanged**

Run:

```powershell
git diff origin/main --check
git diff origin/main -- backend/query.py
git diff origin/main --stat
git status --short --branch
```

Confirm that changes in `backend/query.py` are limited to importing/calling retrieval helpers and serializing sources. The OpenAI client and completion block must match `origin/main`.

- [ ] **Step 5: Update the living portfolio**

Update the Zero-Cost Scholar entry in `C:\Users\ronan\OneDrive\Documents\Portfolio.md` with the implemented ownership boundary, neighbor-aware retrieval, saved-document selector, Vite 8 upgrade, and verified test/audit results. Do not claim checks that did not pass.

- [ ] **Step 6: Commit final integration coverage**

```powershell
git add backend/tests/integration/test_guide_retrieval.py docs/superpowers/plans/2026-07-22-fix-test-findings.md
git commit -m "test: cover guide retrieval regression"
```

- [ ] **Step 7: Request code review and address findings**

Use `superpowers:requesting-code-review` against `origin/main..HEAD`. Resolve every high/medium-confidence correctness or security finding, rerun the affected tests, and commit any fixes.

- [ ] **Step 8: Perform final completion verification and push**

Use `superpowers:verification-before-completion` and `verification-before-completion-extras`. Re-run the full matrix after the final code change, verify the worktree is clean, then push:

```powershell
git push -u origin codex/fix-test-findings
```

Expected: remote branch `origin/codex/fix-test-findings` is created and points to local `HEAD`.
