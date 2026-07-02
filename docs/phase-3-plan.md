# Phase 3 Review Workflow Plan

작성일: 2026-07-02

## Goal

Phase 3 turns the semantic diff engine into a review workflow. The first slice stays local and browser-only: compare the current document against the saved baseline, show reviewable change groups, and let the user reset the baseline with the existing save/mark-saved action.

## Completed Slice: Local Diff Review

- Keep the existing raw diff output for debugging and copy/paste.
- Add a structured diff review panel with total, document, and metadata counts.
- Group readable semantic diff lines into document and metadata sections.
- Surface the same count in the sidebar as review state.
- Treat `Mark saved`, `.sdoc` save, JSON save, new document, and open document as baseline updates.

## Completed Slice: Persistent Local History

- Store document/metadata snapshots in browser localStorage.
- Keep snapshots local to the browser; `.sdoc` remains the portable source of truth.
- Compare the current document against a selected snapshot without changing the saved baseline.
- Keep binary assets out of history snapshots for now; figure diffs still work through canonical asset references.

## Completed Slice: Local History Management

- Let users delete browser-local snapshots.
- Clear a deleted snapshot as the comparison target and return to the saved baseline.
- Persist deletion to localStorage so removed snapshots do not reappear after reload.

## Completed Slice: Broken Reference Diagnostics

- Preserve `crossReference` inline nodes in the Tiptap editor.
- Show a References panel with target, reference, and broken-reference counts.
- Flag references whose `targetId` does not match any current block id.

## Completed Slice: Cross Reference Target Picker

- Replace prompt-based reference insertion with a References panel picker.
- Filter target blocks by label, id, type, or anchor.
- Insert references using the selected target block id and a human-readable label.
- Keep missing-target diagnostics available for imported or edited `document.json` files.

## Completed Slice: Reference Navigation

- Let users reveal target blocks from the References panel.
- Let users reveal broken inline reference nodes from diagnostics.
- Scroll the editor to the selected node and apply a short visual highlight.

## Current Slice: Reference Label Sync

- Detect references whose `targetId` resolves but whose inline label no longer matches the target block label.
- Show stale reference labels separately from broken references.
- Let users update a stale reference label to the current target label from the References panel.

## Acceptance Evidence

- Unit tests cover the structured review summary model.
- Unit tests cover local history snapshot creation, capping, serialization, and malformed storage handling.
- Unit tests cover reference diagnostics for valid and missing targets.
- Playwright verifies that metadata changes appear in the visual review list and that `Mark saved` clears the review state.
- Playwright verifies that a history snapshot can be saved, used as a comparison target, and survives page reload.
- Playwright verifies that deleting a selected history snapshot clears it from comparison and persists after reload.
- Playwright verifies that a reference can be inserted from the target picker and that imported missing-target references are reported.
- Playwright verifies that reference targets and broken inline references can be revealed in the editor.
- Playwright verifies that stale reference labels can be detected and updated after a target heading changes.
- Existing Phase 2 tests keep covering schema, export, diff, and round-trip behavior.

## Out Of Scope

- Side-by-side visual document diff
- Accept/reject individual changes
- Multi-user review or comments
- Git-backed history
