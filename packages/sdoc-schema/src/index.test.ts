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

  it("accepts optional human-facing requirement ids and rejects empty values", () => {
    expect(
      validateDocument({
        schemaVersion: 1,
        type: "doc",
        attrs: { id: "doc_human_id" },
        content: [{ type: "paragraph", attrs: { id: "blk_req", humanId: "REQ-OBC-012" }, content: [{ type: "text", text: "Requirement" }] }]
      }).ok
    ).toBe(true);

    const result = validateDocument({
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_bad_human_id" },
      content: [{ type: "paragraph", attrs: { id: "blk_req", humanId: "   " }, content: [{ type: "text", text: "Requirement" }] }]
    });

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("humanId must be a non-empty string"))).toBe(true);
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

  it("accepts semantic table cell alignment", () => {
    const document = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_table_align" },
      content: [
        {
          type: "table",
          attrs: { id: "blk_table" },
          content: [
            {
              type: "tableRow",
              attrs: { id: "blk_row" },
              content: [
                {
                  type: "tableCell",
                  attrs: { id: "blk_cell", align: "center" },
                  content: [{ type: "paragraph", attrs: { id: "blk_cell_text" }, content: [{ type: "text", text: "Centered" }] }]
                }
              ]
            }
          ]
        }
      ]
    };

    expect(validateDocument(document).ok).toBe(true);
  });

  it("accepts optional authored table captions", () => {
    const document = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_table_caption" },
      content: [
        {
          type: "table",
          attrs: { id: "blk_table", caption: "API readiness matrix" },
          content: [
            {
              type: "tableRow",
              attrs: { id: "blk_row" },
              content: [
                {
                  type: "tableCell",
                  attrs: { id: "blk_cell" },
                  content: [{ type: "paragraph", attrs: { id: "blk_cell_text" }, content: [{ type: "text", text: "Ready" }] }]
                }
              ]
            }
          ]
        }
      ]
    };

    expect(validateDocument(document).ok).toBe(true);
  });

  it("rejects blank table captions", () => {
    const document = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_table_caption_bad" },
      content: [
        {
          type: "table",
          attrs: { id: "blk_table", caption: "   " },
          content: [
            {
              type: "tableRow",
              attrs: { id: "blk_row" },
              content: [
                {
                  type: "tableCell",
                  attrs: { id: "blk_cell" },
                  content: [{ type: "paragraph", attrs: { id: "blk_cell_text" }, content: [{ type: "text", text: "Ready" }] }]
                }
              ]
            }
          ]
        }
      ]
    };

    const result = validateDocument(document);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("table caption must be a non-empty string"))).toBe(true);
  });

  it("rejects unsupported table cell alignment", () => {
    const document = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_table_align_bad" },
      content: [
        {
          type: "table",
          attrs: { id: "blk_table" },
          content: [
            {
              type: "tableRow",
              attrs: { id: "blk_row" },
              content: [
                {
                  type: "tableHeader",
                  attrs: { id: "blk_cell", align: "justify" },
                  content: [{ type: "paragraph", attrs: { id: "blk_cell_text" }, content: [{ type: "text", text: "Bad" }] }]
                }
              ]
            }
          ]
        }
      ]
    };

    const result = validateDocument(document);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("tableHeader align must be left, center, or right"))).toBe(true);
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
    expect(result.issues.some((issue) => issue.message.includes("Draw.io diagram sourceAssetId is required"))).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes("Draw.io diagram source must be stored as an asset reference"))).toBe(false);
  });

  it("accepts Draw.io diagrams with asset-backed source references", () => {
    const document = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_drawio" },
      content: [
        {
          type: "diagram",
          attrs: {
            id: "blk_drawio",
            kind: "drawio",
            sourceAssetId: "asset_architecture.drawio",
            previewAssetId: "asset_architecture.svg"
          }
        }
      ]
    };

    const result = validateDocument(document);
    expect(result.ok).toBe(true);
    expect(getPlainText(document.content[0])).toBe("asset_architecture.drawio");
  });

  it("rejects Draw.io diagrams with embedded source text", () => {
    const document = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_drawio_bad" },
      content: [
        {
          type: "diagram",
          attrs: {
            id: "blk_drawio",
            kind: "drawio",
            sourceAssetId: "asset_architecture.drawio",
            source: "<mxfile>embedded</mxfile>"
          }
        }
      ]
    };

    const result = validateDocument(document);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("Draw.io diagram source must be stored as an asset reference"))).toBe(true);
  });

  it("rejects unsupported diagram kinds", () => {
    const document = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_diagram_bad_kind" },
      content: [{ type: "diagram", attrs: { id: "blk_diagram", kind: "plantuml", source: "@startuml\n@enduml" } }]
    };

    const result = validateDocument(document);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("diagram kind must be mermaid or drawio"))).toBe(true);
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

  it("accepts asset-backed dataGrid nodes without embedded grid rows", () => {
    const document = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_test" },
      content: [
        {
          type: "dataGrid",
          attrs: {
            id: "blk_grid",
            sourceAssetId: "asset_pinout.csv",
            format: "csv",
            title: "MCU Pinout",
            caption: "Connector J1 signal assignment",
            keyColumns: ["pin"]
          }
        }
      ]
    };

    const result = validateDocument(document);
    expect(result.ok).toBe(true);
    expect(getPlainText(document.content[0])).toContain("MCU Pinout");
    expect(getPlainText(document.content[0])).toContain("asset_pinout.csv");
  });

  it("rejects invalid dataGrid keyColumns metadata", () => {
    const document = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_test" },
      content: [
        {
          type: "dataGrid",
          attrs: {
            id: "blk_grid",
            sourceAssetId: "asset_pinout.csv",
            format: "csv",
            keyColumns: ["pin", "PIN", ""]
          }
        }
      ]
    };

    const result = validateDocument(document);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("dataGrid keyColumns duplicates PIN"))).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes("dataGrid keyColumns entries must be non-empty strings"))).toBe(true);
  });

  it("rejects dataGrid nodes that embed raw rows in document.json", () => {
    const document = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_test" },
      content: [
        {
          type: "dataGrid",
          attrs: { id: "blk_grid", sourceAssetId: "asset_pinout.csv", format: "csv" },
          content: [{ type: "text", text: "pin,signal\n1,VCC" }]
        }
      ]
    };

    const result = validateDocument(document);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("dataGrid content must not store grid rows"))).toBe(true);
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

  it("accepts attribute-free subscript and superscript marks", () => {
    const document = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_test" },
      content: [
        {
          type: "paragraph",
          attrs: { id: "blk_text" },
          content: [
            { type: "text", text: "2", marks: [{ type: "subscript" }] },
            { type: "text", text: "2", marks: [{ type: "superscript" }] }
          ]
        }
      ]
    };

    expect(validateDocument(document).ok).toBe(true);
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
