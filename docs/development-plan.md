# AI/Diff 친화적 기술 문서 편집기 개발 계획서

작성일: 2026-07-01

## 1. 검토 배경

본 계획서는 `IDEA.md`, 기존 개발 방향 검토, 그리고 Grok / Gemini / Claude 기반 외부 아키텍처 리뷰를 종합해 작성했다.

검토 과정에서 `Gemini 3.1 Pro (High)`는 AGY quota/model resolution 문제로 실패했으며, `Gemini 3.5 Flash (High)`로 재시도해 의견을 반영했다. `Claude Opus 4.6 (Thinking)`과 Grok은 정상 응답을 확보했다.

## 2. 최종 평결

프로젝트의 최종 방향은 **AI/Diff 친화적인 구조화 기술 문서 편집기**다.

기존의 “Git diff 친화적 WYSIWYG 에디터”라는 방향은 조정한다. Git line diff는 핵심 가치가 아니라 선택적 통합 기능으로 낮춘다. 대신 제품의 1급 차별점은 다음 세 가지다.

1. 사람이 WYSIWYG로 편하게 작성할 수 있는 기술 문서 편집 경험
2. 자체 semantic diff를 통한 의미 단위 변경 비교
3. AI/RAG가 안정적으로 소비할 수 있는 구조화 export

## 3. 핵심 아키텍처 결정

### Editor Runtime

에디터 런타임은 **Tiptap / ProseMirror**를 유지한다.

이유는 명확하다. heading, callout, figure, table, equation, diagram, cross-reference 같은 기술 문서 노드를 schema로 강제하기 좋고, NodeView 기반 WYSIWYG 구현 경험이 가장 현실적이다.

### Canonical Format

canonical format은 확장 Markdown이 아니라 **정규화된 SDoc Semantic JSON**으로 결정한다.

이 포맷은 Tiptap/ProseMirror document tree와 최대한 가깝게 유지하되, 런타임 상태를 제거하고 제품 스키마 규칙을 강제한 JSON이다.

Markdown은 canonical이 아니다. Markdown은 import/export, AI plain text export, 외부 협업용 산출물로 제공한다.

### User-Facing File

사용자에게 보이는 파일은 단일 `.sdoc` 파일이다.

문서 작성자가 여러 sidecar 파일이나 폴더 구조를 직접 관리하게 하지 않는다. `.sdoc` 내부는 ZIP 컨테이너로 구성한다. ZIP은 `.docx`, `.epub`처럼 문서 컨테이너로 익숙하고, unpack/pack 도구를 만들기 쉽다.

SQLite 단일 파일도 검토했지만, v1 문서 포맷으로는 채택하지 않는다. 부분 업데이트와 스냅샷에는 장점이 있으나, unpack 기반 디버깅, Git escape hatch, 단순 복구성은 ZIP 구조가 더 적합하다.

## 4. `.sdoc` 내부 구조

권장 v1 구조:

```text
document.sdoc
  manifest.json
  document.json
  metadata.json
  assets/
    <asset-id>.<ext>
  derived/
    plain.md
    chunks.jsonl
    outline.json
    references.json
```

각 파일의 역할:

- `manifest.json`: 파일 포맷 버전, 생성 앱 버전, 문서 ID, checksum 정보
- `document.json`: canonical SDoc Semantic JSON
- `metadata.json`: title, author, version, createdAt, updatedAt 등 문서 메타데이터
- `assets/`: 이미지, Draw.io 원본, 첨부파일
- `derived/`: 언제든 재생성 가능한 파생 산출물

`derived/`는 canonical이 아니다. 손상되거나 누락되면 `document.json`에서 재생성한다.

## 5. Canonical Document Model

`document.json`은 다음 원칙을 따른다.

```json
{
  "schemaVersion": 1,
  "type": "doc",
  "attrs": {
    "id": "doc_01h..."
  },
  "content": [
    {
      "type": "heading",
      "attrs": {
        "anchor": "sec-overview",
        "id": "blk_01h...",
        "level": 1
      },
      "content": [
        {
          "type": "text",
          "text": "System Overview"
        }
      ]
    }
  ]
}
```

규칙:

- 모든 block-level node는 immutable `id`를 가진다.
- `id`는 diff와 내부 참조용이며, 위치 기반으로 만들지 않는다.
- 사람이 보는 참조에는 선택적 `anchor`를 사용한다.
- `attrs` key는 deterministic하게 정렬한다.
- 빈 값, selection, decoration, cursor, UI 상태는 저장하지 않는다.
- 같은 문서는 항상 같은 JSON byte sequence로 직렬화되어야 한다.

ID 정책:

- 내부 안정성: `id`는 ULID 또는 nanoid 계열 opaque ID 사용
- 사용자 참조: `anchor`는 `{#sec-overview}` 스타일 readable identifier로 export
- cross-reference는 내부적으로 `id`를 가리키고, Markdown export 시 `anchor`로 표현한다.

## 6. Semantic Diff 설계

semantic diff는 Git line diff가 아니라 `document.json`의 semantic node tree를 비교한다.

비교 기준:

1. block `id` 기반 matching
2. 추가 / 삭제 / 이동 / 수정 분류
3. heading, figure, table, callout, diagram 등 node type별 diff formatter
4. 텍스트 내부는 word-level diff 적용
5. 깨진 cross-reference, 변경된 caption, 표 셀 변경을 별도 이벤트로 표현

예상 출력:

```text
Section "인증 흐름" moved under "보안"
Figure fig-auth-flow caption changed
Table tbl-api row 3 column "Status" changed: Draft -> Approved
Reference @sec-login is broken
```

MVP에서는 GUI diff보다 headless diff engine과 CLI 출력을 먼저 만든다. Visual diff UI는 후속 단계에서 구현한다.

## 7. Git의 위치

Git은 버리지 않는다. 다만 사용자 경험의 중심에 두지 않는다.

일반 사용자:

- `.sdoc` 단일 파일 열기/저장
- 앱 내부에서 버전 비교
- Git 지식 불필요

개발자/기술팀:

- `sdoc unpack document.sdoc -o document.sdoc.d`
- `sdoc pack document.sdoc.d -o document.sdoc`
- `sdoc validate document.sdoc`
- `sdoc diff old.sdoc new.sdoc`
- `sdoc export document.sdoc --format markdown`
- `sdoc export document.sdoc --format chunks`
- `sdoc export document.sdoc --format outline`
- `sdoc export document.sdoc --format references`

Git 연동은 Phase 3 이후로 미룬다. 초기에는 CLI 기반 unpack/pack/diff가 충분하다. Git clean/smudge filter는 검증 후 도입한다.

## 8. MVP 범위

### Phase 0: Format & Diff Prototype

목표: 에디터 UI 전에 핵심 가설을 검증한다.

산출물:

- `docs/document-format.md`
- `docs/editor-schema.md`
- `docs/diff-model.md`
- SDoc Semantic JSON 샘플 3개
- deterministic serializer prototype
- block ID 생성/검증 prototype
- semantic diff CLI prototype
- Markdown export prototype

성공 기준:

- 같은 입력은 항상 같은 `document.json`을 만든다.
- block 이동/수정/삭제를 semantic diff로 구분한다.
- 기본 문서를 Markdown으로 읽을 수 있게 export한다.

### Phase 1: Core Editor MVP

목표: `.sdoc` 파일을 만들고, 열고, 저장하고, 기본 편집할 수 있다.

포함 기능:

- Tiptap 기반 editor shell
- paragraph, heading, list, blockquote, code block
- callout/admonition 기본형
- metadata 편집
- `.sdoc` ZIP 저장/열기
- block ID 자동 부여와 중복 복구
- Markdown export

제외 기능:

- PDF export
- slide export
- Draw.io deep integration
- advanced table
- visual diff UI
- real-time collaboration

### Phase 2: Technical Document Basics

목표: 기술 문서 작성에 필요한 최소 구조를 완성한다.

포함 기능:

- 이미지 삽입과 `assets/` 관리
- figure caption
- simple table
- KaTeX block/inline
- Mermaid code block rendering
- AI/RAG export: `plain.md`, `chunks.jsonl`, `outline.json`, `references.json`
- `sdoc diff` CLI 개선

### Phase 3: Review & Integration

목표: 자체 diff와 개발자 워크플로우를 제품 가치로 만든다.

포함 기능:

- visual semantic diff UI
- local document history
- cross-reference autocomplete
- broken reference detection
- unpacked folder workflow
- Git integration prototype

### Phase 4: Publishing & Advanced Features

목표: 배포 가능한 기술 문서 도구로 확장한다.

포함 기능:

- themed HTML export
- PDF export
- slide export
- Draw.io integration
- advanced table editing
- section folding

## 9. 주요 실패 리스크와 완화책

### ID 중복 및 유실

복사/붙여넣기, undo/redo, block split/merge 과정에서 ID가 중복되면 semantic diff와 cross-reference가 깨진다.

완화책:

- Tiptap transaction 후 전역 ID validator 실행
- 중복 ID 발견 시 새 ID 발급
- ID 관련 단위 테스트를 MVP 핵심 테스트로 둔다.

### Canonical과 Editor State 불일치

Tiptap runtime document와 `document.json`이 다르면 데이터 손실이 발생한다.

완화책:

- `document.json`을 Tiptap document와 최대한 동일한 구조로 유지
- 변환 계층을 최소화
- 저장 전 schema validation 필수

### `.sdoc` 바이너리로 인한 협업 한계

단일 ZIP 파일은 Git line diff와 merge에 약하다.

완화책:

- Git은 MVP 핵심에서 제외
- `sdoc unpack/pack/diff` CLI 제공
- 개발자 팀용 unpacked mode를 Phase 3에서 도입

### Semantic Diff 품질 부족

diff가 단순 JSON 변경 수준이면 제품 차별점이 사라진다.

완화책:

- Phase 0에서 diff CLI부터 만든다.
- 실제 문서 샘플로 기존 diff와 비교한다.
- block type별 human-readable formatter를 설계한다.

### Scope Explosion

IDEA.md의 전체 요구사항을 초기부터 구현하면 출시가 지연된다.

완화책:

- Phase 1에서는 작성/저장/열기/기본 export에 집중
- PDF, Draw.io, advanced table, visual diff UI는 후순위

## 10. 개발 원칙

1. **Format first**: 문서 포맷과 schema를 코드보다 먼저 안정화한다.
2. **Web-core first**: Tauri에 종속되지 않는 TypeScript core를 먼저 만든다.
3. **Single source of truth**: canonical은 `document.json` 하나다.
4. **Derived outputs are disposable**: Markdown, chunks, outline, references는 재생성 가능해야 한다.
5. **Non-developer UX first**: Git, JSON, 내부 구조는 숨긴다.
6. **Developer escape hatch**: CLI와 unpacked workflow는 반드시 제공한다.
7. **Semantic over textual**: 변경 비교는 줄 단위가 아니라 문서 의미 단위로 한다.

## 11. 초기 리포지터리 구성 제안

구현 시작 시 다음 구조를 권장한다.

```text
apps/
  web-playground/
  desktop/
packages/
  sdoc-schema/
  sdoc-format/
  sdoc-diff/
  sdoc-export/
  editor-core/
  editor-tiptap/
docs/
  document-format.md
  editor-schema.md
  diff-model.md
  mvp-roadmap.md
```

초기에는 `apps/desktop`보다 `apps/web-playground`를 먼저 만든다. 문서 모델, serializer, diff, Tiptap editor shell을 브라우저에서 빠르게 검증한 뒤 Tauri로 감싼다.

## 12. 최종 결정 요약

| 항목 | 결정 |
|---|---|
| Editor engine | Tiptap / ProseMirror |
| Canonical format | 정규화된 SDoc Semantic JSON |
| User-facing file | 단일 `.sdoc` ZIP container |
| Markdown | canonical 아님, export/import 포맷 |
| Tiptap JSON | canonical과 거의 동일한 구조로 유지하되 런타임 상태 제거 |
| Diff | `document.json` 기반 semantic diff |
| Git | 숨겨진 선택 기능, CLI/unpacked workflow로 지원 |
| MVP 핵심 | format, ID, save/load, basic editor, semantic diff CLI |

## 13. 다음 작업

바로 구현에 들어가기 전에 다음 문서를 먼저 작성한다.

1. `docs/document-format.md`
2. `docs/editor-schema.md`
3. `docs/diff-model.md`
4. `docs/mvp-roadmap.md`

그 후 Phase 0 prototype을 시작한다. Phase 0의 목표는 “예쁜 에디터”가 아니라 **문서 포맷, stable ID, semantic diff가 실제로 작동하는지 증명하는 것**이다.
