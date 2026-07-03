<p align="center">
  <strong>SDoc Editor</strong>
</p>

<p align="center">
  AI/Diff-Friendly Technical Document Editor
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#cli">CLI</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#roadmap">Roadmap</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## Overview

SDoc Editor는 **기술 문서 작성**에 특화된 Tiptap/ProseMirror 기반 WYSIWYG 에디터입니다.

기존 기술 문서 작성 도구의 한계를 해결합니다:

| 문제 | Word / Google Docs | Markdown / AsciiDoc | **SDoc Editor** |
|---|---|---|---|
| WYSIWYG 편집 | ✅ | ❌ | ✅ |
| 일관된 양식/서식 | ❌ 작성자마다 다름 | ⚠️ 제한적 | ✅ 스키마 기반 강제 |
| 의미 기반 변경 추적 | ❌ | ❌ Git 줄 단위 | ✅ Semantic Diff |
| AI/RAG 친화적 구조 | ❌ 토큰 낭비 | ⚠️ 제한적 | ✅ 구조화된 청크 내보내기 |
| 수식 / 다이어그램 | ⚠️ 플러그인 필요 | ⚠️ 별도 도구 | ✅ KaTeX, Mermaid, Draw.io 내장 |

## Features

### 📝 Rich Text Editing
- Paragraph, Heading (1–6), Blockquote, Code Block
- Callout / Admonition (`note`, `info`, `warning`, `danger`, `tip`)
- Ordered / Unordered List
- Bold, Italic, Underline, Strikethrough, Text Color, Highlight
- Inline Code, Link

### 📐 Technical Document Elements
- **KaTeX** — 인라인 및 블록 수학 수식
- **Mermaid** — 소스 기반 다이어그램 렌더링
- **Draw.io** — 에셋 기반 다이어그램 (`.drawio` 소스 보존)
- **Figure** — 이미지 삽입, 캡션, 에셋 관리
- **Table** — 행/열 삽입·삭제, 헤더 토글, 셀 정렬

### 🔗 Cross References
- `@` 키를 통한 heading, figure, table 참조 삽입
- 깨진 참조 자동 감지 및 진단
- 참조 레이블 동기화

### 🔍 Semantic Diff
- Git 줄 비교가 아닌 `document.json` 노드 트리 기반 의미 비교
- `added`, `deleted`, `moved`, `modified`, `reference-broken` 이벤트
- 단어 수준 텍스트 변경 표시
- 브라우저 내 리뷰 UI 및 CLI 지원

### 📦 SDoc Format (`.sdoc`)
- 단일 ZIP 컨테이너 파일 (`.docx`와 유사한 구조)
- 결정론적 직렬화 — 같은 문서는 항상 같은 바이트 시퀀스
- 모든 블록 노드에 안정적인 고유 ID 부여

```text
document.sdoc (ZIP)
├── manifest.json       # 포맷 버전, 문서 ID
├── document.json       # Canonical Source of Truth
├── metadata.json       # 제목, 저자, 버전, 날짜
├── assets/             # 이미지, Draw.io 소스 등
└── derived/            # 재생성 가능한 파생 산출물
    ├── plain.md        # Markdown export
    ├── chunks.jsonl    # RAG 인덱싱용 청크
    ├── outline.json    # 문서 구조 (heading 기반)
    └── references.json # 참조 대상 목록
```

### 🤖 AI/RAG Export
- **Markdown** — LLM 입력에 적합한 플레인텍스트 변환
- **Chunks (JSONL)** — 블록 단위 RAG 인덱싱용 청크
- **Outline (JSON)** — heading 기반 문서 구조
- **References (JSON)** — 참조 가능한 블록 ID/anchor/label 목록

### 📤 Publishing Export
- **HTML** — 테마 적용, 인쇄 스타일시트 포함
- **PDF** — CLI/Tauri를 통한 Chromium 기반 PDF 생성
- **PPTX** — heading 기반 슬라이드 분할, 네이티브 PowerPoint 생성

### 🗂️ VS Code-like UI Shell
- Activity Bar + Side Panel 레이아웃
- Files, Review, References, History, Export, Settings 패널
- 섹션 접기/펼치기 (heading 기반)
- 로컬 문서 히스토리 (스냅샷, 비교, 복원)

## Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                      apps/web-playground                      │
│         Vite + React  •  Tiptap Editor  •  Browser UI         │
├──────────────────────────────────────────────────────────────┤
│  packages/editor-tiptap  │  Tiptap Extensions & Converters   │
├──────────────────────────┼───────────────────────────────────┤
│  packages/sdoc-schema    │  Document Types & Validation       │
│  packages/sdoc-format    │  .sdoc Pack/Unpack, Serialization  │
│  packages/sdoc-diff      │  Semantic Diff Engine              │
│  packages/sdoc-export    │  MD, HTML, PDF, PPTX, AI/RAG       │
│  packages/sdoc-cli       │  CLI: validate, diff, export       │
└──────────────────────────┴───────────────────────────────────┘
```

### Design Principles

1. **Format First** — 에디터 UI보다 포맷·스키마·직렬화를 먼저 확정
2. **Single Source of Truth** — `document.json`만이 canonical 데이터
3. **Derived Outputs Are Disposable** — `derived/`는 언제든 재생성 가능
4. **Semantic Over Textual** — 줄 단위가 아닌 의미 단위 비교
5. **Non-Developer UX First** — Git은 숨겨진 선택적 기능
6. **Web-Core First** — Tauri 독립적인 웹 코어 로직

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

### Installation

```bash
git clone https://github.com/SWBaek/tiptap-editor.git
cd tiptap-editor
npm install
```

### Development

```bash
# 1. 패키지 빌드 (최초 실행 또는 패키지 소스 변경 시 필수)
npm run build:packages

# 2. 브라우저 플레이그라운드 실행 (http://127.0.0.1:6280)
npm run dev:web

# 전체 빌드 (패키지 + 플레이그라운드 프로덕션 번들)
npm run build
```

> **Note:** 플레이그라운드는 `@sdoc/*` 워크스페이스 패키지의 빌드된 `dist/` 산출물을 참조합니다. `npm run dev:web` 전에 반드시 `npm run build:packages`를 한 번 실행해야 하며, 패키지 소스(`packages/` 내부)를 수정한 경우에도 다시 빌드해야 변경이 반영됩니다.

### Testing

```bash
# 단위 테스트 (Vitest)
npm test

# E2E 브라우저 테스트 (Playwright)
npx playwright install chromium
npm run test:e2e
```

## CLI

`sdoc` CLI는 `.sdoc` 파일과 `document.json`을 대상으로 검증, 비교, 내보내기를 지원합니다.

```bash
# 문서 검증
npm run sdoc -- validate examples/sdoc-json/basic.document.json

# 시맨틱 비교
npm run sdoc -- diff examples/sdoc-json/basic.document.json examples/sdoc-json/modified.document.json

# Markdown 내보내기
npm run sdoc -- export examples/sdoc-json/basic.document.json markdown

# RAG 청크 내보내기
npm run sdoc -- export examples/sdoc-json/basic.document.json chunks

# HTML 내보내기
npm run sdoc -- export examples/sdoc-json/basic.document.json --format html

# PDF 내보내기
npm run sdoc -- export examples/sdoc-json/basic.document.json --format pdf -o output.pdf

# PowerPoint 내보내기
npm run sdoc -- export examples/sdoc-json/basic.document.json --format pptx -o deck.pptx
```

## Project Structure

```text
tiptap-editor/
├── apps/
│   └── web-playground/          # Vite + React 브라우저 플레이그라운드
│       ├── src/
│       │   ├── App.tsx          # 메인 에디터 애플리케이션
│       │   ├── documentIo.ts   # .sdoc 파일 I/O
│       │   ├── documentState.ts # 문서 상태 관리
│       │   └── styles.css      # UI 스타일시트
│       └── e2e/                # Playwright E2E 테스트
├── packages/
│   ├── sdoc-schema/            # 문서 타입 정의 및 스키마 검증
│   ├── sdoc-format/            # .sdoc ZIP 패킹/언패킹, 직렬화
│   ├── sdoc-diff/              # 시맨틱 디프 엔진
│   ├── sdoc-export/            # Markdown, HTML, PDF, PPTX, AI/RAG 내보내기
│   ├── sdoc-cli/               # CLI 도구 (validate, diff, export)
│   └── editor-tiptap/          # Tiptap 확장 및 에디터↔SDoc 변환
├── docs/                       # 아키텍처 및 설계 문서
│   ├── document-format.md      # .sdoc 컨테이너 스펙
│   ├── editor-schema.md        # v1 노드/마크 스키마
│   ├── serialization.md        # 결정론적 직렬화 규칙
│   ├── diff-model.md           # 시맨틱 디프 이벤트 모델
│   ├── ai-export.md            # AI/RAG 내보내기 규격
│   ├── ui-shell-plan.md        # VS Code-like UI 설계
│   ├── mvp-roadmap.md          # 단계별 로드맵
│   └── ...                     # Phase 계획/종료 문서, 경계 문서
├── examples/
│   └── sdoc-json/              # 샘플 document.json 파일
├── package.json                # npm workspaces 루트
├── tsconfig.base.json          # 공유 TypeScript 설정
├── vitest.config.ts            # Vitest 설정
└── playwright.config.ts        # Playwright E2E 설정
```

## Tech Stack

| Category | Technology |
|---|---|
| **Language** | TypeScript |
| **Editor Runtime** | Tiptap 3 / ProseMirror |
| **Frontend** | React 19, Vite 7 |
| **Math Rendering** | KaTeX |
| **Diagram** | Mermaid, Draw.io |
| **Icons** | Lucide React |
| **ZIP Handling** | JSZip |
| **Unit Testing** | Vitest |
| **E2E Testing** | Playwright |
| **Build** | TypeScript Project References (`tsc -b`) |
| **Package Management** | npm Workspaces |
| **Future Desktop** | Tauri (planned) |

## Roadmap

| Phase | Description | Status |
|---|---|---|
| **Phase 0** | Format & Diff Prototype — 포맷 가설 증명, 결정론적 직렬화, .sdoc 팩/언팩, 시맨틱 디프, Markdown 내보내기 | ✅ Completed |
| **Phase 1** | Core Editor MVP — 웹 플레이그라운드, 기본 편집, .sdoc 열기/저장, 블록 ID, Markdown 내보내기 | ✅ Completed |
| **Phase 2** | Technical Document Basics — 이미지/Figure, 테이블, KaTeX, Mermaid, AI/RAG 파생 산출물 | ✅ Completed |
| **Phase 3** | Review & Integration — 시맨틱 디프 UI, 로컬 히스토리, 교차참조, Activity Bar 셸, Git 통합 | ✅ Completed |
| **Phase 4** | Publishing & Advanced — HTML/PDF/PPTX 내보내기, Draw.io, 고급 테이블, 섹션 접기 | 🔄 In Progress |
| **Future** | Tauri 데스크톱 래퍼, 네이티브 파일시스템, 인라인 자동완성, 실시간 협업 | 📋 Planned |

## Documentation

설계 문서는 `docs/` 디렉토리에서 관리됩니다:

- [document-format.md](docs/document-format.md) — `.sdoc` 컨테이너 규격
- [editor-schema.md](docs/editor-schema.md) — v1 노드/마크 스키마 정의
- [serialization.md](docs/serialization.md) — 결정론적 직렬화 규칙
- [diff-model.md](docs/diff-model.md) — 시맨틱 디프 이벤트 모델
- [ai-export.md](docs/ai-export.md) — AI/RAG 내보내기 규격
- [ui-shell-plan.md](docs/ui-shell-plan.md) — VS Code-like UI 설계
- [mvp-roadmap.md](docs/mvp-roadmap.md) — 단계별 로드맵
- [development-plan.md](docs/development-plan.md) — 전체 개발 계획 및 의사결정

## Contributing

### Development Workflow

1. 저장소를 클론하고 `npm install`로 의존성 설치
2. `npm run dev:web`으로 개발 서버 실행
3. 변경 후 `npm test` 및 `npm run test:e2e`로 테스트 실행
4. 커밋 메시지는 짧은 명령형으로 작성 (예: `Add sdoc format prototype`)

### Code Style

- TypeScript, 2-space 들여쓰기
- `PascalCase` — 컴포넌트
- `camelCase` — 함수, 변수
- `kebab-case` — 파일명
- 확장 파일은 기능 단위로 분리 (예: `callout-extension.ts`)

### Testing Priority

1. 결정론적 직렬화 — 같은 입력 → 동일한 바이트 시퀀스
2. 블록 ID 라이프사이클 — 생성, 분할, 병합, 복사, 붙여넣기, 실행취소
3. `.sdoc` 패킹/언패킹 왕복
4. 스키마 검증 및 마이그레이션
5. 시맨틱 디프 — 추가, 삭제, 이동, 수정
6. 내보내기 재생성 — Markdown, Outline, References, Chunks

### PR Guidelines

- 간결한 요약과 테스트 노트 포함
- `.sdoc`, 스키마, 직렬화, 디프 관련 변경은 `docs/` 문서도 함께 업데이트
- UI 변경 시 스크린샷 또는 녹화 첨부

## License

Private project. All rights reserved.
