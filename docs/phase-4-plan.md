# Phase 4 Publishing & Advanced Features Plan

Created: 2026-07-03

## Goal

Phase 4 extends SDoc from an authoring/review MVP into a publishing-capable technical document tool. Publishing outputs must remain projections generated from canonical `document.json`; they must not become stored editing state.

## Completed Slice: Themed HTML Export

- Add a deterministic `exportHtml` projection in `@sdoc/export`.
- Keep HTML non-canonical and regenerable from the current document.
- Provide a browser Export panel action that downloads a single `.html` file.
- Embed available browser assets as data URLs so common image figures survive standalone HTML download.
- Support `sdoc export --format html` in the CLI for developer workflows.

## Completed Slice: Phase 4 Next Slice Selection

- Compare PDF export, slide export, Draw.io integration, advanced table editing, and section folding by user value, implementation risk, and dependency order.
- Prefer slices that reuse the canonical document model and current export pipeline.
- Keep PDF/slide work downstream of the HTML projection unless a dedicated renderer proves cleaner.

## Completed Slice: HTML Print Stylesheet

- Add print-specific CSS to generated HTML without changing canonical `document.json`.
- Remove screen-only page chrome such as shadows, borders, and background colors when printing.
- Keep headings with following content and avoid breaking figures, tables, code blocks, callouts, equations, and diagrams across pages where possible.
- Show external HTTP(S) link URLs in print output.

## Current Slice: PDF Export Boundary

- Decide whether MVP PDF export should use browser print-to-PDF, Playwright/Chromium rendering, or a dedicated PDF renderer.
- Keep PDF generation downstream of `exportHtml` unless the renderer cannot preserve technical document structure reliably.
- Define what belongs in browser export, CLI export, and future desktop/Tauri export.

## Acceptance Evidence

- Unit tests cover heading anchors, cross references, HTML escaping, unsafe link blocking, figure asset resolution, and title-based filenames.
- Unit tests cover generated HTML print stylesheet rules.
- CLI tests cover `sdoc export <document> --format html`.
- Playwright verifies the Export side panel exposes and downloads `.html`.

## Boundaries

- Mermaid and KaTeX remain source-preserving static HTML projections for this slice; live rendering can be added later.
- PDF and slide export should build on HTML or a dedicated renderer after the HTML projection is stable.
- The HTML output is a publishing artifact, not an import target or canonical storage format.

## Later Slices

- PDF export
- Slide export
- Draw.io integration
- Advanced table editing
- Section folding
