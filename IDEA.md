# Tiptap 기반 WYSIWYG Editor

본 프로젝트는 Tiptap을 기반으로 하는 WYSIWYG 에디터를 개발한다.

주로 기술 문서를 작성하기 위한 목적이다.

Windows-Tauri Native로 배포한다.

## Problems

기술문서는 대부분 Word와 같은 파일로 작성된다. 그러나 Word는 Template을 준수하기 어렵다. 특히, 작성하는 작성자(인간)의 역량에 따라 그 양식이 다를 수 있다. 또한, Git-diff와 같은 기능으로 버전 추적도 어렵다. 뿐만아니라 AI가 쉽게 읽을 수 없는 형태이므로 불필요한 토큰 낭비, Hallucination 등이 발생할 가능성이 크다. RAG 기능을 염두한다면 역시 Word는 부족하다.

이것을 해결하기 위해 추진했던 전략은 다음과 같다.

**Markdown**: Markdown은 가볍지만, 복잡한 기술 문서에는 적합하지 않다. 또한, WYSIWYG를 기본적으로 지원하지 않기 때문에, 사용자가 편하게 문서 작성을 할 수 없다.
**Asciidoc**: Markdown보다 복잡한 기능을 제공한다. 그러나 역시 사용자가 편하게 문서작성할 수 없다.

따라서 AI 친화적으로 Tiptap 기반의 WYSIWYG Editor로 양식, 서식 걱정 없이 문서 작성할 수 있는 환경을 제공하려한다.

## Requirements

지원해야 하는 대표적인 기능은 아래와 같다.

1. Tiptap/ProseMirror 기반 리치 텍스트 에디터. 확장자는 *.sdoc, *.tiptap.json을 지원한다.
2. 파일 시스템 접근: Editor 좌측 SideBar에서 VS-Code와 같이 File Exploring이 가능해야 함.
3. 커서 히스토리: 마우스 뒤로가기/앞으로가기 버튼, 키보드 Alt+화살표 조합으로 이전 커서 위치 복원
4. pretty-printed JSON 저장 기능
5. 내보내기: Markdown, Asciidoc, 테마를 적용한 HTML, PDF, 슬라이드
6. Markdown, HTML을 Import하여 *.sdoc, *.tiptap.json 으로 변환
7. 텍스트 꾸미기: 굵게, 기울임, 밑줄, 취소선, 텍스트 색상, 하이라이트(음영)
8. 수학 수식 KaTeX 인라인/블록 수식
9. Blockquote
10. Callout / Admonition
11. 표: 캡션, 정렬, 너비 설정/ 컨텍스트 메뉴로 행/열 조작
12. 이미지: 클립보트 붙여넣기, 캡션, 정렬
13. Mermaid 다이어그램
14. Draw.io 다이어그램
15. 교차 참조: @입력으로 heading, figure, table 참조 삽입 및 번호 자동 동기화
16. 섹션 접기: heading 옆 토글로 섹션별 접기/펼치기
17. 문서 메타데이터: Title, Author, Version 인라인 편집(항상 고정 표시)

