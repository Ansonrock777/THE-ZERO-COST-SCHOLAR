# Fix Test Findings Design

**Date:** 2026-07-22

**Branch:** `codex/fix-test-findings`

**Status:** Conversational design approved; pending written-spec review. OpenRouter/model-selector work was explicitly removed by the user.

## Objective

Repair the confirmed security, retrieval, citation, page-display, document-selection, and frontend dependency findings without changing the OpenRouter client, configured LLM, generation request, or model-selection behavior.

## Scope

### Included

- Require the authenticated user to own a document before `/query` can access its Chroma collection.
- Stop accepting or exposing Chroma collection names in the browser-facing API.
- Expand semantic retrieval results with their immediately adjacent chunks.
- Return one-based PDF page numbers and recognize Unicode whitespace in source citations.
- Load the authenticated user's saved documents and let them switch the active PDF after a refresh or upload.
- Upgrade Vite and its React plugin past the confirmed advisories.
- Add repeatable backend and frontend regression tests for these behaviors.

### Explicitly excluded

- Any change to the OpenRouter client, base URL, API key handling, configured model, prompt, completion parameters, or generation call.
- A model selector or models endpoint. The application will continue using `LLM_MODEL` exactly as it does now.
- Other findings from the test report, including history auto-refresh, upload hardening, toast notifications, dependency pinning beyond Vite, embedding-model deduplication, and README corrections.

## Approaches considered

1. **Server-derived collection plus neighbor expansion (selected).** The client sends only a document ID; the backend resolves the owned database row and expands top semantic matches by chunk index. This removes the insecure trust boundary and directly addresses answers split across chunks.
2. **Validate the client-supplied collection name.** This could close the immediate authorization gap, but it would preserve a sensitive implementation identifier in the browser contract and create two values that must remain consistent.
3. **Increase chunk size or top-K only.** This is simpler for retrieval, but cannot reliably guarantee that boundary-spanning lists remain complete and increases unrelated context sent to generation.

## Backend design

### Owned-document resolution

`POST /query` will accept:

```json
{
  "question": "...",
  "document_id": "..."
}
```

The route will query `user_documents` with both `id = document_id` and `user_id = authenticated_user_id`, selecting only the stored `chroma_collection`. A missing match returns `404 Document not found`. Using the same response for absent and foreign documents avoids confirming another user's document identifiers.

Only after this check succeeds will the route call `query_document` with the server-derived collection. Query logging also happens only after ownership validation and successful generation. The query schema will reject unexpected fields so a legacy or malicious `collection_name` cannot silently remain part of the contract.

`GET /documents` will return only browser-required metadata and will not expose `chroma_collection`. The upload response will likewise omit the collection name because the browser no longer needs it.

### Neighbor-aware retrieval

The existing top-K similarity search remains the anchor retrieval step. For every semantic hit with `chunk_index = n`, retrieval will request `n - 1`, `n`, and `n + 1` from the same Chroma collection, ignoring negative indexes. Results will be deduplicated.

Context ordering will preserve semantic-hit rank; within each hit group, chunks will be ordered by chunk index. A chunk already included by an earlier group will not appear twice. This keeps each passage locally coherent while retaining the highest-ranked semantic region first.

Direct semantic hits retain their Chroma distance. Adjacent-only chunks have a null score rather than a fabricated relevance value. The frontend will label those entries as adjacent context.

The retrieval/context portion of `query.py` may change. The OpenRouter initialization, model selection, prompt, and completion-call parameters will remain unchanged; the existing call will simply receive the expanded context string built before it.

### Page-number contract

PyPDFLoader's zero-based `page` metadata will be converted to one-based values when sources are serialized for the API. Non-numeric or missing metadata remains `?`. The frontend will display the API value without applying another offset.

## Frontend design

### Document selector

The dashboard will request `GET /documents` on mount. Because that endpoint is already newest-first, the first document becomes the initial selection. A labeled native `<select>` will let the user switch among their uploaded PDFs. The selector will have explicit loading, empty, and error states.

After a successful upload, the returned document will be inserted into the local document list and selected immediately. `QueryPanel` will receive the active document and send only its `document_id` with the question.

### Citations and source cards

The citation expression will accept any Unicode whitespace between `Source` and its number, so provider output such as `[Source\u202f2]` renders and strips correctly. Existing bracketed numeric citations remain supported.

Source cards will continue to show `Page N`. Numeric scores retain the existing relevance label; neighbor-only sources display `adjacent context` instead of a misleading score.

## Dependency upgrade

Vite will move from 5.4.21 to 8.1.5 and `@vitejs/plugin-react` from 4.x to 6.0.3. The current Node 22.17.1 runtime satisfies Vite 8's `>=22.12` requirement. The existing ESM Vite configuration is compatible and does not require a structural rewrite.

## Error handling

- Foreign and missing document IDs: `404 Document not found`; no Chroma query and no query-log insert.
- Empty document list: selector explains that a PDF must be uploaded.
- Document-list failure: selector area shows the backend error while upload remains available.
- Neighbor metadata absent or malformed: keep the semantic hit and skip neighbor lookup for that hit.
- Vite migration incompatibility: treat build or test failure as a blocking regression and resolve it before pushing.

## Test design

### Backend automated tests

- The owner can query using the collection stored in their document row.
- A foreign or missing document gets 404, never reaches `query_document`, and is not logged.
- A client-supplied `collection_name` is rejected.
- Adjacent chunks are fetched, correctly ordered, and deduplicated around semantic hits.
- Neighbor-only sources have no fabricated score.
- Page metadata `0` is returned as page `1`; missing metadata stays `?`.

### Frontend automated tests

- Unicode-spaced citations render as badges and are removed from plain-text previews.
- The selector renders returned documents, selects the newest, and reports changes.
- A successful upload becomes the active document.
- Query payloads contain `question` and `document_id`, with no collection name.
- Source cards distinguish semantic distance from adjacent context.

### Final verification

- Backend test suite and Python compilation.
- Frontend component suite and production build.
- `npm audit --audit-level=high` with no high-severity result.
- A local ownership regression using faked external boundaries to prove denial occurs before Chroma or logging.
- A retrieval regression over the supplied 29-page guide proving Milestone 4's boundary-spanning task list is present in expanded context.
- Secret scan and clean branch diff before commit and push.

The final provider call is not required for the retrieval regression because OpenRouter behavior is outside this change. Verification will prove that the complete guide context reaches the unchanged generation boundary.
