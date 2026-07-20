---
title: "Phase 5.3 Explorer And Sidebar UX Goal"
status: in_progress
progress_percent: 80
current_slice: final-review-gate
created_at: 2026-07-20
started_at: 2026-07-20
completed_slices:
  - explorer-structure-and-interactions
  - quick-navigation
  - side-panel-simplification
  - start-export-status-responsive-polish
remaining_slices:
  - final-review-gate
progress_log:
  - date: 2026-07-20
    progress_percent: 5
    note: "Read the UTF-8 goal objective, AGENTS.md, development plan, user-provided EXISTING_PRODUCT.md, Phase 5 plans, UX guide, roadmap, shell plan, native smoke, and author review gate. Audited current code/tests and retained the existing untracked source unchanged. Baseline images at the current 8c2df5b commit cover desktop Explorer/Start, browser Documents, Outline, Review, Settings, and Export at 1280px. Phase 5.2 completion claims were reopened where current implementation contradicts resize, direct-open, empty-state, and panel-simplification requirements."
  - date: 2026-07-20
    progress_percent: 20
    note: "Slice 1 completed. Explorer now uses a 260px default and 220-420px runtime-only resizable width, Ctrl+B toggles the sidebar outside text-editing contexts, Ctrl+Shift+E opens Explorer, files open on one click, folder rows toggle as a whole, the redundant decorative root is removed, secondary header actions live in More, row actions no longer reserve a permanent column, and the shared context menu is portaled with viewport collision, full keyboard movement, outside close, and focus return. Evidence: 3 sidebar preference unit tests, focused desktop E2E, npm test (310), npm run build, npm run test:e2e (46), and visual inspection at 1280x800, 1440x1000, and 640x800."
  - date: 2026-07-20
    progress_percent: 40
    note: "Slice 2 completed. Desktop Ctrl+P Quick Open supports tokenized filename/path search and full keyboard selection; Explorer adds a transient file filter, folders-first name/modified sorting, runtime-only auto-reveal preference, sticky expanded ancestors, and a typed Reveal in File Explorer command that reuses canonical workspace path and symlink validation. Compact folder chains, multi-select, and drag/drop remain deferred pending review evidence. Evidence: npm test (317), npm run build, npm run test:e2e (46), npm run typecheck:desktop, cargo test, npm run build:desktop, focused desktop E2E, and visual inspection of the 1280px Explorer and Quick Open states."
  - date: 2026-07-20
    progress_percent: 60
    note: "Slice 3 completed. Outline now presents headings first, consumes authoring depth settings without duplicating controls, and hides empty Figure/Table groups while retaining accessible collapsible groups when content exists. Browser Documents contains only New/Open and an honest browser boundary instead of current-file/recent-activity duplicates. Review hides zero dashboards, filters, disabled batch controls, stale batch results, and empty event sections; compact tabs retain the Document Health accessibility name. History has an actionable empty state, and Document Properties no longer repeats Status Bar health or attachment counts. Evidence: npm test (317), npm run build, npm run test:e2e (46), focused panel E2E, and 1280px visual inspection of Outline, clean Review, and Browser Documents."
  - date: 2026-07-20
    progress_percent: 80
    note: "Slice 4 completed. An empty desktop Start Screen centers only Open Folder, New .sdoc, and Open .sdoc with one primary action and omits a zero-value Recent Documents column. Export exposes only working Markdown/HTML choices and compresses unavailable PDF/DOCX/PPTX into a truthful non-interactive note. Routine workspace refresh is silent, while explicit open feedback remains transient. At 640px and below the Activity Bar becomes horizontal and the side panel is a dismissible max-320px overlay drawer that no longer pushes the document below it; transient Status Bar messages remain visible. Evidence: npm test (317), npm run build, npm run test:e2e (46), focused Start/Export/mobile E2E, and visual inspection at 1280px and 390x844."
---

# Phase 5.3 Explorer And Sidebar UX

## Purpose

Turn the current left-side management surfaces into an Explorer-first technical-document workbench suitable for a second 3-5-person review. This phase preserves the canonical `.sdoc` ZIP, stable block IDs, asset ownership, one shared frontend, and the typed browser/Tauri boundary.

## Decision Matrix

| Experience | Decision | Before | Target / evidence |
| --- | --- | --- | --- |
| Resizable sidebar | Adopt | Fixed 320px desktop column | 260px default, 220-420px range, pointer/keyboard resize, runtime preference tests |
| Direct file activation | Adapt | Single click selects but only double click opens | Single click opens because the product has no preview-tab state; dirty protection remains in the existing open callback |
| Folder row activation | Adopt | Only the small chevron toggles | The complete folder row toggles; ARIA tree keys remain available |
| Workspace root | Adapt | Decorative row outside the ARIA tree | Hide the redundant single root; full workspace path remains available through Open Folder/tooltip context |
| Header actions | Adapt | New file, new folder, Collapse, Refresh, More all permanent | New file, new folder, More; secondary actions move into More |
| Context menu | Adopt | Absolutely positioned inside the scroll owner with Escape-only keyboard support | Portal, viewport collision handling, complete menu keyboard navigation, outside close and focus return |
| Quick Open/filter/reveal | Adapt | Reveal exists; Quick Open/filter absent | Runtime navigation in Slice 2 without browser filesystem claims |
| Multi-select/drag and drop | Defer | Not implemented | Defer until core navigation user evidence; no preview-tab or batch model is accepted yet |
| Compact folder chains | Defer | Ordinary nested tree rows | Defer until user evidence shows deep single-child trees are a material problem |
| Browser Documents | Adapt | Permanent action card, current card, recent block and boundary paragraph | Honest minimal browser-session surface in Slice 3 |
| Zero-value panel dashboards | Reject | Empty Outline/Review groups remain visible | Render concise actionable empty states only |

## Baseline Evidence

- Commit: `8c2df5b` (`Complete the authoring review gate`).
- Worktree at start: only user-owned untracked `EXISTING_PRODUCT.md`.
- Baseline image directory: `%TEMP%/sdoc-ux-review/`.
- Captured surfaces: `desktop-explorer-1280.png`, `desktop-start-1280.png`, `browser-documents-1280.png`, `outline-1280.png`, `review-1280.png`, `settings-document-1280.png`, `settings-application-1280.png`, `export-dialog-1280.png`.
- Native scope limit: the baseline uses the shared frontend with the typed desktop bridge simulation; native dialogs and OS window chrome remain manual smoke evidence.

## Acceptance Evidence

A prior Accepted/Done label is not considered proof when the current DOM, interaction, screenshot, or test contradicts it.

### Slice 1 — Explorer structure and interactions

- `sidebarPreferences.ts` keeps width in local UI storage only and clamps it to 220-420px; three unit tests cover clamp/load/store behavior.
- `SidebarResizeHandle.tsx` supports pointer drag, Arrow keys, Home/End, and double-click reset with separator semantics.
- Workbench shortcuts are `Ctrl+B` outside text-editing targets and `Ctrl+Shift+E` for Explorer, preserving rich-text Bold behavior inside the editor.
- Desktop tree rows use one click for the only available activation model: folders toggle and files invoke the existing protected open callback.
- The redundant single-workspace root row was removed rather than pretending to be an ARIA tree item.
- Header Collapse/Refresh moved into More; row ellipsis is an overlay rather than a permanent grid column.
- Entry menus render through a portal, clamp to the viewport, support Arrow Up/Down, Home/End, Escape, outside close, and invoker focus return.
- Automated evidence: `npm test` 310 passed, `npm run build` passed, `npm run test:e2e` 46 passed.
- Visual evidence: `%TEMP%/sdoc-ux-review-phase53-slice1/explorer-1280x800.png`, `explorer-1440x1000.png`, and `explorer-640x800.png`. The desktop views show the narrower tree-first layout; the 640px capture confirms the remaining non-overlay mobile behavior for Slice 4.

### Slice 2 — Quick navigation

- Desktop `Ctrl+P` opens a focused Quick Open dialog; tokenized filename/path matching, Arrow keys, Home/End, Enter, Escape, and outside dismissal are covered without introducing preview-tab state.
- Explorer More exposes a transient filter, folders-first name/modified sorting, and an auto-reveal preference. Filter expansion is temporary; sorting and auto-reveal persist only in local runtime preferences.
- Expanded ancestor rows remain sticky while traversing a long tree, and opening a nested document reveals its parent folders when auto-reveal is enabled.
- Reveal in File Explorer crosses the typed desktop bridge and invokes the platform file manager only after the existing canonical-root, relative-path, file-type, and symlink checks pass. Browser Documents does not expose this command.
- Automated evidence: `npm test` 317 passed, `npm run build` passed, `npm run test:e2e` 46 passed, `npm run typecheck:desktop` passed, `cargo test` passed, and `npm run build:desktop` produced the Windows release executable.
- Visual evidence: `%TEMP%/sdoc-phase53-slice2-explorer.png` and `%TEMP%/sdoc-phase53-slice2-quick-open.png` at the 1280px acceptance viewport.

### Slice 3 — Side-panel simplification

- Outline consumes depth/numbering preferences from Application Settings without rendering a second permanent control. Headings remain primary; Figure and Table groups appear as compact collapsible groups only when content exists.
- Browser Documents now exposes only explicit New/Open actions and a short truthful file/download boundary. Current-file state remains in the document and Status Bar, and non-actionable recent activity is absent from the sidebar.
- Clean Review shows one actionable status instead of zero count cards, filters, disabled batch actions, stale batch results, and an empty events section. Changes with only metadata direct the author to Show diff.
- Review tab labels fit the accepted sidebar width; the visible Health label retains `Document Health` as its accessible name. History explains why to create a first snapshot.
- Document Properties is limited to editable author/version content and no longer duplicates health or attachment facts already owned elsewhere.
- Automated evidence: `npm test` 317 passed, `npm run build` passed, and `npm run test:e2e` 46 passed after focused panel checks.
- Visual evidence: `%TEMP%/sdoc-phase53-slice3-outline.png`, `%TEMP%/sdoc-phase53-slice3-review-clean.png`, and `%TEMP%/sdoc-phase53-slice3-browser-documents.png` at 1280px.

### Slice 4 — Start, Export, Status, and responsive polish

- The empty desktop Start Screen centers the three valid entry actions and gives Open Folder the only primary treatment. Recent Documents appears only when it contains actionable entries.
- Export lists working Markdown/HTML formats as choices; unavailable PDF/DOCX/PPTX remain discoverable in one non-interactive note instead of five equal options and disabled calls to action.
- Routine workspace refresh does not occupy the Status Bar. Explicit workspace opening still reports a short transient result, and narrow layouts retain non-empty status feedback.
- At 640px and below, the Activity Bar is horizontal and the side panel becomes a max-320px overlay drawer with a dismissible scrim. The underlying workspace begins directly below the Activity Bar and is no longer pushed down by the panel.
- Context-menu initial focus is scheduled after portal positioning so unrelated shell rerenders do not steal it.
- Automated evidence: `npm test` 317 passed, `npm run build` passed, and `npm run test:e2e` 46 passed.
- Visual evidence: `%TEMP%/sdoc-phase53-slice4-start.png`, `%TEMP%/sdoc-phase53-slice4-export.png`, and `%TEMP%/sdoc-phase53-slice4-mobile-sidebar.png`.

## Known Limits

- Real 3-5-person sessions and packaged native interaction cannot be claimed by automation.
- Multi-root workspaces, preview tabs, batch operations, and full workspace content search remain outside this review gate.

## Manual Review Checklist

The final checklist must cover workspace entry, nested document discovery, direct open, create/rename/Trash, keyboard navigation, authoring/save/reopen/export, browser/native boundary, and narrow-window behavior without coaching.
