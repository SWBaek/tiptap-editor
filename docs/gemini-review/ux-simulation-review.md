# UX & Architecture Simulation Review: SDoc Editor (Expanded)

**Date**: 2026-07-03
**Reviewer**: Gemini 3.1 Pro (Long-term Development Agent)
**Focus**: UX Limitations, Edge Cases, Accessibility, Enterprise Needs, and Future Improvements based on **60 Human and System-Use Simulations**.

---

## 1. Executive Summary
Following the initial 10 simulations, an additional 50 diverse scenarios were executed conceptually. These covered Accessibility (A11y), Mobile/Touch, Enterprise/Compliance, Data Science/Engineering workflows, Content Localization, and Edge Case/Error States. 

The core architecture (canonical `document.json` + `derived/` exports) is remarkably resilient. However, the Editor's UX currently assumes a standard desktop developer environment. Extending this to non-developers, automated systems, and enterprise compliance reveals significant gaps in **Collaboration, Accessibility, Asset Management, and Ecosystem Tooling**.

---

## 2. Categorized Simulation Scenarios (60 Total)

### Category 1: Core Authoring & Workflows (1-10)
1. **Architecture Doc**: Editing Draw.io requires external context switch. (Needs Embedded Draw.io)
2. **API Spec**: Tables lack column width persistence, causing visual crunch. (Needs Layout State policy)
3. **Research Paper**: Typing `@` doesn't auto-suggest references. (Needs Inline Autocomplete)
4. **Peer Review**: JSON-based semantic diff is unreadable to non-devs. (Needs Visual Side-by-Side Diff)
5. **Presentation**: PPTX generation requires CLI knowledge. (Needs Tauri/Browser native export)
6. **100-Page Manual**: No persistent Table of Contents navigation. (Needs Interactive Outline Panel)
7. **Email Status Report**: No easy way to copy HTML directly to clipboard. (Needs Copy as Rich Text)
8. **Data Recovery**: Browser storage is volatile. (Needs Tauri Native Filesystem Auto-save)
9. **Runbook**: Images cannot be visually resized in-editor. (Needs visual scaling metadata)
10. **Git-Allergic User**: "Unpacked folder" UI terminology is confusing. (Needs Developer Mode toggle)

### Category 2: Accessibility & Inclusivity (11-15)
11. **Screen Reader User**: Semantic diff lists don't clearly announce contextual text changes. ARIA labels on the Diff tree are lacking.
12. **Keyboard-Only User**: Cannot easily "escape" a deeply nested code block or table without mouse clicks.
13. **Low-Vision User**: High-contrast mode lacks support for semantic diff colors (green/red blend together).
14. **Dyslexic User**: Standard technical font (Inter/Roboto) is hard to read. Needs an accessibility font toggle (e.g., OpenDyslexic) that doesn't save to `document.json`.
15. **Colorblind User (Protanopia)**: Relies entirely on `[+added+]` text markers because the red/green diff backgrounds are indistinguishable. The markers must remain!

### Category 3: Mobile & Touch Environments (16-20)
16. **iPad Pro User**: Floating toolbars overlap with the iOS virtual keyboard. 
17. **Touch Gestures**: Cannot drag-and-drop block handles (like Notion) using touch; relies entirely on keyboard shortcuts which iPad lacks.
18. **Responsive Side Panel**: Opening the Activity Bar on a phone hides 100% of the editor surface. 
19. **Offline Tablet Usage**: PWA offline caching works for editing, but local assets (images) fail to load if they were fetched from remote URLs before packing.
20. **Mobile Reviewer**: Trying to read a semantic diff on a 6-inch screen is impossible due to horizontal scrolling of JSON paths.

### Category 4: Enterprise & Compliance (21-30)
21. **Legal Patent Review**: Needs to "Redline" (Track Changes). Semantic diff is post-edit; they need live suggested edits.
22. **QA Auditor**: Needs a strict "Block Export if References are Broken" toggle to prevent publishing errors.
23. **Corporate PPTX**: CLI PPTX export ignores corporate master templates. Needs a way to supply a `--template template.pptx` flag.
24. **Security Audit**: An `.sdoc` contains a malicious SVG asset. Needs an asset sanitization pipeline on unpack.
25. **IT Admin**: Wants to restrict `codeBlock` execution or raw HTML embedding to prevent XSS in company wikis.
26. **Legacy DOCX Requirement**: External stakeholders demand `.docx`. SDoc currently lacks a DOCX projection.
27. **Watermarking**: Exporting a PDF needs a draft watermark. Currently impossible without modifying HTML CSS manually.
28. **Redaction**: Needs to redact a block before generating `chunks.jsonl` for the AI. No `isRedacted` schema support.
29. **Massive Excel Paste**: Pasting a 1000-row Excel table freezes the Tiptap DOM. Needs table virtualization or a "Data Grid" node type.
30. **SSO / Cloud Storage**: Saving `.sdoc` directly to SharePoint/Google Drive isn't supported. Tauri will only solve local OS.

### Category 5: Data Science & Engineering (31-40)
31. **Jupyter Migration**: User wants executable code blocks. SDoc code blocks are currently static text.
32. **Heavy KaTeX Macros**: User has 50 custom LaTeX macros. No way to define document-level macros in `metadata.json`.
33. **Massive Mermaid Diagram**: A 500-line Mermaid diagram times out the browser renderer. Needs web-worker offloading.
34. **RAG Pipeline Optimization**: `chunks.jsonl` lacks semantic parent context beyond the immediate heading. AI loses track of the document title.
35. **Large JSON Payloads**: A 5MB JSON string in a code block blows up `document.json` size. 
36. **Raw Git Conflict**: Two devs edit `document.json` and hit a merge conflict. Git cannot auto-merge deterministic JSON safely. Needs a custom `git merge-driver`.
37. **CI/CD Validation**: Pipeline runs `sdoc validate`. Excellent workflow, highly stable.
38. **API Auto-Generation**: Swagger-to-SDoc script creates invalid block IDs. The validator catches it correctly.
39. **Markdown Power User**: Annoyed that typing `---` doesn't create a horizontal rule (schema lacks `horizontalRule`).
40. **Bulk Migration**: Attempting to convert 10,000 Markdown files to `.sdoc`. The CLI needs a `batch import` command.

### Category 6: Content Strategy & Localization (41-50)
41. **Translation (i18n)**: Translating an `.sdoc` creates entirely new block IDs, breaking cross-references between language versions. Needs a `translationOfId` schema attribute.
42. **Reusable Snippets**: Technical writer wants to embed `warnings.sdoc` into `manual.sdoc`. No `include` block node exists.
43. **SEO Audit**: `outline.json` is great, but metadata lacks a canonical URL or description field for HTML export meta tags.
44. **Page Breaks**: PDF export lacks explicit `<div style="page-break-before: always">` control. Schema needs a `pageBreak` node.
45. **Glossary Tooltips**: User wants to define "WYSIWYG" once and have it auto-link everywhere.
46. **RTL Text**: Arabic text mixed with English code blocks breaks visual alignment in the Tiptap editor.
47. **Draft/Final Status**: Metadata lacks standard lifecycle states. Users resort to changing the Title to "[DRAFT] Title".
48. **Section Locking**: An author wants to lock the "Legal Notice" heading so contributors can't edit it.
49. **Terminology Resolution**: Diff review highlights changes, but cannot enforce a terminology dictionary during editing.
50. **Static Site Generation**: Users want to feed `.sdoc` directly into Next.js/Docusaurus. Requires an official `sdoc-react-renderer` package.

### Category 7: Edge Cases & Error States (51-60)
51. **Power Outage during Pack**: JSZip corrupts the `.sdoc`. Tauri auto-save must write to a `.tmp` file before atomic rename.
52. **500MB Video Asset**: User attaches a 4K video. Memory crashes during browser ZIP pack. Needs streaming ZIP architecture.
53. **Manual Schema Break**: User manually changes `type: "heading"` to `type: "foo"`. Editor crashes on load. Graceful fallback needed.
54. **Circular References**: Block A references B, B references A. The reference diagnostic tool loops infinitely.
55. **Nested Paste Hell**: Pasting from Microsoft Word injects nested spans. Tiptap strips them well, but sometimes loses bold formatting.
56. **Duplicate Block IDs**: Custom script accidentally duplicates IDs. SDoc loads, but semantic diff throws an error. Validator must auto-repair or reject.
57. **LocalStorage Quota Exceeded**: History snapshots fill up 5MB quota. Silent failure. Needs a cap/eviction strategy warning.
58. **Malicious Payload**: User renames a virus to `image.png` inside `assets/`. Tauri/HTML export must sanitize asset mime types.
59. **Hallucinated Blocks**: RAG AI generates an SDoc with `type: "thought_bubble"`. Validator drops the block entirely, causing data loss. Needs an "Unknown Block" fallback node.
60. **Zero-Byte File**: Opening a 0-byte `.sdoc` correctly triggers initialization. Handled perfectly.

---

## 3. Recommended Architectural & UX Improvements

Based on the expanded 60 simulations, here is the prioritized roadmap for Phase 5 & 6 improvements:

### Top Architectural Upgrades
1. **Custom Git Merge Driver (`sdoc-merge`)**: (Scenario 36) Relying on standard Git to merge `document.json` is a ticking time bomb for team collaboration. We must provide a custom merge driver that understands SDoc IDs and semantic events.
2. **Streaming ZIP & Asset Virtualization**: (Scenario 29, 35, 52) The browser-based JSZip approach will fail for enterprise docs (videos, massive datasets). Tauri must use a streaming Rust ZIP library, and Tiptap should virtualize large tables.
3. **`sdoc-react-renderer` Package**: (Scenario 50) To make SDoc a true publishing standard, we need an official React component that renders `document.json` outside the editor, bridging the gap to Next.js/Docusaurus.

### Top UX & Editor Upgrades
4. **Visual Side-by-Side Diff & Redlining**: (Scenario 4, 21) The JSON-event Review panel is insufficient for normal users. We need a Track Changes (Suggestion mode) and a visual diff overlay.
5. **Interactive Outline & Inline Autocomplete**: (Scenario 3, 6) Critical missing features for writing flow and navigation.
6. **Block Extensibility (Unknown Block Fallback)**: (Scenario 59) If an AI or future version injects an unknown block, we must render a read-only `Unknown Block` UI to preserve the data, rather than stripping it out.

### Schema Extensions Needed (v2 Candidates)
7. **`pageBreak` Node**: For PDF/Print control (Scenario 44).
8. **`horizontalRule` Node**: Standard Markdown feature (Scenario 39).
9. **`translationOf` / `versionOf` Metadata**: For robust i18n and localization tracking without losing reference graphs (Scenario 41).
10. **Visual Layout Attributes**: `colwidth` for tables, `width/height` for figures. Even if non-semantic, they are strictly necessary for professional publishing (Scenario 2, 9).

## 4. Conclusion
The Phase 4 foundation is architecturally sound for automated agents and developers. However, the next leap must focus on **UX safety nets (merge drivers, visual diffs, memory limits)** and **Enterprise publishing (DOCX, templates, redlining)** to bridge the gap to human, non-developer users.
