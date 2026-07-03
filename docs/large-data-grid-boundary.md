# Large Data Grid Asset Boundary

Created: 2026-07-03

## Decision

Small authored tables remain canonical `table` nodes. Large engineering datasets such as BOMs, pinouts, signal lists, calibration tables, parameter matrices, and spreadsheet-like review data use an asset-backed `dataGrid` node instead of expanding canonical tables into spreadsheet behavior.

The node stores source data in `.sdoc/assets/` and keeps `document.json` limited to semantic references and display intent.

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

`sourceAssetId` points to CSV or JSON data in `assets/`. The asset is part of the `.sdoc` container and survives pack/unpack round trips. The schema requires `format` to be `csv` or `json`.

## Canonical Scope

Allowed canonical attributes should be semantic:

- source asset reference;
- source format such as `csv` or `json`;
- title, caption, and optional column intent;
- future optional display hints that affect publishing, such as visible columns or max preview rows.

The following must not be stored in `document.json`:

- selected cell, active row, or edit cursor;
- scroll position or viewport range;
- sort and filter UI state unless explicitly authored as publishing semantics;
- transient column widths from browser layout;
- spreadsheet formulas or computed caches;
- imported row positions from external review sheets.

## Diff And Export

Semantic diff reports data grids at block level: source asset changed, title changed, caption changed, format changed, or display metadata changed. Row-level CSV/JSON structural diff is deferred until the source format and merge policy are proven.

Markdown, HTML, PDF, and slide export render a source asset label and semantic title/caption. Bounded preview rows are deferred. AI/RAG export includes title, caption, and source asset reference via plain text, but does not dump raw source rows by default.

## UI Scope

The editor shows a compact asset-backed preview optimized for scanning, not a full spreadsheet. The web playground can import CSV/JSON assets and insert a `dataGrid` node. Rich grid editing, validation rules, and column typing require a separate implementation slice.

## Implemented V1 Slice

- `dataGrid` is a block-level node with stable `attrs.id`.
- Required attrs: `sourceAssetId`, `format`.
- Optional attrs: `title`, `caption`.
- `.sdoc` pack/unpack validates referenced source assets.
- Markdown, HTML, PDF, slide, AI/RAG, and semantic diff treat the grid as an asset-backed dataset block.
- Browser playground import stores CSV/JSON bytes in `.sdoc/assets/` and keeps raw rows out of `document.json`.

## Deferred Work

- CSV/JSON parser and validation rules;
- row-level semantic diff and merge;
- bounded preview row rendering;
- full spreadsheet editing;
- formulas and computed columns;
- external PLM/requirements database connectors.
