# Word Template Injection Boundary

Created: 2026-07-04

## Decision

External `.dotx` or `.docx` templates are export policy inputs, not canonical SDoc content. They may shape a derived Word artifact, but they must not change `document.json`, add page-layout state to nodes, or make normal `.sdoc` authoring depend on Microsoft Word.

The built-in `controlled` DOCX exporter remains the fallback. Company-specific Word templates require a separate adapter that maps normalized SDoc blocks into approved placeholder regions or styles.

## Template Source Policy

Accepted template locations:

- explicit CLI option such as `--template-file company.dotx`;
- workspace or project policy managed outside the `.sdoc` body;
- future Tauri app settings or trusted organization policy.

Do not store absolute template paths, recently used templates, chosen output paths, preview state, or rendered Word package state in `document.json`. If a template file is bundled into `.sdoc/assets/` later, it is an asset reference used by export policy, not canonical body content.

## Adapter Contract

A Word template adapter consumes normalized `SDocDocument`, metadata, resolved assets, derived outline/reference information, an explicit template source, and export options. It produces a disposable `.docx` artifact.

The adapter should support:

- mapping SDoc headings, paragraphs, tables, figures, diagrams, equations, and data grids into Word styles or content controls;
- preserving editable text where practical;
- keeping source block IDs in custom properties, comments, bookmarks, or debug metadata only when useful for review;
- failing with clear diagnostics when required placeholders/styles are missing.

The first mapping implementation validates the contract only. It checks that a safe `.docx/.dotx` package exposes required style IDs and content-control placeholders before any future renderer writes SDoc content into that template.

The first render skeleton accepts `--template-file` for DOCX export, validates the package and mapping contract, then emits the current editable fallback DOCX while recording the validated template file in derived metadata. It does not yet splice SDoc blocks into the template package.

## Safety Boundary

Template files are untrusted binary Office packages until validated. The implementation must reject or strip macros, embedded scripts, external relationships, remote images, and unexpected package parts before using a template.

The first implementation should inspect the ZIP package and allow only a narrow `.dotx/.docx` subset. It should never execute template code and should not open Word as part of headless export.

## Merge Semantics

Template injection is one-way: SDoc to derived Word. Editing the generated `.docx` does not update `document.json` unless a future import/review workflow is explicitly designed and tested.

## Acceptance Criteria

- Boundary documentation defines template source policy, adapter contract, safety rules, and one-way export semantics.
- `docs/corporate-template-export-boundary.md` links this boundary from deferred external template work.
- `docs/phase-5-plan.md` distinguishes built-in controlled DOCX export from future external template injection.
- `validateWordTemplatePackage` inspects `.docx/.dotx` packages before any future injection path uses them.
- `sdoc template validate <template.docx|template.dotx>` exposes the package safety check for developer/reviewer workflows.
- `validateWordTemplateMapping` reports missing required Word styles and content-control placeholders without mutating canonical document data or rendering a derived file.
- `sdoc template validate-mapping <template.docx|template.dotx> --style nodeType=StyleId --placeholder tag` exposes mapping diagnostics for developer/reviewer workflows.
- `exportDocx(..., { externalTemplate })` and `sdoc export --format docx --template-file company.dotx` validate an external template before producing a derived Word handoff.
- Future implementation includes tests for template package validation, missing placeholders/styles, canonical document immutability, and deterministic output for the same template/input pair.

## Deferred Work

- `.dotx` style/content-control rendering from SDoc blocks;
- company policy registry and template management UI;
- Word review import/redline workflows;
- visual/rendered DOCX regression checks.
