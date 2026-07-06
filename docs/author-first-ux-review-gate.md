# Author-First UX Review Gate

Created: 2026-07-06

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

## Exclusions

- No `.sdoc` schema, serialization, diff, or export behavior changes.
- No embedded Draw.io editing, richer data-grid UX, full desktop file explorer, or approval workflow modeling.
- No Git-first workflow and no requirement that users understand unpacked folders or raw JSON.

## Review Scenarios

Ask 3-5 users to run these scenarios with minimal guidance:

1. Open the app and explain what they think the tool is for.
2. Create a new document, write a title, body paragraph, and second section.
3. Save/download the document, then open it again.
4. Export to at least one readable format such as Markdown or HTML.
5. Open Review, References, or Traceability and report whether it feels helpful or distracting.

## Review Stop Rule

After this gate is implemented and validated, pause feature development. Phase 5 should be adjusted only after reviewing user feedback from the scenarios above.
