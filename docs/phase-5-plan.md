# Phase 5 Productization Plan

Created: 2026-07-03
Realigned: 2026-07-06 after first Tauri app user review

## Goal

Phase 5 turns the accepted MVP foundation into a real desktop authoring product. The product must feel like a technical document editor first, not a document-management console, ALM tool, schema debugger, or collection of experimental panels.

The core format rules remain unchanged: `.sdoc/document.json` is canonical, `.sdoc` is the user-facing single ZIP container, exports are derived, and UI/runtime state never enters `document.json`.

## Review-Driven Direction Change

The 2026-07-06 Tauri app review changes the Phase 5 priority order. The next work must focus on author workflow and desktop file entry before adding more review, traceability, data-grid, or publishing depth.

Accepted changes:

- Desktop must not open directly into a sample document when no workspace/document is selected.
- Files must behave like a simple file explorer, with actual folder contents visible.
- Save/Save As is the `.sdoc` workflow; `.sdoc` should not be presented as a normal export target.
- Raw `document.json`, AI/RAG outputs, schema state, data-grid review, and debug previews belong behind Developer/Advanced surfaces.
- Review, References, and Traceability are useful but must not read as the product's primary purpose.
- Core authoring features now outrank advanced review features: heading numbering, outline/TOC navigation, captions, table/figure lists, equation editing, and selected-text formatting.

## Product Principles

- Normal users open a workspace or `.sdoc`, write, save, reopen, and export deliverables.
- The desktop app owns native folder/file workflows; the browser playground remains a browser-safe demo.
- Files, outline, editor body, and save state are primary. Review and diagnostics are secondary.
- Git, unpacked folders, raw JSON, schema details, CLI commands, and AI/RAG exports are optional developer/reviewer workflows.
- Data-grid features appear only when a document actually contains asset-backed data grids.
- Style/profile settings may affect rendering and export, but must not store UI state in canonical body nodes.

## Priority Slice 1: Desktop Workspace Entry

Status: implemented on 2026-07-06; manual Tauri smoke still recommended before the next user review.

Replace the desktop first-run experience with a workspace/document entry screen.

Acceptance criteria:

- Tauri desktop starts at a lightweight start screen when no document or workspace is active.
- Start screen offers Open Folder, Open `.sdoc`, New `.sdoc`, and Recent Documents.
- The web playground may keep sample content, but desktop product mode must not treat sample content as the user's current document.
- Workspace path, recent documents, selected folder, and start-screen state remain runtime/user settings, not `document.json`.
- `npm run build:desktop` documentation and emitted executable name are consistent (`sdoc-desktop.exe`, not `sdoc-destop.exe`).

Acceptance evidence:

- Desktop runtime now shows a Start Screen with Open Folder, Open `.sdoc`, New `.sdoc`, and Recent Documents when no workspace/document is active.
- Browser playground behavior remains unchanged and may still load the sample document.
- Recent documents can retain optional native paths for desktop reopen, stored only as user-local runtime state.
- Playwright covers the desktop-runtime start screen and workspace entry boundary.
- `npm run build:desktop` emits `apps/desktop/src-tauri/target/release/sdoc-desktop.exe`.

## Priority Slice 2: Explorer-First Files Panel

Status: planned next.

Turn Files into a simple VS Code-like explorer instead of a mixed action/status panel.

Acceptance criteria:

- Show current workspace folder and immediate `.sdoc` files clearly.
- Show which document is open and whether it has unsaved changes.
- Move secondary file operations to context menus or compact action menus.
- Keep developer-only unpack/pack commands out of the default author path.
- Do not expose broad filesystem APIs to browser code; continue using the Tauri adapter boundary.

## Priority Slice 3: Information Architecture Cleanup

Status: planned before more feature depth.

Reduce panel overload and make authoring the obvious main workflow.

Acceptance criteria:

- Activity Bar separates primary author surfaces from advanced/reviewer surfaces.
- Primary: Files, Outline, Export, Settings.
- Advanced/optional: Review, Diagnostics, History, Developer.
- References and Traceability move under Diagnostics unless explicitly enabled for a document type/profile.
- Review defaults to comparing saved/current or file A/file B, not unexplained live tracking.
- Export panel shows deliverables first: Markdown, HTML, PDF, DOCX. Raw JSON and AI/RAG outputs move to Developer/AI export.

## Priority Slice 4: Core Authoring UX

Status: planned.

Implement the technical-writing features the review identified as essential.

Acceptance criteria:

- Heading auto-numbering with enable/disable and style profile options.
- Outline/TOC panel generated from headings, with click-to-jump navigation and configurable depth.
- Figure and table captions with stable references and numbering policy.
- Figure list and table list generated from captions.
- Equation editing by double-click or explicit edit action.
- Selected-text bubble toolbar for common inline formatting.

Design constraints:

- Generated heading numbers and list labels should be render/export projections, not text injected into heading content.
- Caption source text is authored content; generated labels such as `Figure 1` are derived from numbering policy.
- Outline, figure list, and table list are runtime/export projections unless a later boundary defines authored list nodes.

## Priority Slice 5: Publishing Style Profiles

Status: planned after core authoring UX.

Make HTML/PDF/DOCX output configurable without turning `document.json` into a page-layout format.

Acceptance criteria:

- Provide style/profile presets for captions and headings, such as IEEE, ISO/IEC, Modern, and Korean.
- Support custom profile settings for HTML export CSS, logo, typography, and document chrome.
- Store app/workspace profile selection outside canonical body content unless the value is document metadata.
- Keep generated exports disposable and regenerable.

## Priority Slice 6: Draw.io Create Or Import Flow

Status: planned after workspace/explorer cleanup.

Improve Draw.io UX from a raw source import into an author-facing choice.

Acceptance criteria:

- Draw.io action asks whether to import an existing diagram or create a new one.
- Import preserves editable Draw.io source in `.sdoc/assets/`.
- Create new makes a source-preserving Draw.io asset, inserts a `diagram` node, and opens it through the desktop bridge when available.
- Preview SVG/PNG remains non-canonical and regenerable.
- Raw XML, temp paths, editor process state, and conflict state stay out of `document.json`.

## Reprioritized Existing Work

Already implemented foundations remain valuable but are no longer Phase 5's next visible product goal:

- Tauri save/open bridge and workspace adapter remain the base for desktop entry and explorer work.
- Review accept/reject, References, Traceability, and History should be retained but visually demoted.
- Data-grid row review and merge remain advanced engineering workflows, shown only when relevant.
- Corporate export/template work remains the base for publishing style profiles.
- Git and unpacked-folder workflows remain hidden developer/reviewer paths.

## Validation Gates

Every slice must run:

```text
npm test
npm run build
```

UI changes also require:

```text
npm run test:e2e
```

Desktop workflow changes require:

```text
npm run typecheck:desktop
npm run build:desktop
```

When interactive native UX changes, update `docs/desktop-native-smoke.md` and run a manual Tauri smoke pass.
