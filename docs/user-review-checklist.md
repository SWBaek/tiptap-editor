# User Review Checklist

Created: 2026-07-06

## Participants

Run this with 3-5 users who write or review technical documents. Include at least one non-developer author and one reviewer who cares about requirements, references, or version changes.

## Setup

- Use the current web playground or Tauri desktop shell.
- Start from a clean app load when possible.
- Do not explain `.sdoc`, schema, semantic diff, or Git unless the user asks.
- Record the commit hash, platform, browser or desktop runtime, and pass/fail notes.

## Tasks

1. First impression
   - Ask: "What do you think this tool is for?"
   - Pass if the user identifies it as a document editor or technical writing tool.

2. New document and writing
   - Create a new document.
   - Add a title, a paragraph, and at least one section heading.
   - Pass if the user can start writing without opening Settings or JSON.

3. Save and reopen
   - Save or download a `.sdoc`.
   - Reopen that `.sdoc`.
   - Pass if the user understands the file action and sees their content restored.

4. Export
   - Export Markdown or HTML.
   - Pass if the user finds the export path without using raw debug views.

5. Review support
   - Open Review, References, or Traceability.
   - Pass if the user describes it as optional assistance rather than the main task.

## Questions After Testing

- What did you expect the left icon bar to do?
- Was Save/Export clear enough?
- Which toolbar controls felt essential, missing, or too advanced?
- Did Review, Traceability, or References help, confuse, or distract?
- At what point did it feel more like a management console than an editor?
