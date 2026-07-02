# Advanced Table Editing Boundary

Created: 2026-07-03

## Decision

Advanced table editing should extend the existing `table`, `tableRow`, `tableHeader`, and `tableCell` nodes without introducing a separate table format. The first implementation slice should improve authoring controls while keeping the canonical table model simple, deterministic, and friendly to semantic diff.

## Canonical Scope

The following table attributes may become canonical because they describe document semantics:

- cell role through node type: `tableHeader` or `tableCell`
- optional cell alignment: `attrs.align = "left" | "center" | "right"`
- optional row or column header intent when represented through header cells

The following must not be stored in `document.json`:

- selected cell, active row, drag handle, resize handle, or hover state
- transient column widths from browser layout
- editor plugin state used only by Tiptap
- copied table UI metadata that does not affect exported document meaning

## V1 Editing Scope

The next implementation slice should focus on controls that preserve a rectangular table and do not require merged-cell diff logic:

- insert row before/after
- insert column before/after
- delete selected row or column
- toggle header row and header column
- set cell alignment

These operations should preserve stable block IDs for unchanged rows and cells. New rows, columns, and cells must receive fresh `attrs.id` values. Removing rows or columns should produce normal semantic diff events through the existing table diff summary.

## Export And Diff

Markdown export should continue using pipe tables. Cell alignment may be reflected in the Markdown separator row when possible, for example `:---`, `:---:`, or `---:`. HTML export should render alignment as `style="text-align: ..."` or a deterministic class.

Semantic diff should remain table-level for v1 advanced editing. It may summarize row count, column count, header role changes, alignment changes, and changed cell text. It should not emit noisy per-cell move events unless a future table-specific diff model is introduced.

## Deferred Work

- merged cells, `rowspan`, and `colspan`
- nested tables
- table formulas or computed cells
- persistent column width/layout storage
- structural table merge conflict resolution
- spreadsheet-like selection model in canonical data

## Minimal Controls Implementation

The first implementation slice adds rectangular table controls for adding rows/columns after the current cell, deleting the current row/column, toggling header row/column, and setting cell alignment. `attrs.align` is canonical only for `tableCell` and `tableHeader`, and validation accepts `left`, `center`, or `right`. Markdown export maps alignment to pipe-table separators, HTML export renders deterministic text alignment, and semantic diff summarizes role/alignment changes at the table block.
