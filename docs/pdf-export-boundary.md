# PDF Export Boundary

Created: 2026-07-03

## Decision

PDF export should be downstream of `exportHtml`. The canonical document remains `document.json`; PDF is a publishing artifact generated from the themed, print-ready HTML projection.

## Browser Scope

The browser playground should keep exposing `.html` export and print-ready styling. It should not claim direct PDF file generation until the browser workflow can reliably produce a file without confusing popup, print-dialog, or permission behavior.

Acceptable browser behavior:

- download single-file `.html`;
- include print CSS for browser Save as PDF;
- show PDF as a CLI/Tauri workflow rather than a browser download;
- provide a copyable CLI command for saved `.sdoc` files;
- keep `.sdoc`, Markdown, HTML, and AI/RAG exports user-facing;
- avoid storing PDF output or print settings in `document.json`.

## CLI Scope

The CLI owns the first real PDF generation path:

```bash
npm run sdoc -- export "document.sdoc" --format pdf -o "document.pdf"
```

Implementation notes:

- use `exportHtml` as the source projection;
- render with Playwright/Chromium print emulation;
- require `-o output.pdf` because PDF is binary and should not be written to text stdout;
- keep PDF output regenerable and outside `.sdoc` canonical state.

## Future Tauri Scope

The desktop app can wrap the CLI-grade renderer behind a native save dialog and progress/error UI. It may also preserve user-level export preferences, but those preferences should be app settings, not canonical document fields.

## Deferred

- Browser one-click PDF download
- PDF theme presets
- PDF metadata, headers, footers, and page numbers
- Mermaid/KaTeX live rendering inside PDF output
- PDF visual regression tests
