# Repository Guidelines

## Project Structure & Module Organization

This repository is an early-stage Tiptap/ProseMirror-based WYSIWYG editor intended for a Windows Tauri native application. Current top-level files are:

- `IDEA.md`: product notes and planned editor capabilities.
- `docs/`: project documentation; add architecture notes, setup guides, and design decisions here.
- `.agents/skills/`: local agent-reviewer skill definitions; keep automation-specific files isolated here.

When implementation begins, prefer a conventional Tauri layout: frontend code under `src/`, native code under `src-tauri/`, reusable editor extensions under `src/extensions/`, and static assets under `src/assets/`.

## Build, Test, and Development Commands

No package manifest or build system is present yet. After adding one, document commands here and keep them stable. Recommended examples for a Tauri + TypeScript project:

- `npm install`: install project dependencies.
- `npm run dev`: start the local frontend development server.
- `npm run tauri dev`: run the desktop app in development mode.
- `npm run build`: create a production frontend build.
- `npm run tauri build`: package the Windows desktop application.

Do not add tool-specific commands without updating this section.

## Coding Style & Naming Conventions

Use TypeScript for frontend/editor code and Rust for Tauri backend code. Prefer 2-space indentation in TypeScript, 4-space indentation in Rust, `PascalCase` for components, `camelCase` for functions and variables, and kebab-case for route or asset filenames.

Keep editor extensions small and focused. Name extension files by feature, for example `callout-extension.ts` or `mermaid-node.ts`.

## Testing Guidelines

No test framework is configured yet. When added, place unit tests next to source files as `*.test.ts` or under `tests/` for integration coverage. Prioritize tests for document serialization, import/export behavior, Tiptap extensions, and Tauri file-system access. Add a single command such as `npm test` and keep it suitable for CI.

## Commit & Pull Request Guidelines

This directory currently has no Git history, so no existing commit convention can be inferred. Use short, imperative commit messages, for example `Add editor extension scaffold`.

Pull requests should include a concise summary, testing notes, linked issues when available, and screenshots or screen recordings for visible editor changes. Call out changes to document formats such as `.sdoc` or `.tiptap.json`.

## Agent-Specific Instructions

Before modifying files, inspect the current structure and avoid overwriting user-created content. Keep generated documentation concise and update this guide when repository tooling or layout changes.
