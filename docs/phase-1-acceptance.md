# Phase 1 Acceptance Audit

작성일: 2026-07-02

## Scope

Phase 1의 목표는 브라우저 playground에서 `.sdoc` 문서를 만들고, 열고, 저장하고, 기본 편집할 수 있음을 증명하는 것이다. 제품 완성도나 고급 기술 문서 기능보다 format-first editor workflow가 우선이다.

## Acceptance Evidence

| Requirement | Evidence |
| --- | --- |
| Tiptap editor shell | `apps/web-playground/src/App.tsx` renders the editor, toolbar, metadata sidebar, and JSON/Markdown/Diff preview panes. |
| Basic block editing | StarterKit toolbar supports heading, paragraph, bullet/ordered list, blockquote, and code block. `packages/editor-tiptap` converts editor JSON to SDoc JSON. Playwright verifies editor changes and toolbar block commands update the JSON preview. |
| Callout/admonition basics | `CalloutNode` supports note/warning callouts; conversion, Markdown export, and toolbar E2E tests preserve callout kind. |
| Metadata editing | Sidebar fields edit title, author, and version. `documentState` tests cover dirty detection and metadata diff lines. |
| `.sdoc` open/save | `documentIo` tests cover `.sdoc` round trip, empty `.sdoc` initialization, JSON open, invalid input rejection, and derived output regeneration. Playwright also covers browser download and reopen. |
| Block ID lifecycle | `editor-tiptap` tests cover missing IDs, duplicate IDs, split blocks, list wrappers, nested blocks, and top-level block moves without ID loss. Playwright verifies split undo/redo, clipboard paste, and move toolbar actions keep IDs unique. |
| Markdown export | `documentIo` and `sdoc-export` tests cover title-based `.md` payloads and Markdown content generation. |

## Required Verification

Run these before declaring Phase 1 closed:

```text
npm test
npm run test:e2e
npm run build
```

Then verify the running playground at `http://127.0.0.1:6280`:

```text
Invoke-WebRequest -Uri http://127.0.0.1:6280 -UseBasicParsing
```

The automated smoke tests in `apps/web-playground/e2e/phase1-smoke.spec.ts` verify the playground loads, Markdown/Diff previews update, Markdown download works, `.sdoc` download/reopen preserves metadata and block anchors, unsupported files report an error without replacing the document, split undo/redo preserves unique block IDs, copied editor HTML with duplicate IDs is repaired on paste, inline/block toolbar commands update SDoc JSON, move toolbar actions preserve top-level IDs, and the mobile viewport remains usable. For release candidates, also run this manual browser smoke:

1. Create a new document.
2. Edit heading, paragraph, list, blockquote, code block, note callout, and warning callout.
3. Change title, author, and version metadata.
4. Confirm JSON, Markdown, and Diff previews update.
5. Download `.sdoc` and Markdown.
6. Reopen the downloaded `.sdoc` and confirm content, metadata, and block IDs survive.

## Remaining Risk

The browser smoke tests cover core happy/error paths and desktop toolbar commands, but they do not yet automate drag/drop or every toolbar command across mobile viewports.

## Phase 1 Boundary

Phase 1 does not include visual semantic diff UI, advanced tables, image/asset management, KaTeX, Mermaid rendering, PDF/slide export, real-time collaboration, or Git integration. Those remain Phase 2+ work.
