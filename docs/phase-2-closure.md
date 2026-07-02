# Phase 2 Closure Audit

작성일: 2026-07-02

## Verdict

Phase 2 Technical Document Basics is accepted for the MVP slice. The current implementation proves figure assets, simple tables, equations, Mermaid diagrams, regenerated AI/RAG exports, and browser `.sdoc` round trips across schema, editor, export, diff, format, and playground workflows.

Implementation baseline: `8e6c647 Add Mermaid diagram workflow`.

## Acceptance Evidence

| Requirement | Evidence |
| --- | --- |
| Figure and image asset basics | `packages/sdoc-schema/src/index.test.ts` validates figure shape; `packages/sdoc-format/src/index.test.ts` round-trips binary assets and rejects missing assets; `packages/editor-tiptap/src/index.test.ts` strips preview `src` from canonical JSON; `apps/web-playground/e2e/phase1-smoke.spec.ts` inserts an image and reopens the `.sdoc`. |
| Simple table | Schema, editor conversion, Markdown export, semantic diff, and browser round-trip coverage exist in `packages/sdoc-schema`, `packages/editor-tiptap`, `packages/sdoc-export`, `packages/sdoc-diff`, and Playwright tests. |
| Equation basics | Inline `equation` and block `equationBlock` preserve `attrs.latex`; KaTeX is editor projection only; Markdown and derived outputs keep source math; Playwright covers save/open. |
| Mermaid basics | `diagram` nodes preserve `attrs.kind = "mermaid"` and `attrs.source`; editor projection renders SVG; Markdown export emits fenced Mermaid source; derived outputs include source text; Playwright covers save/open. |
| AI/RAG exports | `exportDerivedOutputs` regenerates `plain.md`, `chunks.jsonl`, `outline.json`, and `references.json`; tests cover figure captions, table text, equation source, and Mermaid source. |
| Semantic diff | Table cell, equation source, and Mermaid source changes are summarized at meaningful node boundaries in `packages/sdoc-diff/src/index.test.ts`. |

## Verification Run

The closure state was verified with:

```text
npm test        -> 87 passed
npm run build   -> passed
npm run test:e2e -> 14 passed
```

`npm run build` reports large chunk warnings from KaTeX/Mermaid dependencies; this is accepted as Phase 2 technical debt, not a functional failure.

## Deferred To Phase 3+

- Advanced table editing
- Visual semantic diff UI
- Draw.io deep integration
- PDF/slide export
- Real-time collaboration
- Git integration beyond CLI escape hatches
- Bundle size optimization for Mermaid/KaTeX chunks
