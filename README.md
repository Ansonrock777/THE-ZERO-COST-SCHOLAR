# The Zero-Cost Scholar

A local-first PDF research workspace for asking questions across multiple documents and verifying every cited passage beside the original page.

## What is included

- Hybrid semantic + BM25 retrieval with cross-document result balancing.
- A resizable chat/PDF workspace, mobile pane tabs, light/dark themes, and saved reader preferences.
- Durable conversations with search, rename, pin, export, and soft deletion.
- Clickable citations that open the correct PDF page, highlight matching text, and retain an excerpt fallback.
- Automatic one-paragraph summaries, selected-text questions, readable streamed status updates, Stop, Retry, and Copy controls.
- Prompt-injection defenses, bounded context, ownership checks, file/query limits, and content-free local telemetry.
- An opt-in developer dashboard at `/developer` when `DEV_MODE=true`.

## Stack

- Frontend: React 18, Vite, React-PDF/PDF.js, Lucide, Supabase Auth.
- Backend: FastAPI, Chroma, sentence-transformers, pure-Python BM25, OpenRouter-compatible generation.
- Metadata: Supabase PostgreSQL with row-level security.
- Local artifacts: original PDFs, Chroma collections, BM25 indexes, and SQLite telemetry.

## Local setup

1. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env`.
2. Fill in Supabase values and an OpenRouter key that can access the configured free model.
3. Apply `supabase/migrations/001_init.sql`, then `002_production_workspace.sql`.
4. Install and run:

```powershell
python -m venv backend\venv
backend\venv\Scripts\pip.exe install -r backend\requirements.txt
Set-Location frontend
npm install

# Terminal 1
Set-Location ../backend
.\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000

# Terminal 2
Set-Location ../frontend
npm run dev
```

Open `http://localhost:5173`. Chrome is the supported browser.

## Verification

```powershell
backend\venv\Scripts\python.exe -m pytest backend\tests -q
Set-Location frontend
npm test
npm run build
```

Telemetry retains identifiers and numeric measurements for 30 days by default; it intentionally excludes document text, questions, prompts, and answers. Stop aborts the client request immediately, although an already-started external provider call may finish server-side.

See `PROJECT.md` for architecture rules, milestone state, and explicitly deferred work.
