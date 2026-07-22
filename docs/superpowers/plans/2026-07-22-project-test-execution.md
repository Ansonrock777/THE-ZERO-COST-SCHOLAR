# Zero-Cost Scholar Test Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the current project against the acceptance criteria in `Zero_Cost_Scholar_Internship_Guide.pdf` and produce an evidence-backed defect report without changing application code.

**Architecture:** Test the application in layers: configuration and dependency bootstrap, static/build checks, backend API behavior, RAG ingestion/query behavior, and frontend browser behavior. External systems are exercised read-only unless an existing authenticated session is already available; no test users or persistent cloud records are created without explicit authorization.

**Tech Stack:** React 18, Vite 5, FastAPI, Supabase, ChromaDB, LangChain, sentence-transformers, OpenRouter, PowerShell, Python 3, npm.

## Global Constraints

- Do not print or commit values from `C:\Users\ronan\Downloads\env (1)` or `C:\Users\ronan\Downloads\env (2)`.
- Do not modify application source files during this testing-only pass.
- Compare outcomes with Milestones 2-4 on pages 23-24 of the supplied guide.
- Record each check as PASS, FAIL, BLOCKED, or NOT IMPLEMENTED with fresh command or browser evidence.

---

### Task 1: Configuration and dependency readiness

**Files:**
- Inspect: `backend/requirements.txt`
- Inspect: `frontend/package.json`
- Inspect: `C:\Users\ronan\Downloads\env (1)`
- Inspect: `C:\Users\ronan\Downloads\env (2)`

**Interfaces:**
- Consumes: Supplied backend and frontend environment files.
- Produces: A secret-safe inventory of required variables and runnable dependency environments.

- [ ] **Step 1: Verify required environment variable names and non-empty values without printing values**

Run a PowerShell parser that emits only key names, SET/EMPTY state, and value length.

Expected: all ten backend variables and all three frontend variables are SET.

- [ ] **Step 2: Install frontend dependencies from the lockfile**

Run: `npm ci` from `frontend/` using the bundled npm runtime.

Expected: exit code 0 with no dependency-resolution failure.

- [ ] **Step 3: Create or reuse an isolated Python environment and install backend requirements**

Run: `python -m venv backend/venv`, then `backend/venv/Scripts/python -m pip install -r backend/requirements.txt`.

Expected: exit code 0 and imports for FastAPI, Supabase, ChromaDB, LangChain, sentence-transformers, jose, httpx, and OpenAI succeed.

### Task 2: Static and build verification

**Files:**
- Test: `frontend/src/**/*.jsx`
- Test: `backend/*.py`

**Interfaces:**
- Consumes: Installed dependencies and supplied environment values injected only into the test process.
- Produces: Build, syntax, and import results.

- [ ] **Step 1: Compile all backend Python modules**

Run: `backend/venv/Scripts/python -m compileall -q backend`.

Expected: exit code 0.

- [ ] **Step 2: Build the production frontend**

Load the three `VITE_*` values into the current process and run `npm run build` from `frontend/`.

Expected: Vite exits 0 and creates `frontend/dist/`.

- [ ] **Step 3: Check the repository for an automated test command**

Inspect `frontend/package.json`, backend configuration, and test file names.

Expected: record whether a unit/integration test suite exists; do not infer coverage from a successful build.

### Task 3: Backend API smoke and authentication checks

**Files:**
- Test: `backend/main.py`
- Test: `backend/auth.py`
- Test: generated OpenAPI schema at `http://127.0.0.1:8000/openapi.json`

**Interfaces:**
- Consumes: Backend process with environment values injected in memory.
- Produces: Startup, endpoint inventory, CORS, and authentication rejection evidence.

- [ ] **Step 1: Start Uvicorn and poll `/openapi.json` until ready**

Run: `python -m uvicorn main:app --host 127.0.0.1 --port 8000` from `backend/`.

Expected: server becomes ready without import or model-load failure.

- [ ] **Step 2: Verify the documented four endpoints exist**

Inspect OpenAPI for `POST /upload`, `POST /query`, `GET /documents`, and `GET /history`.

Expected: all four routes present with the documented methods.

- [ ] **Step 3: Verify an invalid bearer token is rejected**

Run an HTTP request to `GET /documents` with `Authorization: Bearer invalid-token`.

Expected: HTTP 401, not 200 or 500.

- [ ] **Step 4: Verify development CORS behavior**

Send an OPTIONS preflight with origin `http://localhost:5173` and requested method POST.

Expected: allowed origin is returned for the documented frontend URL.

### Task 4: RAG ingestion and external-service readiness

**Files:**
- Test: `backend/ingestion.py`
- Test: `backend/query.py`
- Input: `C:\Users\ronan\Downloads\Zero_Cost_Scholar_Internship_Guide.pdf`

**Interfaces:**
- Consumes: Supplied sample PDF and configured Supabase/OpenRouter endpoints.
- Produces: Chroma collection metadata, retrieval evidence, and provider readiness findings.

- [ ] **Step 1: Verify Supabase and OpenRouter endpoints are reachable using non-mutating requests**

Expected: Supabase project metadata/JWKS and OpenRouter model endpoint respond without DNS, TLS, or credential failure.

- [ ] **Step 2: Call `ingest_pdf` directly with the supplied guide**

Expected: a local Chroma collection is created, with page count 29 and a positive chunk count.

- [ ] **Step 3: Retrieve top chunks for a known-answer question**

Question: `What are the four tasks in Milestone 4 - Polish & Testing?`

Expected: at least one retrieved chunk comes from pages 23-24 and contains the milestone content.

- [ ] **Step 4: Exercise generation only if the configured OpenRouter model is available**

Expected: answer is grounded in the retrieved chunks and includes inline `[Source N]` citations; otherwise record the precise provider/model failure.

### Task 5: Frontend browser smoke test

**Files:**
- Test: `frontend/src/App.jsx`
- Test: `frontend/src/components/Auth/*.jsx`
- Test: `frontend/src/components/Dashboard/*.jsx`

**Interfaces:**
- Consumes: Running Vite frontend and FastAPI backend.
- Produces: Visible-route, navigation, form-validation, console, and network findings.

- [ ] **Step 1: Start Vite with the supplied frontend variables injected in memory**

Run: `npm run dev -- --host 127.0.0.1` from `frontend/`.

Expected: `http://127.0.0.1:5173` responds.

- [ ] **Step 2: Verify protected-route redirection and auth-page navigation**

Expected: unauthenticated `/dashboard` redirects to `/login`; Login and Sign Up links navigate correctly.

- [ ] **Step 3: Verify native form constraints and visible error handling without creating an account**

Expected: required email/password constraints work, signup enforces six characters, and invalid login shows a readable Supabase error.

- [ ] **Step 4: Inspect console and failed network requests**

Expected: no uncaught JavaScript exceptions during the unauthenticated smoke path.

### Task 6: Acceptance audit and handoff report

**Files:**
- Create: `TEST_REPORT.md`
- Inspect: `README.md`
- Inspect: `supabase/migrations/001_init.sql`

**Interfaces:**
- Consumes: Evidence from Tasks 1-5 and guide Milestones 2-4.
- Produces: A prioritized testing report suitable for handing back to the project owner.

- [ ] **Step 1: Map every guide acceptance item to evidence**

Expected: every item receives PASS, FAIL, BLOCKED, or NOT IMPLEMENTED.

- [ ] **Step 2: Prioritize defects by user and security impact**

Expected: Critical/High issues first, followed by Medium/Low issues; distinguish code defects from environment or documentation defects.

- [ ] **Step 3: Write reproducible steps and evidence into `TEST_REPORT.md`**

Expected: commands, observed status codes/messages, affected files, and limitations are included without secrets.

- [ ] **Step 4: Re-run the decisive checks before reporting completion**

Expected: fresh build/API/browser evidence agrees with the final report.
