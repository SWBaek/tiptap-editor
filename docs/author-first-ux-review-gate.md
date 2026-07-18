# Author-First UX Review Gate

Created: 2026-07-06
First Tauri review: 2026-07-06
Phase 5.1 review kit prepared: 2026-07-18

## Gate Status

**Ready for 3-5 real-user sessions; user review is now required.** Phase 5.1 implementation and automated validation are complete. The packaged Tauri smoke checklist is prepared in `docs/desktop-native-smoke.md`, but its interactive run and the user sessions must be recorded by people on the target Windows environment.

Feature expansion stops at this gate. Findings are triaged after the sessions; they do not justify changing `.sdoc`, stable IDs, or browser/native boundaries without a separate architecture decision.

## Purpose

The second review determines whether the app now feels like a technical document editor rather than a management/debug tool. It tests the carried-forward Structured Doc Editor experience against the current SDoc architecture, not feature recall from the previous implementation.

## Participants

Recruit 3-5 people who write specifications, manuals, engineering notes, test procedures, or similar structured documents. Prefer at least two non-developers. A reviewer/developer may participate, but raw JSON, Git, schema, or AI/RAG knowledge must not be assumed.

## Facilitator Setup

- Record date, platform, packaged build/commit hash, participant role, and whether the session is in Korean or English.
- Start from a clean temporary workspace and the desktop Start Screen.
- Prepare one PNG/JPEG clipboard image and a small valid Mermaid example. Prepare Draw.io only when it is installed.
- Do not demonstrate controls before a task. If help is requested, record the prompt needed.
- Mark each task `unassisted`, `assisted`, `failed`, or `not applicable`; record time, hesitation, wrong turns, and quotes.
- Do not open Developer, raw JSON, schema, Git, or AI/RAG surfaces unless the participant finds or requests them.

## Review Checklist

Run these scenarios with each participant:

1. **Orientation and entry**
   - Launch the app and ask, “What do you think this product is for?”
   - Ask the participant to create a workspace folder and a new `.sdoc` without guidance.
   - Observe whether Files, Outline, writing canvas, save state, and Export read as the primary workflow.

2. **Routine writing**
   - Enter a document title, author, version, two headings, paragraphs, a bulleted list, and a task item.
   - Format selected text with bold and strike, add a normal web link, and promote/demote a heading with Tab/Shift-Tab.
   - Ask which controls feel common versus advanced and whether any basic command is hard to find.

3. **Technical content**
   - Paste an image from the clipboard, name it, and edit its alt text/caption.
   - Insert a captioned table and change one table property from its context menu or inspector.
   - Insert and edit an equation through the validated preview dialog.
   - Insert and edit Mermaid, including one invalid attempt, and explain the validation feedback.
   - If Draw.io is available, create/import a source and verify that external-edit conflict choices are understandable.

4. **Navigation and recovery**
   - Navigate from Outline, change zoom, move the cursor back/forward, and return to writing.
   - Create a nested folder/document, rename it, refresh the explorer, and explain where the current document is saved.
   - With facilitator help to produce an external file change, choose Compare, Keep, or Reload and explain the expected result before clicking.

5. **Save, reopen, and export**
   - Save, close/restart as practical, and reopen the `.sdoc` from Files or Recent Documents.
   - Confirm the title, metadata, image, table, equation, and Mermaid content are present.
   - Export one readable deliverable such as Markdown, HTML, or DOCX without visiting Developer.
   - Ask the participant to explain the difference between Save `.sdoc` and deliverable Export.

6. **Product impression**
   - Ask what the participant would do next without guidance.
   - Rate 1-5: “This feels like a document editor,” “Common writing tools are easy to find,” “Advanced tools appear when needed,” and “I trust save/reopen.”
   - Ask for the three most confusing moments, one missing essential capability, and one feature that felt distracting.

## Session Record Template

```text
Participant/role:
Date/platform/commit:
Scenario results (unassisted/assisted/failed/N/A):
1 Orientation:
2 Routine writing:
3 Technical content:
4 Navigation/recovery:
5 Save/reopen/export:
Ratings (editor/common/advanced/trust, 1-5):
Critical observations or quotes:
Potential data-loss/security issue:
Top follow-up candidate:
```

## Gate Decision

Review evidence is sufficient after 3-5 completed sessions and one recorded packaged Tauri smoke run. Any data loss, canonical format/stable-ID regression, native path escape, or silent overwrite is a blocker. Usability findings are grouped by frequency and severity; prioritize repeated routine-writing/save blockers before adding deferred features.

The gate currently reports **user review required**, not “user review passed.” After evidence is collected, update this document and reprioritize Phase 5 from observed findings.
