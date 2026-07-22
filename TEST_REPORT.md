# The Zero-Cost Scholar - Test Report

**Date:** 2026-07-22  
**Tester:** Ronan's Codex test pass  
**Scope:** Testing and diagnosis only; no application source code was changed.  
**Reference:** `C:\Users\ronan\Downloads\Zero_Cost_Scholar_Internship_Guide.pdf`, especially Milestones 2-4 on pages 23-24.

## Verdict

The prototype installs, builds, starts, authenticates malformed-token failures, ingests PDFs, retrieves Chroma chunks, and reaches its configured Supabase and OpenRouter services. It is **not ready to be marked complete or demonstrated as a private multi-user document platform** because one high-severity authorization gap can expose another user's Chroma collection if its identifiers are known, and the tested RAG flow failed a representative multi-item question even though the correct page was retrieved.

The repository also has no automated test suite, and several required Milestone 4 features are absent.

## Highest-priority findings

### HIGH - `/query` does not verify document or collection ownership

**Affected code:** `backend/main.py`, `ask_question()`

The route accepts `document_id` and `collection_name` from the client and passes the collection directly to `query_document()`. It never queries `user_documents` to confirm that both identifiers belong to the authenticated `user_id`.

An isolated in-memory test called `ask_question()` as `attacker-user` with a foreign document ID and collection name. The function returned a result, touched only `query_logs`, and performed no `user_documents` ownership lookup:

```text
QUERY_RETURNED={'answer': 'stub', 'sources': [], 'model': 'stub-model'}
TABLE_CALLS=[('table', 'query_logs')]
USER_DOCUMENT_OWNERSHIP_LOOKUP=False
```

Because the backend uses the Supabase service key, RLS does not protect this path. An authenticated user who learns another collection name and document ID can query that collection and can create a log associated with the foreign document.

**Required retest after repair:** User B must receive 404 or 403 when submitting User A's `document_id` or `collection_name`, while User A still receives 200.

### HIGH - Representative RAG question fails despite retrieving the correct page

**Input:** the supplied 29-page internship guide  
**Question:** `What are the four tasks in Milestone 4 - Polish & Testing?`

Ingestion succeeded with 141 chunks. Retrieval returned the correct Milestone 4 page as the top hit, but the generated answer was:

```text
I cannot find this in the document.
```

The top 500-character chunk contains tasks 20-22, while tasks 23-24 fall into the adjacent chunk. Similarity search does not expand to neighboring chunks, so the model does not receive all four requested items. This is a core RAG completeness failure, not an OpenRouter outage.

**Control test:** `What does task 20 in Milestone 4 require?` returned the correct document-selector answer, proving that generation works when the complete answer is present in retrieved context.

**Required retest after repair:** questions spanning a list or paragraph boundary must retrieve neighboring chunks and return a complete cited answer.

### HIGH - Current frontend dependency tree has a Vite file-disclosure advisory

`npm audit --json` reports one high- and one moderate-severity vulnerability. The high finding is Vite's Windows alternate-path `server.fs.deny` bypass (`GHSA-fx2h-pf6j-xcff`); the moderate chain includes the esbuild development-server request issue (`GHSA-67mh-4wv8-2f99`). The lockfile resolves Vite 5.4.21, and npm offers only a semver-major Vite upgrade as the automated fix.

This affects the development server rather than the generated production bundle, but it matters on a Windows development machine, especially if Vite is exposed beyond localhost.

## Medium-priority findings

### Citations can render as raw text instead of badges

The successful control answer used `[Source\u202f2]`, where the separator is a narrow no-break space. `frontend/src/components/Dashboard/FormattedAnswer.jsx` recognizes only a regular ASCII space with `\[Source (\d+)\]`. The answer is semantically cited, but the citation badge and history-stripping logic will miss this real provider output.

### Displayed PDF page numbers are zero-based

`PyPDFLoader` metadata returned page `23` for content visibly printed as page 24 in the guide. `SourceChunks.jsx` renders the metadata unchanged as `Page {source.page}`, so users see a page number one lower than the PDF viewer.

### Required document and model selectors are absent

Milestone 4 tasks 20 and 24 are not implemented. `Dashboard.jsx` stores only the most recently uploaded document in component state, never calls `GET /documents`, and has no model selector. A refresh also loses the active document even though the backend retains its metadata.

### Query history does not refresh after a successful query

`HistoryPanel.jsx` loads `/history` only once on mount. `QueryPanel` does not notify it after a query succeeds, so the new query does not appear until the dashboard is reloaded.

### Upload validation is weak

`upload_pdf()` reads the entire request into memory, has no size limit, checks only a case-sensitive `.pdf` suffix, and does not validate the MIME type or PDF signature. `REPORT.PDF` is rejected while a non-PDF renamed to `.pdf` reaches the parser. A sufficiently large upload can consume excessive memory.

### Embedding model is loaded twice at process startup

Both `ingestion.py` and `query.py` construct their own module-level `HuggingFaceEmbeddings`. Fresh processes printed two complete `Loading weights` sequences. This increases memory use and made first startup materially slower.

### Dependency declarations are too broad for reproducible setup

Every backend requirement is a lower bound with no upper bound or lockfile. On this test date, installation resolved LangChain 1.3.14, `langchain-community` 0.4.2, ChromaDB 1.5.9, Transformers 5.14.1, and Torch 2.13.0. The app still ran, but emitted deprecation warnings for `HuggingFaceEmbeddings`, `Chroma`, and the sunset status of `langchain-community`. A future install can break without a source change.

### README setup instructions do not describe this repository

`README.md` calls the frontend React/Next.js, the backend Node.js/Express, and tells users to run `npm install` and `npm run dev` in `backend/`. The actual stack is React/Vite plus Python/FastAPI. It also tells users to copy `.env.example` files that do not exist.

## Low-priority findings

- A missing `Authorization` header returns FastAPI's default 422 response; a malformed bearer token returns the intended 401.
- Browser logs contain the two React Router v7 future-flag warnings. No uncaught JavaScript exception appeared in the unauthenticated smoke path.
- Source scores are labeled `relevance`, but Chroma's returned value is a distance where lower is better, not a normalized relevance percentage.
- The guide's cover says documents never leave the infrastructure, but `query.py` sends retrieved document chunks to OpenRouter. The guide later acknowledges this on page 22, so the privacy claim should be qualified.

## Checks that passed

| Check | Evidence |
|---|---|
| Backend env file | All 10 expected variables are present and non-empty; values were never printed. |
| Frontend env file | All 3 expected `VITE_*` variables are present and non-empty; values were never printed. |
| Frontend dependency install | `npm ci` completed: 164 packages added. |
| Frontend production build | Vite 5.4.21 transformed 143 modules and produced `dist/` successfully. |
| Python environment | `pip install -r requirements.txt` completed; `pip check` reported no broken requirements. |
| Backend syntax/imports | All five app modules compiled; all declared runtime dependency imports succeeded. |
| Backend startup | Uvicorn reached application startup complete at `127.0.0.1:8000`. |
| API inventory | `POST /upload`, `POST /query`, `GET /documents`, and `GET /history` all appear in OpenAPI. |
| Invalid JWT rejection | `GET /documents` with `Bearer invalid-token` returned 401. |
| CORS for documented dev URL | Preflight from `http://localhost:5173` returned 200, the matching allow-origin, and credentials=true. |
| Supabase reachability | JWKS returned one key; `user_documents` and `query_logs` both returned HTTP 200 on read-only service-key checks. |
| OpenRouter readiness | Model inventory returned 342 models; configured `openai/gpt-oss-20b:free` was present. |
| PDF ingestion | Supplied guide produced 29 pages and 141 chunks in an isolated Chroma directory. |
| Basic retrieval | Milestone 4 content was the top result for the Milestone 4 question. |
| Narrow grounded generation | Task 20 question returned the correct document-selector answer with a semantic source marker. |
| Protected frontend route | Unauthenticated `/dashboard` redirected to `/login`. |
| Auth page navigation | Login -> Sign Up -> Login navigation worked. |
| Invalid-login UX | A synthetic invalid login showed `Invalid login credentials` and created no account. |
| Unauthenticated UI rendering | Login page rendered cleanly; no uncaught browser error was logged. |

## Guide acceptance matrix

| Guide item | Status | Notes |
|---|---|---|
| 6. Install Python dependencies | PASS | Isolated `backend/venv` installed successfully. |
| 7. Invalid token returns 401 | PASS | Malformed bearer token returned 401. |
| 8. Ingestion works from command line | PASS | 29 pages, 141 chunks. |
| 9. Query returns answer and sources | PARTIAL/FAIL | Narrow question works; representative multi-chunk list question fails. |
| 10. Four endpoints appear at `/docs` | PASS | Confirmed through OpenAPI. |
| 11. `/upload` via Postman/curl and Chroma created | BLOCKED | Direct ingestion and Chroma creation passed; authenticated HTTP upload was not run. |
| 12. `/query` response cites sources | FAIL | Real answer used an unsupported Unicode space; multi-item answer had no citation. |
| 13. Vite app and packages | PASS | Clean install and production build succeeded. |
| 14. Supabase login creates a session | BLOCKED | No test-user credentials supplied. Invalid-login behavior passed. |
| 15. ProtectedRoute | PASS | Direct dashboard navigation redirected to login. |
| 16. UploadPanel progress | BLOCKED | Component exists; authenticated browser upload not possible without a test user. |
| 17. QueryPanel answer display | BLOCKED | Backend generation tested directly; authenticated UI path not run. |
| 18. SourceChunks with page number | PARTIAL/FAIL | Component exists, but page number is off by one and citation spacing can miss badges. |
| 19. HistoryPanel from Supabase | BLOCKED | Component and table exist; authenticated runtime path not run. |
| 20. Document selector | NOT IMPLEMENTED | No selector; `/documents` is unused by the frontend. |
| 21. Loading spinners and error toasts | PARTIAL | Loading/error text exists, but no toast system and coverage is not throughout. |
| 22. Test three PDF types | BLOCKED | Only the supplied guide was in authorized test scope. |
| 23. Verify RLS with two users | BLOCKED | Requires two authorized test accounts; static route audit instead found the ownership gap above. |
| 24. Model selector | NOT IMPLEMENTED | Model is fixed by backend environment variable. |

## Test limitations and safe handling

- No Supabase users were created, deleted, or modified.
- No production query or document rows were inserted.
- Authenticated browser flows were not attempted without explicit test credentials.
- Environment values were loaded only into test processes and were never printed or copied into the repository.
- Local generated artifacts were limited to ignored dependency/build directories and temporary Chroma/PDF-render data.

## Recommended retest order

1. Enforce `/query` ownership for both `document_id` and `collection_name`, then run a two-user negative test.
2. Add neighbor-aware retrieval (or another context-expansion strategy) and rerun list/table questions that span chunk boundaries.
3. Normalize citation whitespace and convert page metadata to one-based display numbers.
4. Add a small automated suite covering auth status codes, ownership, upload validation, retrieval boundaries, and citation parsing.
5. Complete an authenticated browser run: login, upload, query, source display, history refresh, logout, and cross-user isolation.
6. Implement or explicitly defer Milestone 4 tasks 20, 21, and 24.
