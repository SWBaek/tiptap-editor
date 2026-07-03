# UI Shell Plan

Created: 2026-07-02

## Decision

The final editor shell should follow a VS Code-like structure: a narrow left Activity Bar controls which side panel is visible, and the main editor remains focused on document authoring.

The current left sidebar in `apps/web-playground` is a Phase 1-3 prototype panel. It exposes metadata, validation, review, reference, and file status quickly, but it is not the final product layout.

## Target Layout

- `ActivityBar`: fixed icon rail on the far left.
- `SidePanel`: toggled panel next to the Activity Bar.
- `EditorWorkspace`: primary writing surface.
- `Inspector/Preview`: optional right-side panel for JSON, Markdown, Diff, History, References, and export previews.

Recommended Activity Bar items:

- `Files`: current document, recent documents, open/save actions, and later folder exploration.
- `Review`: semantic diff, change review, and optional Git/unpacked workflow entry points.
- `References`: target picker, broken reference diagnostics, stale label sync, and navigation.
- `Traceability`: requirement IDs, duplicate/tag format warnings, coverage gaps, and requirement navigation.
- `History`: local snapshots, rename/delete, and compare controls.
- `Export`: `.sdoc`, Markdown, AI/RAG, HTML/PDF/slide exports as they become available.
- `Settings`: document metadata, editor preferences, schema/version details, and advanced options.

## File Explorer Scope

Browser MVP should not pretend to have full filesystem access. In the browser, `Files` should start with recent documents, open/save buttons, and the current `.sdoc` filename.

Full file and folder exploration belongs to the Tauri desktop phase, where native filesystem APIs can support:

- opening `.sdoc` files directly,
- managing recent files,
- showing unpacked `.sdoc` folders for developer workflows,
- round-tripping single-file `.sdoc` containers without exposing internal files to non-developer users.

`docs/unpacked-folder-workflow.md` records the browser, CLI, and future Tauri boundary for this workflow.

## UX Rules

- Git and unpacked-folder workflows must remain optional and hidden from normal authoring.
- Side panel state is runtime UI state and must not be stored in `document.json`.
- Metadata/status controls should move out of the permanent sidebar and into Settings or document info panels.
- Activity Bar buttons should use icons with accessible labels and tooltips.
- The editor must remain usable when the side panel is collapsed.

`docs/git-integration-boundary.md` records the browser, CLI, and future Tauri boundary for Git-oriented review workflows.

## Implementation Order

1. Introduce `ActivityBar` and `SidePanel` components without changing document behavior.
2. Move current metadata/status controls into a `Settings` or `Document Info` panel.
3. Move History and References content from preview tabs into activity panels.
4. Add browser-safe `Files` panel with current file, open/save, recent files, and local history entry points.
5. Add Tauri-only filesystem adapter later; keep web-core logic independent from Tauri IPC.
