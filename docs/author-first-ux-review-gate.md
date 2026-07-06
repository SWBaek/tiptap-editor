# Author-First UX Review Gate

Created: 2026-07-06
Reviewed: 2026-07-06 Tauri app user review

## Purpose

This gate prepares the product for the first real-user review. The goal is not to add more technical-document features; it is to make the current app feel like a writing tool first while preserving `.sdoc/document.json` as the canonical source of truth.

## Target Users

- Non-developer technical authors who need to write structured specs, manuals, or engineering notes.
- Reviewers who need semantic change review, references, and traceability without seeing raw JSON first.
- Developers remain supported through debug previews, CLI commands, and derived exports, but they are not the first-run audience.

## Minimum UX Criteria Before Review

- The first screen centers the editor body, not Settings, schema status, JSON, or diff output.
- A user can see the document workflow immediately: New document, Open `.sdoc`, Save or download `.sdoc`, and Export.
- Basic authoring controls are prioritized: headings, bold/italic/underline, lists, image, reference, table, and callouts.
- Advanced insertions and review/debug tools remain available but do not dominate the first experience.
- Side panel, preview tab, selected review event, folder listing, export settings, cursor, and selection remain runtime-only state.

## Review Outcome

The first Tauri app review found that the current direction is closer, but still too much like a document management/debug tool. The next gate must happen before adding more advanced review or enterprise features.

Accepted review findings:

- Desktop should start with workspace/document choices instead of opening an arbitrary sample document.
- Files should behave like a file explorer and show actual workspace `.sdoc` files.
- Review, References, and Traceability feel unclear as top-level primary panels.
- Export needs clearer separation between Save `.sdoc`, deliverable export, and developer/AI debug output.
- Data Grid and raw `document.json` controls should not be visible to ordinary authors unless relevant.
- Essential authoring gaps are heading numbering, outline/TOC navigation, captions, table/figure lists, equation editing, and selected-text formatting.

## Exclusions

- No `.sdoc` schema, serialization, diff, or export behavior changes.
- No richer data-grid UX, approval workflow modeling, or Git-first review workflow before the desktop authoring shell is clarified.
- No Git-first workflow and no requirement that users understand unpacked folders or raw JSON.

## Next Review Gate Criteria

Before the next real-user review:

- Desktop launches to a StartScreen when no workspace/document is active.
- Files panel reads as a simple explorer.
- Outline/TOC navigation is available or explicitly represented in the near-term UI.
- Export shows deliverables first; Save/Save As owns `.sdoc`.
- Review/Diagnostics/Developer features are available but visually secondary.
- Top toolbar is grouped or reduced, and selected-text formatting is easier than hunting through all icons.
- Heading numbering is visible as a runtime/export projection and can be disabled without changing heading text.
- Figure and table lists are visible from the Outline surface.
- Equations can be edited from the writing surface without touching JSON.

Current status on 2026-07-06:

- Implemented: desktop start screen, explorer-first Files, primary/advanced panel IA, initial heading outline, runtime heading numbering, figure/table structure lists, toolbar grouping, selected-text bubble formatting, and equation edit flow.
- Remaining before the stronger authoring review gate: canonical table caption policy and publishing profile clarity.

## Review Scenarios

Ask 3-5 users to run these scenarios with minimal guidance:

1. Open the app and explain what they think the tool is for.
2. Choose or create a workspace/document from the first screen.
3. Create a new document, write a title, body paragraph, and second section.
4. Use the explorer to understand where the document is saved.
5. Save and reopen the `.sdoc`.
6. Navigate using headings or outline.
7. Export to at least one readable format such as Markdown, HTML, PDF, or DOCX.
8. Open Review/Diagnostics only after authoring and report whether it feels helpful or distracting.

## Review Stop Rule

After the next gate is implemented and validated, pause feature development again. Phase 5 priorities should be adjusted only after reviewing user feedback from the scenarios above.
