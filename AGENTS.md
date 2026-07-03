# Repository Guidelines

## Project Structure & Module Organization

This repository is an early-stage AI/Diff-friendly technical document editor. The editor runtime is Tiptap/ProseMirror, but the product focus is structured `.sdoc` documents, semantic diff, and AI/RAG-friendly exports. Current top-level files are:

- `IDEA.md`: product notes and planned editor capabilities.
- `docs/`: project documentation; add architecture notes, setup guides, and design decisions here.
- `examples/sdoc-json/`: sample canonical documents for Phase 0 diff/export checks.
- `packages/`: TypeScript packages for schema, format, diff, export, and CLI prototypes.
- `.agents/skills/`: local agent-reviewer skill definitions; keep automation-specific files isolated here.

Before implementation, read `docs/development-plan.md`. Current implementation layout:

- `apps/web-playground/`: browser-first prototype for schema, serialization, diff, and editor shell.
- `packages/sdoc-schema/`: canonical document types and validation.
- `packages/sdoc-format/`: `.sdoc` pack/unpack, deterministic serialization.
- `packages/sdoc-diff/`: semantic diff engine.
- `packages/sdoc-export/`: Markdown, AI/RAG, outline, and reference exports.
- `packages/sdoc-cli/`: Phase 0 CLI for pack/unpack/diff/export checks.
- `packages/editor-tiptap/`: Tiptap extensions and editor JSON/SDoc conversion helpers.

Key design documents:

- `docs/document-format.md`: `.sdoc` container and validation contract.
- `docs/editor-schema.md`: v1 node/mark scope and ID policy.
- `docs/serialization.md`: canonical JSON and deterministic ZIP rules.
- `docs/diff-model.md`: semantic diff event model.
- `docs/ai-export.md`: Markdown, chunk, outline, and reference exports.
- `docs/word-template-injection-boundary.md`: external `.dotx/.docx` template injection policy.
- `docs/ui-shell-plan.md`: VS Code-like Activity Bar and toggle sidebar direction.
- `docs/mvp-roadmap.md`: phased scope and exclusions.

Planned later layout:

- `apps/desktop/`: later Tauri wrapper.

## Mandatory Architecture Rules

- Tiptap/ProseMirror is the editor runtime, not the product format by itself.
- The canonical source of truth is normalized SDoc Semantic JSON in `document.json`.
- Markdown is not canonical. Treat Markdown as import/export or AI plain-text output only.
- User-facing `.sdoc` files are single-file ZIP containers.
- A v1 `.sdoc` contains `manifest.json`, `document.json`, `metadata.json`, `assets/`, and optional `derived/`.
- `derived/` files such as `plain.md`, `chunks.jsonl`, `outline.json`, and `references.json` must be disposable and regenerable.
- Never store cursor, selection, decoration, UI state, or other runtime-only data in `document.json`.
- Every block-level node must have a stable immutable `id`. Never derive IDs from position.
- Use optional human-readable `anchor` values for exported references; internal references should rely on stable IDs.
- Semantic diff must compare normalized `document.json`, not raw Git line diff, Markdown text, or UI state.
- Git is optional integration, hidden from non-developer UX. Do not make Git knowledge required for normal use.
- The final editor shell should use a VS Code-like Activity Bar plus toggle sidebar; the current metadata/status sidebar is a prototype surface.
- Format/schema/diff docs must be updated before changing `.sdoc`, node schema, serialization, or diff behavior.

## Build, Test, and Development Commands

Use npm workspaces from the repository root.

- `npm install`: install project dependencies.
- `npm run dev:web`: start the browser playground at `http://127.0.0.1:6280`.
- `npm run dev:desktop`: start the future Tauri desktop shell; requires Rust/Cargo and native Tauri prerequisites.
- `npm run build`: compile packages and build the browser playground.
- `npm run build:packages`: compile only the TypeScript packages.
- `npm run build:desktop`: build the Tauri desktop app; requires Rust/Cargo and native Tauri prerequisites.
- `npm run typecheck:desktop`: type-check the desktop adapter TypeScript without running the native Tauri build.
- `npm test`: build packages and run unit tests with Vitest.
- `npx playwright install chromium`: install the browser runtime needed for E2E checks.
- `npm run test:e2e`: run the Playwright browser smoke test for the Phase 1 playground.
- `npm run sdoc -- validate examples/sdoc-json/basic.document.json`: validate a `.sdoc`, `document.json`, or unpacked `.sdoc` folder.
- `npm run sdoc -- diff examples/sdoc-json/basic.document.json examples/sdoc-json/modified.document.json`: run the Phase 0 semantic diff CLI.
- `npm run sdoc -- export examples/sdoc-json/basic.document.json markdown`: export a sample document to Markdown.
- `npm run sdoc -- export examples/sdoc-json/basic.document.json chunks`: export RAG-oriented JSONL chunks.
- `npm run sdoc -- export examples/sdoc-json/basic.document.json --format html --template controlled -o controlled.html`: export controlled corporate HTML without changing `document.json`.
- `npm run sdoc -- export examples/sdoc-json/basic.document.json --format docx --template controlled -o controlled.docx`: export an editable derived Word handoff without changing `document.json`.
- `npm run sdoc -- template validate controlled.docx`: validate a `.docx/.dotx` template package before future external template injection uses it.
- `npm run sdoc -- export examples/sdoc-json/basic.document.json --format pptx -o deck.pptx`: generate a derived native PowerPoint deck.
- `npm run sdoc -- data-grid diff old.csv new.csv --format csv --key id`: review row-level dataGrid asset changes without storing rows in `document.json`.
- `npm run sdoc -- data-grid apply baseline.csv proposed.csv current.csv --format csv --key id --event 0 -o merged.csv`: apply one guarded row-level asset change with stale-source protection.
- `npm run clean`: remove TypeScript build artifacts through `tsc -b --clean`.

Desktop development uses the `@sdoc/desktop` workspace and reuses the web playground frontend until a dedicated desktop UI split is justified.

## Coding Style & Naming Conventions

Use TypeScript for editor core, schema, serialization, diff, and exports. Use Rust only where Tauri/native file integration justifies it. Prefer 2-space indentation in TypeScript, 4-space indentation in Rust, `PascalCase` for components, `camelCase` for functions and variables, and kebab-case for filenames.

Keep editor extensions small and focused. Name extension files by feature, for example `callout-extension.ts`, `figure-node.ts`, or `mermaid-node.ts`. Keep framework-independent logic out of Tiptap components whenever practical.

## Testing Guidelines

Vitest is configured for package and app logic tests. Playwright is configured for browser-level smoke coverage under `apps/web-playground/e2e/`. Place unit tests next to source files as `*.test.ts`; place browser flows as `*.spec.ts`.

Highest-priority tests:

- deterministic serialization: same semantic document produces identical `document.json`.
- block ID lifecycle: create, split, merge, copy, paste, undo, redo, and deduplicate.
- `.sdoc` pack/unpack round trip.
- schema validation and migration.
- semantic diff for added, deleted, moved, and modified blocks.
- export regeneration for Markdown, outline, references, and chunks.

## Commit & Pull Request Guidelines

Existing history uses short, imperative commit subjects such as `Initial repository setup`. Continue that style, for example `Add sdoc format prototype`.

Pull requests should include a concise summary, testing notes, linked issues when available, and screenshots or recordings for visible editor changes.

PRs that change `.sdoc`, `document.json`, schema, serialization, ID behavior, exports, or semantic diff must explicitly call that out and update the relevant docs under `docs/`.

## Agent-Specific Instructions

Before modifying files, inspect the current structure and avoid overwriting user-created content. Keep generated documentation concise and update this guide when repository tooling or layout changes.

Do not start by building advanced UI. Phase 0 work must prioritize `docs/document-format.md`, `docs/editor-schema.md`, `docs/serialization.md`, `docs/diff-model.md`, `docs/ai-export.md`, `docs/mvp-roadmap.md`, plus small prototypes for SDoc JSON, stable IDs, deterministic serialization, `.sdoc` pack/unpack, semantic diff, and Markdown export.

Do not introduce PDF export, slide export, Draw.io deep integration, advanced tables, real-time collaboration, or visual diff UI before the format, ID, save/load, and headless semantic diff foundations are working.
