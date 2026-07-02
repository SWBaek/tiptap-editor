import { describe, expect, it } from "vitest";
import { createBlockId, createDocumentId, createEmptyDocument, getPlainText, validateDocument } from "./index";

describe("validateDocument", () => {
  it("accepts the minimal document", () => {
    const result = validateDocument(createEmptyDocument("doc_test"));
    expect(result.ok).toBe(true);
  });

  it("rejects duplicate block ids", () => {
    const document = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_test" },
      content: [
        { type: "paragraph", attrs: { id: "blk_dup" }, content: [{ type: "text", text: "A" }] },
        { type: "paragraph", attrs: { id: "blk_dup" }, content: [{ type: "text", text: "B" }] }
      ]
    };

    const result = validateDocument(document);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("duplicate block id"))).toBe(true);
  });

  it("accepts a figure with an asset reference and caption", () => {
    const document = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_test" },
      content: [
        {
          type: "figure",
          attrs: { id: "blk_figure", assetId: "asset_architecture.png", alt: "Architecture" },
          content: [{ type: "paragraph", attrs: { id: "blk_caption" }, content: [{ type: "text", text: "System diagram" }] }]
        }
      ]
    };

    const result = validateDocument(document);
    expect(result.ok).toBe(true);
  });

  it("rejects figures without an asset reference or caption", () => {
    const document = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_test" },
      content: [{ type: "figure", attrs: { id: "blk_figure" }, content: [] }]
    };

    const result = validateDocument(document);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("figure assetId is required"))).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes("figure caption paragraph is required"))).toBe(true);
  });

  it("accepts a simple table with rows and cells", () => {
    const document = {
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
                {
                  type: "tableHeader",
                  attrs: { id: "blk_header_name" },
                  content: [{ type: "paragraph", attrs: { id: "blk_header_name_text" }, content: [{ type: "text", text: "Name" }] }]
                },
                {
                  type: "tableHeader",
                  attrs: { id: "blk_header_status" },
                  content: [{ type: "paragraph", attrs: { id: "blk_header_status_text" }, content: [{ type: "text", text: "Status" }] }]
                }
              ]
            },
            {
              type: "tableRow",
              attrs: { id: "blk_row_body" },
              content: [
                {
                  type: "tableCell",
                  attrs: { id: "blk_cell_api" },
                  content: [{ type: "paragraph", attrs: { id: "blk_cell_api_text" }, content: [{ type: "text", text: "API" }] }]
                },
                {
                  type: "tableCell",
                  attrs: { id: "blk_cell_ready" },
                  content: [{ type: "paragraph", attrs: { id: "blk_cell_ready_text" }, content: [{ type: "text", text: "Ready" }] }]
                }
              ]
            }
          ]
        }
      ]
    };

    const result = validateDocument(document);
    expect(result.ok).toBe(true);
  });

  it("rejects malformed table structure", () => {
    const document = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_table_bad" },
      content: [
        {
          type: "table",
          attrs: { id: "blk_table" },
          content: [{ type: "paragraph", attrs: { id: "blk_wrong" }, content: [{ type: "text", text: "Wrong" }] }]
        }
      ]
    };

    const result = validateDocument(document);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("table child must be tableRow"))).toBe(true);
  });

  it("accepts inline and block equations with latex source", () => {
    const document = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_equation" },
      content: [
        {
          type: "paragraph",
          attrs: { id: "blk_paragraph" },
          content: [
            { type: "text", text: "Energy " },
            { type: "equation", attrs: { latex: "E=mc^2" } }
          ]
        },
        {
          type: "equationBlock",
          attrs: { id: "blk_equation", latex: "a^2+b^2=c^2" }
        }
      ]
    };

    const result = validateDocument(document);
    expect(result.ok).toBe(true);
    expect(getPlainText(document.content[0])).toBe("Energy E=mc^2");
    expect(getPlainText(document.content[1])).toBe("a^2+b^2=c^2");
  });

  it("rejects equations without latex source", () => {
    const document = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_equation_bad" },
      content: [
        { type: "paragraph", attrs: { id: "blk_paragraph" }, content: [{ type: "equation", attrs: { latex: "" } }] },
        { type: "equationBlock", attrs: { id: "blk_equation" } }
      ]
    };

    const result = validateDocument(document);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("equation latex is required"))).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes("equationBlock latex is required"))).toBe(true);
  });

  it("accepts Mermaid diagrams with source text", () => {
    const document = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_diagram" },
      content: [
        {
          type: "diagram",
          attrs: {
            id: "blk_diagram",
            kind: "mermaid",
            source: "flowchart TD\nA[Start] --> B[Done]"
          }
        }
      ]
    };

    const result = validateDocument(document);
    expect(result.ok).toBe(true);
    expect(getPlainText(document.content[0])).toBe("flowchart TD\nA[Start] --> B[Done]");
  });

  it("rejects diagrams without Mermaid kind or source", () => {
    const document = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_diagram_bad" },
      content: [{ type: "diagram", attrs: { id: "blk_diagram", kind: "drawio", source: "" } }]
    };

    const result = validateDocument(document);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("diagram kind must be mermaid"))).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes("diagram source is required"))).toBe(true);
  });

  it("rejects nodes outside the current scope", () => {
    const document = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_test" },
      content: [{ type: "drawioDiagram", attrs: { id: "blk_future" }, content: [] }]
    };

    const result = validateDocument(document);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("unsupported node type: drawioDiagram"))).toBe(true);
  });

  it("rejects marks outside the v1 scope", () => {
    const document = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_test" },
      content: [
        {
          type: "paragraph",
          attrs: { id: "blk_text" },
          content: [{ type: "text", text: "A", marks: [{ type: "customMark" }] }]
        }
      ]
    };

    const result = validateDocument(document);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("unsupported mark type: customMark"))).toBe(true);
  });
});

describe("id generation", () => {
  it("creates prefixed opaque ids without collisions in a small sample", () => {
    const documentId = createDocumentId();
    const blockIds = Array.from({ length: 100 }, () => createBlockId());

    expect(documentId.startsWith("doc_")).toBe(true);
    expect(blockIds.every((id) => id.startsWith("blk_"))).toBe(true);
    expect(new Set(blockIds).size).toBe(blockIds.length);
  });
});
