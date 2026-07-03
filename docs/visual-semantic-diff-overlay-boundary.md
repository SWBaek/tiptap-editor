# Visual Semantic Diff Overlay Boundary

Created: 2026-07-03

## Decision

The visual review overlay should project the existing `SDocDiffEvent` model into the editor surface. It must not create a second diff format, store review UI state in `document.json`, or make Git a prerequisite for normal review.

The source diff remains normalized `document.json` compared through `diffDocuments`. The overlay is a presentation layer for non-developer reviewers who need to see changed blocks and broken references near the authored content.

## Event Mapping

The first overlay implementation should map semantic events as follows:

- `added`: mark the new block with an inserted-block badge and subtle inserted background.
- `deleted`: show a deleted-block placeholder in the review layer, using the old block label and path when the block no longer exists in the current editor tree.
- `modified`: mark the current block and show its readable change summary near the block.
- `moved`: mark the current block with a moved badge and expose the old/new paths in a tooltip or side detail.
- `reference-broken`: mark the inline cross-reference when it exists in the current editor tree and mirror it in the References/Review panels.

Inline word-level highlights may reuse the readable text summary for v1. A precise inline tokenizer can be added later without changing the event contract.

## Runtime State Boundary

The following are runtime UI state and must not be stored in `document.json`:

- overlay enabled/disabled state;
- event filters and selected event;
- reviewer cursor or scroll position;
- expanded/collapsed review details;
- accept/reject preview state;
- decoration IDs produced by Tiptap or ProseMirror.

If a future accept/reject workflow is added, accepting a change must produce a normal edited SDoc document that passes validation, normalization, deterministic serialization, and semantic diff checks.

## UI Scope

The web playground may add a review overlay toggle in the Review Activity panel and render block-level decorations in the editor. It should keep the existing Diff preview as the authoritative textual/debug view.

The overlay should degrade gracefully:

- if a deleted block has no current DOM anchor, show it in the Review panel only;
- if an event path is stale after editing, recompute from the current baseline before rendering;
- if a block ID is missing or duplicated, validation should fail before overlay rendering claims accuracy.

## Styling And Accessibility

Overlay styling should use restrained colors and labels that work in dense technical documents. Inserted, deleted, modified, moved, and broken-reference states need distinct accessible names, not color-only meaning.

## Tests

Implementation should add focused tests for event-to-overlay view-model mapping before wiring editor decorations. UI tests should verify that toggling the overlay does not mutate `document.json` and that broken references remain visible in the review surface.

## Initial Implementation

Implemented on 2026-07-03:

- `SDocDiffEvent` is projected into runtime review items with label, summary, detail, anchorability, and filter counts.
- The Review Activity panel exposes event filters, a selectable semantic event list, and inline overlay toggle.
- Selecting an anchorable event focuses the matching editor node by stable `data-id`; deleted events remain review-panel only.
- Overlay CSS is generated at runtime from filtered review items and selected event ID.
- No overlay enabled state, selected event, or filter state is written to `document.json`.

Extended on 2026-07-04:

- `docs/review-accept-reject-boundary.md` defines accept/reject as controlled edit semantics over normalized SDoc documents.
- A runtime-only review action plan classifies accept/reject availability from projected semantic review items.
- Broken reference events are routed to the References repair workflow instead of direct accept/reject.
- Single-event and visible-event batch accept/reject actions apply through headless semantic diff helpers with stale-event protection.
- The Diff tab renders side-by-side baseline/current block previews from the same semantic diff events and keeps the raw textual diff for debugging.

## Deferred Work

- full inline word decoration from token spans;
- advanced conflict resolution UI for partially applied batches;
- comment threads and reviewer assignments;
- Git-backed PR review integration.
