# UX Simulation Review: SDoc Editor

**Date**: 2026-07-03
**Reviewer**: Gemini 3.1 Pro (Long-term Development Agent)
**Focus**: UX Limitations, Edge Cases, and Future Improvements based on 10 Human-Use Simulations.

---

## 1. 10 Human-Use Simulations & Observations

### Scenario 1: Writing a Software Architecture Document
- **Context**: A developer writes an architecture doc using Draw.io diagrams, code blocks, and section folding.
- **Observation**: While `diagram` nodes support `drawio` assets, the user cannot currently double-click to edit the diagram *inside* the editor. They must manually manage `.drawio` files via unpacked folders.
- **Pain Point**: Context switching to a standalone Draw.io app breaks the WYSIWYG flow.

### Scenario 2: Drafting API Specifications
- **Context**: A technical writer creates an API spec heavily relying on tables for endpoints, parameters, and responses.
- **Observation**: Minimal table controls (add/remove rows/cols, alignment) exist, but column widths and cell merging (colspan/rowspan) are not supported or saved canonically.
- **Pain Point**: Complex API tables look cramped or visually unbalanced because width metadata isn't preserved.

### Scenario 3: Research Paper with Math and Figures
- **Context**: A researcher writes a paper using KaTeX blocks, figure images, and cross-references.
- **Observation**: To insert a reference, the user must open the "References" side panel and use the target picker.
- **Pain Point**: Writing flow is interrupted. Users expect to type `@` and see an inline autocomplete dropdown for headings and figures.

### Scenario 4: Collaborative Peer Review
- **Context**: Alice authors an `.sdoc`, sends it to Bob. Bob edits it, and Alice wants to review what Bob changed.
- **Observation**: The `Review` panel successfully lists semantic diff events (e.g., "Paragraph added", "Metadata changed").
- **Pain Point**: It lacks a side-by-side visual diff. Non-developers struggle to understand textual changes represented as JSON semantic event lists.

### Scenario 5: Preparing a Presentation Deck
- **Context**: A PM writes a PRD and wants to export it as a slide deck for a meeting.
- **Observation**: The Export panel only offers a "Copy PPTX CLI command" button. The user must open a terminal to generate the PPTX.
- **Pain Point**: Non-developer users do not know how to run Node.js CLI commands.

### Scenario 6: Organizing a 100-Page Manual
- **Context**: An engineer is writing a massive infrastructure manual.
- **Observation**: Section folding helps hide content, but navigating the document requires excessive scrolling.
- **Pain Point**: There is no persistent Table of Contents (Outline) navigation tree in the side panel for quick jumping.

### Scenario 7: Weekly Status Report (Emailing)
- **Context**: A team lead writes a weekly summary and wants to copy-paste it into Gmail.
- **Observation**: They can export to HTML, open the HTML, and copy it.
- **Pain Point**: Exporting a file just to copy its contents is tedious. A "Copy as Rich Text (HTML)" button directly in the editor is missing.

### Scenario 8: Accidental Deletion Recovery
- **Context**: A user accidentally deletes a massive section, hits save, and closes the browser.
- **Observation**: Local document history captures snapshots, but it's bound to `localStorage` or `IndexedDB` in the browser playground, which can be cleared by the browser.
- **Pain Point**: Risk of data loss in the browser playground environment without true local filesystem auto-save.

### Scenario 9: Image Heavy Runbook
- **Context**: An ops engineer pastes 20 screenshots into a troubleshooting runbook.
- **Observation**: Images are stored as assets, but the user cannot resize them visually within the editor.
- **Pain Point**: Images take up too much vertical space. Needs basic visual scaling (even if it's just saved as a CSS projection, not a canonical semantic change).

### Scenario 10: The "Git-Allergic" User
- **Context**: A non-technical product manager uses the tool and is confused by "Unpacked folder workflow" and "Git integration boundary" notes in the panels.
- **Observation**: The UI exposes too many developer-centric explanations in the Settings/Files panels.
- **Pain Point**: Cognitive overload. Developer boundaries should be hidden from the default UI unless a "Developer Mode" is toggled.

---

## 2. Recommended Improvements (Action Items)

### High Priority (Next Phase Candidates)
1. **Embedded Draw.io Editor**: This is already the planned next slice in Phase 4. Executing this will solve Scenario 1 and dramatically improve the product's standalone value.
2. **Inline Autocomplete (`@` trigger)**: Implement Tiptap's suggestion utility to map `@` to a floating menu of queryable block IDs (headings, figures, tables).
3. **Tauri Desktop Wrapper**: Fast-track the Tauri shell to solve local filesystem access, auto-save (Scenario 8), and native PPTX/PDF generation without CLI (Scenario 5, 10).

### Medium Priority (UX Polish)
4. **Visual Side-by-Side Diff**: Translate the `sdoc-diff` JSON events into a ProseMirror decoration layer that visually highlights additions in green and deletions in red, directly on the document.
5. **Interactive Outline Panel**: Take the `outline.json` derived output and render it as a clickable navigation tree in a new `Outline` side panel tab.
6. **"Copy as Rich Text" Command**: Add a utility button that runs `exportHtml`, strips `<html>` wrapper, and places the raw HTML onto the system clipboard for email pasting.

### Low Priority / Architectural Discussions
7. **Table Column Widths**: Decide if column width is purely a "runtime visual state" or a "canonical layout state." If it's runtime, we can store it in a local user-preferences cache. If canonical, we need a schema update to support `colwidth` array.
8. **Image Resizing**: Similar to tables, decide if `width`/`height` should be added to the `figure` schema. Technical docs often require strict image sizing to prevent blowout on PDF export.
9. **Developer Mode Toggle**: Hide all CLI copy buttons, Git references, and Unpacked folder mentions behind a single toggle in Settings to clean up the UI for non-developers.
