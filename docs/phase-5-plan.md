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

Status: initial foundation implemented on 2026-07-03.

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
- Root scripts expose `npm run dev:desktop`, `npm run build:desktop`, and `npm run typecheck:desktop`.
- Node validation passes with `npm run typecheck:desktop`, `npm test`, `npm run build`, and `npm run test:e2e`.
- Native Tauri build requires Rust/Cargo; this local environment does not currently provide `cargo`.

## Slice 2: Native File Explorer And Workspace Adapter

Status: initial workspace adapter implemented on 2026-07-03.

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

## Slice 3: Draw.io External Editor Bridge

Status: initial bridge primitive implemented on 2026-07-03.

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

## Slice 4: Review UX Hardening

Status: started on 2026-07-03. Visual semantic diff review UX and requirement tagging diagnostics are implemented; broken reference repair actions remain open.

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

Open work:

- Broken reference repair actions beyond the existing reference-label update flow.
- Side-by-side or accept/reject review workflow.

## Slice 5: Enterprise Authoring And Publishing

Advance asset-backed large data grids and corporate template export only after their boundary documents remain consistent with real pilot workflows. Both stay derived or asset-backed and must not turn `document.json` into a spreadsheet or page layout format.

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
