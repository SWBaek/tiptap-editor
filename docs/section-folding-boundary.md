# Section Folding Boundary

Created: 2026-07-03

## Decision

Section folding is an editor navigation feature, not a canonical document feature. The canonical `document.json` already contains the semantic structure needed to derive foldable ranges: headings with stable block IDs and heading levels. Collapsed or expanded state must not be stored in `document.json`.

## Fold Model

A foldable section starts at a `heading` block and includes following sibling blocks until the next heading with the same or higher level. The section identity should use the heading block `attrs.id`, not its position or title. This keeps folding stable across edits, reordering, and heading text changes.

Example:

```text
h1 blk_intro
  paragraph blk_a
  h2 blk_detail
    paragraph blk_b
h1 blk_next
```

`blk_intro` folds `blk_a` and the nested `blk_detail` section until `blk_next`. `blk_detail` folds only `blk_b`.

## State Boundary

Allowed runtime state:

- current collapsed heading IDs
- temporary reveal/focus state after navigation
- user-local folding preferences in browser local storage or future Tauri settings

Forbidden canonical state:

- `heading.attrs.collapsed`
- fold ranges persisted in `document.json`
- UI-only outline expansion state in `.sdoc`
- generated fold caches in `derived/`

If a future product needs authored disclosure content, it should be modeled as a separate semantic node such as `details` or `accordion`, not by reusing editor folding state.

## Browser Scope

The browser playground may provide heading-level fold/unfold controls and an outline-driven command such as "fold all level 2 sections". It should keep folding local to the current editor session unless explicit user-local preferences are added later. Fold state must reset safely when a different document opens.

## Runtime Controls

The first implementation derives fold ranges from top-level heading blocks and their stable `attrs.id` values. Toolbar actions can fold the selected heading section, unfold the selected heading, or unfold all sections. The implementation applies CSS classes to editor DOM nodes with matching `data-id` values; it does not dispatch ProseMirror transactions or write fold state into the SDoc model.

Fold state is pruned when headings disappear or stop being foldable, and it resets when a new document is created or opened. Hidden content remains in the editor document, preview projections, validation, semantic diff, and `.sdoc` save path.

## Diff And Export

Semantic diff, Markdown, HTML, PDF, slide, and AI/RAG exports must ignore editor fold state. Folding should never hide content from export or validation. Folded content remains part of the document and must continue to participate in references, diff, and derived outputs.

## Deferred Work

- authored disclosure/accordion blocks
- persisted per-document folding preferences
- collaborative shared fold state
- outline tree drag-and-drop reordering
- folding inside tables, figures, code blocks, or custom node views
