import { describe, expect, it } from "vitest";
import {
  addLocalHistoryEntry,
  createChangeReview,
  createReviewActionPlan,
  createReviewBatchConflictSummary,
  createSideBySideDiffRows,
  createVisualDiffFilterCounts,
  createLocalHistoryEntry,
  createReferenceDiagnostics,
  createRequirementTraceability,
  createSectionFoldRanges,
  createVisualDiffOverlayItems,
  filterVisualDiffOverlayItems,
  getFileLabel,
  getSavedLabel,
  getValidationFailureMessage,
  isMetadataDirty,
  parseLocalHistory,
  pruneCollapsedHeadingIds,
  renameLocalHistoryEntry,
  removeLocalHistoryEntry,
  removeCrossReference,
  renderDiffPreview,
  renderBrokenReferenceRuntimeCss,
  renderMetadataDiff,
  renderVisualDiffRuntimeCss,
  retargetCrossReference,
  serializeLocalHistory,
  updateCrossReferenceLabel
} from "./documentState";
import type { SDocDocument } from "@sdoc/schema";

const historyDocument: SDocDocument = {
  schemaVersion: 1,
  type: "doc",
  attrs: { id: "doc_history" },
  content: [{ type: "paragraph", attrs: { id: "blk_history" }, content: [{ type: "text", text: "History" }] }]
};

describe("document state helpers", () => {
  it("detects metadata changes with stable key ordering", () => {
    expect(isMetadataDirty({ title: "Spec", author: "A" }, { author: "A", title: "Spec" })).toBe(false);
    expect(isMetadataDirty({ title: "Spec", author: "B" }, { title: "Spec", author: "A" })).toBe(true);
  });

  it("shows unsaved changes ahead of the last save timestamp", () => {
    expect(getSavedLabel("10:00:00", false)).toBe("10:00:00");
    expect(getSavedLabel("10:00:00", true)).toBe("Unsaved changes");
  });

  it("uses the opened filename before deriving a draft filename from metadata", () => {
    expect(getFileLabel("Opened.sdoc", { title: "Draft" })).toBe("Opened.sdoc");
    expect(getFileLabel(null, { title: "Draft" })).toBe("Draft.sdoc");
    expect(getFileLabel(null, { title: "   " })).toBe("Untitled.sdoc");
  });

  it("formats validation failures for export actions", () => {
    expect(getValidationFailureMessage({ ok: true, issues: [] }, "save .sdoc")).toBeNull();
    expect(
      getValidationFailureMessage(
        { ok: false, issues: [{ path: "$.content[0].type", message: "unsupported node type: drawioDiagram" }] },
        "export Markdown"
      )
    ).toBe("Cannot export Markdown: $.content[0].type: unsupported node type: drawioDiagram");
  });

  it("renders metadata changes by field", () => {
    expect(renderMetadataDiff({ title: "Spec", author: "B", version: "1" }, { title: "Spec", author: "A" })).toEqual([
      'Metadata author changed: "A" -> "B"',
      'Metadata version added: "1"'
    ]);
  });

  it("combines document and metadata diff preview sections", () => {
    expect(renderDiffPreview(["Moved paragraph"], ['Metadata title changed: "A" -> "B"'])).toBe(
      'Document changes (1)\n- Moved paragraph\n\nMetadata changes (1)\n- Metadata title changed: "A" -> "B"\n'
    );
    expect(renderDiffPreview([], [])).toBe("NO_CHANGES\n");
  });

  it("builds a structured change review summary", () => {
    expect(createChangeReview(["Moved paragraph"], ['Metadata title changed: "A" -> "B"'])).toEqual({
      total: 2,
      documentCount: 1,
      metadataCount: 1,
      label: "2 changes",
      sections: [
        { title: "Document changes", lines: ["Moved paragraph"] },
        { title: "Metadata changes", lines: ['Metadata title changed: "A" -> "B"'] }
      ]
    });
    expect(createChangeReview([], [])).toEqual({
      total: 0,
      documentCount: 0,
      metadataCount: 0,
      label: "No changes",
      sections: []
    });
  });

  it("projects semantic events to side-by-side diff rows without storing UI state", () => {
    const baseline: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_review" },
      content: [
        { type: "paragraph", attrs: { id: "blk_body" }, content: [{ type: "text", text: "Old body" }] },
        { type: "paragraph", attrs: { id: "blk_removed" }, content: [{ type: "text", text: "Removed body" }] }
      ]
    };
    const current: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_review" },
      content: [
        { type: "paragraph", attrs: { id: "blk_body" }, content: [{ type: "text", text: "New body" }] },
        { type: "paragraph", attrs: { id: "blk_added" }, content: [{ type: "text", text: "Added body" }] }
      ]
    };
    const rows = createSideBySideDiffRows(
      [
        { kind: "modified", id: "blk_body", nodeType: "paragraph", path: "doc[0]/blk_body", label: '"Body"', changes: ["text changed"] },
        { kind: "deleted", id: "blk_removed", nodeType: "paragraph", path: "doc[1]/blk_removed", label: '"Removed"' },
        { kind: "added", id: "blk_added", nodeType: "paragraph", path: "doc[1]/blk_added", label: '"Added"' },
        { kind: "reference-broken", id: "ref_missing", nodeType: "crossReference", path: "doc[2]/ref_missing", label: '"Missing"', targetId: "blk_missing" }
      ],
      baseline,
      current
    );

    expect(rows).toEqual([
      expect.objectContaining({ id: "blk_body", kind: "modified", baselineText: "Old body", currentText: "New body" }),
      expect.objectContaining({ id: "blk_removed", kind: "deleted", baselineText: "Removed body", currentText: "Not present" }),
      expect.objectContaining({ id: "blk_added", kind: "added", baselineText: "Not present", currentText: "Added body" }),
      expect.objectContaining({ id: "ref_missing", kind: "reference-broken", baselineText: "Not present", currentText: "Missing target blk_missing" })
    ]);
  });

  it("projects semantic diff events to review items and runtime overlay css without canonical state", () => {
    const items = createVisualDiffOverlayItems([
      { kind: "modified", id: "blk_body", nodeType: "paragraph", path: "doc[0]/blk_body", label: '"Body"', changes: ["text changed"] },
      { kind: "deleted", id: "blk_old", nodeType: "paragraph", path: "doc[1]/blk_old", label: '"Old"' },
      { kind: "reference-broken", id: "ref_missing", nodeType: "crossReference", path: "doc[2]/ref_missing", label: '"Missing"', targetId: "blk_missing" }
    ]);

    expect(items[0]).toMatchObject({
      id: "blk_body",
      kind: "modified",
      label: "Modified",
      summary: 'Modified paragraph "Body"',
      detail: "text changed at doc[0]/blk_body",
      anchorable: true
    });
    expect(items[1]).toMatchObject({
      id: "blk_old",
      kind: "deleted",
      label: "Deleted",
      summary: 'Deleted paragraph "Old"',
      detail: "Previous path: doc[1]/blk_old",
      anchorable: false
    });
    expect(createVisualDiffFilterCounts(items)).toEqual({
      total: 3,
      added: 0,
      deleted: 1,
      modified: 1,
      moved: 0,
      "reference-broken": 1
    });
    expect(filterVisualDiffOverlayItems(items, "reference-broken")).toEqual([items[2]]);

    const css = renderVisualDiffRuntimeCss(items, "blk_body");
    expect(css).toContain('[data-id="blk_body"]');
    expect(css).toContain("outline: 3px solid");
    expect(css).toContain('[data-id="ref_missing"]');
    expect(css).not.toContain('[data-id="blk_old"]');
  });

  it("derives review accept/reject action availability without mutating review items", () => {
    const items = createVisualDiffOverlayItems([
      { kind: "added", id: "blk_added", nodeType: "paragraph", path: "doc[0]/blk_added", label: '"Added"' },
      { kind: "modified", id: "blk_body", nodeType: "paragraph", path: "doc[1]/blk_body", label: '"Body"', changes: ["text changed"] },
      { kind: "reference-broken", id: "ref_missing", nodeType: "crossReference", path: "doc[2]/ref_missing", label: '"Missing"', targetId: "blk_missing" }
    ]);

    const plan = createReviewActionPlan(items);

    expect(plan).toMatchObject({
      total: 3,
      actionableCount: 2,
      manualCount: 1,
      unsupportedCount: 0
    });
    expect(plan.items[0].actions).toEqual([
      expect.objectContaining({ kind: "accept", availability: "current-state", label: "Keep added block" }),
      expect.objectContaining({ kind: "reject", availability: "available", label: "Remove added block" })
    ]);
    expect(plan.items[1].actions).toEqual([
      expect.objectContaining({ kind: "accept", availability: "current-state", label: "Keep current version" }),
      expect.objectContaining({ kind: "reject", availability: "available", label: "Restore baseline version" })
    ]);
    expect(plan.items[2].actions.every((action) => action.availability === "manual-repair")).toBe(true);
    expect("actions" in items[0]).toBe(false);
  });

  it("summarizes partially applied review batches without canonical state", () => {
    const summary = createReviewBatchConflictSummary("reject", {
      document: historyDocument,
      appliedCount: 2,
      skippedCount: 1,
      failures: [
        {
          id: "blk_stale",
          kind: "modified",
          reason: "stale-event",
          message: "Cannot reject modified blk_stale: review event is stale or already resolved."
        }
      ]
    });

    expect(summary).toEqual({
      action: "reject",
      status: "partial",
      title: "Partial batch reject",
      detail: "Rejected 2 review events, skipped 1.",
      appliedCount: 2,
      skippedCount: 1,
      failures: [
        {
          id: "blk_stale",
          kind: "modified",
          reason: "stale-event",
          message: "Cannot reject modified blk_stale: review event is stale or already resolved."
        }
      ]
    });
  });

  it("projects broken reference diagnostics to inline marker css", () => {
    const css = renderBrokenReferenceRuntimeCss([{ id: "ref_missing", targetId: "blk_missing", label: "Missing", path: "1.0" }]);

    expect(css).toContain('.sdoc-cross-reference[data-id="ref_missing"]');
    expect(css).toContain("missing blk_missing");
  });

  it("detects broken cross references against current block ids", () => {
    const document: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_references" },
      content: [
        { type: "heading", attrs: { id: "blk_target", level: 1, anchor: "target" }, content: [{ type: "text", text: "Target" }] },
        {
          type: "paragraph",
          attrs: { id: "blk_refs" },
          content: [
            { type: "crossReference", attrs: { id: "ref_ok", targetId: "blk_target" }, content: [{ type: "text", text: "Target" }] },
            { type: "text", text: " and " },
            { type: "crossReference", attrs: { id: "ref_missing", targetId: "blk_missing" }, content: [{ type: "text", text: "Missing" }] }
          ]
        }
      ]
    };

    expect(createReferenceDiagnostics(document)).toEqual({
      targetCount: 2,
      referenceCount: 2,
      brokenCount: 1,
      staleCount: 0,
      label: "1 broken",
      targets: [
        { id: "blk_target", type: "heading", label: "Target", anchor: "target", humanId: undefined },
        { id: "blk_refs", type: "paragraph", label: "Target and Missing", anchor: undefined, humanId: undefined }
      ],
      brokenReferences: [
        {
          id: "ref_missing",
          targetId: "blk_missing",
          label: "Missing",
          path: "1.2",
          repairCandidates: [
            { targetId: "blk_refs", label: "Target and Missing", detail: "blk_refs", score: 55 },
            { targetId: "blk_target", label: "Target", detail: "#target / blk_target", score: 0 }
          ]
        }
      ],
      staleReferences: []
    });
  });

  it("detects and updates stale cross reference labels", () => {
    const document: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_stale_reference" },
      content: [
        { type: "heading", attrs: { id: "blk_target", level: 1 }, content: [{ type: "text", text: "Updated Target" }] },
        {
          type: "paragraph",
          attrs: { id: "blk_refs" },
          content: [
            { type: "crossReference", attrs: { id: "ref_target", targetId: "blk_target" }, content: [{ type: "text", text: "Old Target" }] }
          ]
        }
      ]
    };

    expect(createReferenceDiagnostics(document).staleReferences).toEqual([
      { id: "ref_target", targetId: "blk_target", label: "Old Target", targetLabel: "Updated Target", path: "1.0", repairCandidates: [] }
    ]);

    expect(createReferenceDiagnostics(updateCrossReferenceLabel(document, "ref_target", "Updated Target")).staleCount).toBe(0);
  });

  it("retargets and removes broken cross references as explicit authored changes", () => {
    const document: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_repair_reference" },
      content: [
        {
          type: "heading",
          attrs: { id: "blk_target", level: 1, anchor: "target", humanId: "REQ-OBC-012" },
          content: [{ type: "text", text: "Updated Target" }]
        },
        {
          type: "paragraph",
          attrs: { id: "blk_refs" },
          content: [
            { type: "text", text: "See " },
            { type: "crossReference", attrs: { id: "ref_missing", targetId: "blk_missing" }, content: [{ type: "text", text: "REQ-OBC-012" }] },
            { type: "text", text: " now." }
          ]
        }
      ]
    };

    const diagnostics = createReferenceDiagnostics(document);
    expect(diagnostics.brokenReferences[0].repairCandidates[0]).toEqual({
      targetId: "blk_target",
      label: "Updated Target",
      detail: "REQ-OBC-012 / #target / blk_target",
      score: 90
    });

    const repaired = retargetCrossReference(document, "ref_missing", diagnostics.targets[0]);
    expect(createReferenceDiagnostics(repaired).brokenCount).toBe(0);
    expect(createReferenceDiagnostics(repaired).staleCount).toBe(0);
    expect(JSON.stringify(repaired)).toContain('"targetId":"blk_target"');
    expect(JSON.stringify(repaired)).toContain('"text":"Updated Target"');

    const removed = removeCrossReference(document, "ref_missing");
    expect(JSON.stringify(removed)).not.toContain("ref_missing");
    expect(createReferenceDiagnostics(removed).referenceCount).toBe(0);
  });

  it("summarizes requirement traceability tags without using them as identity", () => {
    const document: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_traceability" },
      content: [
        { type: "heading", attrs: { id: "blk_tagged", humanId: "REQ-OBC-012", level: 1 }, content: [{ type: "text", text: "Tagged" }] },
        { type: "paragraph", attrs: { id: "blk_dup_a", humanId: "REQ-OBC-012" }, content: [{ type: "text", text: "Duplicate A" }] },
        { type: "paragraph", attrs: { id: "blk_format", humanId: "req lowercase" }, content: [{ type: "text", text: "Bad format" }] },
        { type: "heading", attrs: { id: "blk_missing", level: 2 }, content: [{ type: "text", text: "Missing tag" }] }
      ]
    };

    expect(createRequirementTraceability(document)).toEqual({
      taggedCount: 3,
      duplicateCount: 1,
      formatIssueCount: 1,
      coverageGapCount: 1,
      label: "3 trace issues",
      taggedBlocks: [
        { id: "blk_tagged", humanId: "REQ-OBC-012", type: "heading", label: "Tagged", path: "0" },
        { id: "blk_dup_a", humanId: "REQ-OBC-012", type: "paragraph", label: "Duplicate A", path: "1" },
        { id: "blk_format", humanId: "req lowercase", type: "paragraph", label: "Bad format", path: "2" }
      ],
      duplicateHumanIds: [
        {
          humanId: "REQ-OBC-012",
          severity: "warning",
          message: "REQ-OBC-012 appears on 2 blocks",
          blocks: [
            { id: "blk_tagged", humanId: "REQ-OBC-012", type: "heading", label: "Tagged", path: "0" },
            { id: "blk_dup_a", humanId: "REQ-OBC-012", type: "paragraph", label: "Duplicate A", path: "1" }
          ]
        }
      ],
      formatIssues: [
        {
          humanId: "req lowercase",
          severity: "warning",
          message: "req lowercase does not match the recommended tag pattern",
          blocks: [{ id: "blk_format", humanId: "req lowercase", type: "paragraph", label: "Bad format", path: "2" }]
        }
      ],
      coverageGaps: [{ id: "blk_missing", type: "heading", label: "Missing tag", path: "3" }]
    });
  });

  it("derives section fold ranges from heading levels and stable heading ids", () => {
    const document: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_fold" },
      content: [
        { type: "heading", attrs: { id: "h1", level: 1 }, content: [{ type: "text", text: "Overview" }] },
        { type: "paragraph", attrs: { id: "p1" }, content: [{ type: "text", text: "Intro" }] },
        { type: "heading", attrs: { id: "h2", level: 2 }, content: [{ type: "text", text: "Details" }] },
        { type: "paragraph", attrs: { id: "p2" }, content: [{ type: "text", text: "Detail" }] },
        { type: "heading", attrs: { id: "h1_next", level: 1 }, content: [{ type: "text", text: "Next" }] },
        { type: "paragraph", attrs: { id: "p3" }, content: [{ type: "text", text: "Next body" }] }
      ]
    };

    expect(createSectionFoldRanges(document)).toEqual([
      { headingId: "h1", headingLevel: 1, title: "Overview", hiddenBlockIds: ["p1", "h2", "p2"] },
      { headingId: "h2", headingLevel: 2, title: "Details", hiddenBlockIds: ["p2"] },
      { headingId: "h1_next", headingLevel: 1, title: "Next", hiddenBlockIds: ["p3"] }
    ]);
  });

  it("keeps stale collapsed section state out of the active fold set", () => {
    const ranges = [
      { headingId: "h1", headingLevel: 1, title: "Overview", hiddenBlockIds: ["p1"] },
      { headingId: "h2", headingLevel: 2, title: "Details", hiddenBlockIds: ["p2"] }
    ];

    expect([...pruneCollapsedHeadingIds(new Set(["h1", "missing"]), ranges)]).toEqual(["h1"]);
  });

  it("creates and caps local history snapshots", () => {
    const first = createLocalHistoryEntry(historyDocument, { title: "First" }, new Date("2026-07-02T00:00:00.000Z"), "hist_first");
    const second = createLocalHistoryEntry(historyDocument, { title: "Second" }, new Date("2026-07-02T00:01:00.000Z"), "hist_second");

    expect(first).toMatchObject({
      id: "hist_first",
      createdAt: "2026-07-02T00:00:00.000Z",
      title: "First",
      document: historyDocument,
      metadata: { title: "First" }
    });
    expect(addLocalHistoryEntry([first], second, 1)).toEqual([second]);
  });

  it("removes local history snapshots by id", () => {
    const first = createLocalHistoryEntry(historyDocument, { title: "First" }, new Date("2026-07-02T00:00:00.000Z"), "hist_first");
    const second = createLocalHistoryEntry(historyDocument, { title: "Second" }, new Date("2026-07-02T00:01:00.000Z"), "hist_second");

    expect(removeLocalHistoryEntry([first, second], "hist_first")).toEqual([second]);
    expect(removeLocalHistoryEntry([first], "hist_missing")).toEqual([first]);
  });

  it("renames local history snapshots without changing snapshot content", () => {
    const entry = createLocalHistoryEntry(historyDocument, { title: "Original" }, new Date("2026-07-02T00:00:00.000Z"), "hist_original");
    const renamed = renameLocalHistoryEntry([entry], "hist_original", "  Review Baseline  ");

    expect(renamed[0]).toEqual({
      ...entry,
      title: "Review Baseline"
    });
    expect(renamed[0].document).toBe(entry.document);
    expect(renamed[0].metadata).toBe(entry.metadata);
    expect(renameLocalHistoryEntry(renamed, "hist_original", "   ")[0].title).toBe("Untitled");
  });

  it("round-trips valid local history and ignores malformed storage", () => {
    const entry = createLocalHistoryEntry(historyDocument, { title: "Snapshot" }, new Date("2026-07-02T00:00:00.000Z"), "hist_snapshot");

    expect(parseLocalHistory(serializeLocalHistory([entry]))).toEqual([entry]);
    expect(parseLocalHistory("not json")).toEqual([]);
    expect(parseLocalHistory(JSON.stringify([{ id: "bad" }, entry]))).toEqual([entry]);
  });
});
