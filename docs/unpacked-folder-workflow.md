# Unpacked Folder Workflow

Created: 2026-07-02

## Decision

Single-file `.sdoc` remains the normal user-facing document format. An unpacked `.sdoc` folder is a developer workflow for CLI, Git, review automation, and future Tauri desktop filesystem integration.

The browser app must not pretend it can browse or manage arbitrary project folders. It can save and open single files, show browser-local recent metadata, and expose CLI commands as guidance.

## Folder Shape

The CLI unpacked folder mirrors the ZIP container:

```text
document.sdoc.d/
  manifest.json
  document.json
  metadata.json
  assets/
  derived/
    plain.md
    chunks.jsonl
    outline.json
    references.json
```

`document.json` is the canonical semantic document. `derived/` is regenerated from `document.json` and should not be treated as authoritative.

## Supported Entry Points

- Browser: open/save single `.sdoc` files and show CLI command hints only.
- CLI: `npm run sdoc -- unpack "document.sdoc" "document.sdoc.d"`.
- CLI: `npm run sdoc -- pack "document.sdoc.d" "document.sdoc"`.
- CLI: `npm run sdoc -- validate "document.sdoc.d"`.
- Future Tauri: browse and watch unpacked folders through a filesystem adapter.

## Guardrails

- Do not store folder paths in `document.json`.
- Do not make Git or unpacked folders required for non-developer authors.
- Regenerate `derived/` during pack/export instead of trusting stale files.
- Keep web-core document logic independent from Tauri IPC.
