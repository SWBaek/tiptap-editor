# Existing Product Experience Parity Plan

Created: 2026-07-18
Source: `EXISTING_PRODUCT.md` (user-provided, read-only)
Target: Phase 5.1 second real-user review gate

## Purpose

This plan carries forward proven authoring UX from the previous Structured Doc Editor without restoring its incompatible storage or frontend architecture. Parity means an ordinary technical author can recognize and complete the useful workflow; it does not mean source-level cloning.

The current implementation was checked against `apps/web-playground/src/App.tsx`, `apps/web-playground/src/styles.css`, `packages/editor-tiptap/src/index.ts`, `apps/desktop/src/`, `apps/desktop/src-tauri/`, unit tests, and `apps/web-playground/e2e/phase1-smoke.spec.ts`. A feature is not marked complete from product notes alone.

## Non-Negotiable Boundary

- Canonical authored content remains normalized `.sdoc/document.json`.
- `.sdoc` remains the user-facing single ZIP container.
- Every block-level node keeps a stable immutable `attrs.id`; position-derived IDs are forbidden.
- UI state, selection, cursor history, zoom, dialogs, native paths, watcher state, and conflicts stay out of `document.json`.
- Images and editable Draw.io source remain `.sdoc/assets/`; previews are derived.
- Browser mode never claims native folder access, save-back, watcher, trash, or external-editor support.
- Git, raw JSON, schema/debug, AI/RAG, unpacked folders, and CLI workflows are optional advanced surfaces.
- The previous plain-JSON `.sdoc`, position-derived/slug-derived identity, and duplicated frontend mirror are not compatibility targets.

## Classification Rules

- **Adopt**: preserve the previous interaction essentially as-is because it fits current architecture.
- **Adapt**: preserve the user outcome while changing data flow, placement, or native boundary.
- **Defer**: valuable but not required for the Phase 5.1 user-review gate.
- **Reject**: conflicts with canonical format, stable IDs, browser/native separation, or author-first product direction.

## Experience Parity Matrix

| Area / previous-product feature | Decision | Current implementation state | Phase 5.1 acceptance evidence |
|---|---|---|---|
| Fixed document header with inline title/author/version | Adapt | Implemented in the shared command bar: title, author, and version are immediately editable; Settings retains the same canonical metadata fields as a secondary surface. | Browser save/reopen E2E edits all three fields in the author header and proves metadata round trip without writing UI state. |
| Activity Bar plus toggle panels | Adopt | Implemented for Files, Outline, Export, Settings and advanced Review/Diagnostics/History/Developer. | Existing panel navigation E2E remains green after shell extraction. |
| Editor-first fixed shell and isolated body scrolling | Adapt | Partial in the monolithic `App.tsx`; visual hierarchy still mixes workflow, toolbar, panels, and preview. | Shell components are separated, editor remains primary at desktop and browser widths, and E2E covers panel/preview toggles. |
| Slim common toolbar with advanced insert menu | Adapt | Implemented initially. Common text/list/image/table controls remain visible; technical insertion, structure, table, and Draw.io commands are grouped into labeled menus that appear contextually where applicable. | E2E checks the reduced default surface, opens each labeled menu for advanced workflows, and retains existing insert/table/structure coverage. |
| Selected-text Bubble Menu | Adapt | Implemented for bold, italic, underline, strike, subscript, superscript, code, normal links, and cross-references while preserving the captured selection. | Common inline marks work on selection; focus/selection is preserved and covered by E2E. |
| Editor background insertion context menu | Adopt | Implemented for right-click. It restores the clicked editor position, clamps to the viewport, exposes common/technical insert commands, and closes on outside click or Escape. Keyboard invocation remains a later accessibility refinement. | E2E opens/closes without document mutation, checks viewport bounds, inserts at the restored selection, and proves no menu state is serialized. |
| Image context menu and inspector | Adapt | Implemented. Selected figures open one validated inspector from Image tools, context menu, or double-click. It edits alt text/caption, applies authored left/center/right alignment, optionally replaces the asset, and uses a two-step delete action. | Unit tests cover accessible fields, MIME validation, schema alignment, canonical preview stripping, and HTML alignment. E2E replaces an asset, preserves figure/caption IDs, round-trips `.sdoc`, verifies no data URI is canonical, and confirms guarded deletion. |
| Table context menu and inspector | Adapt | Implemented. Table creation uses a bounded rows/columns/header/caption dialog. A selection-aware context menu and Table tools open the selected-table inspector for caption, header-row, and selected-cell alignment changes; row/column actions remain contextual. | Dialog unit tests cover dimension bounds. E2E rejects invalid dimensions, inserts a configured table, edits caption/header/alignment, exercises a context-menu row mutation, preserves the table ID, exports the caption, and round-trips `.sdoc`. |
| Equation and Mermaid hybrid editor with preview | Adapt | Implemented. Inline/block equation insert and selected-node edit share a validated KaTeX preview dialog. Mermaid insert and selected-node edit share an asynchronous strict-mode SVG preview dialog with parse-error feedback; neither workflow uses `window.prompt`. | Unit tests cover preview helper boundaries. E2E blocks invalid source, verifies rendered previews, inserts and edits in place with stable IDs, confirms rendered HTML/SVG stays non-canonical, verifies Markdown export, and round-trips `.sdoc`. |
| Zoom slider, 60-200%, persisted locally | Adopt | Implemented as a compact floating editor control with 10% steps, reset, and the previous `sdoc-editor-zoom` local preference key. | Unit tests cover clamp/round/load behavior; E2E changes CSS zoom, reloads the preference, resets it, and proves canonical JSON is byte-for-byte unchanged. |
| Cursor back/forward history, mouse and Alt+arrow | Adapt | Implemented as a bounded runtime-only stack of explicit editor click locations, with floating controls, Alt+Left/Right, and mouse back/forward buttons. New navigation branches discard stale forward entries and edited-document positions are clamped. | Unit tests cover branching, bounds, and stale-position clamping; E2E covers keyboard, mouse, and button navigation and proves canonical JSON is unchanged. |
| Section folding and outline navigation | Adopt | Implemented initially. Fold state and outline depth are runtime-only. | Existing fold/outline E2E stays green after component extraction; no fold state appears in `document.json`. |
| Task list | Adopt | Implemented in the basic writing toolbar with nested TaskList/TaskItem extensions, accessible checkboxes, and checked styling. | Schema and conversion tests require boolean checked state and stable IDs for list/item/paragraph blocks; export tests cover Markdown/HTML plus DOCX/PPTX projections; E2E authors and checks an item while preserving unique IDs. |
| Strike | Adopt | Implemented in the common toolbar and selected-text Bubble Menu using the existing canonical `strike` mark. | E2E applies strike without losing the selected range and verifies canonical JSON plus Markdown export. |
| Paragraph/heading text alignment | Adapt | Implemented for paragraph and heading blocks through the advanced Text options menu, separately from table-cell alignment. | Schema/conversion/export tests constrain `textAlign` to left/center/right, omit the left runtime default, preserve center/right in HTML, and E2E proves canonical JSON plus rendered alignment without changing IDs. |
| Normal hyperlinks | Adopt | Implemented with a selection-preserving add/edit/remove dialog, http/https/mailto validation, and distinct cross-reference controls. Canonical normalization strips Tiptap link defaults and retains authored `href`. | Unit tests cover protocol validation and mark normalization; E2E covers add/edit/remove plus JSON and Markdown output. |
| Subscript and superscript | Adopt | Implemented as mutually exclusive, attribute-free canonical marks with advanced text-menu and Bubble Menu controls. | Schema/export unit tests plus browser E2E prove authoring, stable-ID canonical JSON, and semantic `<sub>`/`<sup>` Markdown output. |
| Clipboard image paste | Adapt | Implemented for supported PNG/JPEG/GIF/WebP/SVG clipboard files through a validated name/caption dialog; ordinary text/HTML paste remains editor-owned. | Dialog validation unit tests and E2E prove ClipboardEvent handling, stable-ID figure/caption creation, no data URI in canonical JSON, `.sdoc/assets/` persistence, and save/reopen round trip. |
| Heading Tab / Shift-Tab level change | Adopt | Implemented as a focused editor extension for heading levels 1–6. | Unit tests cover both boundaries; E2E changes H2→H3→H2 with the same stable ID and proves Tab leaves an ordinary paragraph's canonical content unchanged. |
| Figure captions/list and table captions/list | Adopt | Implemented, including canonical captions, Outline projections, and typed figure/table editing. | Semantic/export/round-trip tests remain green; caption authoring no longer depends on browser prompts. |
| Cross-reference picker and diagnostics | Adapt | Implemented as a custom node/picker and advanced diagnostics, rather than plain link text rewritten on save. | Stable-ID references remain valid; normal links and internal references are clearly separated in UI. |
| Draw.io create/import and external edit | Adapt | Implemented initially with asset-backed source and explicit conflict actions. | Contextual inspector/dialog replaces toolbar clutter; desktop smoke verifies external changes and conflict messaging. |
| New/Open/Save/Save As and deliverable Export | Adopt | Implemented initially; browser download and desktop save-back routes are separated. | Natural new-save-reopen-export scenarios pass browser E2E and manual Tauri smoke. |
| Desktop welcome/start screen and recent files | Adopt | Implemented initially. | Existing desktop-runtime E2E remains green; native recent reopen is included in manual smoke. |
| Nested workspace explorer | Adapt | Implemented as recursive typed `folder`/`sdoc-file` entries with runtime-only expand/collapse state. Native traversal is depth-bounded, skips symlinks and unpacked authoring folders by default, and browser mode retains its native-filesystem boundary. | Recursive sorting/validation unit tests, a Rust filesystem/serialization test, desktop-runtime E2E, desktop typecheck, and packaged Tauri build pass. |
| New document/folder, rename, trash delete/undo, refresh | Adapt | Implemented for selected-folder creation, contextual rename, operating-system Trash/Recycle Bin deletion, and manual refresh. Rename updates affected current/recent native paths. Dirty current documents or their parent folders cannot be trashed. Recovery uses the OS trash; in-app trash undo is intentionally not claimed for this gate. | Typed bridge/Rust commands reject absolute paths, traversal, symlink parents, invalid/reserved names, duplicate targets, non-`.sdoc` files, and overwrite. Unit tests cover bridge/model/path remapping; Rust tests cover creation/rename/filesystem guards; desktop-runtime E2E covers folder/file rename, save to the remapped path, dirty-delete blocking, and confirmed file/folder trash. `npm test` (297), build, E2E (40), desktop typecheck, Rust test, and packaged Tauri build pass. |
| Workspace/file watcher | Adapt | Implemented with a recursive `notify` watcher rooted at the canonicalized selected workspace. Typed bounded events are drained through the Tauri adapter, coalesced into silent explorer refreshes, and the watcher is replaced/stopped with workspace lifecycle. Current-document events surface a runtime alert without automatic reload; author-initiated create/rename/trash/save events are briefly correlated to prevent false conflicts. | Model/bridge tests validate watcher session/event payloads; Rust tests validate event mapping and root scoping; desktop-runtime E2E proves automatic typed polling, self-event suppression, external-change feedback, and no automatic content reload. Full test/build/E2E, desktop typecheck, Windows Rust test, and Linux Tauri build pass. |
| Save failure and external-change feedback | Adapt | Partial. Watcher-driven current-document changes now have a durable Files alert and an explicit keep-current dismissal, while status feedback remains for save errors. Reload/compare choices and save retry/Save As recovery still remain. | Failed save retains dirty state and offers retry/Save As; external changes present reload/keep/compare choices. |
| Draw.io conflict feedback | Adopt | Partial. Confirm dialogs and status messages exist. | A dedicated conflict dialog explains source/revision choices and never stores conflict state canonically. |
| Native menu bar and status bar | Defer | Status information exists in the web shell; no native menu bar. | Reconsider after user review; not required if commands remain discoverable and accessible. |
| TOC fold/unfold hierarchy and richer LOF/LOT controls | Defer | Initial outline/figure/table lists exist. | Collect user-review evidence before adding hierarchy-specific controls. |
| VS Code custom editor distribution | Defer | Not present in this repository architecture. | Reconsider only after desktop authoring workflow is accepted. |
| `.sdocbook` multi-document project | Defer | Not implemented. | Requires a separate canonical/project-format decision and is outside this gate. |
| AsciiDoc/slides/PDF breadth from the old product | Defer | Current exports already include broader derived formats, but parity work does not deepen them. | Existing export tests stay green; user review decides future surface priority. |
| Plain JSON `.sdoc` / `.tiptap.json` as user source | Reject | Current `.sdoc` ZIP and normalized `document.json` are implemented and tested. | Pack/unpack and deterministic serialization tests continue to pass; no legacy writer is added. |
| Position-, text-slug-, or save-time-derived block identity | Reject | Stable block IDs and repair lifecycle are implemented. | ID lifecycle tests prove edits, split/merge/copy/paste/undo/redo do not replace surviving IDs. |
| Duplicated webview/Tauri frontend mirror | Reject | Desktop already reuses the web playground frontend. | New UI components remain in the shared web app; desktop contains typed native adapters only. |
| Git/raw JSON/schema/AI as normal-user prerequisites | Reject | Already visually demoted to Developer/advanced surfaces. | Default review scenarios complete without visiting Developer or understanding Git/JSON. |
| Broad Tauri CSP disablement or wildcard asset scope | Reject | CSP is currently `null`, so hardening is required. | A documented non-null CSP and minimum capability set pass desktop build and native smoke. |

## Ordered Delivery Slices

1. **Planning baseline**: this matrix, Phase 5.1 plan alignment, progress record.
2. **Shell extraction**: split `App.tsx` shell, toolbar, panels, dialogs without changing behavior.
3. **Author header and command hierarchy**: inline title/core metadata, reduced default toolbar, insert menu, Bubble/context menus.
4. **Writing essentials**: task list, strike, text alignment, normal link, sub/superscript, clipboard image paste, heading Tab/Shift-Tab.
5. **Technical content editors**: validated equation, Mermaid, image, and table dialogs/inspectors; remove authoring `prompt()` flows.
6. **Runtime navigation**: zoom and cursor history with explicit non-canonical tests.
7. **Desktop explorer**: recursive typed adapter, create/rename/trash/refresh/watcher.
8. **Recovery and security**: save/external/Draw.io conflict feedback, CSP and capability minimization.
9. **Review gate**: full automated validation, manual Tauri checklist, and 3-5 user review checklist; stop feature expansion.

Each slice updates its boundary docs and tests, then runs `npm test`, `npm run build`, and `npm run test:e2e`. Desktop slices also run `npm run typecheck:desktop` and `npm run build:desktop`. Each validated slice receives a separate commit and push.

## Gate Evidence

Phase 5.1 is ready for review only when:

- a new document can be titled, authored, saved, reopened, and exported without Developer surfaces;
- image, table, equation, and Mermaid creation/editing use visible validated UI rather than browser prompts;
- common writing controls are immediately visible and advanced controls are contextual;
- browser/native filesystem boundaries and canonical/stable-ID tests remain green;
- desktop nested explorer, recovery feedback, watcher behavior, CSP, and capabilities have automated evidence plus a manual Tauri checklist;
- the 3-5 user scenarios in `docs/author-first-ux-review-gate.md` are updated for the second review.

At this point implementation stops and the goal is reported as **user review required**.
