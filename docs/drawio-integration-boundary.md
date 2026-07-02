# Draw.io Integration Boundary

Created: 2026-07-03

## Decision

Draw.io support starts as a source-preserving asset integration, not as a new canonical document format. Editable Draw.io source belongs in `.sdoc/assets/`, while `document.json` stores only semantic references to that source.

The v1 schema should reuse the existing `diagram` node shape with Draw.io-specific attributes:

```json
{
  "type": "diagram",
  "attrs": {
    "id": "blk_drawio",
    "kind": "drawio",
    "sourceAssetId": "asset_architecture.drawio",
    "previewAssetId": "asset_architecture.svg"
  }
}
```

`sourceAssetId` is required for editable Draw.io diagrams. `previewAssetId` is optional and points to a generated SVG or PNG preview when available.

## Canonical Boundary

- `document.json` must not embed Draw.io XML, generated SVG, PNG data, editor viewport state, or export cache.
- Draw.io source assets are part of the `.sdoc` container and must survive pack/unpack round trips.
- Preview images are non-canonical projections. They may live in `assets/` for portability or `derived/` when they are purely regenerated output.
- HTML, PDF, slide, AI/RAG, and Markdown outputs consume the diagram reference; none become import targets.

## Storage Policy

Implementation should introduce a small policy or adapter boundary, such as `DiagramSourceStore`, instead of hardcoding Draw.io storage rules in UI components. The default policy stores source files under `.sdoc/assets/`, but future policies may support external enterprise asset stores, Tauri-managed local files, or user-selected storage modes.

## Browser Scope

The browser MVP may import a `.drawio` or `.drawio.xml` file, store it as an asset, and render a static preview or source-preserving placeholder. It must not claim native folder watching, external file links, or full Draw.io editing. Embedded Draw.io editor integration is deferred until source ownership, save behavior, and conflict handling are proven.

## Diff And Export

Semantic diff should initially report Draw.io changes at the diagram block level: source asset changed, preview changed, caption changed, or attributes changed. Raw XML structural diff is deferred. Exports should prefer the preview asset when present and fall back to a labeled diagram placeholder that preserves the block ID and source asset reference.

## Deferred Work

- Embedded Draw.io editor round trip.
- Structural XML diff and merge.
- Live preview generation in browser.
- External path references for normal users.
- Tauri file watching and external editor integration.

## Minimal Asset Model Implementation

The first implementation slice accepts `diagram.attrs.kind = "drawio"` in schema validation, requires `sourceAssetId`, and preserves optional `previewAssetId`. `.sdoc` pack/save paths include both referenced assets, deterministic serialization omits `null` runtime attributes, and semantic diff reports source/preview asset changes without diffing raw XML. Markdown and HTML exports prefer the preview asset when present and otherwise emit a source-preserving placeholder.
