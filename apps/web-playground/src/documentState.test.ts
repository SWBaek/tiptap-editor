import { describe, expect, it } from "vitest";
import {
  addLocalHistoryEntry,
  createChangeReview,
  createLocalHistoryEntry,
  createReferenceDiagnostics,
  createSectionFoldRanges,
  getFileLabel,
  getSavedLabel,
  getValidationFailureMessage,
  isMetadataDirty,
  parseLocalHistory,
  pruneCollapsedHeadingIds,
  renameLocalHistoryEntry,
  removeLocalHistoryEntry,
  renderDiffPreview,
  renderMetadataDiff,
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
        { id: "blk_target", type: "heading", label: "Target", anchor: "target" },
        { id: "blk_refs", type: "paragraph", label: "Target and Missing", anchor: undefined }
      ],
      brokenReferences: [{ id: "ref_missing", targetId: "blk_missing", label: "Missing", path: "1.2" }],
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
      { id: "ref_target", targetId: "blk_target", label: "Old Target", targetLabel: "Updated Target", path: "1.0" }
    ]);

    expect(createReferenceDiagnostics(updateCrossReferenceLabel(document, "ref_target", "Updated Target")).staleCount).toBe(0);
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
