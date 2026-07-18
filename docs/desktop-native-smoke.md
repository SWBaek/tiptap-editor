# Desktop Native Smoke Checklist

Created: 2026-07-05

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

For interactive validation, start the desktop app:

```text
npm run dev:desktop
```

## Manual Scenarios

Automated coverage now includes a Playwright desktop-runtime simulation for the Start Screen and workspace-entry boundary. Manual Tauri smoke is still required because native dialogs and the packaged WebView cannot be fully proven by browser tests.

1. Start Screen
   - Launch the desktop app without an active workspace/document.
   - Confirm it offers Open Folder, Open `.sdoc`, New `.sdoc`, and Recent Documents.
   - Confirm it does not present a sample document as the user's active saved document.

2. Workspace Explorer
   - Choose a workspace folder containing multiple `.sdoc` files.
   - Include nested folders and confirm the Files panel renders a folder tree with predictable expand/collapse behavior.
   - Confirm nested `.sdoc` files open from the tree while symlinked folders are not traversed outside the selected workspace.
   - Select a nested folder, create a subfolder and a new document, and confirm the document is a valid single-file `.sdoc` that opens from the refreshed tree.
   - Confirm duplicate names, parent traversal, and invalid names are rejected without overwriting an existing entry.
   - Confirm the current document and saved/unsaved state are visible in the compact Files header.
   - Confirm developer-only unpacked folder commands are not part of the default author path.

3. Open `.sdoc`
   - Use the Files panel open action.
   - Select a valid `.sdoc`.
   - Confirm the document title/content load and the native path appears only as runtime file status.

4. Save existing `.sdoc`
   - Edit visible document content.
   - Save without choosing a new path.
   - Reopen the saved file and confirm the edit persists.
   - Inspect exported JSON and confirm cursor, selection, panel state, and native path are absent from `document.json`.

5. Save As
   - Choose Save As and select a new `.sdoc` path.
   - Confirm the app now treats the new path as the current native save target.
   - Reopen the new file and verify it is a complete single ZIP container.

6. Authoring First Impression
   - Confirm the default visible workflow emphasizes writing, outline/files, save, and deliverable export.
   - Confirm Review, References, Traceability, raw JSON, AI/RAG, Data Grid, and CLI/debug tools are secondary or advanced surfaces.
   - Confirm References and Traceability appear under Diagnostics, and raw JSON/AI/Data Grid tools appear under Developer.
   - Confirm heading numbering appears as a runtime projection and can be disabled from Settings without changing heading text.
   - Confirm Outline supports heading navigation and visible depth control.
   - Confirm Outline shows figure and table lists after inserting a figure or table.
   - Confirm double-clicking an equation opens an edit prompt and updates rendered math without exposing raw JSON.
   - Confirm selecting text shows a compact bubble toolbar for bold, italic, underline, code, and reference entry.
   - Confirm the Export panel offers publishing profile selection for derived HTML/PDF output without changing authored content.
   - Confirm Draw.io insertion asks whether to create a new diagram or import an existing source.
   - Confirm importing Draw.io preserves editable source in `.sdoc/assets/`.
   - Confirm creating a new Draw.io diagram opens the external editor when the desktop bridge and executable path are available.

7. Browser Boundary Regression
   - Run `npm run dev:web`.
   - Confirm the browser Files panel does not claim native folder browsing, native path save-back, or external editor launch without a desktop bridge.
   - Confirm the browser can create/import Draw.io source assets but does not claim native external editing without the bridge.

## Evidence To Record

For each run, record:

- date, platform, and commit hash;
- command results;
- sample file path pattern, without committing private documents;
- pass/fail result for each scenario;
- any screenshots or recordings for UI regressions.

Manual failures should block declaring Phase 5 desktop-native workflow complete, but they should not change canonical `.sdoc` rules unless a separate format issue is found.
