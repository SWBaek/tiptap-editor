# Authoring Structure Projections

Created: 2026-07-06

## Purpose

Phase 5 authoring UX adds visible document structure without turning `document.json` into page layout or panel state. Heading numbers, outline depth, figure labels, table labels, and editor affordances are runtime/export projections unless this document states otherwise.

## Heading And Outline

- Heading numbers are generated from heading order and level.
- Generated numbers are rendered in the editor and outline, but are not inserted into heading text.
- Outline depth is UI runtime state and must not be stored in `document.json`.

## Figures

- Figure captions are authored canonical content because `figure` already contains a caption paragraph.
- Generated labels such as `Figure 1` are projections derived from document order.
- Figure list entries use stable figure block IDs for navigation.

## Tables

- v1 table captions are authored semantic metadata stored as optional `table.attrs.caption`.
- `caption` must be a non-empty string when present. Empty captions should remove the attr instead of storing blank text.
- Generated labels such as `Table 1` are projections derived from document order and must not be stored.
- The table list uses authored captions when present, then falls back to first-row header text and row/column summaries.
- Table captions participate in validation, deterministic serialization, semantic diff, Markdown/HTML/DOCX/PPTX exports, and tests.

## Equations

- Equation rendering is a projection from `attrs.latex`.
- Editing an equation updates only the existing inline `equation` or block `equationBlock` `attrs.latex` value.
- Selection state, double-click state, and edit prompts are runtime UI state and must not be serialized.
