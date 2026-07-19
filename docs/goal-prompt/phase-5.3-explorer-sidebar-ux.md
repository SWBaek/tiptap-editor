---
title: "Phase 5.3 Explorer And Sidebar UX Goal"
status: in_progress
progress_percent: 20
current_slice: quick-navigation
created_at: 2026-07-20
started_at: 2026-07-20
completed_slices:
  - explorer-structure-and-interactions
remaining_slices:
  - quick-navigation
  - side-panel-simplification
  - start-export-status-responsive-polish
  - final-review-gate
progress_log:
  - date: 2026-07-20
    progress_percent: 5
    note: "Read the UTF-8 goal objective, AGENTS.md, development plan, user-provided EXISTING_PRODUCT.md, Phase 5 plans, UX guide, roadmap, shell plan, native smoke, and author review gate. Audited current code/tests and retained the existing untracked source unchanged. Baseline images at the current 8c2df5b commit cover desktop Explorer/Start, browser Documents, Outline, Review, Settings, and Export at 1280px. Phase 5.2 completion claims were reopened where current implementation contradicts resize, direct-open, empty-state, and panel-simplification requirements."
  - date: 2026-07-20
    progress_percent: 20
    note: "Slice 1 completed. Explorer now uses a 260px default and 220-420px runtime-only resizable width, Ctrl+B toggles the sidebar outside text-editing contexts, Ctrl+Shift+E opens Explorer, files open on one click, folder rows toggle as a whole, the redundant decorative root is removed, secondary header actions live in More, row actions no longer reserve a permanent column, and the shared context menu is portaled with viewport collision, full keyboard movement, outside close, and focus return. Evidence: 3 sidebar preference unit tests, focused desktop E2E, npm test (310), npm run build, npm run test:e2e (46), and visual inspection at 1280x800, 1440x1000, and 640x800."
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

## Known Limits

- Real 3-5-person sessions and packaged native interaction cannot be claimed by automation.
- Multi-root workspaces, preview tabs, batch operations, and full workspace content search remain outside this review gate.

## Manual Review Checklist

The final checklist must cover workspace entry, nested document discovery, direct open, create/rename/Trash, keyboard navigation, authoring/save/reopen/export, browser/native boundary, and narrow-window behavior without coaching.
