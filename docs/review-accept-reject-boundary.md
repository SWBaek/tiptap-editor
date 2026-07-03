# Review Accept/Reject Boundary

Created: 2026-07-04

## Decision

Accept/reject review is a controlled edit workflow over normalized `document.json`, not a stored review layer. The source of review truth is the existing semantic diff model produced from baseline and current SDoc documents. Review UI state, selected events, preview decisions, and pending accept/reject choices must stay outside `document.json`.

Accepting or rejecting a change must eventually produce a normal edited SDoc document that passes validation, normalization, deterministic serialization, and semantic diff checks.

## Action Semantics

The initial action model is derived from `SDocDiffEvent` and records availability only. It does not mutate documents yet.

- `added`: accept keeps the current block; reject removes the current block.
- `deleted`: accept keeps the deletion; reject restores the baseline block.
- `modified`: accept keeps the current block; reject restores baseline attrs/content for the same stable ID.
- `moved`: accept keeps current order; reject restores the baseline parent/order for the same stable ID.
- `reference-broken`: direct accept/reject is disabled; users must use the References repair flow to retarget or remove the reference.

Metadata accept/reject is deferred until metadata field-level actions can be applied with the same validation and serialization guarantees.

## Canonical Constraints

- `document.json` stores the accepted document state only.
- Runtime review decisions, batch selections, panel state, and preview state are not canonical.
- Stable `attrs.id` remains the internal identity key during restore, move, and removal actions.
- Git is optional; review actions must work without a Git checkout.
- If the current document changed since the diff baseline, apply commands must recompute or refuse stale actions instead of applying by path blindly.

## Implementation Scope

Implemented first:

- A runtime-only review action plan derived from visual semantic review items.
- Action availability labels for accept/reject decisions.
- Manual repair classification for broken references.

Deferred:

- Actual apply/revert document mutations.
- Batch accept/reject.
- Conflict handling for stale baselines.
- Side-by-side document diff.
- Comment threads, reviewer assignments, and Git-backed PR review.

## Tests

Unit tests should verify action classification and confirm the source review items are not mutated. Future apply-command tests must include pack/unpack round trip, validation failure cases, deterministic serialization, and semantic diff after each accepted or rejected result.
