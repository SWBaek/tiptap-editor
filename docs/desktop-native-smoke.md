# Desktop Native Smoke Checklist

Created: 2026-07-05
Phase 5.2 checklist updated: 2026-07-18
Execution status: desktop typecheck/build and packaged executable launch passed; interactive scenarios remain user-review evidence

## Purpose

This checklist verifies the Tauri-only authoring flows that cannot be proven by browser Playwright tests alone. It is release evidence for Phase 5 desktop-native `.sdoc` workflows, not a replacement for unit, E2E, or Tauri build validation.

## Preconditions

- Rust, Cargo, Node dependencies, and WebView2 are installed.
- `npm run build:desktop` completes successfully.
- A valid sample `.sdoc` exists, for example one produced from the browser playground or CLI.
- Keep test files outside the repository or under an ignored temporary directory.

## Required Commands

Run these before manual interaction:

```text
npm run typecheck:desktop
npm test
npm run build
npm run test:e2e
npm run build:desktop
```

For development-mode interaction, start the desktop app:

```text
npm run dev:desktop
```

For the release candidate, prefer the packaged executable produced by `npm run build:desktop`:

```text
apps/desktop/src-tauri/target/release/sdoc-desktop.exe
```

## Latest Automated And Launch Evidence

- Date/platform: 2026-07-18, Windows x64.
- `npm run typecheck:desktop`: passed.
- `npm run build:desktop`: passed; Tauri release executable produced.
- Basic packaged launch: passed; process remained alive and responsive with window title `SDoc Editor`.
- Candidate executable size: 11,423,744 bytes.
- Candidate SHA-256: `22C8F7D4FFBC44D559FB13276281B1DCDE47B70794490EF750F346756308388F`.
- Scope limit: this proves packaging and window startup, not native dialog, filesystem mutation, watcher, Trash, Draw.io, or full save/reopen interaction. Record those manually below.

## Manual Scenarios

Automated coverage now includes a Playwright desktop-runtime simulation for the Start Screen and workspace-entry boundary. Manual Tauri smoke is still required because native dialogs and the packaged WebView cannot be fully proven by browser tests.

1. Start Screen
   - Launch the desktop app without an active workspace/document.
   - Confirm it offers Open Folder, Open `.sdoc`, New `.sdoc`, and Recent Documents.
   - Confirm it does not present a sample document as the user's active saved document.

2. Workspace Explorer
   - Choose a workspace folder containing multiple `.sdoc` files.
   - Include nested folders and confirm Explorer starts directly with its compact action header and recursive file tree.
   - Confirm nested `.sdoc` files open from the tree while symlinked folders are not traversed outside the selected workspace.
   - Select a nested folder, create a subfolder and a new document, and confirm the document is a valid single-file `.sdoc` that opens from the refreshed tree.
   - Confirm duplicate names, parent traversal, and invalid names are rejected without overwriting an existing entry.
   - Rename a nested folder and `.sdoc`; confirm the tree refreshes, duplicate/invalid targets are rejected, and an open document continues saving to its renamed native path.
   - Move a non-current document and folder to the operating-system Trash/Recycle Bin through the explicit confirmation dialog; confirm the explorer refreshes and the entries can be recovered from the OS trash.
   - Try to trash the current document or its parent folder with unsaved edits; confirm the editor blocks the action and retains the dirty document and native save path.
   - With the workspace open, create/rename/remove a nested `.sdoc` in the operating-system file manager and confirm the explorer refreshes without manual intervention.
   - Modify the current `.sdoc` externally and confirm a document-level recovery banner reports the external change without silently reloading, overwriting, or serializing watcher/conflict state into `document.json`.
   - From the external-change notice, verify Compare opens semantic Review against the disk package without changing the editor, Keep preserves unsaved content, and Reload explicitly replaces the editor with the complete disk `.sdoc` and resets its baseline.
   - Save or rename from inside the editor and confirm the resulting native watcher events do not produce a false external-change warning.
   - Confirm the current document, saved/unsaved state, health, counts, zoom, and cursor history are visible in the fixed Status Bar rather than duplicated in Explorer.
   - Confirm developer-only unpacked folder commands are not part of the default author path.

3. Open `.sdoc`
   - Use Start Screen or the document command bar Open action.
   - Select a valid `.sdoc`.
   - Confirm the document title/content load and the native path appears only as runtime file status.

4. Save existing `.sdoc`
   - Edit visible document content.
   - Save without choosing a new path.
   - Simulate an unwritable or missing save target and confirm the document remains dirty while a document-level banner shows the error with Retry and Save As; confirm a successful recovery clears the error and updates the native path only after the write succeeds.
   - Edit a checked-out Draw.io source both inside and outside the editor, read the external edit, and confirm the dedicated conflict dialog explains Keep current, Replace source, and Save as revision without a browser confirm prompt. Verify revision changes only `sourceAssetId`, preserves the diagram block ID, and stores the revised source under `.sdoc/assets/`.
   - Reopen the saved file and confirm the edit persists.
   - Inspect exported JSON and confirm cursor, selection, panel state, and native path are absent from `document.json`.
   - Inspect the packaged webview response in developer tools and confirm a non-null CSP is present, remote scripts/connections are blocked, in-document asset previews still render, and Open/Save dialogs plus validated workspace commands still work with only `dialog:allow-open` and `dialog:allow-save` capabilities.

5. Save As
   - Choose Save As and select a new `.sdoc` path.
   - Confirm the app now treats the new path as the current native save target.
   - Reopen the new file and verify it is a complete single ZIP container.

6. Authoring First Impression
   - Confirm the default Activity Bar contains Explorer, Outline, Review, and bottom Settings, with Developer hidden.
   - Confirm the default visible workflow emphasizes writing, document structure/files, save, and deliverable export.
   - Confirm Review, References, Traceability, raw JSON, AI/RAG, Data Grid, and CLI/debug tools are secondary or advanced surfaces.
   - Confirm References and Traceability appear under Diagnostics, and raw JSON/AI/Data Grid tools appear under Developer.
   - Confirm heading numbering appears as a runtime projection and can be disabled from Settings without changing heading text.
   - Confirm Outline supports heading navigation and visible depth control.
   - Confirm Outline shows figure and table lists after inserting a figure or table.
   - Confirm double-clicking an equation opens the validated edit/preview dialog and updates rendered math without exposing raw JSON.
   - Confirm selecting text shows a compact bubble toolbar for bold, italic, underline, strike, subscript, superscript, code, link, and reference entry.
   - Confirm Export opens a focused dialog, Markdown and HTML work, PDF/DOCX/PPTX are honestly marked unavailable, and no CLI knowledge is required.
   - Confirm Settings separates Document, Application, and Developer; arrow/Home/End keys switch its tabs and developer details remain opt-in.
   - Confirm Draw.io insertion asks whether to create a new diagram or import an existing source.
   - Confirm importing Draw.io preserves editable source in `.sdoc/assets/`.
   - Confirm creating a new Draw.io diagram opens the external editor when the desktop bridge and executable path are available.

7. Browser Boundary Regression
   - Run `npm run dev:web`.
   - Confirm the browser calls the surface Documents, offers explicit New/Open/download behavior, and does not claim native folder browsing, watcher, Trash, native path save-back, or external editor launch without a desktop bridge.
   - Confirm the browser can create/import Draw.io source assets but does not claim native external editing without the bridge.

8. Keyboard And Window Sizes
   - At 1920x1080, 1440x900, and 1280x720, confirm the command bar, one-row authoring toolbar, canvas, sidebar, and Status Bar do not overlap or create page-level horizontal scrolling.
   - Without a mouse, traverse Activity Bar controls, Explorer tree, Review tabs, Settings tabs, document commands, toolbar menus, and Export.
   - Confirm focus is visibly outlined, settings tabs support arrows/Home/End, Explorer supports its documented tree keys, and Escape closes Export and returns focus to its invoking button.

## Evidence To Record

For each run, record:

- date, platform, and commit hash;
- command results;
- sample file path pattern, without committing private documents;
- pass/fail result for each scenario;
- any screenshots or recordings for UI regressions.

Use this result header in the smoke record:

```text
Date/platform/commit:
Operator:
Required commands:
Scenarios 1-8 (pass/fail/not applicable):
Blocking issue:
Evidence paths:
Overall result: pass/fail
```

Manual failures should block declaring Phase 5 desktop-native workflow complete, but they should not change canonical `.sdoc` rules unless a separate format issue is found.
