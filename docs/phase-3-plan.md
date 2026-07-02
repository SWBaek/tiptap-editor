# Phase 3 Review Workflow Plan

작성일: 2026-07-02

## Goal

Phase 3 turns the semantic diff engine into a review workflow. The first slice stays local and browser-only: compare the current document against the saved baseline, show reviewable change groups, and let the user reset the baseline with the existing save/mark-saved action.

## Completed Slice: Local Diff Review

- Keep the existing raw diff output for debugging and copy/paste.
- Add a structured diff review panel with total, document, and metadata counts.
- Group readable semantic diff lines into document and metadata sections.
- Surface the same count in the sidebar as review state.
- Treat `Mark saved`, `.sdoc` save, JSON save, new document, and open document as baseline updates.

## Completed Slice: Persistent Local History

- Store document/metadata snapshots in browser localStorage.
- Keep snapshots local to the browser; `.sdoc` remains the portable source of truth.
- Compare the current document against a selected snapshot without changing the saved baseline.
- Keep binary assets out of history snapshots for now; figure diffs still work through canonical asset references.

## Completed Slice: Local History Management

- Let users delete browser-local snapshots.
- Clear a deleted snapshot as the comparison target and return to the saved baseline.
- Persist deletion to localStorage so removed snapshots do not reappear after reload.

## Completed Slice: Broken Reference Diagnostics

- Preserve `crossReference` inline nodes in the Tiptap editor.
- Show a References panel with target, reference, and broken-reference counts.
- Flag references whose `targetId` does not match any current block id.

## Completed Slice: Cross Reference Target Picker

- Replace prompt-based reference insertion with a References panel picker.
- Filter target blocks by label, id, type, or anchor.
- Insert references using the selected target block id and a human-readable label.
- Keep missing-target diagnostics available for imported or edited `document.json` files.

## Completed Slice: Reference Navigation

- Let users reveal target blocks from the References panel.
- Let users reveal broken inline reference nodes from diagnostics.
- Scroll the editor to the selected node and apply a short visual highlight.

## Completed Slice: Reference Label Sync

- Detect references whose `targetId` resolves but whose inline label no longer matches the target block label.
- Show stale reference labels separately from broken references.
- Let users update a stale reference label to the current target label from the References panel.

## Completed Slice: Local History Rename

- Let users rename browser-local history snapshots from the History panel.
- Keep rename operations local to the snapshot label; do not change the captured document or metadata.
- Persist renamed snapshot labels in localStorage and use them in compare/delete UI.

## Completed Slice: VS Code-Like UI Shell Planning

- Treat the current left sidebar as a prototype status/metadata panel, not the final product layout.
- Adopt a VS Code-like Activity Bar plus toggled SidePanel as the target shell.
- Use `docs/ui-shell-plan.md` as the implementation reference for Files, Review, References, History, Export, and Settings panels.
- Keep browser `Files` scope limited to current/recent documents and open/save actions until Tauri filesystem integration exists.

## Completed Slice: Activity Bar Shell

- Add a left Activity Bar with Files, Review, References, History, Export, and Settings buttons.
- Let users toggle the side panel by clicking the active Activity Bar button.
- Keep the existing Settings/status panel open by default so current metadata and validation workflows remain available.
- Provide lightweight side-panel entry points for Files, Review, References, History, and Export before moving full workflows out of preview tabs.

## Completed Slice: References SidePanel Migration

- Move the full References workflow from a preview tab into the References Activity SidePanel.
- Open the References SidePanel when users invoke the Insert Reference toolbar action.
- Keep reference insertion, broken-reference reveal, target reveal, and stale-label update workflows intact in the side panel.
- Remove the redundant References preview tab.

## Completed Slice: History SidePanel Migration

- Move local history snapshot management from the preview tab into the History Activity SidePanel.
- Keep compare/delete/rename/persist workflows intact.
- Remove the redundant History preview tab; use the Diff preview for comparison output.

## Completed Slice: Review SidePanel Refinement

- Keep the Diff preview as the main comparison workspace.
- Expand the Review Activity SidePanel with review status, base selection, and review actions.
- Avoid duplicating full diff content in the sidebar; keep the sidebar focused on navigation and workflow controls.

## Current Slice: Browser Files Panel

- Keep browser file operations honest: current file, new/open/save actions, and browser-local recent entries only.
- Avoid pretending that the browser can browse arbitrary folders before Tauri filesystem integration exists.
- Prepare the Files Activity SidePanel to become the bridge into recent files and later unpacked-folder workflows.

## Acceptance Evidence

- Unit tests cover the structured review summary model.
- Unit tests cover local history snapshot creation, capping, serialization, and malformed storage handling.
- Unit tests cover local history snapshot renaming without changing captured content.
- Unit tests cover reference diagnostics for valid and missing targets.
- Playwright verifies that metadata changes appear in the visual review list and that `Mark saved` clears the review state.
- Playwright verifies that a history snapshot can be saved, used as a comparison target, and survives page reload.
- Playwright verifies that deleting a selected history snapshot clears it from comparison and persists after reload.
- Playwright verifies that a history snapshot can be renamed and that the label survives reload.
- Playwright verifies that a reference can be inserted from the target picker and that imported missing-target references are reported.
- Playwright verifies that reference targets and broken inline references can be revealed in the editor.
- Playwright verifies that stale reference labels can be detected and updated after a target heading changes.
- `docs/ui-shell-plan.md` records the VS Code-like Activity Bar and toggle sidebar direction.
- Playwright verifies the Activity Bar default Settings panel, Files panel switch, and side panel collapse/restore behavior.
- Playwright verifies that reference insertion and broken-reference diagnostics work from the References Activity SidePanel.
- Playwright verifies that history save, rename, compare, delete, and reload workflows work from the History Activity SidePanel.
- Playwright verifies that the Review Activity SidePanel shows review counts, opens the Diff preview, marks the current state saved, and switches from a history base back to the saved baseline.
- Existing Phase 2 tests keep covering schema, export, diff, and round-trip behavior.

## Out Of Scope

- Side-by-side visual document diff
- Accept/reject individual changes
- Multi-user review or comments
- Git-backed history
