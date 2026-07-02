# Phase 3 Review Workflow Plan

작성일: 2026-07-02

## Goal

Phase 3 turns the semantic diff engine into a review workflow. The first slice stays local and browser-only: compare the current document against the saved baseline, show reviewable change groups, and let the user reset the baseline with the existing save/mark-saved action.

## First Slice Scope

- Keep the existing raw diff output for debugging and copy/paste.
- Add a structured diff review panel with total, document, and metadata counts.
- Group readable semantic diff lines into document and metadata sections.
- Surface the same count in the sidebar as review state.
- Treat `Mark saved`, `.sdoc` save, JSON save, new document, and open document as baseline updates.

## Acceptance Evidence

- Unit tests cover the structured review summary model.
- Playwright verifies that metadata changes appear in the visual review list and that `Mark saved` clears the review state.
- Existing Phase 2 tests keep covering schema, export, diff, and round-trip behavior.

## Out Of Scope

- Persistent local history storage
- Side-by-side visual document diff
- Accept/reject individual changes
- Multi-user review or comments
- Git-backed history
