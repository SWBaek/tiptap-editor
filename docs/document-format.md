# SDoc Document Format

작성일: 2026-07-01

## 목적

`.sdoc`는 AI/Diff 친화적인 기술 문서를 담는 사용자-facing 단일 파일이다. 사용자는 하나의 파일만 열고 저장하지만, 내부는 `.docx`나 `.xlsx`처럼 ZIP 컨테이너로 구성한다.

## v1 컨테이너 구조

```text
document.sdoc
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

- `manifest.json`: 포맷 식별자, 포맷 버전, 문서 ID, schema version, 생성 도구 정보를 저장한다.
- `document.json`: canonical source of truth인 SDoc Semantic JSON이다.
- `metadata.json`: title, author, version, createdAt, updatedAt 같은 문서 메타데이터를 저장한다.
- `assets/`: 이미지, diagram 원본, 첨부파일 등 binary asset을 저장한다.
- `derived/`: Markdown, chunk, outline, reference graph 등 재생성 가능한 산출물이다.

`document.json`만 canonical이다. `derived/`가 없거나 손상되어도 문서는 유효할 수 있으며, 앱은 이를 다시 생성해야 한다.

Draw.io diagrams are asset-backed in v1. The editable `.drawio` or `.drawio.xml` source is stored under `assets/`, and `document.json` stores `diagram.attrs.sourceAssetId`. Optional preview SVG/PNG files may also live in `assets/` through `diagram.attrs.previewAssetId` for portable exports, but preview bytes remain non-canonical and may be regenerated.

Large engineering data grids follow the same asset-backed principle: CSV or JSON source lives under `assets/`, while `document.json` stores `dataGrid.attrs.sourceAssetId`, `format`, and optional title/caption rather than huge spreadsheet state.

## 빈 파일 처리

사용자가 `name.sdoc`라는 0-byte 파일을 먼저 만들 수 있다. 이 파일은 아직 유효한 `.sdoc`가 아니므로 앱은 “새 SDoc 문서로 초기화” 동작을 제공해야 한다. 임의 텍스트 파일을 `.sdoc`로 rename한 경우에는 invalid container로 처리한다.

## 최소 유효 문서

```json
{
  "schemaVersion": 1,
  "type": "doc",
  "attrs": {
    "id": "doc_..."
  },
  "content": []
}
```

`manifest.json`의 `documentId`와 `document.json.attrs.id`는 동일해야 한다.

## 직렬화 규칙

- `document.json`은 UTF-8 JSON으로 저장한다.
- JSON은 2-space pretty print를 사용하고 마지막 줄바꿈을 포함한다.
- object key는 deterministic하게 정렬한다.
- `attrs` 안의 `undefined`, `null`은 저장하지 않는다. 빈 문자열은 의미 있는 값일 수 있으므로 보존한다.
- cursor, selection, decoration, hover state, panel state 등 UI/runtime 상태는 저장하지 않는다.
- 같은 semantic document는 항상 같은 `document.json` byte sequence를 만들어야 한다.

## 버전과 마이그레이션

v1은 `schemaVersion: 1`을 사용한다. 앱은 지원하지 않는 상위 schema version을 만나면 자동 변경하지 말고 read-only 또는 migration 안내를 제공한다. 마이그레이션은 원본 백업을 남기고, `document.json`과 `manifest.json`을 함께 갱신해야 한다.
