# Corporate Template Export Boundary

Created: 2026-07-03

## Decision

Corporate template export is a publishing renderer, not a replacement for canonical `document.json` and not a reason to store page layout state in the document model. The current HTML-to-PDF pipeline remains the MVP publishing path.

Enterprise deliverables that require controlled headers, footers, watermarks, document-control blocks, approval tables, page numbering, strict typography, or `.docx` handoff should be handled by a dedicated template exporter.

## Export Targets

Supported v1 targets:

- controlled HTML/PDF template through `sdoc export --format html|pdf --template controlled`.
- controlled `.docx` handoff through `sdoc export --format docx --template controlled`.

Likely future targets:

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

The initial `controlled` template reads optional metadata such as `documentNumber`, `version`, `author`, `classification`, `approvalStatus`, and `effectiveDate`. These values are export metadata and document-control labels; they do not create new canonical body nodes.

## Renderer Contract

A future template renderer should consume:

- normalized `SDocDocument`;
- document metadata;
- resolved assets;
- derived outline/reference information regenerated from canonical input;
- explicit export options.

It should produce binary artifacts outside canonical storage. If generated files are included under `.sdoc/derived/`, they must remain disposable and regenerable.

## MVP Relationship

The current CLI PDF export through themed HTML and Playwright remains the default MVP publishing path. The `controlled` template adds a document-control header, footer, watermark label, and print-friendly CSS when explicitly requested.

Example:

```text
npm run sdoc -- export document.sdoc --format html --template controlled -o document.controlled.html
npm run sdoc -- export document.sdoc --format pdf --template controlled -o document.controlled.pdf
```

## Implemented V1 Slice

- `exportHtml(document, { template: "controlled", metadata })` renders controlled enterprise chrome.
- CLI `sdoc export` accepts `--template controlled` for HTML and PDF.
- `exportDocx(document, { template: "controlled", metadata })` emits a derived OOXML `.docx` package with editable text, headings, tables, data grid references, and document-control metadata.
- CLI `sdoc export --format docx --template controlled -o output.docx` exposes the derived Word handoff path.
- `validateWordTemplatePackage` and CLI `sdoc template validate <template.docx|template.dotx>` reject unsafe external Word template packages before future injection work.
- `validateWordTemplateMapping` and CLI `sdoc template validate-mapping` verify required Word style IDs and content-control placeholders before future template rendering work.
- CLI `sdoc export --format docx --template-file company.dotx -o output.docx` validates an external template and injects SDoc body content into the `sdoc-body` content control.
- CLI `--template-style nodeType=StyleId` applies validated company Word styles to matching rendered SDoc blocks.
- External Word templates may include optional `sdoc-approval-table` and `sdoc-revision-history` content controls, which are filled from export metadata as derived Word output.
- Template selection is an explicit export option and is not stored in `document.json`.
- Strict enterprise pagination remains deferred.

## Deferred Work

- richer company-specific `.dotx`/`.docx` content-control rendering following `docs/word-template-injection-boundary.md`;
- strict page header/footer support;
- approval workflow modeling and multi-row revision history management;
- watermark and classification markings;
- corporate theme management UI;
- PDF visual regression tests.
