# Phase 2 Acceptance Plan

작성일: 2026-07-02

## Scope

Phase 2의 목표는 실제 기술 문서 작성에 필요한 최소 구조를 추가하는 것이다. Phase 1이 editor/save/load의 기반을 증명했다면, Phase 2는 figure, simple table, equation, Mermaid, asset-backed document structure가 schema, editor, export, diff에서 일관되게 동작함을 증명해야 한다.

## Current Baseline

| Area | Current State |
| --- | --- |
| Assets container | `.sdoc` stores `assets/` in `packages/sdoc-format`; figure references are checked against container assets. The playground can insert image files into `assets/`. |
| AI/RAG exports | `plain.md`, `chunks.jsonl`, `outline.json`, and `references.json` already exist in `packages/sdoc-export`. |
| Unsupported nodes | `figure` and simple `table` are accepted Phase 2 slices. `equationBlock` and `diagram` are still intentionally rejected by `packages/sdoc-schema`. |
| Mermaid | Current code blocks preserve language attrs, but Mermaid is not rendered or typed as a diagram node. |

## Acceptance Evidence

Phase 2 is not closed until all of these are covered:

| Requirement | Evidence Needed |
| --- | --- |
| Figure and image asset basics | Covered for the MVP slice: schema/editor/export/format support `figure` with stable block ID, caption, asset reference, image insertion, and browser `.sdoc` round trip. |
| Simple table | Covered for the MVP slice: schema/editor support rows and cells, Markdown export emits a pipe table, semantic diff summarizes changed cells at the table block, and browser `.sdoc` round trip is covered. |
| Equation basics | Inline and block equations preserve source text; editor renders or previews them without losing canonical source. |
| Mermaid basics | Mermaid source is stored canonically and previewed/rendered as a diagram projection, not as the canonical format. |
| Export upgrades | Markdown, chunks, outline, and references include figure/table captions where relevant. |
| Tests | Unit tests cover schema/export/format/diff behavior; Playwright covers figure and table browser workflows. Equation and Mermaid workflows remain. |

## Suggested Implementation Order

1. Extend `docs/editor-schema.md` and `packages/sdoc-schema` for Phase 2 node shapes.
2. Add Markdown/export support before rich UI polish.
3. Add Tiptap nodes and focused toolbar/insert controls.
4. Add Playwright workflows for save/open/export round trips.
5. Improve semantic diff formatters for new node types.

## Boundary

Phase 2 should avoid advanced table editing, PDF/slide export, Draw.io deep integration, real-time collaboration, and visual semantic diff UI. Those remain Phase 3+ work.
