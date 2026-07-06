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

1. Open `.sdoc`
   - Use the Files panel open action.
   - Select a valid `.sdoc`.
   - Confirm the document title/content load and the native path appears only as runtime file status.

2. Save existing `.sdoc`
   - Edit visible document content.
   - Save without choosing a new path.
   - Reopen the saved file and confirm the edit persists.
   - Inspect exported JSON and confirm cursor, selection, panel state, and native path are absent from `document.json`.

3. Save As
   - Choose Save As and select a new `.sdoc` path.
   - Confirm the app now treats the new path as the current native save target.
   - Reopen the new file and verify it is a complete single ZIP container.

4. Workspace Folder
   - Choose a workspace folder containing multiple `.sdoc` files.
   - Confirm only immediate `.sdoc` files are listed by default.
   - Open one listed file and verify the document loads through the native adapter.

5. Browser Boundary Regression
   - Run `npm run dev:web`.
   - Confirm the browser Files panel does not claim native folder browsing, native path save-back, or external editor launch without a desktop bridge.

## Evidence To Record

For each run, record:

- date, platform, and commit hash;
- command results;
- sample file path pattern, without committing private documents;
- pass/fail result for each scenario;
- any screenshots or recordings for UI regressions.

Manual failures should block declaring Phase 5 desktop-native workflow complete, but they should not change canonical `.sdoc` rules unless a separate format issue is found.
