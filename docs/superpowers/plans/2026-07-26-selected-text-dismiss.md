# Selected-text prompt dismiss control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users clear staged PDF text from the chat composer with an accessible close button.

**Architecture:** `Dashboard` owns `selectedPdfText` and passes an `onClearSelectedText` callback to `ChatPane`. `ChatPane` renders the close button only while selected text is present; activating it calls the callback and leaves the normal composer intact.

**Tech Stack:** React, Vitest, Testing Library, existing Lucide icons.

## Global Constraints

- Keep selection state owned by `Dashboard`.
- Use the existing `X` icon and button conventions.
- Do not change query payload behavior.

### Task 1: Add the failing interaction test

**Files:**
- Test: `frontend/src/components/Dashboard/ChatPane.test.jsx`

- [ ] Add a test that renders `ChatPane` with selected text and an `onClearSelectedText` spy, clicks the button named `Clear selected text`, and expects the spy to be called once.
- [ ] Run `npm test -- src/components/Dashboard/ChatPane.test.jsx` and confirm it fails because the button is not yet present.

### Task 2: Wire the callback and button

**Files:**
- Modify: `frontend/src/components/Dashboard/ChatPane.jsx`
- Modify: `frontend/src/components/Dashboard/Dashboard.jsx`

- [ ] Add `onClearSelectedText` to `ChatPane` props.
- [ ] Wrap the selected-text label in a header and render an accessible close button with the existing `X` icon.
- [ ] Pass `() => setSelectedPdfText('')` from `Dashboard`.

### Task 3: Verify

- [ ] Run the focused `ChatPane` test and confirm it passes.
- [ ] Run `npm test` from `frontend` and confirm the full suite passes.
- [ ] Run `npm run build` from `frontend` and confirm the production build succeeds.
