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

- v1 tables do not yet have a canonical caption field.
- The current table list is a projection from table block IDs, row/column count, and first-row header text.
- Do not add table caption storage without updating `docs/editor-schema.md`, validation, serialization, diff, export, and tests.

## Equations

- Equation rendering is a projection from `attrs.latex`.
- Editing an equation updates only the existing inline `equation` or block `equationBlock` `attrs.latex` value.
- Selection state, double-click state, and edit prompts are runtime UI state and must not be serialized.
