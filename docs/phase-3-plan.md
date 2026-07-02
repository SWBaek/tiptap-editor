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

## Current Slice: Local History Management

- Let users delete browser-local snapshots.
- Clear a deleted snapshot as the comparison target and return to the saved baseline.
- Persist deletion to localStorage so removed snapshots do not reappear after reload.

## Acceptance Evidence

- Unit tests cover the structured review summary model.
- Unit tests cover local history snapshot creation, capping, serialization, and malformed storage handling.
- Playwright verifies that metadata changes appear in the visual review list and that `Mark saved` clears the review state.
- Playwright verifies that a history snapshot can be saved, used as a comparison target, and survives page reload.
- Playwright verifies that deleting a selected history snapshot clears it from comparison and persists after reload.
- Existing Phase 2 tests keep covering schema, export, diff, and round-trip behavior.

## Out Of Scope

- Side-by-side visual document diff
- Accept/reject individual changes
- Multi-user review or comments
- Git-backed history
