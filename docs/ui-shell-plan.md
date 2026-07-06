# UI Shell Plan

Created: 2026-07-02
Realigned: 2026-07-06 after Tauri app user review

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
- Group controls by task: text, blocks, insert, structure, review/developer.
- Move advanced insertions such as Draw.io source, dataGrid, external editor read-back, and debug actions behind menus or contextual controls.
- Add a selected-text bubble toolbar for inline marks such as bold, italic, underline, code, and link.
- Avoid long rows of equal-weight icons.

## Outline And Authoring Structure

The Outline surface should become a primary authoring tool:

- Generated from heading nodes.
- Click-to-jump into the editor.
- Configurable visible heading depth.
- Later extended with figure list and table list after caption policy is implemented.

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

1. Desktop `StartScreen` for Open Folder, Open `.sdoc`, New `.sdoc`, and Recent Documents.
2. Explorer-first Files panel with real workspace `.sdoc` listing.
3. Activity Bar cleanup: primary author surfaces first, advanced surfaces grouped.
4. Outline panel with click-to-jump heading navigation.
5. Export panel simplification and Developer/Debug split.
6. Toolbar grouping and selected-text bubble toolbar.
7. Diagnostics grouping for References and Traceability.
