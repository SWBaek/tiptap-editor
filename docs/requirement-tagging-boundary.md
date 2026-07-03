# Requirement Tagging Boundary

Created: 2026-07-03

## Decision

Requirement and traceability tags should be optional human-facing metadata on semantic blocks. They must never replace stable immutable `attrs.id`, which remains the identity key for semantic diff, cross references, serialization, and internal graph operations.

The first canonical shape should use `attrs.humanId` for a single primary tag:

```json
{
  "type": "heading",
  "attrs": {
    "id": "blk_01h...",
    "humanId": "REQ-OBC-012",
    "level": 2
  }
}
```

## Canonical Scope

`humanId` is allowed when the tag is authored document meaning, such as a safety requirement, design requirement, test case, interface ID, or review-controlled section number. It is mutable and human-owned.

The following must not be stored in `document.json`:

- tag picker open/closed state;
- generated suggestions not accepted by the author;
- traceability panel filters and sort order;
- reviewer selection, hover, or validation UI state;
- external spreadsheet row positions.

## Validation Policy

The v1 implementation should validate `humanId` as a non-empty string when present. A conservative recommended pattern is uppercase letters, digits, dots, underscores, and hyphens, for example `REQ-OBC-012`, `TEST_INV_04`, or `ISO26262-6.7.4`.

Duplicate `humanId` values should be reported as diagnostics, not used for block matching. Some teams intentionally duplicate high-level tags across related paragraphs, so duplicate handling should start as a warning surface rather than a hard schema failure unless a project policy enables strict uniqueness.

## Diff, Export, And AI/RAG

Semantic diff should report `humanId` changes as normal block metadata changes while still matching blocks by `attrs.id`. Markdown and HTML exports may show `humanId` as a visible requirement badge or data attribute. AI/RAG chunk and reference exports should include `humanId` when present so downstream systems can map chunks to external trace matrices.

Changing `humanId` must not break `crossReference` nodes, because cross references target stable block IDs.

## UI Scope

The editor may show `humanId` in the left margin, block toolbar, or inspector. Editing should be explicit and auditable, not generated silently from heading text or position.

## Deferred Work

- multiple tags per block;
- typed traceability metadata such as `requirement`, `testCase`, or `hazard`;
- import/export of external trace matrices;
- strict project-level uniqueness policies;
- requirement coverage reports.
