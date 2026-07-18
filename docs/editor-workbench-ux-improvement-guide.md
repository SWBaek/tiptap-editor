# Editor Workbench UX Improvement Guide

Created: 2026-07-18
Target: Phase 5.2 Explorer-First Authoring Workbench
Status: implementation complete; Slices 1-8 accepted, user review required

## 1. Purpose

이 문서는 Phase 5.1 사용자 리뷰 gate에서 확인된 workbench UI/UX 문제를 해결하기 위한 구현 지침이다. 목표는 SDoc을 관리·디버그하는 도구처럼 보이는 현재 shell을, 사용자가 폴더에서 문서를 찾고 작성하고 저장하고 다시 여는 기술 문서 편집기로 재구성하는 것이다.

이번 작업은 새로운 문서 기능을 추가하는 단계가 아니다. 기존 작성·저장·검토·export 동작을 보존하면서 Explorer, Activity Bar, document header, toolbar, status/error feedback, panel information architecture를 정돈하는 제품화 단계다.

완료 상태는 “기능이 많다”가 아니라 다음 질문으로 판정한다.

- 사용자가 설명 없이 workspace와 중첩 `.sdoc` 파일을 탐색할 수 있는가?
- 문서 제목과 본문을 편집하고 저장하는 주 경로가 하나로 보이는가?
- 일반 화면에서 Git, CLI, raw JSON, schema/debug 개념을 이해할 필요가 없는가?
- 저장 실패와 외부 변경을 놓치지 않으면서 Explorer가 상태 대시보드가 되지 않는가?
- 1280px desktop viewport에서도 toolbar와 document commands가 겹치거나 불필요하게 두 줄이 되지 않는가?

## 2. Permanent Architecture Boundaries

다음 원칙은 UX 정리 과정에서도 변경하지 않는다.

- canonical source of truth는 `.sdoc/document.json`이다.
- 사용자-facing `.sdoc`는 `manifest.json`, `document.json`, `metadata.json`, `assets/`, optional `derived/`를 포함하는 단일 ZIP 컨테이너다.
- 모든 block-level node는 stable immutable `attrs.id`를 유지한다.
- cursor, selection, tree expansion, selected folder, panel, dialog, zoom, history, toast, menu, dirty/conflict 상태는 `document.json`에 저장하지 않는다.
- 이미지와 Draw.io 원본은 `.sdoc/assets/`에 저장한다.
- browser mode는 native folder browsing, watcher, Trash, filesystem write를 흉내 내지 않는다.
- Git, raw JSON, AI/RAG, schema/debug, CLI command는 일반 사용자 UX의 전제가 아니다.
- 이전 제품의 plain JSON 포맷, 위치 기반 ID, frontend mirror 구조를 복원하지 않는다.
- React frontend는 `apps/web-playground` 하나를 유지하고 desktop은 typed Tauri adapter만 제공한다.
- format/schema/diff 변경이 필요하다고 판단되면 구현 전에 해당 boundary 문서를 갱신하고 별도 승인을 받는다. 이번 UX goal은 원칙적으로 canonical schema 변경 없이 끝나야 한다.

## 3. Accepted Product Direction

### 3.1 Reference model

세 제품을 그대로 복제하지 않고 다음 경험을 SDoc에 맞게 채택한다.

- VS Code: icon-only Activity Bar, view-focused Primary Sidebar, editor 중심 layout, Status Bar, Explorer context actions.
- Obsidian: compact file explorer header actions, active-file auto reveal, collapse all, sort, context menu, workspace/vault 중심 탐색.
- Zed: dense project tree, arrow-key navigation, inline create/rename, auto reveal, compact directory folding, hover-only secondary controls.

SDoc은 현재 single-document editing model이므로 code editor의 preview tab/permanent tab 차이를 억지로 복제하지 않는다. 파일을 여는 동작은 기존 unsaved-change 보호 정책을 유지하며 명확한 단일 규칙을 사용한다.

### 3.2 Target workbench

```text
┌────┬──────────────────────────┬─────────────────────────────────┐
│    │ EXPLORER     +  ▣  ↻  ⋯ │ document.sdoc  ●          Save │
│ 📁 │                          │                                 │
│ ≡  │ DOCS                     │ Document title                  │
│ ⇄  │ ▾ Architecture           │                                 │
│    │   ▾ ADRs                 │ Editor body                     │
│    │     0001-format.sdoc     │                                 │
│    │   system-overview.sdoc ● │                                 │
│    │ ▸ Guides                 │                                 │
│    │   Release Notes.sdoc     │                                 │
│    │                          │                                 │
│ ⚙  │                          │ Saved · Healthy · 620 words 100%│
└────┴──────────────────────────┴─────────────────────────────────┘
```

권장 desktop density:

- Activity Bar: 44-48px.
- Sidebar: default 260-280px, minimum 220px, maximum 420px, pointer-resizable and keyboard-toggleable.
- Sidebar header: 32-36px.
- Explorer row: 24-26px, one line.
- Tree indentation: 12-16px per level.
- Status Bar: 22-24px.
- Secondary row actions: hover, focus, or selection 상태에서만 노출.

## 4. Current Problems To Remove

현재 `FilesPanel`은 다음 콘텐츠를 tree보다 앞이나 뒤에 함께 렌더링한다.

- product brand와 `Phase 3 Playground`.
- 모든 panel에 반복되는 persistent status message.
- current-file card와 save state.
- New/Open/Save button group.
- root name과 absolute path.
- Change folder/New document/New folder full-width buttons.
- `New entries: ...` helper.
- file kind, byte size, localized modification time 등의 두 번째 행 metadata.
- Recent Documents.
- Developer workspace와 pack/unpack commands.

동일한 New/Open/Save/Export 계열 command가 Document Command Bar, Editor Toolbar, Files panel에 중복된다. Metadata title/author/version도 header와 Settings에 중복된다. Settings에는 schema/document ID/native integration이, Review에는 Git/CLI workflow가, Export에는 `Copy PDF command` 같은 구현 세부사항이 일반 사용자 surface로 노출된다.

이 항목들은 테스트가 존재한다는 이유로 유지하지 않는다. 기존 테스트는 새 정보구조의 acceptance를 검증하도록 갱신한다.

## 5. Final Information Architecture

### 5.1 Activity Bar

일반 사용자의 Activity Bar는 다음 네 위치만 사용한다.

1. Explorer
2. Outline
3. Review
4. Settings at the bottom

규칙:

- `Write`, `Review` 같은 rail 내부 text label을 제거한다.
- icon name과 shortcut은 tooltip과 accessible name으로 제공한다.
- active state는 큰 filled card 대신 2px edge indicator와 낮은 대비 배경을 사용한다.
- Export는 Activity panel이 아니라 document command에서 여는 dialog로 변경한다.
- Diagnostics는 `Review > Document Health` tab으로 이동한다.
- History는 `Review > History` tab으로 이동한다.
- Developer는 기본적으로 숨긴다. `Settings > Advanced > Enable developer tools`가 runtime/user preference로 켜진 경우에만 bottom icon 또는 command-palette entry로 노출한다.
- requirement-management profile이 없는 일반 문서에서 References/Traceability를 독립 top-level view로 승격하지 않는다.

### 5.2 Explorer

Explorer의 기본 DOM/visual order는 다음과 같다.

1. `EXPLORER` title과 compact action icons.
2. optional transient inline filter; 사용 중이 아닐 때 공간을 차지하지 않는다.
3. workspace root와 recursive tree. 이 영역이 남은 sidebar height의 유일한 scroll owner다.

Explorer header actions:

- New document.
- New folder.
- Refresh.
- Collapse all.
- More: Open Folder, sort, auto reveal, compact folders, developer-only reveal options when enabled.

Explorer에서 제거하거나 이동할 항목:

| Current item | Destination |
| --- | --- |
| Brand / Phase label | Desktop title/start screen; remove phase wording from product mode |
| Persistent status card | transient toast or Status Bar |
| Current file card | document tab/header plus active tree row |
| New/Open/Save large buttons | File/document commands and shortcuts |
| Change folder button | Explorer More or File command |
| Full absolute root path | tooltip or Properties |
| `New entries` helper | remove; inline insertion location is the explanation |
| File kind/size/date second line | tooltip or optional Properties |
| Recent Documents | desktop Start Screen and Quick Open |
| Developer workspace | Developer tools surface |
| Save/external-change alerts | document-level persistent banner |

Tree row rules:

- one line containing chevron, file/folder icon, name, and optional dirty/conflict indicator.
- no card border around ordinary rows.
- folders sort before files by default; natural case-insensitive order.
- active file uses normalized path or adapter-provided identity, never basename-only equality.
- ellipsis/action control appears only on hover, focus, selected row, or touch context.
- row context menu owns Rename, Move to Trash, New inside folder, and optional Reveal in File Explorer.
- tooltip may show full path and modification information without changing row height.
- nested single-folder chains may support compact-folding after basic tree behavior is accepted.

Tree interaction rules:

- single click selects a row. Folder chevron or Enter/Right expands; file Enter or explicit activation opens it.
- double click must not introduce a second hidden state unless document tabs are implemented later.
- Arrow Up/Down moves among visible nodes.
- Arrow Right expands or enters the first child; Arrow Left collapses or moves to parent.
- Home/End moves to first/last visible node.
- F2 starts inline rename with the filename stem selected while preserving `.sdoc`.
- Delete requests Trash with the existing dirty-document guard.
- Shift+F10 opens the context menu.
- Escape cancels inline create/rename or closes the context menu.
- create and rename happen inline at the target tree location; Enter confirms and Escape cancels.
- active document is auto-revealed and scrolled into view when files/workspace change.
- Collapse All is deterministic.
- use `role="tree"`, `role="treeitem"`, nested `group`, roving tab index, `aria-level`, `aria-expanded`, and `aria-selected`.
- expanded folders, selection, sort, auto-reveal, and sidebar size are runtime/user settings only.

### 5.3 Outline

- Outline remains a primary author surface.
- Heading, Figures, and Tables are compact collapsible groups rather than equal permanent blocks.
- click navigates to the corresponding stable block ID.
- outline depth and numbering configuration moves to Document Properties or authoring settings; the Outline panel consumes the setting but does not dedicate permanent top space to it.
- empty Figures/Tables groups may be hidden until relevant content exists.

### 5.4 Review

Review has three internal tabs:

1. Changes: saved/current or explicit comparison, accept/reject when supported.
2. History: local snapshots, compare, restore.
3. Document Health: broken references, stale labels, traceability and validation issues expressed in author language.

Rules:

- remove ordinary-user `Git workflow` and CLI command cards.
- replace `Baseline` with `Last saved version` where possible.
- replace `Diagnostics` with `Document Health` or a specific issue type.
- advanced raw semantic events remain available only in developer mode.
- empty states explain the next useful action in one sentence and do not show dashboards of zero values unless they help a decision.

### 5.5 Settings And Document Properties

Split current Settings responsibilities.

Document Properties:

- title, author, version, publishing profile, heading numbering/depth when document-specific.
- opened contextually from the document header or inspector.

Application Settings:

- appearance, default authoring behavior, explorer preferences, keyboard shortcuts, native integration preferences.

Advanced/Developer:

- Draw.io executable override.
- schema version/document ID.
- raw JSON, AI/RAG, CLI and unpacked-folder tools.
- developer-tools enable switch.

Title/author/version must not be rendered simultaneously in both the persistent header and Settings. The document title is edited naturally in the canvas header; author/version use Document Properties.

### 5.6 Export

Export is a modal/dialog or focused transient surface opened from File/Export and the document header.

Flow:

1. Choose deliverable format: Markdown, HTML, PDF, DOCX, PPTX when available.
2. Choose applicable profile/options.
3. Show destination/filename and availability.
4. Run Export and show success/failure feedback.

Rules:

- do not show `CLI/Tauri`, Playwright implementation notes, or Copy CLI Command in normal mode.
- if a format is unavailable in browser mode, state the environment boundary and offer only an actually supported alternative.
- raw `document.json`, chunks, outline JSON, references JSON and developer `.sdoc` package inspection stay under Developer.
- Save `.sdoc` is a file workflow, not a deliverable export.

## 6. Document Header, Commands, And Toolbar

### 6.1 Document header

Replace the current dense `DocumentCommandBar` with two layers.

Compact workbench/document bar:

- filename or breadcrumb.
- dirty/saving/error indicator.
- one Save control where a visible control is needed.
- Export.
- overflow menu for New/Open/Save As/Preview/Properties.

Canvas document header:

- large editable document title above the body.
- optional compact author/version summary that opens Document Properties.
- clearly distinguish document title from the first H1.

At widths below the normal desktop breakpoint, secondary commands collapse into overflow before fields overlap. The 1280px acceptance viewport must not have clipped metadata or command overlap.

### 6.2 Editor toolbar

The toolbar contains authoring commands only and stays one row at 1280px.

Immediately visible:

- paragraph/heading selector.
- Bold and Italic.
- Link.
- Bullet, Ordered, Task list.
- Image and Table.
- `+ Insert`.
- `More`.

Contextual/overflow:

- underline, strike, alignment, subscript, superscript.
- equation, Mermaid, Draw.io, callout, code block, cross-reference, data grid.
- table/image/equation/diagram inspectors shown only for an applicable selection.

Remove from the editor toolbar:

- New document.
- Open document.
- Save/download `.sdoc`.
- Download Markdown.
- Mark saved.

Selection Bubble Menu remains for common inline formatting and must preserve selection. Context menus remain viewport-safe. No authoring command may regress to `window.prompt()`.

## 7. Status, Recovery, And Navigation

### 7.1 Status Bar

Adopt the previously deferred Status Bar. It is runtime UI and never canonical.

Recommended contents:

- left: workspace/document state when useful.
- center or left: Saving/Saved/Unsaved/Save failed and Document Healthy/issue count.
- right: word count or block count, zoom, cursor-history Back/Forward.

Success messages such as `Loaded 3 workspace entries` are transient toast messages and expire. Routine refresh success should usually be silent.

### 7.2 Persistent document banners

The following states appear above the editor body, not inside Explorer:

- native save failure with concrete message, Retry, Save As.
- external current-document change with Reload, Keep Current, Compare.
- blocking validation or export failure when the author must act.

Draw.io source conflicts continue to use the dedicated conflict dialog. Alerts must name the affected document/block and never auto-reload over dirty content.

### 7.3 Navigation controls

- move floating zoom and cursor-history controls into the Status Bar.
- retain 60-200% runtime-only zoom, reset, keyboard/mouse history behavior and existing canonical non-mutation tests.
- controls must have accessible names and keyboard focus indicators.

## 8. Browser/Desktop Boundary

Desktop mode:

- typed Tauri adapter owns workspace selection, recursive listing, watcher, create/rename/Trash and native save/open.
- Explorer renders only adapter-provided folder and `.sdoc` entries.

Browser mode:

- do not render a disabled fake filesystem tree.
- Start/Open surface offers browser-supported Open `.sdoc`, New document, recent browser activity and downloads/exports.
- if Files remains available, name it `Documents` and show only browser-session documents/actions, not a native workspace metaphor.
- browser mode must never claim watcher, arbitrary path, native Trash, Save As path persistence, or Draw.io process control.

## 9. Visual And Content Rules

- remove `Phase 3 Playground` from desktop product mode and use `SDoc` or the current filename/window title.
- use sentence case except established compact panel headings.
- reduce borders and filled cards; hierarchy comes from spacing, selection and typography.
- ordinary tree rows and outline rows do not use form-button styling.
- dark-sidebar/light-editor contrast remains acceptable, but every panel must follow one theme; History/Diagnostics must not switch to an unrelated white embedded surface.
- icons never carry meaning alone when the action is destructive or uncommon; use tooltip, accessible name and context-menu text.
- reserve warning/error color for actionable states. Active navigation uses a neutral/brand accent, not an alert-like filled block.

Terminology mapping:

| Internal wording | Normal-user wording |
| --- | --- |
| Schema valid | Document healthy |
| Semantic diff | Changes |
| Baseline | Last saved version |
| Traceability issue | Missing or broken requirement link |
| CLI/Tauri PDF | PDF export |
| Derived output | Export |
| document.json | hidden; Developer mode only |
| Mark saved | remove from UI |

## 10. Responsive And Accessibility Gate

Required viewports:

- 1920x1080 desktop.
- 1440x900 common laptop/desktop.
- 1280x720 minimum supported authoring review viewport.

Required checks:

- no header command overlap.
- authoring toolbar remains one row or collapses deterministically into More.
- sidebar can resize and collapse without losing editor access.
- 1000px height에서 Explorer content area의 70% 이상을 tree가 사용할 수 있다.
- every interactive control has visible `:focus-visible` styling.
- Activity Bar, tree, tabs, context menu, dialogs and toolbar can be operated without a mouse.
- destructive actions identify the target and require the existing confirmation/dirty guard.
- screen-reader names describe outcome, not icon shape.

## 11. Ordered Delivery Slices

각 slice는 bounded change로 구현하고 별도 commit/push한다. 대형 shell rewrite를 한 번에 수행하지 않는다.

### Slice 1: Explorer visual declutter

- remove/move brand, status, current-file card, duplicated commands, absolute-path line, helper metadata, Recent and Developer content.
- add compact Explorer header and dense one-line rows.
- preserve existing file open/create/rename/Trash behavior through current callbacks.
- add visual/E2E assertions that the tree starts immediately below the Explorer header.

### Slice 2: Accessible desktop tree interactions

- path-identity fix, ARIA tree model, roving focus and keyboard navigation.
- inline create/rename, context menu, auto reveal, Collapse All, natural folders-first sort.
- keep Tauri validation, symlink, depth, dirty-delete, watcher and browser boundaries unchanged.

Accepted 2026-07-18. The tree now uses normalized full-path identity and folders-first natural ordering, exposes `tree`/`treeitem`/`group` semantics with one roving tab stop, supports arrows/Home/End/Enter/F2/Delete/Shift+F10/Escape, and performs create/rename inline. Current documents reveal their ancestor folders, Collapse All is explicit, and pointer/keyboard context menus share the same actions. The existing typed adapter, safe Trash confirmation, dirty-document guard, watcher feedback, and browser boundary remain in place. Evidence: four focused tree-model unit tests, the desktop bridge Playwright workflow, `npm test` (307), `npm run build`, and `npm run test:e2e` (40).

### Slice 3: Activity Bar and panel consolidation

- icon-only Explorer/Outline/Review plus bottom Settings.
- merge Changes/History/Document Health into Review tabs.
- hide Developer unless runtime developer-tools preference is enabled.
- remove Git/CLI cards from normal Review.

Accepted 2026-07-18. The 48px icon-only Activity Bar now exposes Explorer, Outline, Review, and bottom Settings with an edge-indicator active state; Export remains reachable from the document command until its later dialog slice, but is absent from the rail. Review owns keyboard-operable Changes, History, and Document Health tabs, and the moved History/health surfaces share the dark sidebar theme. Git/CLI and raw event IDs were removed from normal Changes. Developer is hidden by default and appears only after the runtime-only `Enable developer tools` preference is enabled in Settings. Evidence: focused Review/History/Health/Developer Playwright flows (9), visual inspection at 1440x1000, `npm test` (307), `npm run build`, and `npm run test:e2e` (40).

### Slice 4: Document header and command hierarchy

- replace the dense metadata/action bar.
- edit title in the canvas header; move author/version to Document Properties.
- define one New/Open/Save/Save As path and one Export entry.
- remove file commands and `Mark saved` from the authoring toolbar.
- guarantee no overlap at 1280px.

Accepted 2026-07-18. A compact document command bar now presents filename, save state, document health, Save, and one Export entry without competing with the canvas. New, Open, Save As, preview, and Document Properties live in a single overflow path. The editable document title is the first element inside the canvas, while author and version live in Document Properties. Duplicate file commands and `Mark saved` were removed from the authoring toolbar and Review. Existing `.sdoc` save/open/export behavior remains intact, and an existing link can now be edited with only the caret inside it. Evidence: focused command-hierarchy and link Playwright checks, visual inspection at 1440x1000 and 1280px with no command-bar overlap, `npm test` (307), `npm run build`, and `npm run test:e2e` (41).

### Slice 5: One-row authoring toolbar

- implement the visible/contextual command split in Section 6.2.
- preserve Bubble Menu, context menu, dialogs and stable-ID behavior.
- verify image/table/equation/Mermaid flows remain discoverable.

Accepted 2026-07-18. The authoring toolbar now stays on one row at the 1280px acceptance viewport and contains only a paragraph/Heading 1-3 selector, Bold, Italic, Link, Bullet/Ordered/Task lists, Image, Table, `+ Insert`, and `More`. Underline, strike, alignment, subscript/superscript, blockquote, code block, callouts, folding, and block movement live in `More`; stable-ID references, data grids, equations, Mermaid, and Draw.io creation live in `+ Insert`. Equation, Mermaid, table, image, and Draw.io inspectors appear only for applicable selections. Bubble Menu, viewport-safe context menus, validated dialogs, and canonical/stable-ID behavior remain intact. Evidence: focused Playwright authoring flows (7), one-row geometry assertion at 1280px, visual inspection at 1280x900 and 1440x1000, `npm test` (307), `npm run build`, and `npm run test:e2e` (41).

### Slice 6: Status Bar and document-level recovery

- introduce Status Bar and move zoom/cursor history into it.
- make routine success transient/silent.
- move save failure/external change banners from Files to the editor document level.
- preserve all recovery semantics and runtime-only state.

Accepted 2026-07-18. A fixed workbench Status Bar now owns filename/save state, document validity, transient feedback, word/block counts, cursor-history Back/Forward, and 60-200% zoom. The former floating runtime control is gone, routine messages expire after 4.5 seconds, and zoom/history remain runtime-only under existing canonical non-mutation checks. Native save failure now persists above the document with Retry/Save As, external current-document changes persist there with Reload/Keep Current/Compare, and blocking schema validation names the reason and links to Document Health. Explorer no longer owns document recovery alerts; the Draw.io conflict remains its dedicated dialog. Evidence: focused Status Bar, transient-feedback, zoom/history, and desktop bridge Playwright flows; visual inspection at 1280x900; `npm test` (307), `npm run build`, and `npm run test:e2e` (42).

### Slice 7: Settings, Export, browser mode, and product language

- split Document Properties/Application Settings/Developer.
- convert Export to the accepted deliverable flow.
- remove phase/debug/CLI/schema wording from normal UI.
- replace browser fake Explorer with a browser-honest Documents/open surface.
- make panel visual themes consistent.

Accepted 2026-07-18. Settings now separates Document, Application, and Developer concerns with keyboard-operable tabs: author/version and health are document properties, heading/outline and desktop Draw.io preferences are application settings, and format/debug details require an explicit runtime-only Developer toggle. Export is a command-opened dialog for deliverables: Markdown and HTML are available, PDF/DOCX/PPTX are visibly unavailable instead of represented by CLI handoff text, and `.sdoc` remains the Save workflow. Browser mode is named Documents and offers explicit New/Open/download/recent-activity flows without claiming native folders, watcher, Trash, or persistent paths. Raw JSON preview and Developer rail content remain hidden in normal author mode. Visual inspection covered the Documents surface and Export dialog; evidence passed with `npm test` (307), `npm run build`, and `npm run test:e2e` (42).

### Slice 8: Responsive/accessibility hardening and review gate

- keyboard-only and viewport coverage.
- packaged Tauri manual smoke update and execution checklist.
- update 3-5 person review scenarios and facilitator record.
- stop feature expansion and report `user review required`.

Accepted 2026-07-18. Playwright now fixes the shell acceptance geometry at 1920x1080, 1440x900, and 1280x720, including no page-level horizontal overflow and one-row authoring controls. A keyboard-only flow covers Activity activation, Settings arrow/Home/End tabs, Export modal initial focus, trapped Tab/Shift-Tab, Escape dismissal, and invoker focus restoration; shared `:focus-visible` styling makes interactive focus explicit. The Windows desktop typecheck and Tauri release build passed, and the packaged executable launched as a responsive `SDoc Editor` window. `docs/desktop-native-smoke.md` records the artifact evidence and separates it from still-required native interaction checks; `docs/author-first-ux-review-gate.md` contains the updated 3-5-person scenarios, individual record, and batch summary. Final evidence: `npm test` (307), `npm run build`, `npm run test:e2e` (46), `npm run typecheck:desktop`, and `npm run build:desktop`. Feature expansion stops here at `user review required`; no human review pass is claimed.

## 12. Validation And Commit Loop

For every slice:

1. inspect current code and tests; do not assume a feature is absent or complete.
2. update this guide or the relevant plan/boundary document when behavior changes.
3. implement the smallest bounded change.
4. add/update unit and Playwright coverage.
5. run:

```text
npm test
npm run build
npm run test:e2e
```

6. for desktop adapter/native workflow changes also run:

```text
npm run typecheck:desktop
npm run build:desktop
```

7. record evidence in the goal prompt YAML.
8. commit with a short imperative message and push.
9. confirm `git status --short` before starting the next slice.

Do not delete or overwrite `EXISTING_PRODUCT.md`; it is user-provided and intentionally untracked unless the user decides otherwise. Ignore unrelated user changes.

## 13. Acceptance Evidence

Phase 5.2 is ready for real-user review only when all items are evidenced by code/tests or an explicitly prepared manual scenario.

Explorer:

- workspace root and nested `.sdoc` tree are the first substantive Files content.
- ordinary rows are one line and no more than 26px high at default density.
- active state uses full normalized path/identity and is unique for duplicate basenames.
- mouse and keyboard open, expand/collapse, create, rename and Trash flows work.
- active file auto-reveal and Collapse All work.
- browser mode does not claim native filesystem access.

Workbench:

- Activity Bar has the accepted primary information architecture.
- Developer, schema, raw JSON, AI/RAG, CLI and Git workflows are absent from default author mode.
- title is naturally editable in the writing surface; author/version are not duplicated in persistent panels.
- New/Open/Save/Export are not duplicated across Explorer, command bar and toolbar.
- toolbar does not wrap into orphaned file-action icons at 1280px.
- Status Bar owns save/health/zoom/navigation state.

Core workflows:

- New document, save, close/reopen and nested workspace open remain natural.
- image clipboard/file insertion, table, equation, Mermaid and export remain reachable and validated.
- save failure, external change and Draw.io conflict remain recoverable without data loss.
- canonical JSON and stable IDs are unchanged by shell state, zoom, tree navigation, panel selection or dialogs.

Quality:

- required automated commands pass after the final slice.
- packaged Windows Tauri smoke checklist is current.
- 3-5 person test asks participants to open a folder, locate a nested document, create/rename/trash an entry, edit title/body, save/reopen, insert technical content and export without coaching.
- gate reports `user review required`; it must not claim that human review passed before records exist.

## 14. Stop And Defer Rules

Stop and request direction if the implementation would require:

- canonical schema/format/ID policy changes.
- a second frontend or direct browser filesystem emulation.
- silent overwrite/reload of dirty user content.
- broad Tauri filesystem/capability permissions.

Defer until user evidence:

- multi-select/batch file operations.
- drag files from the operating system into the tree.
- favorites/pins/tags.
- multi-root workspace.
- permanent multi-document tabs and preview-tab semantics.
- full workspace content search.
- compact single-child folder chains beyond the basic optional setting.

These features are useful reference-editor capabilities, but they must not delay the accepted Explorer and workbench cleanup.
