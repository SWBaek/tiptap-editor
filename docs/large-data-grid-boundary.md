# Large Data Grid Asset Boundary

Created: 2026-07-03

## Decision

Small authored tables remain canonical `table` nodes. Large engineering datasets such as BOMs, pinouts, signal lists, calibration tables, parameter matrices, and spreadsheet-like review data should use a future asset-backed data grid model instead of expanding canonical tables into spreadsheet behavior.

The future node should store source data in `.sdoc/assets/` and keep `document.json` limited to semantic references and display intent.

## Proposed Shape

```json
{
  "type": "dataGrid",
  "attrs": {
    "id": "blk_grid",
    "sourceAssetId": "asset_pinout.csv",
    "format": "csv",
    "title": "MCU Pinout",
    "caption": "Connector J1 signal assignment"
  }
}
```

`sourceAssetId` points to CSV or JSON data in `assets/`. The asset is part of the `.sdoc` container and must survive pack/unpack round trips.

## Canonical Scope

Allowed canonical attributes should be semantic:

- source asset reference;
- source format such as `csv` or `json`;
- title, caption, and optional column intent;
- optional display hints that affect publishing, such as visible columns or max preview rows.

The following must not be stored in `document.json`:

- selected cell, active row, or edit cursor;
- scroll position or viewport range;
- sort and filter UI state unless explicitly authored as publishing semantics;
- transient column widths from browser layout;
- spreadsheet formulas or computed caches;
- imported row positions from external review sheets.

## Diff And Export

Semantic diff should initially report data grids at block level: source asset changed, title/caption changed, or display metadata changed. Row-level CSV/JSON structural diff is deferred until the source format and merge policy are proven.

Markdown, HTML, PDF, and slide export may render a bounded preview table plus a source asset label. AI/RAG export should include the title, caption, column intent, and optionally sampled rows or summarized chunks, but should avoid dumping huge raw data into every chunk by default.

## UI Scope

The editor should show a preview optimized for scanning, not a full spreadsheet. Editing source data can start as import/replace/export. Rich grid editing, validation rules, and column typing require a separate implementation slice.

## Deferred Work

- `dataGrid` schema implementation;
- CSV/JSON parser and validation rules;
- row-level semantic diff and merge;
- full spreadsheet editing;
- formulas and computed columns;
- external PLM/requirements database connectors.
