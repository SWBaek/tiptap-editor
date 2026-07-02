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

## Completed Slice: PDF Export Boundary

- Decide whether MVP PDF export should use browser print-to-PDF, Playwright/Chromium rendering, or a dedicated PDF renderer.
- Keep PDF generation downstream of `exportHtml` unless the renderer cannot preserve technical document structure reliably.
- Define what belongs in browser export, CLI export, and future desktop/Tauri export.
- Use `docs/pdf-export-boundary.md` as the boundary document.

## Completed Slice: CLI PDF Export

- Add `sdoc export <input.sdoc|document.json> --format pdf -o output.pdf`.
- Render PDF through the existing `exportHtml` projection and Playwright/Chromium print emulation.
- Require an output path because PDF is binary output.

## Completed Slice: Browser PDF UX Boundary

- Decide whether the web playground should expose a print command, a PDF-ready HTML action, or defer direct PDF UX to Tauri.
- Avoid claiming browser PDF generation unless it can produce a file reliably.
- Keep the Export panel focused on outputs that the browser can actually download today.
- Expose PDF as a CLI/Tauri workflow in the Export panel with a copyable `sdoc export --format pdf` command.

## Current Slice: Slide Export Boundary

- Decide whether slides should be generated from sections/headings, explicit slide nodes, or a separate projection of the canonical document.
- Avoid adding slide-specific canonical state until the mapping from technical documents to decks is clear.
- Prefer an export boundary document before implementation.

## Acceptance Evidence

- Unit tests cover heading anchors, cross references, HTML escaping, unsafe link blocking, figure asset resolution, and title-based filenames.
- Unit tests cover generated HTML print stylesheet rules.
- CLI tests cover `sdoc export <document> --format html`.
- CLI tests cover PDF generation through the HTML print pipeline.
- Playwright verifies the Export side panel exposes and downloads `.html`.
- Playwright verifies the Export side panel marks PDF as CLI/Tauri-only and exposes a PDF CLI command without pretending the browser downloads PDF.

## Boundaries

- Mermaid and KaTeX remain source-preserving static HTML projections for this slice; live rendering can be added later.
- PDF and slide export should build on HTML or a dedicated renderer after the HTML projection is stable.
- The HTML output is a publishing artifact, not an import target or canonical storage format.

## Later Slices

- Slide export
- Draw.io integration
- Advanced table editing
- Section folding
