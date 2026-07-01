import { describe, expect, it } from "vitest";
import { diffDocuments, renderDiffEvents, renderReadableDiffEvents } from "./index";
import type { SDocDocument } from "@sdoc/schema";

const oldDocument: SDocDocument = {
  schemaVersion: 1,
  type: "doc",
  attrs: { id: "doc_test" },
  content: [
    {
      type: "heading",
      attrs: { id: "blk_intro", level: 1, anchor: "intro" },
      content: [{ type: "text", text: "Intro" }]
    },
    {
      type: "paragraph",
      attrs: { id: "blk_body" },
      content: [{ type: "text", text: "Old body" }]
    },
    {
      type: "paragraph",
      attrs: { id: "blk_removed" },
      content: [{ type: "text", text: "Remove me" }]
    }
  ]
};

const newDocument: SDocDocument = {
  schemaVersion: 1,
  type: "doc",
  attrs: { id: "doc_test" },
  content: [
    {
      type: "paragraph",
      attrs: { id: "blk_body" },
      content: [{ type: "text", text: "New body" }]
    },
    {
      type: "heading",
      attrs: { id: "blk_intro", level: 1, anchor: "intro" },
      content: [{ type: "text", text: "Intro" }]
    },
    {
      type: "paragraph",
      attrs: { id: "blk_added" },
      content: [
        { type: "text", text: "See " },
        { type: "crossReference", attrs: { id: "ref_missing", targetId: "blk_missing" } }
      ]
    }
  ]
};

describe("diffDocuments", () => {
  it("classifies add, delete, move, modify, and broken references", () => {
    const events = diffDocuments(oldDocument, newDocument);
    const lines = renderDiffEvents(events);

    expect(lines.some((line) => line.startsWith("DELETED paragraph blk_removed"))).toBe(true);
    expect(lines.some((line) => line.startsWith("ADDED paragraph blk_added"))).toBe(true);
    expect(events.some((event) => event.kind === "moved")).toBe(true);
    expect(lines.some((line) => line.startsWith("MODIFIED paragraph blk_body"))).toBe(true);
    expect(lines.some((line) => line.startsWith("BROKEN_REF crossReference ref_missing"))).toBe(true);
  });

  it("does not report moves when a new sibling only shifts indexes", () => {
    const oldShiftDocument: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_shift" },
      content: [
        { type: "paragraph", attrs: { id: "blk_a" }, content: [{ type: "text", text: "A" }] },
        { type: "paragraph", attrs: { id: "blk_b" }, content: [{ type: "text", text: "B" }] }
      ]
    };
    const newShiftDocument: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_shift" },
      content: [
        { type: "paragraph", attrs: { id: "blk_x" }, content: [{ type: "text", text: "X" }] },
        { type: "paragraph", attrs: { id: "blk_a" }, content: [{ type: "text", text: "A" }] },
        { type: "paragraph", attrs: { id: "blk_b" }, content: [{ type: "text", text: "B" }] }
      ]
    };

    const events = diffDocuments(oldShiftDocument, newShiftDocument);
    expect(events.filter((event) => event.kind === "moved")).toHaveLength(0);
    expect(events.some((event) => event.kind === "added" && event.id === "blk_x")).toBe(true);
  });

  it("does not cascade parent movement to nested child blocks", () => {
    const oldNestedDocument: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_nested" },
      content: [
        {
          type: "callout",
          attrs: { id: "blk_callout", kind: "note" },
          content: [
            { type: "paragraph", attrs: { id: "blk_child" }, content: [{ type: "text", text: "Nested" }] }
          ]
        },
        { type: "heading", attrs: { id: "blk_heading", level: 1 }, content: [{ type: "text", text: "Heading" }] }
      ]
    };
    const newNestedDocument: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_nested" },
      content: [
        { type: "heading", attrs: { id: "blk_heading", level: 1 }, content: [{ type: "text", text: "Heading" }] },
        {
          type: "callout",
          attrs: { id: "blk_callout", kind: "note" },
          content: [
            { type: "paragraph", attrs: { id: "blk_child" }, content: [{ type: "text", text: "Nested" }] }
          ]
        }
      ]
    };

    const movedIds = diffDocuments(oldNestedDocument, newNestedDocument)
      .filter((event) => event.kind === "moved")
      .map((event) => event.id);

    expect(movedIds).not.toContain("blk_child");
  });

  it("does not emit deleted child events when a parent block is deleted", () => {
    const oldParentDocument: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_parent_delete" },
      content: [
        {
          type: "callout",
          attrs: { id: "blk_callout", kind: "note" },
          content: [
            { type: "paragraph", attrs: { id: "blk_child" }, content: [{ type: "text", text: "Nested" }] }
          ]
        }
      ]
    };
    const newParentDocument: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_parent_delete" },
      content: []
    };

    const deletedIds = diffDocuments(oldParentDocument, newParentDocument)
      .filter((event) => event.kind === "deleted")
      .map((event) => event.id);

    expect(deletedIds).toEqual(["blk_callout"]);
  });

  it("does not emit added child events when a parent block is added", () => {
    const oldParentDocument: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_parent_add" },
      content: []
    };
    const newParentDocument: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_parent_add" },
      content: [
        {
          type: "callout",
          attrs: { id: "blk_callout", kind: "note" },
          content: [
            { type: "paragraph", attrs: { id: "blk_child" }, content: [{ type: "text", text: "Nested" }] }
          ]
        }
      ]
    };

    const addedIds = diffDocuments(oldParentDocument, newParentDocument)
      .filter((event) => event.kind === "added")
      .map((event) => event.id);

    expect(addedIds).toEqual(["blk_callout"]);
  });
});

describe("renderReadableDiffEvents", () => {
  it("renders review-friendly event lines", () => {
    expect(
      renderReadableDiffEvents([
        {
          kind: "added",
          id: "blk_add",
          nodeType: "codeBlock",
          path: "doc[0]/blk_add",
          label: '"New code"'
        },
        {
          kind: "moved",
          id: "blk_move",
          nodeType: "heading",
          fromPath: "doc[2]/blk_move",
          toPath: "doc[1]/blk_move",
          label: '"Moved heading"'
        },
        {
          kind: "reference-broken",
          id: "ref_missing",
          nodeType: "crossReference",
          path: "0.1",
          label: '"Missing section"',
          targetId: "blk_missing"
        }
      ])
    ).toEqual([
      'Added code block "New code" (blk_add) at doc[0]/blk_add',
      'Moved heading "Moved heading" (blk_move) from doc[2]/blk_move to doc[1]/blk_move',
      'Broken cross reference "Missing section" (ref_missing) at 0.1: missing blk_missing'
    ]);
  });
});
