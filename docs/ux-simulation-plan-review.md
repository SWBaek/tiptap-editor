# UX Simulation Plan Review

Created: 2026-07-03

## Source

This document records planning decisions from reviewing `docs/gemini-review/ux-simulation-review.md`. The review is useful as a product-risk simulation, but repository documents, code behavior, and tests remain the source of truth.

## Accepted Changes

- Add a visual semantic diff overlay. Textual diff logs are useful for CLI/debugging, but non-developer reviewers need inline insert/delete/change markers in the editor surface.
- Add a requirement-tagging boundary. Human-facing IDs such as `REQ-OBC-012` should be optional canonical metadata, while immutable `attrs.id` remains the internal identity key.
- Add broken-reference inline highlighting. Existing reference checks should surface directly near broken links, not only in side panels or CLI output.
- Prefer a Tauri external-editor bridge for Draw.io before deep iframe embedding. Browser-only integration should remain source-preserving import and preview.
- Add a large data grid boundary for CSV/JSON-backed BOM, pinout, and parameter tables stored in `.sdoc/assets/`.
- Add a corporate template export boundary for controlled Word/PDF deliverables that need headers, footers, document-control blocks, and enterprise templates.

## Deferred Or Rejected

- Do not make Git mandatory. Git remains a developer/reviewer workflow, not a prerequisite for normal users.
- Do not replace stable block IDs with human-readable IDs. Requirement IDs may change; block identity must not.
- Do not turn the canonical table model into a spreadsheet. Small authored tables remain canonical; large tabular datasets need a separate asset-backed model.
- Do not remove the current HTML-to-PDF pipeline. It is acceptable for MVP publishing; corporate template output is a future renderer.
- Do not implement embedded Draw.io iframe editing until save ownership, conflict handling, and preview regeneration are proven.

## Planning Impact

Phase 4 should continue in small slices. The next Draw.io planning slice is renamed to `Draw.io External Editor / Tauri Bridge Boundary`. New later slices should cover visual review overlay, requirement tagging, broken-reference highlights, large data grids, and corporate template export.
