# MVP Roadmap

작성일: 2026-07-01

## Phase 0: Format & Diff Prototype

목표는 에디터 UI 전에 포맷 가설을 증명하는 것이다.

산출물:

- `.sdoc` ZIP 구조 문서화
- `document.json` schema와 stable block ID 정책
- serialization과 AI export 규칙 문서화
- deterministic serializer
- `.sdoc` pack/unpack prototype
- semantic diff prototype
- Markdown export prototype
- SDoc JSON sample 3개 이상

완료 기준:

- 같은 입력은 항상 같은 `document.json` byte sequence를 만든다.
- block 추가/삭제/이동/수정을 구분한다.
- 기본 문서를 Markdown으로 export할 수 있다.
- 테스트로 위 동작을 재현한다.

## Phase 1: Core Editor MVP

목표는 `.sdoc`를 만들고, 열고, 저장하고, 기본 편집하는 것이다.

포함:

- web playground 기반 Tiptap editor shell
- paragraph, heading, list, blockquote, code block
- callout/admonition 기본형
- metadata 편집
- `.sdoc` open/save
- block ID 자동 부여와 중복 복구
- Markdown export

제외:

- PDF/slide export
- visual diff UI
- Draw.io deep integration
- advanced table editing
- real-time collaboration

## Phase 2: Technical Document Basics

상태: MVP slice accepted on 2026-07-02. 세부 증거는 `docs/phase-2-closure.md`를 기준으로 한다.

목표는 실제 기술 문서 작성에 필요한 기본 구조를 제공하는 것이다.

포함:

- 이미지 삽입과 `assets/` 관리
- figure caption
- simple table
- KaTeX inline/block
- Mermaid rendering
- `plain.md`, `chunks.jsonl`, `outline.json`, `references.json` 생성

## Phase 3: Review & Integration

상태: MVP slice accepted on 2026-07-03. 세부 증거와 경계는 `docs/phase-3-closure.md`를 기준으로 한다.

목표는 diff와 개발자 workflow를 제품 가치로 만드는 것이다.

포함:

- visual semantic diff UI
- local document history
- cross-reference autocomplete
- broken reference detection
- VS Code-like Activity Bar and toggle sidebar shell
- unpacked folder workflow
- optional Git integration

## Phase 4: Publishing & Advanced Features

상태: MVP slice accepted on 2026-07-03. 세부 증거와 Phase 5 인계 항목은 `docs/phase-4-closure.md`를 기준으로 한다.

목표는 배포 가능한 기술 문서 제작 도구로 확장하는 것이다.

포함:

- themed HTML export
- PDF export
- slide export
- Draw.io integration
- advanced table editing
- section folding

## Phase 5: Productization

상태: 진행 중. 범위와 acceptance criteria는 `docs/phase-5-plan.md`를 기준으로 한다.

목표는 MVP 기능을 실제 제품 사용 흐름에 가깝게 만드는 것이다.

우선순위:

- Tauri desktop shell과 native `.sdoc` open/save/save-as 기반
- VS Code-like native file explorer와 workspace adapter
- Draw.io external editor bridge
- visual semantic diff review UX
- requirement tagging, traceability diagnostics, broken reference repair UX
- asset-backed large data grid minimal model 완료; row-level grid workflows와 corporate template export는 후속 slice
