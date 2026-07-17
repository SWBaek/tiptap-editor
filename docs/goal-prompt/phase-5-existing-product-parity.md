---
title: "Phase 5.1 Existing Product Experience Parity Goal"
status: in_progress
progress_percent: 36
current_slice: shell-extraction
created_at: 2026-07-18
started_at: 2026-07-18
completed_at: null
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
remaining_slices:
  - shell-extraction
  - author-header-and-command-hierarchy
  - writing-essentials
  - technical-content-editors
  - runtime-navigation
  - desktop-explorer
  - recovery-and-security
  - review-gate
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
done_rule: "Set status to done and progress_percent to 100 only after all slices are implemented, validated, committed, pushed, and the second user-review gate is ready."
---

# Goal Prompt

Carry the previous Structured Doc Editor's proven authoring experience into the current SDoc architecture without restoring its plain JSON format, unstable identity rules, duplicated frontend, or developer-first UX.

Follow `docs/existing-product-parity-plan.md` in order. For each slice: update docs, implement a bounded change, add tests, run the required validation commands, commit separately, and push. Do not infer completion from `EXISTING_PRODUCT.md`; use current code and test evidence.

The permanent architecture rules and stop condition are defined in the parity plan. When the second real-user review gate is ready, stop feature expansion and report that user review is required.
