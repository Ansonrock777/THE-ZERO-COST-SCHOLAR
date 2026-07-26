# Skill Observation Log

Observations captured during task-oriented work. Each entry identifies a
potential skill improvement or new skill opportunity.

**Status key:** OPEN = not yet actioned | ACTIONED = skill updated/created |
DECLINED = user decided not to pursue

---

## 2026-07-22 - Zero-Cost Scholar testing

### Observation 1: Layered acceptance testing needs an explicit mutation budget

**Status:** OPEN
**Date:** 2026-07-22
**Session context:** Testing an inherited React/FastAPI/Supabase RAG project against a supplied internship acceptance guide.
**Skill:** New skill candidate: full-stack-acceptance-testing
**Type:** open-source
**Phase/Area:** Test planning, external integrations, and evidence reporting
**Reference file:** `docs/superpowers/plans/2026-07-22-project-test-execution.md`; `TEST_REPORT.md`

**Issue:** A meaningful test pass had to combine secret-safe environment inspection, dependency/build checks, API smoke tests, direct RAG tests, browser checks, static authorization review, and a guide-to-evidence matrix. Some acceptance tests would create cloud users or database rows, so they needed to be classified as blocked rather than silently skipped or run without authority. No existing skill packaged this workflow or made the external-mutation boundary explicit.

**Suggested improvement:** Create a reusable full-stack acceptance-testing skill that begins by extracting acceptance criteria, declares an external mutation budget, runs tests in layers from cheapest/read-only to stateful, distinguishes FAIL from BLOCKED and NOT IMPLEMENTED, and produces a reproducible evidence report with a secret scan. Include a verification rule that Python syntax checks target application modules explicitly when an in-project virtual environment exists, rather than recursively compiling the environment.

**Principle:** Full-stack testing is trustworthy only when every requirement is mapped to evidence and tests that require external state changes are explicitly authorized, safely simulated, or reported as blocked; generated dependency directories must be excluded from source-verification commands.

### Observation 2: Full-suite collection order can hide isolated test import failures

**Status:** OPEN
**Date:** 2026-07-22
**Session context:** Implementing and independently verifying security, retrieval, and UI fixes for a Python/React RAG project.
**Skill:** New skill candidate: full-stack-acceptance-testing
**Type:** open-source
**Phase/Area:** Test isolation and completion verification
**Reference file:** `backend/tests/conftest.py`; `backend/tests/integration/test_guide_retrieval.py` on branch `codex/fix-test-findings`

**Issue:** The full backend suite passed because an integration test modified `sys.path` during collection before another test imported application modules. Running the authorization test alone from the repository root then failed with `ModuleNotFoundError`, proving that the full-suite result depended on collection order. Centralizing the path setup in `tests/conftest.py` and removing the per-test mutation made both isolated and aggregate invocations pass.

**Suggested improvement:** Add an isolated-test gate to the full-stack acceptance workflow for at least one high-risk test node, run from the same directory CI or users will use. Treat suite-level setup performed by an individual test module as a test-smell; shared import/environment setup belongs in the framework's central configuration.

**Principle:** A green aggregate suite is not proof of test isolation; collection-order side effects can mask failures, so critical regressions should also pass independently from the canonical project entry point.
