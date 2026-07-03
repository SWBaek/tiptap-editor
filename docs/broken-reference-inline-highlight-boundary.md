# Broken Reference Inline Highlight Boundary

Created: 2026-07-03

## Decision

Broken references should be visible directly in the editor surface, not only in a References panel or CLI diff output. The implementation should reuse existing `crossReference` diagnostics and `reference-broken` semantic diff events instead of introducing a separate reference validation model.

The canonical document remains unchanged: a broken reference is a valid authored state that points to a missing `targetId` and should be repairable by the user.

## Runtime Boundary

Inline highlighting is editor UI state. The following must not be stored in `document.json`:

- diagnostic visibility state;
- selected broken reference;
- hover tooltip state;
- panel filters or sort order;
- suggested repair candidates;
- ProseMirror decoration IDs.

Only the authored `crossReference.attrs.targetId`, reference label content, and stable reference `attrs.id` belong in canonical JSON.

## UI Scope

The first implementation should:

- decorate inline `crossReference` nodes whose `targetId` is missing;
- expose an accessible label such as "Broken reference: missing blk_target";
- keep the References panel list and reveal actions as the navigation surface;
- optionally show a compact tooltip or inspector detail with the missing target ID;
- clear the decoration automatically when the target block exists again or the reference is retargeted.

If a reference node cannot be found in the current editor DOM, the diagnostic should remain visible in the References panel without claiming inline coverage.

## Validation And Diff

Schema validation should continue to require `targetId` on `crossReference`, but it should not fail solely because the target block is missing. Broken target detection is a document-level diagnostic and semantic diff/review event.

Semantic diff should keep emitting `reference-broken` for the current document. The inline highlighter may consume the same diagnostic result that powers the References panel.

## Repair Direction

Repair actions should prefer retargeting the existing reference to another stable block ID or deleting the reference node through normal editor commands. Automatic retargeting by matching label text is too risky for v1.

## Deferred Work

- automatic retarget suggestions;
- stale label inline highlights;
- batch repair workflows;
- reference graph visualization;
- project-wide broken-reference checks across multiple `.sdoc` files.
