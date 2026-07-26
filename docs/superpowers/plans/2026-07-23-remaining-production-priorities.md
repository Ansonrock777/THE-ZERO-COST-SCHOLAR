# Remaining Production Priorities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the approved PDF verification workspace, guided interaction, developer visibility, cancellation/retry, and final documentation after the verified P0 retrieval foundation.

**Architecture:** Extend FastAPI with server-owned local PDF storage, soft deletion, conversations, summaries, streaming status events, and `DEV_MODE` telemetry endpoints. Replace the current stacked dashboard with an accessible React workspace using React-PDF 10.1.0, a resizable chat/PDF split, authenticated PDF loading, citation-driven page navigation, and responsive mobile tabs.

**Tech Stack:** React 18, Vite 8, Tailwind CSS 3, React-PDF 10.1.0/PDF.js, Lucide React, Axios/fetch, FastAPI, Supabase PostgreSQL, standard-library local storage and telemetry.

## Global constraints

- Core behavior remains strictly zero-cost and local-first.
- Preserve legacy `/query` and `/history` behavior while adding capabilities.
- PDF bytes and local paths are server-owned and never exposed without ownership checks.
- Follow-up questions are supported; suggested follow-up questions are not generated.
- Answers render in readable batches, not word-by-word.
- Preserve the user-owned `.gitignore` change.
- Chrome is the required browser; target WCAG 2.1 AA.
- Use test-first changes and verify high-risk tests both alone and in the full suite.

---

### Task 1: Local PDF lifecycle and soft deletion

**Files:**
- Create: `backend/pdf_storage.py`
- Create: `backend/tests/test_pdf_storage.py`
- Modify: `backend/main.py`
- Modify: `backend/document_repository.py`
- Modify: `backend/tests/test_document_repository.py`
- Modify: `backend/tests/test_main_query_authorization.py`
- Create: `supabase/migrations/002_production_workspace.sql`

**Interfaces:**
- `LocalPdfStorage.save(user_id, document_id, bytes)`, `path_for(...)`, and `delete(...)` reject unsafe identifiers and keep files under `PDF_STORAGE_PATH`.
- Upload generates the document UUID before ingestion, persists the original, and inserts that UUID.
- `GET /documents/{document_id}/file` returns the owned PDF.
- `DELETE /documents/{document_id}` removes bytes and soft-deletes metadata while retaining history.

- [ ] Write storage traversal, round-trip, and idempotent-delete tests.
- [ ] Run `python -m pytest backend/tests/test_pdf_storage.py -q` and observe the missing-module failure.
- [ ] Implement `LocalPdfStorage` with atomic writes and resolved-path containment checks.
- [ ] Add failing endpoint/repository tests for ownership, file delivery, and soft deletion.
- [ ] Implement upload UUID generation, owned file response, soft-delete filtering, and cleanup on ingestion failure.
- [ ] Add migration columns `summary`, `deleted_at`, and query-log source preservation; change destructive foreign-key behavior to retain logs.
- [ ] Run focused backend tests and commit `feat: add owned local PDF lifecycle`.

---

### Task 2: Durable conversations and bounded follow-ups

**Files:**
- Create: `backend/conversation_repository.py`
- Create: `backend/tests/test_conversation_repository.py`
- Modify: `backend/main.py`
- Modify: `backend/tests/test_main_query_authorization.py`
- Modify: `supabase/migrations/002_production_workspace.sql`

**Interfaces:**
- Conversation records contain owner, title, selected document IDs, pinned state, and timestamps.
- Message records contain role, content, source snapshot, trace ID, and timestamp.
- Endpoints: list/create/update/delete conversations and list messages.
- `QueryRequest.conversation_id` is optional; owned recent messages feed the bounded P0 conversation context and the new exchange is persisted.

- [ ] Write repository tests for owner filters, ordering, rename, pin, soft delete, and recent message limits.
- [ ] Verify RED with `python -m pytest backend/tests/test_conversation_repository.py -q`.
- [ ] Implement the repository and migration tables/indexes/RLS policies.
- [ ] Add failing API tests proving foreign conversations are refused and follow-up context is bounded.
- [ ] Integrate conversation persistence without breaking legacy query logs.
- [ ] Run repository, authorization, and query-pipeline tests; commit `feat: add durable document conversations`.

---

### Task 3: Production workspace shell and history

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/Dashboard/Dashboard.jsx`
- Create: `frontend/src/components/Workspace/AppShell.jsx`
- Create: `frontend/src/components/Workspace/Sidebar.jsx`
- Create: `frontend/src/components/Workspace/HistoryList.jsx`
- Create: `frontend/src/components/Workspace/workspaceState.js`
- Create: `frontend/src/components/Workspace/AppShell.test.jsx`
- Modify: `frontend/src/lib/apiClient.js`

**Interfaces:**
- The sidebar manages multi-document selection and conversations.
- Last selected documents/conversation/theme persist in namespaced local storage.
- Desktop uses sidebar + split workspace; mobile exposes Chat/PDF tabs.

- [ ] Install `react-pdf@10.1.0` and `lucide-react`, recording exact lockfile versions.
- [ ] Write failing state and shell tests for multi-select, restored state, sidebar collapse, and mobile tabs.
- [ ] Verify RED with targeted Vitest invocations.
- [ ] Implement design tokens for light/dark academic themes and the responsive shell.
- [ ] Implement accessible history search, pin, rename, export, and delete actions against conversation endpoints.
- [ ] Run targeted frontend tests and commit `feat: build academic workspace shell`.

---

### Task 4: Authenticated PDF viewer and citation navigation

**Files:**
- Create: `frontend/src/components/Workspace/PdfViewer.jsx`
- Create: `frontend/src/components/Workspace/PdfViewer.test.jsx`
- Modify: `frontend/src/components/Dashboard/FormattedAnswer.jsx`
- Modify: `frontend/src/components/Dashboard/FormattedAnswer.test.jsx`
- Modify: `frontend/src/components/Dashboard/SourceChunks.jsx`
- Modify: `frontend/src/components/Workspace/AppShell.jsx`

**Interfaces:**
- React-PDF worker uses `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`.
- Authenticated PDF bytes are fetched as a Blob and exposed through a revoked object URL.
- Citation activation selects its document, navigates to its page, and highlights the closest text fragment with `customTextRenderer`; an excerpt remains visible when exact matching fails.

- [ ] Write failing tests for clickable inline citations, page selection, source fallback, and object-URL cleanup.
- [ ] Verify RED with targeted Vitest tests.
- [ ] Implement worker/CSS configuration, page/zoom/search controls, and text selection events.
- [ ] Connect citation chips and copied `filename, p. N` references.
- [ ] Run component tests and commit `feat: link answers to the PDF viewer`.

---

### Task 5: Chat, readable batching, and response controls

**Files:**
- Create: `frontend/src/components/Workspace/ChatPane.jsx`
- Create: `frontend/src/components/Workspace/ChatPane.test.jsx`
- Create: `frontend/src/lib/queryStream.js`
- Create: `frontend/src/lib/queryStream.test.js`
- Modify: `backend/main.py`
- Create: `backend/tests/test_query_stream.py`

**Interfaces:**
- `POST /query/stream` emits newline-delimited JSON events: `status`, `result`, and `error` while preserving `/query`.
- Client uses `AbortController`, batches updates to stable visual intervals, and exposes Stop, Retry, and Copy.
- Selected PDF text is inserted as quoted context in the composer.

- [ ] Write failing backend event-contract and disconnect tests.
- [ ] Implement the additive stream endpoint around the existing query pipeline.
- [ ] Write failing client parser, abort, retry, and composer tests.
- [ ] Implement authenticated fetch streaming and accessible answer controls.
- [ ] Run backend and frontend focused suites; commit `feat: add cancellable query interactions`.

---

### Task 6: Automatic summaries and user settings

**Files:**
- Create: `backend/summary.py`
- Create: `backend/tests/test_summary.py`
- Modify: `backend/main.py`
- Create: `frontend/src/components/Workspace/SettingsPanel.jsx`
- Create: `frontend/src/components/Workspace/SettingsPanel.test.jsx`
- Modify: `frontend/src/components/Workspace/AppShell.jsx`

**Interfaces:**
- Upload attempts one paragraph summary generation after indexing; failure does not discard the PDF.
- Settings persist theme, concise/detailed/academic answer style, and inline/paragraph citation placement.
- No suggested questions are generated.

- [ ] Write failing one-paragraph, no-suggestions, and graceful-failure tests.
- [ ] Implement bounded summary prompting and persistence.
- [ ] Write failing settings tests and implement the settings panel.
- [ ] Run focused tests and commit `feat: add document onboarding and settings`.

---

### Task 7: Developer telemetry dashboard

**Files:**
- Modify: `backend/telemetry.py`
- Modify: `backend/main.py`
- Create: `backend/tests/test_developer_telemetry.py`
- Create: `frontend/src/components/Developer/DeveloperDashboard.jsx`
- Create: `frontend/src/components/Developer/DeveloperDashboard.test.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- `GET /developer/telemetry` returns only numeric aggregates/recent identifier metadata.
- Endpoint returns 404 unless `DEV_MODE=true` and always requires authentication.
- Dashboard shows stage latency, candidate counts, failures, citation counts, and deterministic evaluation warnings.

- [ ] Write failing disabled/enabled/privacy endpoint tests.
- [ ] Implement environment gating and safe aggregate serialization.
- [ ] Write failing route/render tests and build the developer dashboard.
- [ ] Run focused tests; commit `feat: add developer pipeline dashboard`.

---

### Task 8: Production verification and project state

**Files:**
- Modify: `PROJECT.md`
- Modify: `README.md`
- Modify only source/test files required by verified failures.

- [ ] Run high-risk authorization, PDF ownership, injection, streaming-abort, and citation tests independently.
- [ ] Run `python -m pytest backend/tests -q`.
- [ ] Run `npm test` and `npm run build` in `frontend`.
- [ ] Start both local servers with test-safe configuration and inspect the rendered light/dark desktop workspace and mobile tabs in Chrome.
- [ ] Verify citation click navigation/highlight, selected-text questions, Stop/Retry/Copy, history operations, summary display, and developer gating through observed UI state.
- [ ] Run source compilation, secret scan, `git diff --check`, and inspect final status.
- [ ] Strike through completed P1-P3/P4 goals in `PROJECT.md`, document deferred RAGAS/OCR/malicious-PDF/web-provider work, and correct only directly relevant README inaccuracies.
- [ ] Commit `docs: record production workspace completion` only after the evidence above is green.

