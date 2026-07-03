# Corporate Template Export Boundary

Created: 2026-07-03

## Decision

Corporate template export is a future publishing renderer, not a replacement for canonical `document.json` and not a reason to store page layout state in the document model. The current HTML-to-PDF pipeline remains the MVP publishing path.

Enterprise deliverables that require controlled headers, footers, watermarks, document-control blocks, approval tables, page numbering, strict typography, or `.docx` handoff should be handled by a dedicated template exporter.

## Export Targets

Likely future targets:

- `.docx` for editable enterprise review and controlled document workflows;
- template-driven PDF for locked deliverables;
- HTML/PDF with corporate theme presets when strict pagination is not required.

Each target must remain a derived projection from normalized `document.json`.

## Configuration Boundary

Template choices and export preferences belong outside required canonical document fields. Acceptable locations:

- explicit CLI options such as `--template company-a`;
- project policy files managed by the app or workspace;
- user/app settings in a future Tauri desktop app;
- optional document metadata only when the value is authored document meaning, not UI preference.

Do not store export dialog state, last output path, selected printer, page preview state, or generated document-control numbering cache in `document.json`.

## Renderer Contract

A future template renderer should consume:

- normalized `SDocDocument`;
- document metadata;
- resolved assets;
- derived outline/reference information regenerated from canonical input;
- explicit export options.

It should produce binary artifacts outside canonical storage. If generated files are included under `.sdoc/derived/`, they must remain disposable and regenerable.

## MVP Relationship

The current CLI PDF export through themed HTML and Playwright is sufficient for MVP publishing. Corporate template export should not block Phase 4 closure unless a pilot user explicitly requires controlled enterprise deliverables before evaluation.

## Deferred Work

- `.docx` renderer selection and template format;
- strict page header/footer support;
- approval table and revision history rendering;
- watermark and classification markings;
- corporate theme management UI;
- PDF visual regression tests.
