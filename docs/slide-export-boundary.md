# Slide Export Boundary

Created: 2026-07-03

## Decision

Slide export is a derived projection from canonical `document.json`. v1 should not add slide-specific canonical nodes, per-slide layout state, or presentation-only metadata until the document-to-deck mapping is proven.

The first implementation should treat slides as an export view, not as another editing mode.

## Source Mapping

The default mapping should group content by heading sections:

- `h1` starts a major deck section.
- `h2` starts a candidate slide.
- stable block IDs are preserved as source references for review, speaker notes, or round-trip diagnostics.
- paragraphs, lists, callouts, figures, tables, equations, and diagrams remain source-preserving blocks before any summarization is attempted.

This keeps technical-document fidelity ahead of visual deck polish. If the generated deck is too dense, later export options can split slides by block count, section depth, or explicit export hints.

## Browser Scope

The browser playground may expose a slide outline or a future HTML slide-deck download. It must not claim native PPTX generation until a renderer exists and can preserve technical content reliably.

Acceptable browser behavior:

- preview slide grouping from the current document;
- download `slides.html` after an HTML-slide renderer exists;
- copy a CLI command for saved `.sdoc` files;
- avoid storing slide grouping, export theme, or manual layout state in `document.json`.

## CLI Scope

The CLI should own the first durable slide generation path after the renderer decision:

```bash
npm run sdoc -- export "document.sdoc" --format slides-html -o "deck.html"
```

Native PPTX can be added later as a separate format, for example:

```bash
npm run sdoc -- export "document.sdoc" --format pptx -o "deck.pptx"
```

Both outputs must remain regenerable publishing artifacts outside `.sdoc` canonical state.

## Future Tauri Scope

The desktop app can wrap slide export with a native save dialog, progress UI, and renderer-specific error reporting. User export preferences may live in app settings, not in `document.json`.

## Deferred

- Native PPTX generation
- Theme templates
- Speaker notes
- Per-slide manual layout
- Mermaid/KaTeX live rendering inside slide output
- Slide visual regression tests
