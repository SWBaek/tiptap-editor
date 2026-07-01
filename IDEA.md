# Tiptap 기반 WYSIWYG Editor

본 프로젝트는 Tiptap을 기반으로 하는 WYSIWYG 에디터를 개발한다.

Windows-Tauri Native로 배포한다.

지원해야 하는 대표적인 기능은 아래와 같다.

1. Tiptp/ProseMirror 기빈 리치 텍스트 에디터. 확장자는 *.sdoc, *.tiptap.json을 지원한다.
2. 파일 시스템 접근: Eidtor의 좌측 SideBar에서 VS-Code와 같이 File Exploring이 가능해야 함.
3. 커서 히스토리: 마우스 뒤로가기/앞으로가기 버튼, 키보드 Alt+화살표 조합으로 이전 커서 위치 복원
4. pretty-printed JSON 저장 기능
5. 내보내기: Markdown, ASciidoc, 테마를 적용한 HTML, PDF, 슬라이드
6. Markdown, HTML ->
7. 텍스트 꾸미기: 굵게, 기울임, 밑줄, 취소선, 텍스트 색상, 하이라이트(음영)
8. 수학 수식 KaTeX 인라인/블록 수식
9. Blockquote
10. Callout / Admonition
11. 표: 캡션, 정렬, 너미 설정/ 컨텍스트 메뉴로 행/열 조작
12. 이미지: 클립보트 붙여넣기, 캡션, 정렬
13. Mermaid 다이어그램
14. Draw.io 다이어그램
15. 교차 참조: @입력으로 heading, figure, table 참조 삽입 및 번호 자동 동기화
16. 섹션 접기: heading 옆 토글로 섹션별 접기/펼치기
17. 문서 메타데이터: Title, Author, Version 인라인 편집(항상 고정 표시)

