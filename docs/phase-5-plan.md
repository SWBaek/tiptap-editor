# Phase 5 Productization Plan

Created: 2026-07-03
Realigned: 2026-07-06 after first Tauri app user review
Realigned: 2026-07-18 for existing-product experience parity

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

## Phase 5.1 Existing Product Experience Parity

Status: in progress. The authoritative feature classification, current evidence, ordered slices, and stop rule are in `docs/existing-product-parity-plan.md`.

Phase 5.1 does not clone the previous product. It adopts or adapts author-facing interactions that improve writing while rejecting the previous plain JSON `.sdoc`, derived/position-based identity, frontend mirrors, and developer-first defaults.

Ordered slices:

1. Extract the monolithic app shell, toolbar, panels, and dialogs while preserving behavior.
2. Put title and core metadata in the writing surface; reduce the default toolbar and add contextual insert/format controls.
3. Add task list, strike, text alignment, normal links, subscript/superscript, clipboard images, and heading Tab/Shift-Tab.
4. Replace authoring prompts with validated equation, Mermaid, image, and table dialogs/inspectors.
5. Add runtime-only zoom and cursor history.
6. Extend the typed Tauri explorer for nested folders, create/rename/trash/refresh/watcher behavior.
7. Add recoverable save/external-change/Draw.io conflict feedback and minimize Tauri CSP/capabilities.
8. Run the full review gate, update native smoke and 3-5-user scenarios, then stop for user review.

Every slice requires docs, implementation, tests, `npm test`, `npm run build`, and `npm run test:e2e`, followed by a separate commit and push. Desktop slices additionally require `npm run typecheck:desktop` and `npm run build:desktop`.

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

Status: implemented on 2026-07-06; manual Tauri smoke still recommended before the next user review.

Turn Files into a simple VS Code-like explorer instead of a mixed action/status panel.

Acceptance criteria:

- Show current workspace folder and immediate `.sdoc` files clearly.
- Show which document is open and whether it has unsaved changes.
- Move secondary file operations to context menus or compact action menus.
- Keep developer-only unpack/pack commands out of the default author path.
- Do not expose broad filesystem APIs to browser code; continue using the Tauri adapter boundary.

Acceptance evidence:

- Files panel now presents a compact current-file header with saved/unsaved state.
- File actions are reduced to New, Open, and Save/Save As.
- Desktop workspace entries render as an explorer tree under the selected folder.
- Browser mode continues to show a desktop-only browsing boundary instead of claiming folder access.
- Developer unpack/pack commands remain available only behind a collapsed Developer workspace disclosure.
- Playwright covers browser Files panel behavior and the desktop workspace listing path.

## Priority Slice 3: Information Architecture Cleanup

Status: implemented on 2026-07-06; manual user review still required before declaring the Phase 5 UX gate complete.

Reduce panel overload and make authoring the obvious main workflow.

Acceptance criteria:

- Activity Bar separates primary author surfaces from advanced/reviewer surfaces.
- Primary: Files, Outline, Export, Settings.
- Advanced/optional: Review, Diagnostics, History, Developer.
- References and Traceability move under Diagnostics unless explicitly enabled for a document type/profile.
- Review defaults to comparing saved/current or file A/file B, not unexplained live tracking.
- Export panel shows deliverables first: Markdown, HTML, PDF, DOCX. Raw JSON and AI/RAG outputs move to Developer/AI export.

Acceptance evidence:

- Activity Bar now separates primary author surfaces from advanced surfaces.
- Primary surfaces are Files, Outline, Export, and Settings.
- Advanced surfaces are Review, Diagnostics, History, and Developer.
- References and Traceability are grouped under Diagnostics rather than top-level panels.
- Export focuses on deliverables: Markdown, HTML, PDF command, and DOCX command.
- Raw `document.json`, `.sdoc` developer export, AI/RAG derived outputs, and Data Grid diagnostics live under Developer.
- Playwright covers the new Outline, Diagnostics, Developer, and deliverable Export routes.

## Priority Slice 4: Core Authoring UX

Status: accepted on 2026-07-06. Heading/outline/selected-text formatting, figure/table structure projections, equation editing, and canonical table caption storage are implemented.

Implement the technical-writing features the review identified as essential.

Acceptance criteria:

- Heading auto-numbering with enable/disable and style profile options. Initial runtime projection implemented with enable/disable and numbered-level controls.
- Outline/TOC panel generated from headings, with click-to-jump navigation and configurable depth. Initial heading outline implemented from all headings, independent of fold ranges.
- Figure and table captions with stable references and numbering policy. Figure captions use existing authored caption content; table captions use optional `table.attrs.caption`.
- Figure list and table list generated from captions. Table list falls back to generated table structure summaries when no authored caption exists.
- Equation editing by double-click or explicit edit action. Implemented for inline and block equations by updating existing `attrs.latex`.
- Selected-text bubble toolbar for common inline formatting. Initial selected-text bubble implemented for bold, italic, underline, code, and reference entry.

Design constraints:

- Generated heading numbers and list labels should be render/export projections, not text injected into heading content.
- Caption source text is authored content; generated labels such as `Figure 1` are derived from numbering policy.
- Outline, figure list, and table list are runtime/export projections unless a later boundary defines authored list nodes.

Acceptance evidence so far:

- Heading numbers are injected through runtime CSS from stable heading IDs and are not written into heading text.
- Settings exposes runtime heading numbering enable/level and outline depth controls.
- Outline displays all heading nodes, shows generated numbers when enabled, and can filter visible depth.
- Figure list displays generated figure numbers from authored figure captions.
- Table list displays generated table numbers and authored captions when present, with structure summaries as fallback.
- Equations can be edited by double-click or toolbar action without storing edit UI state.
- Top toolbar is grouped into Text, Insert, Structure, and Advanced authoring tools.
- Selected text shows a compact bubble toolbar for common inline marks.
- Playwright covers heading numbering projection, outline depth controls, selected-text bubble formatting, figure/table list projection, and equation editing.
- Playwright covers authored table caption editing, Markdown export visibility, and `.sdoc` round trip preservation.

## Priority Slice 5: Publishing Style Profiles

Status: accepted on 2026-07-06 for v1 HTML/PDF profile presets. DOCX remains configurable through the existing controlled template and external Word template injection boundary.

Make HTML/PDF/DOCX output configurable without turning `document.json` into a page-layout format.

Acceptance criteria:

- Provide style/profile presets for captions and headings, such as IEEE, ISO/IEC, Modern, and Korean.
- Support custom profile settings for HTML export CSS, logo, typography, and document chrome through headless export options.
- Store app/workspace profile selection outside canonical body content unless the value is document metadata. The browser Export panel currently keeps profile choice as runtime state.
- Keep generated exports disposable and regenerable.

Acceptance evidence:

- `docs/publishing-style-profiles.md` defines the canonical boundary and v1 presets.
- `exportHtml` supports `modern`, `ieee`, `iso`, and `korean` profiles plus custom HTML chrome/typography/CSS options.
- CLI HTML/PDF export accepts `--profile modern|ieee|iso|korean`; PDF reuses the HTML print pipeline.
- Browser Export panel exposes profile selection for HTML export and reflected PDF commands without showing raw developer outputs.
- Tests cover headless HTML profiles, custom HTML chrome, CLI profile export, browser payload generation, and Export panel E2E.

## Priority Slice 6: Draw.io Create Or Import Flow

Status: accepted on 2026-07-06. Browser-safe import/create choice is implemented; desktop bridge opening is used when the native adapter is available.

Improve Draw.io UX from a raw source import into an author-facing choice.

Acceptance criteria:

- Draw.io action asks whether to import an existing diagram or create a new one.
- Import preserves editable Draw.io source in `.sdoc/assets/`.
- Create new makes a source-preserving Draw.io asset, inserts a `diagram` node, and opens it through the desktop bridge when available.
- Preview SVG/PNG remains non-canonical and regenerable.
- Raw XML, temp paths, editor process state, and conflict state stay out of `document.json`.

Acceptance evidence:

- The Draw.io toolbar action asks whether to create a new diagram or import an existing `.drawio` source.
- Import still stores editable source bytes in `.sdoc/assets/` and stores only `diagram.attrs.sourceAssetId` in `document.json`.
- Create new generates a minimal editable `.drawio` source asset, inserts a Draw.io `diagram` node, and opens the desktop external editor through the existing bridge when available.
- Browser mode creates/imports source-preserving assets but does not claim native editing when the desktop bridge is absent.
- Playwright covers import round trip, create-new asset-backed insertion, and external edit conflict resolution.

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
