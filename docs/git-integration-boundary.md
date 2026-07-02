# Git Integration Boundary

Created: 2026-07-03

## Decision

Git is an optional developer and review workflow, not the canonical storage model and not a requirement for normal authors. The canonical document remains `document.json` inside a single-file `.sdoc` container.

The product should optimize for semantic diff first. Git line diff can be useful around unpacked folders, but it must not become the main review experience.

## Browser Scope

The browser MVP can:

- show local semantic diff against the saved baseline or a browser-local snapshot,
- expose CLI command hints for semantic diff,
- explain that Git workflows require CLI or future Tauri filesystem access.

The browser MVP must not:

- run Git commands,
- store repository paths in `document.json`,
- require a repository for save/open/review,
- imply it can watch or merge arbitrary folders.

## CLI and Tauri Scope

CLI workflows:

```text
npm run sdoc -- diff "old.document.json" "new.document.json"
npm run sdoc -- unpack "document.sdoc" "document.sdoc.d"
npm run sdoc -- validate "document.sdoc.d"
npm run sdoc -- pack "document.sdoc.d" "document.sdoc"
```

Future Tauri workflows may add repository detection, file watching, branch metadata, and Git-backed review entry points through an adapter layer. Editor core and document conversion logic must remain independent from Tauri IPC and Git APIs.

## Guardrails

- Keep Git hidden unless the user chooses a developer workflow.
- Prefer SDoc semantic diff over raw JSON or ZIP binary diffs.
- Treat unpacked folders as an escape hatch for review automation, not the normal authoring format.
- Do not block non-developer teams on Git knowledge.
