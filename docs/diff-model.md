# Semantic Diff Model

작성일: 2026-07-01

## 목적

SDoc diff는 Git line diff나 raw JSON diff가 아니라 `document.json`의 semantic node tree를 비교한다. 목표는 사람이 리뷰 가능한 변경 이벤트를 생성하는 것이다.

## 입력

diff 입력은 정규화된 두 개의 SDoc document다.

```text
sdoc diff old.sdoc new.sdoc
sdoc diff old.document.json new.document.json
```

비교 전 두 문서는 같은 normalization pipeline을 통과해야 한다. derived output, asset binary, UI state는 diff 입력에 포함하지 않는다.

## Matching

block-level node의 `attrs.id`를 기준으로 매칭한다.

- old에만 있으면 `deleted`
- new에만 있으면 `added`
- old/new 모두에 있고 parent block ID가 바뀌면 `moved`
- 같은 parent 안에서는 sibling ID sequence의 LCS를 기준으로 실제 재배치된 block만 `moved`
- old/new 모두에 있고 block fingerprint가 다르면 `modified`

ID가 없거나 중복된 문서는 valid diff 입력이 아니다. validator가 먼저 실패해야 한다.

단순 삽입/삭제로 뒤쪽 sibling의 index가 밀리는 경우는 `moved`가 아니다. 부모 block이 이동할 때 그 내부 자식 block은 parent가 유지되는 한 별도 `moved` event를 만들지 않는다. 부모 block이 추가 또는 삭제되면 그 내부 자식 block의 `added`/`deleted` event도 중복 생성하지 않는다.

## Event

초기 diff event는 다음을 지원한다.

```text
added
deleted
moved
modified
reference-broken
```

각 event는 `id`, `nodeType`, human-readable label, old/new path를 포함한다. `modified` event는 heading text, paragraph text, callout kind, code language 같은 type별 변경 요약을 포함한다.

## Text Diff

inline text는 Phase 0에서 word-level diff만 제공한다. 한국어/영어 혼합 문서는 whitespace tokenization이 완벽하지 않으므로, UI 단계에서 더 정교한 tokenizer를 검토한다.

## Reference Checks

`crossReference.attrs.targetId`가 new document에 존재하지 않으면 `reference-broken` event를 생성한다. anchor 변경은 참조 깨짐이 아니다. 내부 참조는 ID를 기준으로 안정성을 유지한다.

## 출력

CLI는 우선 사람이 읽을 수 있는 line output을 제공한다.

```text
MODIFIED heading blk_1 "Overview": text changed
MOVED paragraph blk_2 from blk_parent[0]/blk_2 to blk_parent[3]/blk_2
BROKEN_REF crossReference ref_4 target blk_missing
```

나중에 visual diff UI는 같은 event model을 사용한다. UI 전용 포맷을 별도로 만들지 않는다.
