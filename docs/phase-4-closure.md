# Phase 4 Closure

Created: 2026-07-03

## Status

Phase 4 Publishing & Advanced Features is accepted for the MVP slice. The work extends SDoc from authoring/review into publishing, advanced authoring, and product-direction boundaries while preserving `document.json` as the only canonical source of truth.

## Completed Scope

- Themed HTML export and print stylesheet.
- CLI PDF export through the HTML print pipeline.
- Browser PDF UX boundary with CLI/Tauri-only PDF messaging.
- Slide export boundary and native PPTX CLI export.
- Draw.io asset-backed diagram model.
- Draw.io external editor / Tauri bridge boundary.
- Advanced rectangular table controls.
- Section folding runtime controls.
- Visual semantic diff overlay boundary and minimal runtime overlay.
- Requirement tagging boundary and minimal `attrs.humanId` schema/export/editor preservation.
- Broken reference inline highlight boundary and minimal runtime inline marker.
- Large data grid asset boundary.
- Corporate template export boundary.

## Canonical Invariants Preserved

- `.sdoc/document.json` remains the source of truth.
- Publishing outputs are derived projections.
- Draw.io source and future large data grids are asset-backed.
- UI/runtime state such as folds, overlays, preview state, temp files, panel state, and export preferences stays out of `document.json`.
- Stable immutable `attrs.id` remains the internal identity key.
- Human-facing IDs such as `humanId` are optional metadata, not identity.
- Semantic diff continues to operate on normalized `document.json`.

## Acceptance Evidence

Evidence is recorded in `docs/phase-4-plan.md`. The implemented slices have unit and Playwright coverage for HTML/PDF/PPTX export behavior, Draw.io asset references, advanced table controls, section folding runtime state, visual diff overlay runtime projection, broken reference inline markers, and `humanId` validation/diff/export/editor preservation. Large data grids and corporate template export remain boundary-only Phase 5 decisions.

Required closure validation:

```text
npm test
npm run build
```

## Deferred To Phase 5

- Tauri desktop shell and native filesystem/file explorer.
- Tauri Draw.io external editor bridge implementation.
- Visual semantic diff overlay implementation.
- Requirement tagging implementation and traceability diagnostics.
- Broken reference inline decorations and repair UX.
- Asset-backed `dataGrid` schema and import/export.
- Corporate `.docx` or template-driven PDF exporter.
- Semantic merge, migration/repair tools, and pilot hardening.

## Handoff

Phase 5 should focus on productizing the strongest user-facing workflows: desktop shell, visual review overlay, requirement tagging, broken reference repair, and native Draw.io editing. Each feature should still follow the established process: boundary document, schema/core impact analysis, headless implementation, CLI or UI wiring, tests, documentation, and commit/push. The active Phase 5 scope is tracked in `docs/phase-5-plan.md`.
