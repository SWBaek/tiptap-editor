# AI Export

작성일: 2026-07-01

## 목적

AI export는 SDoc의 구조화 문서를 LLM/RAG 파이프라인이 안정적으로 소비할 수 있게 만드는 파생 산출물이다. AI export는 canonical이 아니며, 언제든 `document.json`에서 재생성해야 한다.

## Derived Files

v1 `.sdoc`의 `derived/`에는 다음 파일을 둘 수 있다.

```text
derived/
  plain.md
  chunks.jsonl
  outline.json
  references.json
```

- `plain.md`: 사람이 읽기 쉽고 LLM 입력에 적합한 Markdown.
- `chunks.jsonl`: RAG indexing을 위한 block 단위 chunk.
- `outline.json`: heading 기반 문서 구조.
- `references.json`: block ID, anchor, label, type 기반 참조 대상 목록.

CLI export aliases:

```text
sdoc export document.sdoc --format markdown
sdoc export document.sdoc --format chunks
sdoc export document.sdoc --format outline
sdoc export document.sdoc --format references
```

## Markdown Export

Markdown은 canonical이 아니다. Markdown export는 리뷰, 외부 협업, LLM 입력을 위한 projection이다.

규칙:

- heading은 `# Title {#anchor}` 형태로 export한다.
- cross-reference는 target block의 `anchor`가 있으면 Markdown link로 export한다.
- heading target에 `anchor`가 없으면 block ID를 fallback anchor로 사용한다.
- target block이 없으면 missing reference marker를 남긴다.
- callout은 Markdown admonition 호환 문법으로 export한다.
- 지원하지 않는 node는 가능한 범위에서 text fallback으로 export한다.

## Chunk Export

초기 chunk는 block 단위로 생성한다.

필드:

- `id`: block ID
- `type`: node type
- `heading`: 가장 가까운 preceding heading text
- `text`: block plain text

Phase 2 이후에는 heading hierarchy, reference graph, token budget, table/figure caption을 반영해 chunk strategy를 확장한다.

## Reference Export

`references.json`은 참조 가능한 block의 목록이다.

필드:

- `id`: immutable block ID
- `type`: node type
- `anchor`: optional human-readable anchor
- `label`: plain text label

내부 참조 안정성은 `id`가 담당하고, Markdown/HTML 표현은 가능한 경우 `anchor`를 사용한다.

## Regeneration Policy

앱은 `.sdoc`를 열 때 `derived/`가 없거나 오래되었거나 손상되어도 `document.json`을 기준으로 재생성해야 한다. `derived/`만 변경된 상태는 semantic document 변경으로 보지 않는다.
