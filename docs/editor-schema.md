# Editor Schema

작성일: 2026-07-01

## 목적

SDoc schema는 Tiptap/ProseMirror 편집 상태를 제품 포맷으로 정규화하는 계약이다. Tiptap은 런타임이고, canonical 데이터는 `document.json`이다.

## v1 기본 노드

현재 지원하는 canonical node는 다음으로 제한한다.

| Node | Block | 설명 |
|---|---:|---|
| `doc` | yes | 문서 루트 |
| `heading` | yes | `level: 1..6`, optional `anchor` |
| `paragraph` | yes | 기본 본문 |
| `blockquote` | yes | 인용 블록 |
| `codeBlock` | yes | `language` optional |
| `bulletList` | yes | 목록 컨테이너 |
| `orderedList` | yes | 순서 목록 컨테이너 |
| `listItem` | yes | 목록 항목 |
| `callout` | yes | `kind: note/info/warning/danger/tip` |
| `figure` | yes | Phase 2 asset-backed image with caption; `assetId` required |
| `equationBlock` | yes | Phase 2 block math; `latex` source required |
| `diagram` | yes | Phase 2 Mermaid diagram; `kind` and `source` required |
| `table` | yes | Phase 2 simple table container |
| `tableRow` | yes | Table row; children are `tableCell` or `tableHeader` |
| `tableCell` | yes | Table body cell; contains block content |
| `tableHeader` | yes | Header cell; contains block content |
| `text` | no | inline text |
| `hardBreak` | no | 줄바꿈 |
| `crossReference` | no | 내부 참조 inline node |
| `equation` | no | Phase 2 inline math; `latex` source required |

PDF, slide, Draw.io deep integration은 schema foundation 이후로 미룬다.

## Phase 2 Figure Shape

`figure` is the first Phase 2 block node. It stores an asset reference in `attrs.assetId`, keeps image bytes in the `.sdoc` `assets/` container, and requires a paragraph caption so Markdown and AI/RAG exports have useful text.

```json
{
  "type": "figure",
  "attrs": {
    "id": "blk_figure",
    "assetId": "asset_architecture.png",
    "alt": "Architecture"
  },
  "content": [
    {
      "type": "paragraph",
      "attrs": { "id": "blk_caption" },
      "content": [{ "type": "text", "text": "System architecture" }]
    }
  ]
}
```

## Phase 2 Equation Shape

Equations store source text in `attrs.latex`. KaTeX rendering is an editor/export projection; canonical `document.json` keeps only the source.

```json
{
  "type": "paragraph",
  "attrs": { "id": "blk_equation_text" },
  "content": [
    { "type": "text", "text": "Energy " },
    { "type": "equation", "attrs": { "latex": "E=mc^2" } }
  ]
}
```

```json
{
  "type": "equationBlock",
  "attrs": {
    "id": "blk_equation",
    "latex": "a^2+b^2=c^2"
  }
}
```

## Phase 2 Diagram Shape

Mermaid diagrams store source text in `attrs.source` with `attrs.kind = "mermaid"`. SVG rendering is an editor/export projection; canonical `document.json` does not store generated SVG.

```json
{
  "type": "diagram",
  "attrs": {
    "id": "blk_diagram",
    "kind": "mermaid",
    "source": "flowchart TD\nA[Start] --> B[Done]"
  }
}
```

## Phase 2 Table Shape

Simple tables use Tiptap-compatible `table`, `tableRow`, `tableHeader`, and `tableCell` nodes. Each table node still carries a stable `attrs.id`; semantic diff reports cell text changes at the table block.

```json
{
  "type": "table",
  "attrs": { "id": "blk_table" },
  "content": [
    {
      "type": "tableRow",
      "attrs": { "id": "blk_row_header" },
      "content": [
        {
          "type": "tableHeader",
          "attrs": { "id": "blk_header_name" },
          "content": [{ "type": "paragraph", "attrs": { "id": "blk_header_name_text" }, "content": [{ "type": "text", "text": "Name" }] }]
        }
      ]
    }
  ]
}
```

## Phase 3 Cross Reference Shape

`crossReference` is an inline semantic node. It stores a stable reference id in `attrs.id`, points to a block id through `attrs.targetId`, and keeps human-readable label text as inline content. The editor preserves this node, the References panel can insert it from target blocks, and the playground reports references whose `targetId` does not match any current block id.

```json
{
  "type": "paragraph",
  "attrs": { "id": "blk_ref" },
  "content": [
    { "type": "text", "text": "See " },
    {
      "type": "crossReference",
      "attrs": {
        "id": "ref_overview",
        "targetId": "blk_overview"
      },
      "content": [{ "type": "text", "text": "System Overview" }]
    }
  ]
}
```

## Mark

초기 mark는 `bold`, `italic`, `underline`, `strike`, `code`, `link`, `textColor`, `highlight`를 허용한다. mark attribute는 필요한 값만 저장하고 deterministic key ordering을 따른다.

## ID와 Anchor

모든 block-level node는 `attrs.id`를 가진다. ID는 immutable opaque identifier이며 위치나 제목에서 만들지 않는다.

```json
{
  "type": "heading",
  "attrs": {
    "id": "blk_01...",
    "anchor": "sec-overview",
    "level": 1
  },
  "content": [{ "type": "text", "text": "Overview" }]
}
```

- `id`: semantic diff, cross-reference, 내부 graph에 사용한다.
- `anchor`: Markdown/HTML export에서 사람이 읽는 참조에 사용한다.
- `anchor`는 optional이며 변경 가능하다.
- 내부 cross-reference는 `targetId`를 저장한다. export 시 가능한 경우 `anchor`로 변환한다.

## Tiptap 매핑 원칙

- Tiptap node 이름은 가능하면 SDoc node 이름과 동일하게 둔다.
- 저장 전 SDoc validator를 통과해야 한다.
- 복사/붙여넣기, split, merge, undo/redo 후 block ID 중복을 검사한다.
- 중복 ID가 발견되면 붙여넣어진 쪽에 새 ID를 발급한다.
- editor plugin state는 `document.json`에 저장하지 않는다.
