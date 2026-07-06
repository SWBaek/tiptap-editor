---
title: "Phase 5 Author-First Productization Goal"
status: in_progress
progress_percent: 61
current_slice: core-authoring-ux
created_at: 2026-07-06
started_at: 2026-07-06
completed_at:
owner_model: gpt-5.5-medium
source_reviews:
  - docs/user-review/2026-07-06-Tauri-app-review.md
planning_docs:
  - docs/phase-5-plan.md
  - docs/ui-shell-plan.md
  - docs/author-first-ux-review-gate.md
  - docs/tauri-user-review-action-plan.md
  - docs/desktop-native-smoke.md
completed_slices:
  - desktop-workspace-entry
  - explorer-first-files-panel
  - information-architecture-cleanup
remaining_slices:
  - core-authoring-ux
  - publishing-style-profiles
  - drawio-create-or-import-flow
progress_log:
  - date: 2026-07-06
    progress_percent: 0
    note: "Goal prompt created; implementation not started."
  - date: 2026-07-06
    progress_percent: 10
    note: "desktop-workspace-entry slice started; desktop start screen and recent native reopen work in progress."
  - date: 2026-07-06
    progress_percent: 17
    note: "desktop-workspace-entry implemented and validated with npm test, npm run build, npm run test:e2e, npm run typecheck:desktop, and npm run build:desktop. Commit hash is recorded in the final run report."
  - date: 2026-07-06
    progress_percent: 34
    note: "explorer-first-files-panel implemented with compact current-file state, explorer-style workspace entries, browser boundary retention, and collapsed developer commands. Validation and commit hash are recorded in the final run report."
  - date: 2026-07-06
    progress_percent: 51
    note: "information-architecture-cleanup implemented with primary/advanced Activity Bar grouping, initial Outline panel, Diagnostics grouping for References/Traceability, and Developer grouping for raw JSON, AI/RAG, and Data Grid tools. Validation and commit hash are recorded in the final run report."
  - date: 2026-07-06
    progress_percent: 61
    note: "core-authoring-ux structure sub-slice implemented with runtime heading numbering, configurable outline depth, all-heading outline generation, toolbar grouping, and selected-text bubble formatting. Remaining Core Authoring UX work includes captions, figure/table lists, and equation edit flow."
done_rule: "When this goal is fully completed, update status to done, progress_percent to 100, completed_at to the completion date, and record final evidence in progress_log."
---

# Goal Prompt

This repository is an AI/Diff-friendly technical document editor. The goal is for non-developers to author technical documents through WYSIWYG while the app reliably maintains `.sdoc/document.json` for AI/RAG, semantic diff, and deterministic exports.

You are a long-running development agent based on gpt-5.5 medium. Final responsibility belongs to you. Use external models only for design review or red-team checks when useful; make final decisions from repository docs, code, tests, and user review evidence.

## Current Objective

Reflect the 2026-07-06 Tauri user review and make the product feel like a real technical document editor rather than a document-management/debug console. Do not add broad new feature depth before the author workflow is clear.

Primary sequence:

1. Desktop Workspace Entry
2. Explorer-First Files Panel
3. Information Architecture Cleanup
4. Core Authoring UX
5. Publishing Style Profiles
6. Draw.io Create Or Import Flow

## Required Start Checklist

1. Run `git status --short`.
2. Read `AGENTS.md`.
3. Read the planning docs listed in the YAML front matter.
4. Read `docs/document-format.md`, `docs/editor-schema.md`, and `docs/diff-model.md`.
5. If present, read `docs/user-review/2026-07-06-Tauri-app-review.md`.

## Architecture Rules

- Tiptap/ProseMirror is only the editor runtime, not the canonical format.
- Canonical source of truth is `.sdoc/document.json`.
- `.sdoc` is a user-facing single ZIP container.
- Markdown, HTML, PDF, DOCX, slide, and AI/RAG outputs are derived exports.
- UI/runtime state must never be stored in `document.json`.
- Every block-level node must keep a stable immutable `attrs.id`.
- Git, unpacked folders, raw JSON, schema/debug views, and AI/RAG internals are not normal-user prerequisites.
- Browser mode stays browser-safe; native filesystem workflows belong behind the Tauri adapter.
- Review, References, Traceability, Data Grid, raw JSON, and AI/RAG outputs must stay secondary until the author workflow is clear.

## Slice Requirements

For each slice, follow this loop:

1. Confirm or update boundary/plan docs.
2. Analyze schema/core impact before implementation.
3. Implement headless logic first when applicable.
4. Connect desktop/web UI without leaking native APIs into browser mode.
5. Add or update unit/E2E tests.
6. Update docs and this YAML front matter.
7. Run validation.
8. Commit with a short imperative message and push when possible.

## Slice 1: Desktop Workspace Entry

Acceptance criteria:

- Tauri desktop starts at a lightweight start screen when no document or workspace is active.
- Start screen offers Open Folder, Open `.sdoc`, New `.sdoc`, and Recent Documents.
- Browser playground may keep sample content; desktop product mode must not treat sample content as the user document.
- Workspace path, recent documents, selected folder, and start-screen state remain runtime/user settings only.
- `build:desktop` docs and emitted executable naming stay consistent.

## Remaining Slices

Explorer-First Files Panel:
Make Files read as a simple VS Code-like explorer. Show current workspace, immediate `.sdoc` files, active document, and unsaved state. Move developer unpack/pack and debug workflows out of the default path.

Information Architecture Cleanup:
Primary surfaces are Files, Outline, Export, and Settings. Review, Diagnostics, History, Developer, References, Traceability, Data Grid, raw JSON, and AI/RAG outputs become advanced or contextual surfaces.

Core Authoring UX:
Implement heading numbering as render/export projection, heading-based outline/TOC navigation, figure/table captions, figure/table lists, equation editing, and selected-text bubble formatting.

Publishing Style Profiles:
Add export style profiles such as IEEE, ISO/IEC, Modern, and Korean without turning `document.json` into a page-layout format.

Draw.io Create Or Import Flow:
Offer Import Existing and Create New. Preserve editable Draw.io source in `.sdoc/assets/`; keep preview, temp path, editor process state, and raw XML out of `document.json`.

## Validation Gates

Always run:

```text
npm test
npm run build
```

For UI changes:

```text
npm run test:e2e
```

For desktop workflow changes:

```text
npm run typecheck:desktop
npm run build:desktop
```

Clean Playwright output before committing when it is generated.

## Stop Conditions

- If canonical format changes are required, document the boundary first and stop before implementation.
- If user data loss is possible, add design notes and tests before coding.
- If existing tests fail, diagnose and fix before adding more feature work.
- Once the next user-review gate is ready, stop and report instead of moving into unrelated large features.

## Completion Rule

This goal is complete only when all listed slices are implemented, validated, committed, and pushed. At completion, update the YAML front matter to `status: done`, `progress_percent: 100`, set `completed_at`, and add final evidence to `progress_log`.
