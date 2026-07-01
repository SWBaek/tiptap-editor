# Phase 0 Acceptance Audit

작성일: 2026-07-02

## Scope

Phase 0의 목표는 UI 품질이 아니라 `.sdoc` format, stable block ID, deterministic serialization, semantic diff, Markdown/AI export가 headless workflow에서 실제로 동작함을 증명하는 것이다.

## Acceptance Evidence

| Requirement | Evidence |
| --- | --- |
| SDoc JSON schema and stable IDs | `packages/sdoc-schema`, `examples/sdoc-json/*.document.json`, `npm run sdoc -- validate ...` |
| Deterministic canonical serialization | `packages/sdoc-format/src/index.test.ts` verifies stable stringify and identical ZIP bytes. |
| `.sdoc` ZIP pack/unpack | `packages/sdoc-format` unit tests and `packages/sdoc-cli` Phase 0 smoke flow cover pack, validate, and unpack. |
| Semantic diff | `packages/sdoc-diff` tests cover added, deleted, moved, modified, broken reference, and word-level text summaries. |
| Markdown and AI/RAG export | `packages/sdoc-export` tests and CLI export tests cover `plain.md`, `chunks.jsonl`, `outline.json`, and `references.json`. |
| Sample documents | `examples/sdoc-json/basic.document.json`, `modified.document.json`, and `reordered.document.json`. |

## Required Verification

Run these before declaring Phase 0 closed:

```text
npm test
npm run build
npm run sdoc -- validate examples/sdoc-json/basic.document.json
npm run sdoc -- diff examples/sdoc-json/basic.document.json examples/sdoc-json/modified.document.json
npm run sdoc -- export examples/sdoc-json/basic.document.json markdown
```

The smoke test in `packages/sdoc-cli/src/index.test.ts` additionally creates real `.sdoc` ZIP files, unpacks one, diffs two `.sdoc` files, and exports Markdown from a `.sdoc` input.

## Phase 0 Boundary

The accepted prototype does not include visual diff UI, advanced tables, PDF/slide export, real-time collaboration, or Git integration. Those remain Phase 1+ work after the format and semantic diff foundation stays green.
