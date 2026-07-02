# Native PPTX Export Boundary

Created: 2026-07-03

## Decision

Native PPTX export is a derived publishing projection from canonical `document.json`. It must not introduce slide-specific canonical nodes, manual layout state, speaker notes, theme choices, or export preferences into `.sdoc` v1.

The v1 implementation should be CLI-first and renderer-backed by a programmable PPTX writer. PptxGenJS is the preferred initial candidate because its official documentation supports generation from Node, React, and browsers, and it can create editable PowerPoint objects such as text, tables, shapes, images, charts, and slide masters. Do not add the dependency until the implementation slice.

## Renderer Strategy

Prefer direct native PPTX generation over screenshotting HTML. Editable output matters more than pixel-perfect reproduction for this product because reviewers should be able to inspect and adjust generated decks. HTML or PDF rendering may still inform layout heuristics, but v1 PPTX should emit native text, table, image, and shape objects where practical.

Mermaid, KaTeX, and Draw.io previews may be inserted as raster/SVG images in v1 when native conversion is not available. Their source remains in `document.json` or `.sdoc/assets/` and is not replaced by the generated visual.

## Source Mapping

Use the existing slide export boundary as the default grouping model:

- `h1` starts a deck section or title divider.
- `h2` starts a candidate content slide.
- content before the first `h2` becomes an overview slide.
- stable block IDs should be carried into internal speaker notes, comments, or custom properties only if the renderer supports it without visible clutter.
- paragraphs, lists, callouts, figures, tables, equations, and diagrams map to editable native objects where feasible.

If a section is too dense, v1 may split slides by block count or estimated content height. This split is an export heuristic, not canonical state.

## CLI Scope

The first durable command should be:

```bash
npm run sdoc -- export "document.sdoc" --format pptx -o "deck.pptx"
```

PPTX is binary, so `-o` should be required. The command must accept `.sdoc`, unpacked `.sdoc` folders, and `document.json` inputs consistently with existing export formats.

## Browser And Tauri Scope

The browser playground should initially expose PPTX as a CLI/Tauri boundary command, not as a direct download, until bundle size, browser asset handling, and output fidelity are verified. A later browser download is acceptable only if it uses the same projection model and does not store export state in `document.json`.

Future Tauri can wrap the CLI-grade exporter with a native save dialog and progress/error reporting.

## Validation And Tests

Implementation must add tests for:

- deterministic deck structure for the same `document.json`;
- CLI output existence and non-empty `.pptx` bytes;
- title/section mapping from `h1` and `h2`;
- asset-backed figures and Draw.io previews;
- absence of PPTX/export state in `document.json`;
- browser UI boundary if an Export panel command is added.

## Deferred

- manual slide layout editor
- `.sdoc` slide nodes
- persisted deck themes
- round-trip PPTX import
- native Mermaid or KaTeX object conversion
- PowerPoint visual regression testing
