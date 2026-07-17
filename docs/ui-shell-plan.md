# UI Shell Plan

Created: 2026-07-02
Realigned: 2026-07-06 after Tauri app user review
Realigned: 2026-07-18 for Phase 5.1 existing-product experience parity

## Decision

The final shell still follows a VS Code-like structure, but the left rail must not make every feature look equally important. The product should open as a technical writing environment with a clear file/workspace entry point, document outline, editor body, and save/export workflow.

Review, references, traceability, data-grid review, raw JSON, and CLI/debug tools are secondary surfaces. They must be reachable without defining the first-run experience.

## Target Desktop Layout

- `StartScreen`: shown in desktop mode when no workspace/document is active.
- `ActivityBar`: narrow icon rail for major surfaces.
- `ExplorerPanel`: file-first workspace panel next to the Activity Bar.
- `EditorWorkspace`: primary writing surface.
- `Outline/Inspector`: optional right or side surface for document structure, diagnostics, preview, or export status.
- `Developer/Debug`: hidden or advanced surface for raw JSON, schema, AI/RAG outputs, CLI commands, and unpacked folder workflows.

Desktop start screen actions:

- Open Folder
- Open `.sdoc`
- New `.sdoc`
- Recent Documents

Browser playground may still load sample content, but desktop product mode should not treat a sample document as the user's active work.

## Activity Bar Priority

Primary author surfaces:

- `Files`: workspace folder, `.sdoc` files, current file, save state, New/Open/Save/Save As.
- `Outline`: generated heading outline and later figure/table lists.
- `Export`: deliverable exports such as Markdown, HTML, PDF, and DOCX.
- `Settings`: document metadata and authoring/profile settings.

Secondary or advanced surfaces:

- `Review`: saved/current or file-to-file semantic diff; not unexplained live tracking.
- `Diagnostics`: broken references, stale labels, traceability warnings, schema warnings, and repair actions.
- `History`: local snapshots and compare/restore actions.
- `Developer`: raw JSON, AI/RAG outputs, CLI commands, unpacked folders, and advanced debug data.

Traceability and References should not be permanent top-level panels for ordinary authors. They can live under Diagnostics or become top-level only when a workspace/document profile enables requirement-management mode.

## Files / Explorer Rules

- Files must look and behave like a simple explorer, not a mixed dashboard.
- Show the active workspace folder and immediate `.sdoc` files clearly.
- Show the current file and unsaved state in a compact header.
- Move secondary operations to context menus or compact menus.
- Keep unpack/pack, Git, raw path, and debug commands out of the default author path.
- Recent files, workspace path, expanded folders, selected files, and sort order are runtime/user settings and never `document.json`.

Browser mode must not pretend to browse arbitrary folders. Folder listing belongs to the Tauri adapter.

## Toolbar Rules

- The top toolbar should expose only common writing controls by default.
- Group controls by task: text, blocks, insert, structure, review/developer. Initial Text, Insert, Structure, and Advanced grouping is implemented.
- Move advanced insertions such as Draw.io source, dataGrid, external editor read-back, and debug actions behind menus or contextual controls.
- Add a selected-text bubble toolbar for inline marks such as bold, italic, underline, code, and link. Initial bubble toolbar is implemented for common marks and reference entry.
- Avoid long rows of equal-weight icons.

Phase 5.1 completion sharpens these rules:

- Keep headings, common inline marks, lists, image, table, and one Insert entry immediately visible.
- Move equation, Mermaid, Draw.io, data grid, section, table-structure, and external-editor operations into menus or node-contextual controls.
- Distinguish normal hyperlinks from stable-ID SDoc cross-references.
- Bubble/context menus must preserve selection and remain inside viewport bounds.
- Authoring dialogs and inspectors must validate before applying; `window.prompt()` is not an accepted final editing surface.

## Phase 5.1 Component Boundary

`App.tsx` currently owns product state and approximately 4,600 lines of shell, toolbar, panels, dialogs, and helper UI. Split it incrementally without changing canonical conversion or desktop adapter ownership:

- `components/editor-shell/`: document header, command bar, Activity Bar, side/preview layout, status.
- `components/editor-toolbar/`: common toolbar, Insert menu, Bubble Menu, node context menus.
- `components/panels/`: Files, Outline, Export, Settings, Review, Diagnostics, History, Developer.
- `components/dialogs/`: link, image, table, equation, Mermaid, Draw.io choice/conflict, external-change/save recovery.
- `hooks/` or small runtime models: zoom, cursor history, dialog/context-menu state, typed workspace event state.

The web app remains the single frontend. `apps/desktop` adds only typed native adapters and Rust commands; it must not mirror React components.

Extraction progress on 2026-07-18:

- `ActivityBar`, desktop start screen, document command bar, preview tab button, toolbar button, and shared shell types moved under `components/editor-shell/` and `components/editor-toolbar/`.
- Existing Text, Insert, Structure, and Advanced button groups moved into a typed `EditorToolbarGroups` component; editor/file input ownership remains in `App.tsx` until the command hierarchy slice changes UX.
- Component props preserve the existing callbacks, accessible labels, and CSS class contract.
- Panel bodies, hidden file inputs/document actions, Bubble Menu, and authoring dialogs remain in `App.tsx` for subsequent behavior-preserving sub-slices.

## Outline And Authoring Structure

The Outline surface should become a primary authoring tool:

- Generated from heading nodes. Implemented from all heading nodes rather than foldable sections only.
- Click-to-jump into the editor. Implemented.
- Configurable visible heading depth. Implemented as runtime UI state.
- Figure list from authored figure captions. Implemented.
- Table list from authored table captions, with table structure summaries as fallback. Implemented.

Generated outline state is runtime/export state. It must not be stored as panel state in `document.json`.

## Export Rules

Export means producing deliverables. The default export surface should show:

- Markdown
- HTML
- PDF
- DOCX

Save/Save As handles `.sdoc`. Raw `document.json`, chunks, outline JSON, references JSON, and other AI/RAG/debug outputs belong in Developer or AI export mode, not ordinary Export.

## Review And Diagnostics Rules

- Review should answer "what changed between these two document states/files?"
- Visual diff should be readable without requiring users to understand stable block IDs.
- Broken references and stale labels are diagnostics to assist authors, not chores the author must constantly manage.
- Traceability remains optional and profile-driven.

All review filters, selected events, repaired candidates, panel expansion, and diagnostic visibility remain runtime state.

## Implementation Order

1. Desktop `StartScreen` for Open Folder, Open `.sdoc`, New `.sdoc`, and Recent Documents. Implemented.
2. Explorer-first Files panel with real workspace `.sdoc` listing. Implemented.
3. Activity Bar cleanup: primary author surfaces first, advanced surfaces grouped. Implemented.
4. Outline panel with click-to-jump heading navigation. Initial heading outline implemented.
5. Export panel simplification and Developer/Debug split. Implemented.
6. Diagnostics grouping for References and Traceability. Implemented.
7. Toolbar grouping and selected-text bubble toolbar. Initial implementation complete.
8. Figure/table lists and equation edit UX. Initial implementation complete.
9. Canonical table caption policy. Implemented.
10. Publishing style profile selection for derived HTML/PDF exports. Implemented for v1 presets.
11. Draw.io create/import choice with source-preserving assets. Implemented.
12. Phase 5.1 shell/component extraction with behavior parity.
13. Author header, reduced toolbar, Bubble Menu, insert and node context menus.
14. Writing essentials and validated technical-content dialogs/inspectors.
15. Runtime-only zoom/cursor navigation.
16. Nested typed desktop explorer, recovery feedback, watcher, and security hardening.
17. Second Tauri/manual user-review gate; stop feature work pending feedback.
