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

Implement the bridge described in `docs/drawio-external-editor-bridge.md`. The bridge checks out Draw.io source assets into temporary files, launches the configured external editor, validates save-back, and writes accepted changes through the existing asset-backed diagram source policy.

## Slice 4: Review UX Hardening

Productize the visual semantic diff overlay, requirement tagging diagnostics, and broken reference repair actions. These features must consume existing semantic diff and reference diagnostic sources instead of creating independent review state in canonical JSON.

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
