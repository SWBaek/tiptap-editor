# Native File Explorer Boundary

Created: 2026-07-03

## Decision

Native file exploration belongs to the Tauri desktop app. The browser playground may show a Files activity panel with open/save downloads and browser recent-file metadata, but it must not pretend to browse local folders or reopen files by path.

The desktop file explorer should expose normal `.sdoc` files first. Unpacked `.sdoc` folders remain an advanced developer/reviewer workflow and should be visually separated from the default authoring path.

## Workspace Adapter Contract

The desktop layer should expose a narrow workspace adapter with these responsibilities:

- list immediate `.sdoc` files in a selected directory;
- optionally include unpacked `.sdoc` folders that contain `manifest.json` and `document.json`;
- read and write selected `.sdoc` files through the existing native file adapter;
- return display metadata such as name, path, kind, size, and modified time;
- keep recent files, selected folder, expanded folders, filters, and sort order as runtime/app state.

The adapter must not write paths, folder expansion state, recent-file lists, Git status, or explorer selection into `document.json`.

Native save-back is limited to concrete user-facing `.sdoc` files. The desktop policy layer must reject missing paths, non-`.sdoc` paths, unpacked folders, and empty package bytes before calling the Tauri write command. Save-as may choose a new `.sdoc` path, but once selected it follows the same validation and writes a complete single-container package, not partial asset files.

## User Workflow

Normal authors should see:

- current `.sdoc` document;
- open/save/save-as actions;
- recent documents;
- `.sdoc` files in the selected folder.

Developer/reviewer users may opt into unpacked folders later. This opt-in can support raw folder inspection, Git review, and repair workflows without making those concepts part of the normal authoring experience.

## Tauri Scope

The first desktop implementation may list only one directory level. Recursive trees, folder watching, drag/drop moves, rename/delete, conflict prompts, and Git badges are later slices.

Native commands should stay small and explicit. A command that lists workspace entries is acceptable; broad arbitrary filesystem APIs should not be exposed to the web frontend.

## Current Bridge Slice

The current desktop bridge exposes only the minimum workspace surface needed by the Files panel:

- choose one workspace directory through the native dialog plugin;
- list immediate `.sdoc` files from that directory through `list_sdoc_workspace_entries`;
- open a listed `.sdoc` file by path through the existing `read_sdoc_file` command;
- keep selected directory, listed entries, refresh state, and clicked entry state as runtime UI state.

The browser bundle discovers this bridge through an optional `window.__SDOC_NATIVE_SAVE_BRIDGE__` contract. Browser mode continues to show a boundary message and uses user-selected file inputs rather than local-folder browsing.

## Deferred Work

- directory picker UI;
- recursive tree view;
- recent file persistence outside `document.json`;
- unpacked folder open/save implementation;
- Git status badges for developer mode;
- file watcher and external-change prompts.
