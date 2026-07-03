import { describe, expect, it } from "vitest";
import { applyDiffEventAcceptanceToBaseline, applyDiffEventAction, diffDocuments, renderDiffEvents, renderReadableDiffEvents } from "./index";
import { getPlainText, validateDocument, type SDocDocument } from "@sdoc/schema";

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

  it("summarizes text modifications with word-level markers", () => {
    const modified = diffDocuments(oldDocument, newDocument).find((event) => event.kind === "modified" && event.id === "blk_body");

    expect(modified?.kind).toBe("modified");
    expect(modified?.kind === "modified" ? modified.changes : []).toContain('text changed "[-Old-] [+New+] body"');
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

  it("summarizes table cell changes at the table block", () => {
    const oldTableDocument = createTableDocument("Draft");
    const newTableDocument = createTableDocument("Ready");
    const events = diffDocuments(oldTableDocument, newTableDocument);
    const modified = events.find((event) => event.kind === "modified" && event.id === "blk_table");

    expect(modified?.kind).toBe("modified");
    expect(modified?.kind === "modified" ? modified.changes : []).toContain('cell 2,2 changed "Draft" -> "Ready"');
    expect(events.some((event) => event.kind === "modified" && event.id !== "blk_table")).toBe(false);
    expect(renderReadableDiffEvents(events)).toContain('Modified table "table 2x2" (blk_table) at doc_table[0]/blk_table: cell 2,2 changed "Draft" -> "Ready"');
  });

  it("summarizes table header role and alignment changes at the table block", () => {
    const oldTableDocument = createTableDocument("Ready");
    const newTableDocument = createTableDocument("Ready", { statusAlign: "right", firstBodyCellType: "tableHeader" });
    const modified = diffDocuments(oldTableDocument, newTableDocument).find(
      (event) => event.kind === "modified" && event.id === "blk_table"
    );

    expect(modified?.kind).toBe("modified");
    expect(modified?.kind === "modified" ? modified.changes : []).toContain("cell 2,1 role changed tableCell -> tableHeader");
    expect(modified?.kind === "modified" ? modified.changes : []).toContain('cell 2,2 alignment changed "" -> "right"');
  });

  it("summarizes block equation source changes", () => {
    const oldEquationDocument = createEquationDocument("E=mc^2");
    const newEquationDocument = createEquationDocument("F=ma");
    const modified = diffDocuments(oldEquationDocument, newEquationDocument).find(
      (event) => event.kind === "modified" && event.id === "blk_equation"
    );

    expect(modified?.kind).toBe("modified");
    expect(modified?.kind === "modified" ? modified.changes : []).toEqual(['text changed "[-E=mc^2-] [+F=ma+]"']);
  });

  it("summarizes Mermaid diagram source changes", () => {
    const oldDiagramDocument = createDiagramDocument("flowchart TD\nA --> B");
    const newDiagramDocument = createDiagramDocument("flowchart TD\nA --> C");
    const modified = diffDocuments(oldDiagramDocument, newDiagramDocument).find(
      (event) => event.kind === "modified" && event.id === "blk_diagram"
    );

    expect(modified?.kind).toBe("modified");
    expect(modified?.kind === "modified" ? modified.changes : []).toEqual(['text changed "flowchart TD A --> [-B-] [+C+]"']);
  });

  it("summarizes Draw.io diagram asset reference changes without XML diffing", () => {
    const oldDiagramDocument = createDrawioDocument("asset_architecture.drawio", "asset_architecture.svg");
    const newDiagramDocument = createDrawioDocument("asset_architecture_v2.drawio", "asset_architecture_v2.svg");
    const modified = diffDocuments(oldDiagramDocument, newDiagramDocument).find(
      (event) => event.kind === "modified" && event.id === "blk_drawio"
    );

    expect(modified?.kind).toBe("modified");
    expect(modified?.kind === "modified" ? modified.changes : []).toEqual([
      'source asset changed "asset_architecture.drawio" -> "asset_architecture_v2.drawio"',
      'preview asset changed "asset_architecture.svg" -> "asset_architecture_v2.svg"'
    ]);
  });

  it("summarizes dataGrid asset reference changes without row-level diffing", () => {
    const oldGridDocument = createDataGridDocument("asset_pinout.csv", "MCU Pinout");
    const newGridDocument = createDataGridDocument("asset_pinout_v2.csv", "MCU Pinout v2");
    const modified = diffDocuments(oldGridDocument, newGridDocument).find(
      (event) => event.kind === "modified" && event.id === "blk_grid"
    );

    expect(modified?.kind).toBe("modified");
    expect(modified?.kind === "modified" ? modified.changes : []).toEqual([
      'source asset changed "asset_pinout.csv" -> "asset_pinout_v2.csv"',
      'title changed "MCU Pinout" -> "MCU Pinout v2"'
    ]);
  });

  it("summarizes human-facing id changes while matching by stable block id", () => {
    const oldReqDocument: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_req" },
      content: [{ type: "paragraph", attrs: { id: "blk_body", humanId: "REQ-OBC-001" }, content: [{ type: "text", text: "Requirement" }] }]
    };
    const newReqDocument: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_req" },
      content: [{ type: "paragraph", attrs: { id: "blk_body", humanId: "REQ-OBC-002" }, content: [{ type: "text", text: "Requirement" }] }]
    };

    const modified = diffDocuments(oldReqDocument, newReqDocument).find((event) => event.kind === "modified" && event.id === "blk_body");

    expect(modified?.kind).toBe("modified");
    expect(modified?.kind === "modified" ? modified.changes : []).toEqual(['humanId changed "REQ-OBC-001" -> "REQ-OBC-002"']);
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

describe("applyDiffEventAction", () => {
  it("rejects an added block by removing it from the canonical document", () => {
    const event = diffDocuments(oldDocument, newDocument).find((candidate) => candidate.kind === "added" && candidate.id === "blk_added");
    expect(event).toBeDefined();

    const result = applyDiffEventAction(oldDocument, newDocument, event!, "reject");

    expect(result.ok).toBe(true);
    expect(result.ok ? result.status : undefined).toBe("rejected-added");
    expect(result.ok ? result.changed : false).toBe(true);
    expect(result.ok ? result.document.content.some((node) => node.attrs?.id === "blk_added") : true).toBe(false);
    expect(result.ok ? validateDocument(result.document).ok : false).toBe(true);
  });

  it("rejects a deleted block by restoring the baseline block at the baseline position", () => {
    const event = diffDocuments(oldDocument, newDocument).find((candidate) => candidate.kind === "deleted" && candidate.id === "blk_removed");
    expect(event).toBeDefined();

    const result = applyDiffEventAction(oldDocument, newDocument, event!, "reject");

    expect(result.ok).toBe(true);
    expect(result.ok ? result.status : undefined).toBe("rejected-deleted");
    expect(result.ok ? result.document.content.map((node) => node.attrs?.id) : []).toContain("blk_removed");
    expect(result.ok ? getPlainText(result.document.content[2]) : "").toBe("Remove me");
    expect(result.ok ? validateDocument(result.document).ok : false).toBe(true);
  });

  it("rejects a modified block by restoring baseline attrs and content for the same stable id", () => {
    const event = diffDocuments(oldDocument, newDocument).find((candidate) => candidate.kind === "modified" && candidate.id === "blk_body");
    expect(event).toBeDefined();

    const result = applyDiffEventAction(oldDocument, newDocument, event!, "reject");

    expect(result.ok).toBe(true);
    const restored = result.ok ? result.document.content.find((node) => node.attrs?.id === "blk_body") : undefined;
    expect(restored?.attrs?.id).toBe("blk_body");
    expect(restored ? getPlainText(restored) : "").toBe("Old body");
    expect(result.ok ? validateDocument(result.document).ok : false).toBe(true);
  });

  it("rejects a moved block by restoring the baseline sibling order", () => {
    const event = diffDocuments(oldDocument, newDocument).find((candidate) => candidate.kind === "moved" && candidate.id === "blk_intro");
    expect(event).toBeDefined();

    const result = applyDiffEventAction(oldDocument, newDocument, event!, "reject");

    expect(result.ok).toBe(true);
    expect(result.ok ? result.status : undefined).toBe("rejected-moved");
    expect(result.ok ? result.document.content.map((node) => node.attrs?.id) : []).toEqual(["blk_intro", "blk_body", "blk_added"]);
    expect(result.ok ? validateDocument(result.document).ok : false).toBe(true);
  });

  it("accepts a current event without adding review state to the document", () => {
    const event = diffDocuments(oldDocument, newDocument).find((candidate) => candidate.kind === "modified" && candidate.id === "blk_body");
    expect(event).toBeDefined();

    const result = applyDiffEventAction(oldDocument, newDocument, event!, "accept");

    expect(result).toMatchObject({ ok: true, status: "accepted-current", changed: false });
    expect(result.ok ? result.document : null).toEqual(newDocument);
  });

  it("accepts a modified event into the review baseline so only unrelated changes remain", () => {
    const event = diffDocuments(oldDocument, newDocument).find((candidate) => candidate.kind === "modified" && candidate.id === "blk_body");
    expect(event).toBeDefined();

    const result = applyDiffEventAcceptanceToBaseline(oldDocument, newDocument, event!);

    expect(result.ok).toBe(true);
    expect(result.ok ? result.status : undefined).toBe("accepted-modified");
    const remainingEvents = result.ok ? diffDocuments(result.document, newDocument) : [];
    expect(remainingEvents.some((candidate) => candidate.kind === "modified" && candidate.id === "blk_body")).toBe(false);
    expect(remainingEvents.some((candidate) => candidate.kind === "added" && candidate.id === "blk_added")).toBe(true);
  });

  it("accepts added, deleted, and moved events into the review baseline", () => {
    let reviewBaseline = oldDocument;
    for (const event of diffDocuments(reviewBaseline, newDocument).filter((candidate) =>
      (candidate.kind === "added" && candidate.id === "blk_added") ||
      (candidate.kind === "deleted" && candidate.id === "blk_removed") ||
      (candidate.kind === "moved" && candidate.id === "blk_intro")
    )) {
      const result = applyDiffEventAcceptanceToBaseline(reviewBaseline, newDocument, event);
      expect(result.ok).toBe(true);
      if (result.ok) {
        reviewBaseline = result.document;
      }
    }

    const remainingEvents = diffDocuments(reviewBaseline, newDocument);
    expect(remainingEvents.some((candidate) => candidate.kind === "added" && candidate.id === "blk_added")).toBe(false);
    expect(remainingEvents.some((candidate) => candidate.kind === "deleted" && candidate.id === "blk_removed")).toBe(false);
    expect(remainingEvents.some((candidate) => candidate.kind === "moved" && candidate.id === "blk_intro")).toBe(false);
  });

  it("routes broken references to explicit repair workflows instead of direct accept/reject", () => {
    const event = diffDocuments(oldDocument, newDocument).find((candidate) => candidate.kind === "reference-broken");
    expect(event).toBeDefined();

    const result = applyDiffEventAction(oldDocument, newDocument, event!, "reject");

    expect(result).toMatchObject({
      ok: false,
      reason: "unsupported-event",
      message: "Broken references require explicit retarget or remove actions from the References repair workflow."
    });
  });

  it("refuses stale review events when current content no longer matches the reviewed diff", () => {
    const event = diffDocuments(oldDocument, newDocument).find((candidate) => candidate.kind === "modified" && candidate.id === "blk_body");
    expect(event).toBeDefined();
    const staleCurrent: SDocDocument = {
      ...newDocument,
      content: newDocument.content.map((node) =>
        node.attrs?.id === "blk_body" ? { ...node, content: [{ type: "text", text: "Edited again" }] } : node
      )
    };

    const result = applyDiffEventAction(oldDocument, staleCurrent, event!, "reject");

    expect(result).toMatchObject({
      ok: false,
      reason: "stale-event"
    });
  });
});

function createTableDocument(
  status: string,
  options: { statusAlign?: "left" | "center" | "right"; firstBodyCellType?: "tableCell" | "tableHeader" } = {}
): SDocDocument {
  return {
    schemaVersion: 1,
    type: "doc",
    attrs: { id: "doc_table" },
    content: [
      {
        type: "table",
        attrs: { id: "blk_table" },
        content: [
          {
            type: "tableRow",
            attrs: { id: "blk_row_header" },
            content: [
              createTableCell("tableHeader", "blk_header_name", "blk_header_name_text", "Name"),
              createTableCell("tableHeader", "blk_header_status", "blk_header_status_text", "Status")
            ]
          },
          {
            type: "tableRow",
            attrs: { id: "blk_row_body" },
            content: [
              createTableCell(options.firstBodyCellType ?? "tableCell", "blk_cell_api", "blk_cell_api_text", "API"),
              createTableCell("tableCell", "blk_cell_status", "blk_cell_status_text", status, options.statusAlign)
            ]
          }
        ]
      }
    ]
  };
}

function createTableCell(
  type: "tableCell" | "tableHeader",
  id: string,
  paragraphId: string,
  text: string,
  align?: "left" | "center" | "right"
) {
  return {
    type,
    attrs: { id, ...(align ? { align } : {}) },
    content: [{ type: "paragraph", attrs: { id: paragraphId }, content: [{ type: "text", text }] }]
  };
}

function createEquationDocument(latex: string): SDocDocument {
  return {
    schemaVersion: 1,
    type: "doc",
    attrs: { id: "doc_equation" },
    content: [{ type: "equationBlock", attrs: { id: "blk_equation", latex } }]
  };
}

function createDiagramDocument(source: string): SDocDocument {
  return {
    schemaVersion: 1,
    type: "doc",
    attrs: { id: "doc_diagram" },
    content: [{ type: "diagram", attrs: { id: "blk_diagram", kind: "mermaid", source } }]
  };
}

function createDrawioDocument(sourceAssetId: string, previewAssetId?: string): SDocDocument {
  return {
    schemaVersion: 1,
    type: "doc",
    attrs: { id: "doc_drawio" },
    content: [
      {
        type: "diagram",
        attrs: {
          id: "blk_drawio",
          kind: "drawio",
          sourceAssetId,
          ...(previewAssetId ? { previewAssetId } : {})
        }
      }
    ]
  };
}

function createDataGridDocument(sourceAssetId: string, title: string): SDocDocument {
  return {
    schemaVersion: 1,
    type: "doc",
    attrs: { id: "doc_grid" },
    content: [
      {
        type: "dataGrid",
        attrs: {
          id: "blk_grid",
          sourceAssetId,
          format: "csv",
          title
        }
      }
    ]
  };
}
