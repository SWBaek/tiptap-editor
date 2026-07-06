# Tauri User Review Action Plan

Created: 2026-07-06

## Source

This document summarizes development changes accepted from the first manual Tauri app review in `docs/user-review/2026-07-06-Tauri-app-review.md`. The review used a built desktop executable and focused on whether the current product feels like a real technical document editor.

## Main Finding

The architecture is still valid, but the product surface is over-weighted toward panels, diagnostics, and advanced workflows. The next development cycle should make the desktop app feel like an editor with a workspace, explorer, outline, writing surface, save flow, and export flow.

## Accepted Changes

- Add a desktop start screen for Open Folder, Open `.sdoc`, New `.sdoc`, and Recent Documents.
- Make Files a real explorer-style panel that shows current workspace contents.
- Treat `.sdoc` as Save/Save As, not as an ordinary export.
- Move `document.json`, AI/RAG outputs, CLI commands, and schema/debug details into Developer/Advanced surfaces.
- Demote Review, References, Traceability, and Data Grid from default first-run prominence.
- Add or prioritize heading numbering, outline/TOC navigation, figure/table captions, figure/table lists, selected-text bubble toolbar, and equation edit UX.
- Improve Draw.io flow from raw import/open buttons to an author-facing Import Existing or Create New choice.
- Add publishing style/profile work for HTML/CSS, company logo, heading/caption presets, and controlled templates.

## Deferred Or Constrained

- Do not make Traceability a primary panel unless a document/workspace profile enables requirement-management mode.
- Do not expose Data Grid controls until a document contains a `dataGrid` block or the user explicitly inserts a dataset.
- Do not store heading numbering labels, generated TOC state, selected text toolbar state, or export dialog state in `document.json`.
- Do not use plain preview SVG as the only Draw.io source. Draw.io creation must preserve editable source XML in `.sdoc/assets/`.
- Do not expand Review into collaboration-grade live tracking before the simpler file/saved-state comparison UX is clear.

## Revised Near-Term Sequence

1. Desktop workspace entry screen. Implemented on 2026-07-06; manual Tauri smoke remains recommended before the next user review.
2. Explorer-first Files panel.
3. Panel information architecture cleanup.
4. Outline/TOC navigation and heading numbering boundary.
5. Caption model and figure/table list boundary.
6. Toolbar grouping and selected-text bubble toolbar.
7. Equation double-click edit flow.
8. Publishing style profiles for HTML/PDF/DOCX.
9. Draw.io create/import flow.

## Acceptance Evidence For The Next Review

- A new user can explain the app as a technical document editor within the first minute.
- The first desktop screen does not imply that a sample document is the user's document.
- The user can open a workspace and see `.sdoc` files.
- The user can create, save, close/reopen, and export a document without touching raw JSON or developer commands.
- Review and diagnostics are discoverable but do not dominate the primary workflow.
- Basic document-structure authoring is visible through headings, outline, and caption/list affordances.
