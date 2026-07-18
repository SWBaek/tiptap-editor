---
title: "Phase 5.2 Explorer-First Authoring Workbench Goal"
status: in_progress
progress_percent: 12
current_slice: accessible-desktop-tree
created_at: 2026-07-18
started_at: 2026-07-18
completed_at: null
source_reviews:
  - docs/editor-workbench-ux-improvement-guide.md
planning_docs:
  - docs/editor-workbench-ux-improvement-guide.md
  - docs/phase-5-plan.md
  - docs/mvp-roadmap.md
  - docs/ui-shell-plan.md
  - docs/author-first-ux-review-gate.md
  - docs/desktop-native-smoke.md
completed_slices:
  - explorer-visual-declutter
remaining_slices:
  - accessible-desktop-tree
  - activity-and-panel-consolidation
  - document-header-and-command-hierarchy
  - one-row-authoring-toolbar
  - status-and-recovery-relocation
  - settings-export-browser-language
  - responsive-accessibility-review-gate
progress_log:
  - date: 2026-07-18
    progress_percent: 0
    note: "Accepted UX review converted into the authoritative Phase 5.2 implementation guide; implementation has not started."
  - date: 2026-07-18
    progress_percent: 2
    note: "Goal started after auditing AGENTS.md, all planning documents, canonical format/schema/serialization/diff boundaries, the current FilesPanel implementation, and its Playwright coverage. Slice 1 is in progress."
  - date: 2026-07-18
    progress_percent: 12
    note: "Explorer visual declutter completed: Files now starts with a compact action header and workspace tree, ordinary rows are one-line 26px entries, secondary row actions are hover/focus-only, and brand/persistent status/current-file cards/duplicate file commands/absolute path text/row metadata/Recent/Developer blocks were removed from the panel. Existing create/open/rename/Trash/watcher/recovery callbacks remain intact. Visual inspection at 1440x1000 and automated evidence passed: npm test (303), npm run build, and npm run test:e2e (40)."
done_rule: "Set status to done and progress_percent to 100 only after all eight slices are implemented, validated, committed, pushed, and the packaged-app plus 3-5-person review kit is ready. Stop at user review required; do not claim that human review passed without session records."
---

# Goal Prompt

이 저장소는 AI/Diff 친화적인 기술 문서 편집기입니다. 이번 goal은 Phase 5.1에서 기능적으로 준비된 SDoc 편집기의 workbench를 Explorer-first authoring UX로 재구성하여, 관리·디버그 도구가 아니라 실제 기술 문서 편집기로 느껴지게 만드는 것입니다.

`docs/editor-workbench-ux-improvement-guide.md`를 이 goal의 authoritative UX specification으로 사용하세요. 문서에 확정된 정보구조와 ordered slices를 선택사항으로 다시 열지 말고 순서대로 구현하세요.

## 작업 시작 시

1. `git status --short`를 확인하고 `AGENTS.md`를 읽으세요.
2. 이 파일의 YAML front matter와 `planning_docs`의 모든 문서를 읽으세요.
3. `docs/document-format.md`, `docs/editor-schema.md`, `docs/serialization.md`, `docs/diff-model.md`를 읽어 canonical/stable-ID 경계를 재확인하세요.
4. 현재 UI와 동작을 코드, unit test, Playwright, 실제 렌더링으로 확인하세요. 기존 문서의 “implemented” 표현만 보고 완료 처리하지 마세요.
5. `EXISTING_PRODUCT.md`는 user-provided untracked source이므로 수정·삭제·commit하지 마세요.
6. 시작 시 `started_at`, `status: in_progress`, 현재 slice와 progress log를 갱신하세요.

## 절대 변경하지 않을 원칙

- canonical source는 `.sdoc/document.json`입니다.
- `.sdoc`는 사용자-facing 단일 ZIP 컨테이너입니다.
- 모든 block-level node는 stable immutable `attrs.id`를 유지합니다.
- UI/runtime state는 `document.json`에 저장하지 않습니다.
- 이미지와 Draw.io 원본은 `.sdoc/assets/`에 저장합니다.
- browser mode는 native filesystem 접근을 흉내 내지 않습니다.
- Git, raw JSON, AI/RAG, schema/debug, CLI는 일반 사용자 UX의 전제가 아닙니다.
- 이전 제품의 plain JSON 포맷, 위치 기반 ID, frontend mirror 구조를 복원하지 않습니다.
- web frontend는 하나만 유지하며 desktop native 접근은 typed Tauri adapter 뒤에 둡니다.
- dirty content를 자동 reload/overwrite하지 않고 Tauri 권한 범위를 넓히지 않습니다.

## 구현 순서

1. Explorer visual declutter: brand/status/current-file card/중복 command/path/helper/recent/developer content를 제거·이동하고 compact header와 one-line dense tree를 만드세요.
2. Accessible desktop tree: normalized path identity, ARIA tree, roving keyboard focus, inline create/rename, context menu, auto reveal, Collapse All, natural folders-first sort를 구현하세요.
3. Activity and panel consolidation: icon-only Explorer/Outline/Review와 bottom Settings로 정리하고, Changes/History/Document Health를 Review tabs로 통합하며 Developer를 opt-in으로 숨기세요.
4. Document header and command hierarchy: canvas에서 title을 자연스럽게 편집하고 author/version을 Document Properties로 이동하며 New/Open/Save/Export의 중복 경로를 하나로 정리하세요.
5. One-row authoring toolbar: 파일 command와 Mark saved를 제거하고 1280px에서도 한 줄인 기본 작성 toolbar와 contextual/overflow controls를 완성하세요.
6. Status and recovery relocation: Status Bar를 도입하고 zoom/cursor history/save/health를 이동하며 save failure와 external-change feedback을 document-level banner로 옮기세요.
7. Settings, Export, browser, language: Document Properties/Application Settings/Developer를 분리하고 deliverable Export dialog, browser-honest Documents flow, 일반 사용자 product language를 적용하세요.
8. Responsive/accessibility/review gate: 1920/1440/1280 viewport, keyboard-only, focus-visible, packaged Tauri smoke와 3-5명 사용자 리뷰 kit를 검증·갱신한 뒤 기능 확장을 멈추세요.

## Slice 수행 규칙

대형 shell 변경을 한 번에 구현하지 마세요. 각 slice마다 다음 순서를 지키세요.

1. 관련 plan/boundary 문서와 이 goal YAML을 갱신합니다.
2. 현재 코드와 테스트에서 정확한 변경 범위를 확인합니다.
3. bounded implementation을 수행하고 unrelated user changes를 보존합니다.
4. unit/E2E 테스트를 추가하거나 새 정보구조에 맞게 갱신합니다.
5. 다음 명령을 실행합니다.

```text
npm test
npm run build
npm run test:e2e
```

6. desktop adapter/native workflow에 영향이 있으면 추가로 실행합니다.

```text
npm run typecheck:desktop
npm run build:desktop
```

7. test count와 결과를 progress log에 기록합니다.
8. 짧은 imperative subject로 별도 commit하고 push합니다.
9. `git status --short`와 commit/push 상태를 확인한 뒤 다음 slice로 이동합니다.

Flaky test로 추정하지 말고 실패 원인을 재현·진단하세요. focused rerun이 필요하면 최종 full suite도 다시 통과해야 합니다.

## 핵심 acceptance

- Explorer header 바로 아래에서 workspace root와 nested `.sdoc` tree가 시작됩니다.
- ordinary tree row는 default density에서 한 줄, 26px 이하입니다.
- duplicate basename이 있어도 active file 표시는 normalized identity로 하나만 나타납니다.
- keyboard로 tree 탐색, expand/collapse, open, create, rename, Trash context를 사용할 수 있습니다.
- 일반 Activity Bar에는 Explorer, Outline, Review, bottom Settings만 보입니다.
- Developer/schema/raw JSON/AI-RAG/CLI/Git workflow는 default author mode에 보이지 않습니다.
- title은 writing surface에서 편집되고 author/version은 persistent duplicate field가 아닙니다.
- New/Open/Save/Export가 Explorer, command bar, toolbar에 중복되지 않습니다.
- 1280x720에서 command overlap이나 orphaned second toolbar row가 없습니다.
- Status Bar가 save/health/zoom/cursor navigation 상태를 담당합니다.
- save failure, external change, Draw.io conflict는 명확하고 data-loss 없이 복구됩니다.
- browser mode는 native Explorer, watcher, Trash, persistent native path를 주장하지 않습니다.
- shell state와 navigation은 canonical JSON 및 stable block ID를 변경하지 않습니다.
- 새 문서 작성, 저장, 재열기, image/table/equation/Mermaid 작성, export 흐름이 유지됩니다.

## 완료 및 중단 조건

canonical format/schema/ID 변경, 두 번째 frontend, browser filesystem emulation, dirty content의 silent overwrite, broad Tauri capability가 필요해지면 구현을 멈추고 사용자에게 보고하세요.

모든 slice가 구현·검증·commit·push되고 packaged Windows Tauri smoke checklist와 3-5명 사용자 리뷰 checklist가 준비되면:

- YAML을 `status: done`, `progress_percent: 100`, `current_slice: user-review-required`로 변경합니다.
- `completed_at`, `completed_slices`, `remaining_slices`, final progress evidence를 기록합니다.
- 기능 확장을 멈추고 `user review required`로 보고합니다.
- 실제 session record가 없으면 user review passed라고 주장하지 않습니다.

최종 보고에는 변경 요약, slice별 검증 결과, commit hash와 push 여부, 작업트리 상태, packaged-app 수동 검증 항목, 알려진 제한, 다음 사용자 리뷰 절차를 포함하세요.
