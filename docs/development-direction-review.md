# AI 친화적 기술 문서 편집기 개발 방향 검토

작성일: 2026-07-01

## 검토 방식

`IDEA.md`를 기준으로 Codex가 1차 분석을 수행한 뒤, 외부 비평 관점으로 Grok, Gemini 3.1 Pro(AGY), Claude Opus(AGY)의 의견을 받아 종합했다. AGY 로그에서 `Gemini 3.1 Pro (High)`와 `Claude Opus 4.6 (Thinking)` 모델 선택이 정상 반영된 것을 확인했다.

이 문서는 원 응답을 그대로 붙여넣은 것이 아니라, 개발 적합성과 방향성 판단에 필요한 공통 결론, 이견, 실행 권고를 정리한 것이다.

## 최종 판단

이 프로젝트는 만들 가치가 있다. 단, “또 하나의 WYSIWYG 에디터”가 아니라 **AI/RAG/Git 친화적인 구조화 기술 문서 IDE**로 좁혀야 한다.

핵심 가설은 다음이다.

- 작성자는 Word처럼 편하게 쓴다.
- 저장 포맷은 구조적이고 deterministic해야 한다.
- Git 리뷰가 가능해야 한다.
- AI/RAG 파이프라인이 문서를 안정적으로 chunking하고 참조할 수 있어야 한다.

이 네 가지 중 하나라도 약하면 제품 차별성이 크게 줄어든다.

## 외부 리뷰 공통 합의

세 외부 리뷰어가 공통적으로 지적한 내용은 명확하다.

1. 문제 인식은 타당하다. Word는 Git diff, 템플릿 준수, AI/RAG 소비 측면에서 약하다.
2. Markdown과 AsciiDoc은 개발자 친화적이지만, 일반 작성자에게 WYSIWYG 경험이 부족하다.
3. Tiptap/ProseMirror는 구조화 문서 편집기에 적합한 선택이다.
4. 현재 요구사항 17개는 MVP가 아니라 장기 제품 로드맵에 가깝다.
5. `pretty-printed JSON`만으로 Git-friendly가 된다고 보면 위험하다.
6. 차별화는 기능 개수가 아니라 구조화 문서 모델, semantic diff, AI export에서 나와야 한다.

## 주요 이견과 해석

Grok은 저장 포맷 전략을 가장 강하게 문제 삼았다. ProseMirror JSON을 그대로 Git diff 대상으로 삼으면 실제 리뷰 경험이 좋지 않을 수 있으므로, Markdown 계열 canonical representation이나 semantic diff가 필요하다는 입장이다.

Gemini는 Tauri + Tiptap 조합 자체는 긍정적으로 봤다. 다만 JSON diff 문제를 GitHub Action, 내장 visual diff, headless CLI 등으로 보완해야 한다고 봤다.

Claude Opus는 Tauri 데스크톱부터 시작하는 것에 회의적이었다. PMF 검증 전에는 웹앱으로 시작하고, Tauri는 이후 래핑해도 늦지 않다는 입장이다.

Codex 판단은 중간이다. 최종 제품은 Windows Tauri 네이티브가 맞을 수 있지만, 초기 아키텍처는 **web-core first**로 잡아야 한다. 즉, editor core, schema, serializer, importer/exporter는 브라우저와 Tauri 모두에서 재사용 가능해야 한다.

## 개발 적합성

### Tiptap/ProseMirror

적합하다. heading, paragraph, callout, figure, table, equation, diagram, cross-reference 같은 semantic node를 강제하기 좋다. 단, Tiptap JSON을 곧바로 제품 포맷으로 확정하면 스키마 진화와 diff 품질 문제가 생긴다.

권장 방향:

- 제품 스키마를 먼저 정의한다.
- Tiptap node는 그 스키마의 편집 UI로 취급한다.
- 저장 시 stable id, attribute 정렬, 빈 속성 제거, deterministic serialization을 강제한다.

### Tauri

최종 배포 방식으로는 적합하다. 로컬 파일 시스템, 이미지/다이어그램 에셋, 오프라인 사용, Windows 배포에 강점이 있다.

단, 초기 검증은 Tauri 의존성을 낮추는 편이 좋다. 파일 I/O와 네이티브 기능은 adapter로 분리하고, 편집기와 문서 변환 로직은 순수 TypeScript 패키지로 유지한다.

## 핵심 차별화 제안

### 1. Semantic Document Schema

문서를 자유로운 rich text가 아니라 기술 문서용 구조로 제한해야 한다.

예:

- `heading`
- `paragraph`
- `codeBlock`
- `callout`
- `figure`
- `table`
- `equation`
- `diagram`
- `crossReference`
- `metadata`

각 주요 block에는 stable id를 부여해야 한다. AI/RAG, cross-reference, semantic diff가 모두 이 id에 의존한다.

### 2. Semantic Diff

가장 강한 킬러 피처 후보는 semantic diff다.

일반 JSON diff가 아니라 다음처럼 보여야 한다.

- 제목 `System Overview`가 `Architecture Overview`로 변경됨
- Figure 3의 caption이 수정됨
- Table 2의 2행 3열 값이 변경됨
- `@fig-auth-flow` 참조 대상이 삭제되어 깨짐

이 기능은 Word, Markdown, 일반 Tiptap 에디터와 구분되는 강한 차별점이 될 수 있다.

### 3. AI/RAG Export

AI 친화성은 슬로건이 아니라 산출물로 증명해야 한다.

초기부터 다음 export를 고려한다.

- `document.chunks.jsonl`: RAG용 chunk
- `document.outline.json`: heading tree
- `document.references.json`: figure/table/heading 참조 그래프
- `document.plain.md`: LLM 입력용 Markdown

## 저장 포맷 방향

`*.tiptap.json`은 디버그와 호환 목적의 export로 유지할 수 있다. 그러나 장기 canonical format은 별도로 정의하는 것이 좋다.

권장안:

```text
example.sdoc/
  document.json
  metadata.json
  assets/
  exports/
```

또는 단일 파일이 필요하면 zip 기반 컨테이너를 고려한다. 중요한 것은 `.sdoc`가 단순한 ProseMirror dump가 아니라, 기술 문서용 schema와 assets, metadata, references를 안정적으로 담는 포맷이어야 한다는 점이다.

## MVP 권장 순서

### Phase 0: 검증

- 실제 기술 문서 샘플 5개 이상 수집
- Word/Markdown/AsciiDoc의 구체적 실패 사례 정리
- JSON diff와 semantic diff 프로토타입 비교
- AI chunk export가 실제 RAG 품질을 개선하는지 테스트

### Phase 1: Core Editor

- Tiptap 기본 편집기
- heading, paragraph, list, code block, blockquote
- callout/admonition
- metadata 편집
- `.sdoc` 또는 `.tiptap.json` 저장/열기
- deterministic pretty serialization
- Markdown export

### Phase 2: Technical Document Basics

- 파일 탐색기
- 이미지 붙여넣기와 상대 경로 에셋 관리
- 기본 표
- Markdown/HTML import
- AI/RAG JSONL export
- semantic diff 초안

### Phase 3: Advanced Structure

- KaTeX
- Mermaid
- cross-reference와 자동 번호
- section folding
- HTML export with theme

### Phase 4: Late Features

- PDF export
- slide export
- Draw.io deep integration
- 고급 표 편집

## 피해야 할 방향

- 처음부터 PDF, slide, Draw.io, 고급 표를 구현하지 않는다.
- “JSON이라서 AI 친화적”이라고 주장하지 않는다.
- `.sdoc` 독자 포맷만 만들고 Markdown export/import를 약하게 두지 않는다.
- Tauri IPC에 editor core가 묶이게 만들지 않는다.
- 사용자가 직접 JSON diff를 읽을 것이라고 가정하지 않는다.

## 반드시 문서화해야 할 설계 결정

다음 문서는 구현 전에 분리해서 작성해야 한다.

- `docs/document-format.md`: `.sdoc` 구조, schema version, migration 정책
- `docs/editor-schema.md`: Tiptap node/mark와 semantic document model 매핑
- `docs/serialization.md`: stable id, attribute ordering, pretty print 규칙
- `docs/ai-export.md`: RAG chunking, outline, reference graph export 규칙
- `docs/mvp-roadmap.md`: Phase별 포함/제외 기능
- `docs/diff-model.md`: semantic diff의 입력, 출력, UI 표현 방식

## 결론

개발 방향은 유효하다. 그러나 성공 조건은 에디터 기능을 많이 넣는 것이 아니라, **구조화된 기술 문서를 사람이 편하게 작성하고, Git과 AI가 안정적으로 소비할 수 있게 만드는 것**이다.

가장 먼저 증명해야 할 것은 Tauri 앱도, PDF export도, Draw.io도 아니다. 우선 증명해야 할 것은 다음 세 가지다.

1. 구조화 문서를 WYSIWYG로 편하게 작성할 수 있는가.
2. 저장 결과가 Git/리뷰에 실제로 유리한가.
3. AI/RAG 입력으로 넣었을 때 Word/Markdown보다 명확한 이점이 있는가.

이 세 가지가 검증되면 나머지 기능은 제품을 확장하는 요소가 된다. 검증되지 않으면 나머지 기능은 범위만 키우는 부담이 된다.
