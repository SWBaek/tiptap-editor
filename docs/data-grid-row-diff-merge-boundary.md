# Data Grid Row Diff And Merge Boundary

Created: 2026-07-04

## Decision

Row-level CSV/JSON diff and merge is an asset-level review projection for `dataGrid` nodes. It must not turn `document.json` into a spreadsheet model. The canonical document keeps only the `dataGrid` block, semantic metadata, and asset references; row content remains in `.sdoc/assets/`.

## Scope

The first implementation should provide a headless row diff model for two referenced CSV/JSON assets and a guarded merge apply path. It may surface added rows, deleted rows, modified cells, duplicate keys, missing keys, column mismatches, invalid source data, and stale merge attempts.

The implementation should reuse the existing data grid parsing and diagnostics path where possible. It should not add live spreadsheet editing, formulas, virtualized grid authoring, external database sync, or collaborative cell locking.

## Row Identity Policy

Reliable row identity is required for semantic row diff and merge.

- If future schema adds `dataGrid.attrs.keyColumns`, those column names are authored semantic metadata and must validate against the referenced asset.
- Until explicit key columns exist, v1 may infer a review-only key from common columns such as `id`, `key`, or `name`, but automatic merge must require user confirmation.
- If no reliable key exists, the product should show row count, column, and parse diagnostics only. It must not approximate row merge by raw line numbers.
- Duplicate or empty row keys are conflicts, not mergeable changes.

## Diff Event Model

Row-level events should be a separate `DataGridDiffEvent` view-model linked to the parent `dataGrid.attrs.id` and `sourceAssetId`. They are not normal `SDocDiffEvent` block events until a stable public event contract is documented.

Each event should include the grid block ID, source asset ID, row key, column name when applicable, old/new values or summaries, and severity. Raw CSV/JSON text should be available only as debug/export detail, not as canonical diff data.

## Merge Semantics

Accepting row changes writes updated CSV/JSON bytes through the asset layer. It does not store row patches, conflict state, selected rows, or merge decisions in `document.json`.

The guarded merge path must:

- recompute diagnostics and row diff before applying a stored decision;
- refuse stale events when the source asset changed;
- preserve the source format when possible;
- create or update an asset according to the active asset policy;
- update `sourceAssetId` only when a new asset revision is created;
- validate the resulting `.sdoc` pack/unpack path and deterministic serialization.

## UI Boundary

The editor should present row diff as a review tool attached to the `dataGrid` block. Selected row, expanded conflict, preview mode, and pending accept/reject choices are runtime state and must stay outside `document.json`.

## Acceptance Criteria

- A boundary document defines row identity, diff event shape, merge semantics, and deferred work.
- `docs/diff-model.md` states that row-level grid diff is an asset projection, not raw line diff.
- `docs/large-data-grid-boundary.md` links this boundary from the deferred row diff section.
- Headless row diff projection adds unit coverage for keyed CSV and JSON rows, duplicate keys, and no-key fallback.
- Guarded merge apply adds unit coverage for stale merge refusal and asset-only source writes.

## Implemented V1 Slice

- `createDataGridRowDiff` creates a headless `DataGridRowDiff` projection for two CSV/JSON asset sources.
- Explicit `keyColumns` are honored when provided as runtime review options.
- Without explicit keys, review projection may infer a shared `id`, `key`, or `name` column.
- Missing keys and duplicate keys are reported as conflicts.
- If no reliable key exists, the function refuses row-level diff instead of comparing raw line numbers.
- JSON row diff currently supports object-row arrays. JSON array-row diff is deferred until explicit column/key metadata exists.
- `applyDataGridRowMerge` recomputes the diff before applying a selected row event, refuses conflicting/no-key diffs, refuses stale current asset sources, and returns updated CSV/JSON source text without mutating `document.json`.

## Deferred Work

- authored `keyColumns` schema extension;
- asset revision policy for save-back, including whether a merge updates the current asset ID or creates a new asset ID;
- CLI or UI wiring for selecting and applying row merge events;
- visual side-by-side cell diff UI;
- multi-user conflict resolution;
- formula-aware spreadsheet merge;
- PLM, requirements database, or external spreadsheet connectors.
