# Serialization Rules

작성일: 2026-07-01

## 목적

SDoc serialization은 같은 semantic document가 항상 같은 canonical `document.json`을 만들도록 강제한다. 이 규칙은 semantic diff, `.sdoc` pack/unpack, AI/RAG export의 공통 기반이다.

## Canonical JSON

- UTF-8 JSON을 사용한다.
- 2-space pretty print와 trailing newline을 사용한다.
- object key는 deterministic order로 정렬한다.
- `document.json`의 루트는 `schemaVersion`, `type`, `attrs`, `content`를 가진다.
- `attrs`의 `undefined`와 `null`은 저장하지 않는다.
- Mark attrs follow the same rule. Editor-runtime defaults are removed during normalization; a v1 `link` mark stores its authored `href` rather than Tiptap defaults such as `target`, `rel`, `class`, or null `title`.
- 빈 문자열은 의미 있는 값일 수 있으므로 보존한다.
- runtime-only state는 저장하지 않는다.

저장하지 않는 값:

- cursor, selection, decoration
- hover/focus state
- editor panel state
- undo/redo stack
- rendered HTML cache

## ID 안정성

모든 block-level node는 `attrs.id`를 가진다. ID는 위치, 제목, 번호에서 파생하지 않는다. 복사/붙여넣기, split, merge, undo/redo 이후에는 validator가 중복 ID를 탐지해야 한다.

Phase 1 Tiptap 통합 시 중복 ID 해결 정책은 다음으로 고정한다.

- 기존 문서에 먼저 존재하던 block이 ID를 유지한다.
- 새로 삽입되었거나 붙여넣어진 duplicate block은 새 ID를 받는다.
- 내부 cross-reference는 가능한 한 기존 target ID를 유지한다.

## ZIP 안정성

`.sdoc` ZIP entry는 deterministic name order로 기록한다. 동일한 container를 두 번 pack하면 같은 byte sequence가 나와야 한다. ZIP entry timestamp는 고정값을 사용한다.

`derived/`는 canonical이 아니지만 pack 시 재생성 가능한 최신 값으로 덮어쓸 수 있다. `document.json`과 `metadata.json`은 항상 stable stringify 결과로 저장한다.

## Validation Gate

저장 전 반드시 다음을 검증한다.

- `manifest.json.documentId`와 `document.json.attrs.id` 일치
- 지원하는 `formatVersion`과 `schemaVersion`
- block-level ID 존재와 중복 없음
- v1에서 허용한 node/mark만 사용
- cross-reference의 `targetId` 존재 여부는 diff/export 단계에서 별도 점검
