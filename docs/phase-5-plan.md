# Phase 5 Productization Plan

Created: 2026-07-03

## Goal

Phase 5 turns the accepted MVP slices into product workflows for non-developer authors. The priority is desktop-native `.sdoc` file handling, review usability, requirement traceability, repair workflows, and native asset integrations while preserving `document.json` as the only canonical source of truth.

## Product Principles

- Normal users open, save, and share one `.sdoc` file.
- Git, unpacked folders, and raw JSON remain optional developer/reviewer workflows.
- Tauri owns native filesystem, external editor, file watcher, and OS integration.
- Browser playground remains browser-safe and must not claim native capabilities.
- UI/runtime state stays outside `document.json`.
- Stable `attrs.id` remains the internal identity key; `attrs.humanId` is human-facing metadata only.

## Slice 1: Tauri Desktop Shell Foundation

Status: initial foundation implemented on 2026-07-03; native save-back policy model, workspace writer entrypoint, browser/desktop save-route boundary, Tauri runtime capability detection, native path runtime state, route-based save action execution, web-safe native save/open bridge discovery, desktop-side native save bridge installer, and Rust initialization bootstrap hook added on 2026-07-04.

Acceptance criteria:

- Add an `apps/desktop/` workspace for the future Tauri shell.
- Reuse the existing web playground build as the first desktop frontend.
- Add narrow native commands for reading and writing `.sdoc` bytes by path.
- Keep native filesystem access behind a desktop adapter instead of mixing it into browser code.
- Document that Rust/Tauri toolchains are required for desktop build validation.

Exclusions:

- Full file explorer.
- Draw.io external editor launch.
- Asset file watching.
- Git integration.
- Canonical format changes.

Acceptance evidence:

- `apps/desktop/` exists as an npm workspace with Tauri v2 configuration.
- The desktop shell reuses `apps/web-playground/dist` and the web dev server.
- `read_sdoc_file` and `write_sdoc_file` native commands are limited to `.sdoc` paths.
- `apps/desktop/src/nativeSdocFileAdapter.ts` keeps Tauri IPC behind a desktop adapter.
- `apps/desktop/src/sdocSaveBackModel.ts` validates native save-back targets before writes: only concrete `.sdoc` files with non-empty package bytes are writable, and unpacked folders are not treated as normal authoring save targets.
- `apps/desktop/src/nativeSdocSaveBack.ts` connects validated save-back plans to `nativeWorkspaceAdapter.writeSdoc` without exposing broad filesystem mutation helpers to the web runtime.
- `apps/web-playground/src/documentFileRuntime.ts` keeps browser download saves and future desktop native save/save-as routes explicit, detecting Tauri capability from runtime globals without importing Tauri IPC into the browser playground.
- `apps/web-playground/src/documentFileActions.ts` executes save routes through injected browser or native adapters, so desktop native routes cannot silently fall back to browser download when no native adapter is wired.
- `apps/web-playground/src/documentNativeBridge.ts` discovers optional `window.__SDOC_NATIVE_SAVE_BRIDGE__` save and open adapters without importing Tauri APIs into the browser bundle.
- `apps/desktop/src/nativeSdocSaveBridge.ts` installs that window bridge from the desktop layer, writes through the validated native save-back model, and uses the Tauri dialog plugin for `.sdoc` open/save-as path selection.
- `apps/web-playground/src/App.tsx` keeps the current native path as runtime-only state, clears it for browser open/download/new flows, sets it after native open, and uses it only for save-route selection.
- `apps/desktop/src-tauri` registers `tauri-plugin-dialog`, grants dialog permissions for native open/save-as, disables automatic window creation, and creates the main window with a Rust `initialization_script` that installs `window.__SDOC_NATIVE_SAVE_BRIDGE__` before the web app scripts run.
- Root scripts expose `npm run dev:desktop`, `npm run build:desktop`, and `npm run typecheck:desktop`.
- Node validation passes with `npm run typecheck:desktop`, `npm test`, `npm run build`, and `npm run test:e2e`.
- `apps/desktop/src-tauri/Cargo.lock` locks the desktop Rust dependency graph for reproducible Tauri builds.
- `apps/desktop/src-tauri/icons/icon.ico` provides the required Windows resource icon for Tauri packaging.
- Native Tauri build passes locally with Rust/Cargo installed; `npm run build:desktop` emits `apps/desktop/src-tauri/target/release/sdoc-desktop.exe`.
- `npm run dev:desktop` launches the Vite dev server on `127.0.0.1:6280` and starts `target/debug/sdoc-desktop.exe` with WebView2.
- Manual native dialog UX smoke is still required for `.sdoc` open, save, save-as, and workspace folder selection.

## Slice 2: Native File Explorer And Workspace Adapter

Status: initial workspace adapter implemented on 2026-07-03; web-safe workspace bridge discovery, desktop workspace folder chooser/list bridge, and Files panel workspace listing UX added on 2026-07-05.

Add a VS Code-like Files activity panel for desktop. It should expose current document, recent documents, open/save/save-as, and later unpacked folder workflows. Git and unpacked folders must remain optional and hidden from the normal authoring path.

Acceptance criteria:

- Document the browser/desktop boundary for native file exploration.
- Add a desktop workspace adapter that lists `.sdoc` files without exposing broad filesystem APIs to browser code.
- Keep unpacked folder workflow optional and explicitly marked as developer/reviewer scope.
- Keep recent files, selected folders, expanded nodes, sort order, and Git status out of `document.json`.
- Reuse the existing Activity Bar and Files panel direction instead of adding a competing shell model.

Acceptance evidence:

- `docs/native-file-explorer-boundary.md` records the explorer boundary and deferred work.
- `list_sdoc_workspace_entries` returns immediate `.sdoc` files and optional unpacked `.sdoc` folders.
- `apps/desktop/src/nativeWorkspaceAdapter.ts` keeps workspace listing and `.sdoc` byte IO behind a Tauri adapter.
- `apps/desktop/src/workspaceModel.ts` provides testable entry sorting, labeling, and validation.
- Unit tests cover workspace entry ordering, labeling, and bridge response validation.
- `apps/web-playground/src/documentNativeBridge.ts` discovers an optional native workspace adapter without importing Tauri APIs into the browser bundle.
- `apps/desktop/src/nativeSdocSaveBridge.ts` exposes folder selection, immediate `.sdoc` workspace listing, and path-based `.sdoc` open through the installed desktop bridge.
- `apps/web-playground/src/App.tsx` shows workspace files only as runtime Files panel state; selected folders, listed paths, loading state, and workspace entries are not written to `document.json`.
- Browser mode shows the workspace browsing boundary instead of pretending to browse local folders.

## Slice 3: Draw.io External Editor Bridge

Status: initial bridge primitive implemented on 2026-07-03; browser-safe Draw.io source import UX added on 2026-07-05; desktop bridge UI open/read-back wiring and explicit conflict resolution added on 2026-07-05.

Implement the bridge described in `docs/drawio-external-editor-bridge.md`. The bridge checks out Draw.io source assets into temporary files, launches the configured external editor, validates save-back, and writes accepted changes through the existing asset-backed diagram source policy.

Acceptance criteria:

- Keep Draw.io XML in `.sdoc/assets/` and out of `document.json`.
- Check out source asset bytes to a private Tauri temp file.
- Launch a configured external editor or platform default opener without storing executable/process state in canonical JSON.
- Read edited temp file bytes back and classify invalid source or source conflict as runtime status.
- Keep preview regeneration, file watching, and save-back UI as later slices.

Acceptance evidence:

- `checkout_drawio_source_asset`, `open_drawio_external_editor`, `read_drawio_external_edit`, and `close_drawio_external_edit` are exposed as Tauri commands.
- `apps/desktop/src/nativeDrawioExternalEditorBridge.ts` wraps the commands behind a desktop adapter.
- `apps/desktop/src/drawioBridgeModel.ts` resolves Draw.io diagram references, validates source XML, and classifies save-back status without mutating document JSON.
- Unit tests cover Draw.io reference resolution, source validation, conflict classification, and runtime status event shape.
- The browser toolbar can import `.drawio` or `.drawio.xml` source files, stores the source bytes in `.sdoc/assets/`, and inserts a `diagram` block with only `attrs.kind = "drawio"` and `attrs.sourceAssetId` in `document.json`.
- Playwright coverage verifies Draw.io source import and `.sdoc` round trip without serializing XML source text into canonical JSON.
- The web runtime discovers an optional native Draw.io external editor adapter through the existing desktop bridge boundary without importing Tauri APIs into the browser bundle.
- The editor toolbar can open the selected Draw.io source through the desktop bridge, read valid saved XML back into the asset store, and keep conflicts, temp paths, and session state runtime-only.
- Desktop bridge tests cover checkout/open/read-back/close routing through the injected Draw.io adapter.
- Conflict read-back stores the external edit as a runtime candidate and offers explicit keep-current, replace-source, or save-as-revision actions.
- Revision save-back creates a new Draw.io asset, updates only the reviewed diagram `sourceAssetId`, and keeps raw XML out of `document.json`.
- Playwright coverage verifies mocked desktop conflict resolution as a revision asset and `.sdoc` package generation.

## Slice 4: Review UX Hardening

Status: initial review UX hardening implemented on 2026-07-03. Visual semantic diff review UX, requirement tagging diagnostics, broken reference repair actions, runtime accept/reject action planning, headless single-event accept/reject apply, browser Review panel single-event apply UX, visible-event batch accept/reject, side-by-side document diff, and partial batch conflict summaries are implemented.

Productize the visual semantic diff overlay, requirement tagging diagnostics, and broken reference repair actions. These features must consume existing semantic diff and reference diagnostic sources instead of creating independent review state in canonical JSON.

Acceptance criteria:

- Project semantic diff events into a Review panel view-model without introducing a second diff format.
- Provide runtime-only event filters, selected event state, and inline overlay state.
- Keep deleted blocks visible in the Review panel even when they no longer have an editor DOM anchor.
- Preserve the textual Diff preview as the debug view for developer/reviewer workflows.
- Verify that review selection and overlay toggles do not mutate `document.json`.

Acceptance evidence:

- `apps/web-playground/src/documentState.ts` creates semantic review items, filter counts, filtered item sets, and runtime overlay CSS from `SDocDiffEvent`.
- `apps/web-playground/src/App.tsx` adds Review panel event filters, selectable review events, and stable-ID editor focusing for anchorable changes.
- Unit tests cover event projection, filter counts, filtered results, selected overlay CSS, and deleted-event exclusion from editor CSS.
- Playwright coverage verifies Review panel filtering/selection and confirms `document.json` remains unchanged by review-only interactions.
- `apps/web-playground/src/documentState.ts` creates requirement traceability diagnostics for tagged blocks, duplicate `humanId` values, recommended-pattern warnings, and heading coverage gaps.
- `packages/editor-tiptap/src/index.ts` exposes selected-block `humanId` helpers so the UI can set or clear authored tags without treating them as internal identity.
- The Traceability Activity panel lets authors set/clear selected block IDs, inspect diagnostics, and jump to tagged or missing-heading blocks.
- Unit and Playwright coverage verify traceability diagnostics, selected-block tag editing, and runtime panel state staying out of `document.json`.
- Broken reference diagnostics include runtime repair candidates ranked from target labels, anchors, `humanId`, and stable block IDs.
- The References Activity panel supports explicit retarget and remove actions for broken references.
- Unit and Playwright coverage verify retarget/remove behavior and confirm repair state is not serialized as panel/runtime state.
- `docs/review-accept-reject-boundary.md` records accept/reject as canonical edit semantics, not stored review state.
- `apps/web-playground/src/documentState.ts` derives runtime-only accept/reject action availability from semantic review items.
- Unit coverage verifies action classification and broken-reference routing to the References repair workflow.
- `@sdoc/diff` applies single-event accept/reject actions with stale-event protection for added, deleted, modified, and moved events.
- `sdoc review <accept|reject>` exposes the headless review action path for developer/reviewer workflows without making Git mandatory.
- The browser Review panel exposes per-event Accept/Reject actions for saved-baseline review, confirms each action, recomputes semantic diff, and keeps review action state out of `document.json`.
- Batch accept/reject applies visible non-broken review events, recomputes diff between each event, and reports skipped stale events without serializing batch state.
- The Diff tab renders side-by-side baseline/current block previews derived from `SDocDiffEvent` and stable block IDs while preserving the raw textual diff as the debug view.
- The Review panel renders the latest batch result as runtime-only applied/skipped counts plus stale/conflict messages for partially applied batches.

Open work:

- Full inline word decoration and collaboration-grade reviewer workflows remain deferred beyond the current Review UX hardening scope.

## Slice 5: Enterprise Authoring And Publishing

Status: large data grid minimal asset model, row-level CSV/JSON validation diagnostics, headless row diff projection, guarded row merge apply, row merge asset revision policy, browser row review readiness view-model, browser row accept/reject actions, browser row revision save-back, browser row event expansion/filtering, browser side-by-side cell review, browser added/deleted row payload preview, asset-only dirty-state tracking, CLI row merge wiring, row diff/merge boundary, controlled corporate HTML/PDF/DOCX template export, Word template package validation, Word template mapping diagnostics, external Word template body injection, Word template style mapping application, and basic approval/revision metadata placeholder injection implemented.

Advance asset-backed large data grids and corporate template export only after their boundary documents remain consistent with real pilot workflows. Both stay derived or asset-backed and must not turn `document.json` into a spreadsheet or page layout format.

Acceptance evidence:

- `dataGrid` is supported as an asset-backed block node with required `sourceAssetId` and `format`.
- `.sdoc` validation and pack/unpack include referenced CSV/JSON assets and reject missing source assets.
- Markdown, HTML, PDF, slide, AI/RAG, and semantic diff expose semantic metadata and source labels without embedding raw grid rows in `document.json`.
- HTML/PDF export renders bounded CSV/JSON preview rows from referenced assets when asset bytes are available.
- Web playground imports CSV/JSON as `.sdoc/assets/` and inserts a compact `dataGrid` preview.
- Unit and Playwright coverage verify canonical JSON excludes raw CSV content and round-trips asset references.
- Headless data grid diagnostics inspect CSV/JSON asset bytes for row shape, parse, header, and missing-column issues while keeping raw rows out of `document.json`.
- The Export panel shows data grid readiness counts and per-grid issues as runtime-only publishing feedback.
- `docs/data-grid-row-diff-merge-boundary.md` defines row-level grid diff and merge as an asset-level review projection with reliable row keys, stale-event protection, and asset-only merge writes.
- `createDataGridRowDiff` creates keyed CSV/JSON row diff events for added rows, deleted rows, modified cells, duplicate-key conflicts, and no-key fallback without mutating canonical JSON.
- `applyDataGridRowMerge` recomputes row diffs, refuses stale current sources and conflicts, and returns updated CSV/JSON source text as an asset-layer change rather than a canonical row patch.
- `applyDataGridAssetRevision` applies merged source through explicit `update` or `revision` policies; revision mode creates a new `.revN` asset and leaves canonical `sourceAssetId` updates to the caller.
- `sdoc data-grid diff|apply` exposes row-level CSV/JSON asset source review and guarded apply for developer/reviewer workflows, including optional asset-policy output.
- The browser Export panel projects saved-baseline dataGrid assets into runtime-only row review readiness, including ready, conflict, no-change, missing-asset, source-change, and format-change states.
- The browser Export panel can accept individual ready row events by updating the saved-baseline asset snapshot while keeping the current asset and `document.json` unchanged.
- The browser Export panel can reject individual ready row events back to the saved-baseline asset value using update-policy asset writes without mutating `document.json`.
- The browser Export panel can reject individual ready row events as new revision assets, preserving previous asset bytes and updating only the reviewed `dataGrid.attrs.sourceAssetId` as a canonical document edit.
- Browser save state treats asset-only row review writes as unsaved changes until the `.sdoc` package is saved.
- The browser Export panel can expand each ready grid from a compact first-three row event view to the full runtime event list without storing panel state in `document.json`.
- The browser Export panel can filter row events by row key, column, kind, source asset, message, and old/new values without storing filter state in `document.json`.
- The browser Export panel shows compact side-by-side before/after cell values for row events from runtime diff data.
- The browser Export panel shows added/deleted row payload previews from runtime `oldRow`/`newRow` diff event fields without storing row data in `document.json`.
- `exportHtml(..., { template: "controlled" })` renders controlled corporate header/footer/watermark chrome from explicit export metadata.
- CLI `sdoc export --format html|pdf --template controlled` exposes the controlled template without storing export preferences in `document.json`.
- `exportDocx(..., { template: "controlled" })` emits a derived OOXML Word document with editable text and controlled metadata without mutating `document.json`.
- CLI `sdoc export --format docx --template controlled -o output.docx` exposes the Word handoff path.
- `validateWordTemplatePackage` verifies `.docx/.dotx` ZIP structure and rejects macro-enabled parts, external relationships, remote targets, and blocked package parts before future template injection uses them.
- `sdoc template validate <template.docx|template.dotx>` exposes this validation as a developer/reviewer CLI check.
- `validateWordTemplateMapping` verifies required Word style IDs and content-control placeholders without rendering or mutating canonical document data.
- `sdoc template validate-mapping <template.docx|template.dotx> --style nodeType=StyleId --placeholder tag` exposes mapping diagnostics for developer/reviewer workflows.
- `exportDocx(..., { externalTemplate })` and `sdoc export --format docx --template-file company.dotx -o output.docx` validate an external template and replace the `sdoc-body` content-control body with editable Word XML derived from SDoc blocks.
- `--template-style nodeType=StyleId` applies validated Word style IDs to matching rendered SDoc block types during DOCX export.
- External Word template content controls named `sdoc-approval-table` and `sdoc-revision-history` are filled from export metadata when present, without storing template state in `document.json`.

Open work:

- Tauri-native revision save-back and richer multi-column cell review for very wide CSV/JSON merge workflows.
- richer external `.dotx` content-control rendering, strict pagination, approval workflow modeling, multi-row revision history management, and template management UI.

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

Desktop changes should additionally run the relevant Tauri command when Rust and native prerequisites are installed:

```text
npm run tauri dev
npm run tauri build
```

If the local environment lacks Rust/Cargo, record that limitation and still run all Node-based validation.
