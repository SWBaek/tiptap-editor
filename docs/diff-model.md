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

Asset-backed blocks are compared by semantic references, not by binary payload. Draw.io changes report source/preview asset reference changes. `dataGrid` changes report source asset, format, title, caption, and display metadata changes at block level. Row-level CSV/JSON validation diagnostics may inspect asset bytes as runtime/export readiness feedback.

Figure changes compare stable block identity plus authored `assetId`, `alt`, optional `align`, and caption content. Image replacement is therefore an asset-reference modification on the existing figure ID; inspector selection, preview URLs, and dialog state never participate in diff.

Row-level `dataGrid` diff and merge is an asset-level review projection, not a replacement for `SDocDiffEvent` block diff. The boundary in `docs/data-grid-row-diff-merge-boundary.md` requires reliable row identity, reports keyed row/cell events through the separate `DataGridRowDiff` view-model, and refuses raw line-number merge when no key exists. Applying accepted row changes uses `applyDataGridRowMerge` to recompute the row diff, refuse stale current assets, and return updated asset source text; it must not store row patches or merge UI state in `document.json`.

## Text Diff

현재 구현은 inline text 변경을 whitespace token 기준으로 `[-removed-]`, `[+added+]` marker에 표시한다. 예: `text changed "This is [-old-] [+new+]"`. 이는 Phase 0의 CLI/editor preview 요약 형식이며 canonical 저장 형식은 아니다.

inline text는 Phase 0에서 word-level diff만 제공한다. 한국어/영어 혼합 문서는 whitespace tokenization이 완벽하지 않으므로, UI 단계에서 더 정교한 tokenizer를 검토한다.

## Reference Checks

`crossReference.attrs.targetId`가 new document에 존재하지 않으면 `reference-broken` event를 생성한다. anchor 변경은 참조 깨짐이 아니다. 내부 참조는 ID를 기준으로 안정성을 유지한다.

Broken reference inline highlights should consume this same diagnostic/event source. Highlight visibility, selected diagnostics, hover state, and repair suggestions are editor runtime state and must not be written to `document.json`.

## 출력

CLI는 우선 사람이 읽을 수 있는 line output을 제공한다.

```text
MODIFIED heading blk_1 "Overview": text changed
MOVED paragraph blk_2 from blk_parent[0]/blk_2 to blk_parent[3]/blk_2
BROKEN_REF crossReference ref_4 target blk_missing
```

Core rendering exposes two levels:

- `renderDiffEvents`: compact debug/CLI lines that preserve event kind, id, and path.
- `renderReadableDiffEvents`: review-friendly lines for editor preview surfaces.

Metadata changes are rendered outside semantic document diff. They may appear in UI as a separate metadata section, but they are not part of `document.json` block matching.

## Visual Review Projection

The editor should eventually project the same semantic diff events as inline review UI: inserted blocks, deleted blocks, modified text spans, moved-block badges, and broken-reference markers. This is a presentation layer for non-developer reviewers, not a second diff format.

Overlay state, reviewer cursor state, expanded/collapsed diff panels, and accepted/rejected preview state must not be stored in `document.json`. If accepted changes are implemented later, the result should be a normal edited document that passes the same normalization and validation pipeline.

나중에 visual diff UI는 같은 event model을 사용한다. UI 전용 포맷을 별도로 만들지 않는다.

Side-by-side document diff is also a projection of `SDocDiffEvent` plus baseline/current block previews by stable ID. It is not a second diff source and does not change `document.json`.

## Accept/Reject Apply

The headless review apply path uses the same semantic diff events. Before applying an action, it recomputes the diff between the baseline and current document and refuses stale events.

- `accept` keeps the current normalized document.
- single-event `accept` may update the review baseline for that event so the accepted event disappears from the active review without writing review state to `document.json`.
- `reject added` removes the current block.
- `reject deleted` restores the baseline block at the baseline parent/order.
- `reject modified` restores baseline attrs/content for the same stable block ID.
- `reject moved` restores the baseline parent/order for the same stable block ID.
- `reference-broken` is not directly accepted or rejected; it is repaired through the References workflow.

The resulting document must validate and serialize deterministically as normal `document.json`. Review action choices, previews, and batch selections remain runtime state only.

Batch accept/reject is an ordered application of the same single-event semantics. Implementations must recompute semantic diff after each applied event and skip stale or already-resolved events instead of applying stored paths.
