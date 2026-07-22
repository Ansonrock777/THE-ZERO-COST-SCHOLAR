# The Zero-Cost Scholar

Read this file before changing the repository. Keep it concise and current. When a goal is completed, leave it visible and strike it through with `~~...~~`.

## Purpose

The Zero-Cost Scholar is a strictly zero-cost, local-first workspace for general readers to question multiple PDFs, continue a conversation, and verify cited claims beside the original pages.

## Architecture

- `frontend/`: React 18, Vite, Tailwind CSS, Supabase authentication.
- `backend/`: FastAPI, Supabase metadata/history, local PDF processing, Chroma semantic retrieval, OpenRouter-compatible answer generation.
- `supabase/`: PostgreSQL schema and row-level security migrations.
- Local retrieval artifacts must remain server-owned; clients submit document IDs, never collection names or filesystem paths.
- The approved production design is `docs/superpowers/specs/2026-07-23-production-rag-workspace-design.md`.

## Commands

Run from the repository root unless a command says otherwise.

```powershell
# Backend tests
backend\venv\Scripts\python.exe -m pytest backend\tests -q

# One high-risk backend test in isolation
backend\venv\Scripts\python.exe -m pytest backend\tests\test_main_query_authorization.py::test_foreign_document_is_rejected_before_query_or_logging -q

# Backend development server
Set-Location backend
.\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000

# Frontend tests and production build
Set-Location frontend
npm test
npm run build

# Source-only Python syntax check
backend\venv\Scripts\python.exe -m compileall -q backend -x "(venv|\.venv|__pycache__)"
```

## Conventions

- Write a failing test before production behavior changes; verify the failure reason, then implement the minimum passing change.
- Run high-risk tests alone and in the aggregate suite so collection-order side effects cannot hide failures.
- Do not run tests that mutate live cloud state without credentials and explicit authorization.
- Enforce document ownership on the server before retrieval, PDF access, history access, or deletion.
- Never expose service keys, OAuth sessions, Chroma collection names, local paths, document text, questions, prompts, or answers in telemetry.
- Keep the existing API compatible when a safe additive endpoint or field can do so.
- Keep files focused by responsibility; avoid unrelated refactors while implementing a milestone.
- Make completion claims only after fresh tests or builds directly verify the changed behavior.

## Current milestones

### P0 - Retrieval foundation

- ~~Approve the production workspace design.~~
- ~~Write the focused RAG foundation implementation plan.~~
- Add persistent BM25 indexes and hybrid semantic/keyword retrieval.
- Support authorized multi-document queries.
- Add bounded prompt construction and document-injection defenses.
- Add identifier-and-numeric-only pipeline telemetry.
- Add deterministic retrieval evaluation fixtures.

### P1 - Verification workspace

- Build the academic/library interface in light and dark themes.
- Add the resizable chat/PDF split view and mobile tabs.
- Store PDFs locally and connect citations to page navigation and highlights.
- Add multi-document selection and durable conversation history.

### P2 - Guided interaction

- Generate a one-paragraph summary after upload.
- Add selected-text questions and Stop, Retry, and Copy controls.
- Add answer-detail and citation-placement settings.

### P3 - Developer visibility

- Add the `DEV_MODE` telemetry dashboard.
- Surface deterministic evaluation warnings without blocking builds.

## Future ideas

- RAGAS evaluation when a trustworthy free judge is available without requiring Ollama or a paid service.
- OCR for scanned PDFs.
- A free web-search provider behind the disabled-by-default provider interface.
- Shareable read-only conversations and optional answer feedback.

## Rejected or deferred ideas

- Suggested or automatically generated follow-up questions: removed; users may still ask follow-ups.
- Word-by-word rendering: use readable response batches instead.
- Ollama or another local generative-model runtime: not allowed for the current product.
- Password-protected and malicious-PDF policy: decide in a later milestone.
- Broad unrelated cleanup: last priority after the production workflow is verified.
