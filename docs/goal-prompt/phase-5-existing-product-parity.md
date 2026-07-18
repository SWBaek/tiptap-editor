---
title: "Phase 5.1 Existing Product Experience Parity Goal"
status: done
progress_percent: 100
current_slice: user-review-required
created_at: 2026-07-18
started_at: 2026-07-18
completed_at: 2026-07-18
source_material:
  - EXISTING_PRODUCT.md
planning_docs:
  - docs/existing-product-parity-plan.md
  - docs/phase-5-plan.md
  - docs/mvp-roadmap.md
  - docs/ui-shell-plan.md
  - docs/author-first-ux-review-gate.md
  - docs/desktop-native-smoke.md
completed_slices:
  - planning-baseline
  - shell-extraction
  - author-header-and-command-hierarchy
  - writing-essentials
  - technical-content-editors
  - runtime-navigation
  - desktop-explorer
  - recovery-and-security
  - review-gate
remaining_slices: []
progress_log:
  - date: 2026-07-18
    progress_percent: 0
    note: "Goal started; EXISTING_PRODUCT.md is treated as read-only user-provided source material."
  - date: 2026-07-18
    progress_percent: 12
    note: "Planning baseline completed: repository and required plans audited, parity decisions/evidence documented, and validated with npm test (268 tests), npm run build, and npm run test:e2e (31 tests) using supported Node 24. Commit and push follow this update."
  - date: 2026-07-18
    progress_percent: 16
    note: "Shell extraction sub-slice moved ActivityBar, desktop start screen, document command bar, preview/toolbar primitives, and shell types out of App.tsx without behavior changes; npm test (268), npm run build, and npm run test:e2e (31) passed."
  - date: 2026-07-18
    progress_percent: 20
    note: "Composite Text/Insert/Structure/Advanced toolbar groups moved into a typed EditorToolbarGroups boundary while App retains state and file inputs; npm test (268), npm run build, and npm run test:e2e (31) passed."
  - date: 2026-07-18
    progress_percent: 22
    note: "Selected-text Bubble Menu moved into SelectionBubbleToolbar with typed commands and preserved mouse/selection behavior; npm test (268), npm run build, and npm run test:e2e (31) passed."
  - date: 2026-07-18
    progress_percent: 24
    note: "Settings panel moved into components/panels with typed metadata, validation, and runtime authoring settings props; npm test (268), npm run build, and npm run test:e2e (31) passed."
  - date: 2026-07-18
    progress_percent: 26
    note: "Outline panel and its heading/figure/table projection types moved into components/panels; projection generation remains outside the view component. npm test (268), npm run build, and npm run test:e2e (31) passed."
  - date: 2026-07-18
    progress_percent: 28
    note: "Deliverable Export panel and reusable ExportAction moved into components/panels; export functions and profile state remain App-owned. npm test (268), npm run build, and npm run test:e2e (31) passed."
  - date: 2026-07-18
    progress_percent: 30
    note: "Files panel moved into components/panels with typed workspace/recent-file props and preserved browser/desktop boundaries; native file actions and workspace state remain App-owned. npm test (268), npm run build, and npm run test:e2e (31) passed."
  - date: 2026-07-18
    progress_percent: 32
    note: "History panel and editable snapshot cards moved into components/panels; persistence and comparison state remain App-owned. npm test (268), npm run build, and npm run test:e2e (31) passed."
  - date: 2026-07-18
    progress_percent: 34
    note: "Diagnostics, Reference, and Traceability views moved into components/panels; filtering stays view-local while diagnostic derivation and editor mutations remain App-owned. npm test (268) and npm run build passed. The first E2E run had one paste-event timeout; that test passed alone and the full npm run test:e2e retry passed (31)."
  - date: 2026-07-18
    progress_percent: 36
    note: "Developer panel, data-grid row review view, and derived-output presentation moved into components/panels; canonical export and asset mutations remain App-owned. npm test (268), npm run build, and npm run test:e2e (31) passed."
  - date: 2026-07-18
    progress_percent: 38
    note: "Review panel and side-by-side Diff preview moved into components/panels; review derivation, mutation, and baseline state remain App-owned. npm test (268), npm run build, and npm run test:e2e (31) passed."
  - date: 2026-07-18
    progress_percent: 40
    note: "Enclosing editor toolbar, hidden file inputs, and document actions moved into components/editor-toolbar; App retains refs and behavior callbacks. npm test (268), npm run build, and npm run test:e2e (31) passed, completing the shell-extraction slice."
  - date: 2026-07-18
    progress_percent: 43
    note: "Author header now edits canonical title, author, and version directly and responsively; browser round-trip coverage uses the header. An initial build caught optional legacy metadata values, which are now displayed as empty fields. Final npm test (268), npm run build, and npm run test:e2e (31) passed."
  - date: 2026-07-18
    progress_percent: 46
    note: "Default toolbar was reduced to common writing/image/table controls; technical insert, structure, table, and Draw.io commands moved into labeled runtime-only menus. E2E exposed overlay interception, so command selection now closes menus automatically. Final npm test (268), npm run build, and npm run test:e2e (31) passed."
  - date: 2026-07-18
    progress_percent: 49
    note: "Viewport-safe runtime editor context menu added with clicked-selection restoration, insertion commands, contextual table actions, and equation edit entry. npm test (268), npm run build, and npm run test:e2e (32) passed."
  - date: 2026-07-18
    progress_percent: 52
    note: "Author-header-and-command-hierarchy completed. Writing essentials started by adding canonical strike controls to the common toolbar and selection-preserving Bubble Menu with JSON/Markdown E2E assertions. npm test (268), npm run build, and npm run test:e2e (32) passed."
  - date: 2026-07-18
    progress_percent: 55
    note: "Normal hyperlink dialog now supports validated add/edit/remove separately from stable-ID references. Focused tests exposed Tiptap runtime defaults leaking into link marks, so canonical conversion now retains only href and strips null/default attrs. npm test (271), npm run build, and npm run test:e2e (33) passed."
  - date: 2026-07-18
    progress_percent: 58
    note: "Subscript and superscript are now mutually exclusive, attribute-free canonical marks exposed through Text options and the selection Bubble Menu. Tiptap dependencies were pinned to one 3.27.1 runtime after the new extensions exposed a duplicate-core type boundary. Schema/export tests and browser authoring coverage pass; npm test (273), npm run build, and npm run test:e2e (34) passed."
  - date: 2026-07-18
    progress_percent: 61
    note: "Paragraph and heading left/center/right alignment is available through Text options and remains distinct from table-cell alignment. Canonical conversion omits the left runtime default, schema validation rejects unsupported justify, HTML preserves authored center/right, and Markdown intentionally remains plain. npm test (276), npm run build, and npm run test:e2e (35) passed."
  - date: 2026-07-18
    progress_percent: 65
    note: "Task lists are available beside bullet/ordered lists with accessible checkbox toggling and nested list support. Canonical taskList/taskItem/paragraph blocks retain stable IDs; checked is validated as boolean and exported to Markdown/HTML/DOCX/PPTX projections. npm test (279), npm run build, and npm run test:e2e (36) passed."
  - date: 2026-07-18
    progress_percent: 68
    note: "Heading Tab/Shift-Tab now changes levels 1-6 in place through a focused editor extension, preserving attrs.id and yielding outside headings or at boundaries. The first build exposed workspace-private Tiptap type identity, so the extension follows the existing typed package-extension boundary. npm test (280), npm run build, and npm run test:e2e (37) passed."
  - date: 2026-07-18
    progress_percent: 72
    note: "Writing essentials completed. Supported clipboard images now open a validated name/caption dialog, reuse the asset-backed figure path, avoid data URIs in canonical JSON, and survive .sdoc save/reopen; ordinary HTML/text paste remains unchanged. npm test (281), npm run build, and npm run test:e2e (38) passed."
  - date: 2026-07-18
    progress_percent: 75
    note: "Inline/block equation insertion and selected equation editing now use one typed KaTeX validation/preview dialog instead of window.prompt. E2E blocks invalid LaTeX, verifies preview, edits in place, exports, and reopens .sdoc with stable IDs. npm test (282), npm run build, and npm run test:e2e (38) passed."
  - date: 2026-07-18
    progress_percent: 78
    note: "Mermaid insertion and selected-node editing now use one asynchronous strict-mode SVG validation/preview dialog instead of window.prompt, reachable by menu, context menu, and double-click. E2E blocks invalid syntax, verifies preview, edits source without changing the stable ID, excludes SVG from canonical JSON, exports Markdown, and reopens .sdoc. npm test (283), npm run build, and npm run test:e2e (38) passed."
  - date: 2026-07-18
    progress_percent: 81
    note: "Table creation now uses a bounded rows/columns/header/caption dialog, and the selected-table inspector replaces the caption prompt with caption, header-row, and selected-cell alignment controls. E2E rejects invalid dimensions, exercises context-menu insertion and inspector edits, preserves the table ID, exports the caption, and reopens .sdoc. npm test (285), npm run build, and npm run test:e2e (38) passed."
  - date: 2026-07-18
    progress_percent: 84
    note: "Technical-content editors completed. A selected-image inspector now validates alt/caption, supports asset replacement, authored figure alignment, and guarded deletion while preserving figure/caption IDs. Figure align was documented before schema implementation and is validated/exported without serializing preview URLs or dialog state. npm test (288), npm run build, and npm run test:e2e (38) passed."
  - date: 2026-07-18
    progress_percent: 86
    note: "Runtime navigation started with a floating 60-200% editor zoom control using the existing sdoc-editor-zoom local preference, 10% steps, and reset. Unit tests cover normalization/storage loading; E2E verifies CSS zoom, reload persistence, reset, and byte-for-byte unchanged canonical JSON. npm test (290), npm run build, and npm run test:e2e (39) passed."
  - date: 2026-07-18
    progress_percent: 89
    note: "Runtime navigation completed with a bounded runtime-only cursor history for explicit editor click locations, floating back/forward controls, Alt+Left/Right, and mouse buttons 3/4. Branching, retention bounds, and stale-position clamping have unit coverage; E2E verifies keyboard, mouse, and control navigation without changing canonical JSON. npm test (292), npm run build, and npm run test:e2e (40) passed."
  - date: 2026-07-18
    progress_percent: 91
    note: "Desktop explorer started with recursive typed folder/.sdoc entries, runtime-only expand/collapse state, depth-bounded native traversal, symlink exclusion, and the existing browser filesystem boundary. Rust tests cover nested listing and optional-field serialization; desktop-runtime E2E covers collapse/expand/open. npm test (292), npm run build, npm run test:e2e (40), npm run typecheck:desktop, cargo test (1), and npm run build:desktop passed. The packaged build also exposed and repaired the previously missing RGBA icon.png derived from the existing icon.ico."
  - date: 2026-07-18
    progress_percent: 93
    note: "Desktop explorer now creates a validated nested folder or a canonical packed .sdoc beneath the selected folder/root through typed Tauri commands. Workspace-relative validation rejects traversal, symlink parents, invalid/reserved names, duplicates, and non-.sdoc targets; successful document creation refreshes and opens the new package. npm test (296), npm run build, npm run test:e2e (40), npm run typecheck:desktop, cargo test (1), and npm run build:desktop passed. Rename and trash remain in the desktop-explorer slice."
  - date: 2026-07-18
    progress_percent: 95
    note: "Desktop explorer now exposes contextual rename and explicit operating-system Trash actions through typed Tauri commands. Rename refuses overwrite and remaps affected current/recent native paths; trash blocks a dirty current document or parent folder, clears stale save state after clean current-file deletion, and leaves recovery to the OS Trash/Recycle Bin rather than claiming an in-app undo. npm test (297), npm run build, npm run test:e2e (40), npm run typecheck:desktop, Windows cargo test (1), and Linux npm run build:desktop passed. Scoped watcher/external-change handling remains in desktop-explorer/recovery work."
  - date: 2026-07-18
    progress_percent: 97
    note: "Desktop explorer completed with a canonical-root recursive notify watcher, bounded typed start/read/stop event bridge, silent coalesced refresh, lifecycle cleanup, and runtime external-change alerts. Current-document content is never auto-reloaded; internal create/rename/trash/save events are briefly correlated to avoid false warnings. npm test (298), npm run build, npm run test:e2e (40), npm run typecheck:desktop, Windows cargo test (1), and Linux npm run build:desktop passed. Reload/compare recovery, save-failure actions, Draw.io conflict dialog, and CSP/capability hardening remain."
  - date: 2026-07-18
    progress_percent: 98
    note: "Recovery work now gives native save failures a durable Files alert with the concrete error, Retry, and desktop Save As. Failed writes preserve the dirty document and baseline/path; only successful recovery clears the alert and marks the document saved. npm test (299), npm run build, npm run test:e2e (40), npm run typecheck:desktop, and npm run build:desktop passed. External reload/compare, Draw.io conflict dialog, CSP/capability hardening, and the final review gate remain."
  - date: 2026-07-18
    progress_percent: 99
    note: "External current-document changes now offer explicit Reload from disk, Keep current, and Compare recovery. Compare validates the disk SDoc into a runtime-only semantic review baseline without mutating the active draft; Reload is explicit and Keep preserves dirty state. npm test (299), npm run build, npm run test:e2e (40), npm run typecheck:desktop, and npm run build:desktop passed. The Draw.io conflict dialog, CSP/capability hardening, and final review-gate documentation remain."
  - date: 2026-07-18
    progress_percent: 99
    note: "Draw.io external-edit conflicts now open a dedicated modal that names the block, current source, and prospective revision and explains Keep current, Replace source, and Save as revision. No browser confirm prompt is used; E2E proves revision preserves the stable diagram ID, stores revised bytes under assets, and keeps conflict/session/source content out of document.json. npm test (299), npm run build, npm run test:e2e (40), npm run typecheck:desktop, and npm run build:desktop passed. CSP/capability hardening and the final review gate remain."
  - date: 2026-07-18
    progress_percent: 99
    note: "Recovery-and-security completed with a non-null production CSP limited to local bundles, Tauri IPC, and in-memory editor assets, plus a main-window capability containing only dialog:allow-open and dialog:allow-save. Exact-boundary configuration tests reject the former broad defaults. npm test (301), npm run build, npm run test:e2e (40), npm run typecheck:desktop, and npm run build:desktop passed. Only the final review-gate documentation and handoff remain."
  - date: 2026-07-18
    progress_percent: 100
    note: "Phase 5.1 reached the second user-review gate. The packaged Tauri smoke checklist and 3-5-user facilitator/scenario/record kit are prepared, all delivery slices are complete, and feature expansion is stopped. Final npm test (301), npm run build, npm run test:e2e (40; one transient parallel failure passed focused reproduction and the full rerun), npm run typecheck:desktop, and npm run build:desktop passed. Interactive packaged-app smoke and real-user sessions are the next evidence and are not claimed as already executed."
done_rule: "Set status to done and progress_percent to 100 only after all slices are implemented, validated, committed, pushed, and the second user-review gate is ready."
---

# Goal Prompt

Carry the previous Structured Doc Editor's proven authoring experience into the current SDoc architecture without restoring its plain JSON format, unstable identity rules, duplicated frontend, or developer-first UX.

Follow `docs/existing-product-parity-plan.md` in order. For each slice: update docs, implement a bounded change, add tests, run the required validation commands, commit separately, and push. Do not infer completion from `EXISTING_PRODUCT.md`; use current code and test evidence.

The permanent architecture rules and stop condition are defined in the parity plan. When the second real-user review gate is ready, stop feature expansion and report that user review is required.
