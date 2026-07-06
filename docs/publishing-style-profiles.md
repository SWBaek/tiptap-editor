# Publishing Style Profiles

Created: 2026-07-06

## Purpose

Publishing style profiles make derived outputs look intentional without changing canonical `.sdoc/document.json`. They are export/runtime policy, not document body structure.

## v1 Scope

v1 provides HTML/PDF-oriented profile presets:

- `modern`: default readable technical document.
- `ieee`: compact paper-like heading and caption styling.
- `iso`: controlled-document styling aligned with standards/specification handoff.
- `korean`: Korean technical document typography and spacing.

The browser Export panel may choose a profile for HTML export. CLI HTML/PDF export may choose the same profile with `--profile`. PDF uses the HTML print pipeline, so the selected profile affects print CSS without adding PDF-specific canonical state.

## Canonical Boundary

- Do not store selected profile, preview profile, logo, CSS edits, page size, export dialog state, or generated heading/caption labels in `document.json`.
- If a profile choice must travel with a specific document, store it in document metadata or workspace/user settings, not block-level nodes.
- `derived/` outputs are disposable and can be regenerated with a different profile.
- Headings, figure captions, and table captions remain authored semantic content; numbering and visual labels are generated projections.

## Customization Boundary

Custom profile support should be implemented as export options:

- typography tokens such as body font, heading font, and base size;
- optional logo or document chrome for HTML exports;
- caption and heading numbering presentation;
- additional CSS appended after the selected preset.

Custom CSS must be sanitized or trusted only in local/headless contexts before exposing it broadly. External company Word templates remain the DOCX path for exact corporate handoff.

## Deferred

- Full DOCX style profile generation beyond the existing `controlled` template and external `.dotx/.docx` template injection.
- Persisted workspace/user profile preferences.
- Visual profile preview thumbnails.
