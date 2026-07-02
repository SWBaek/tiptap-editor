import { describe, expect, it } from "vitest";
import { exportDerivedOutputs, exportMarkdown } from "./index";
import type { SDocDocument } from "@sdoc/schema";

const document: SDocDocument = {
  schemaVersion: 1,
  type: "doc",
  attrs: { id: "doc_export" },
  content: [
    {
      type: "heading",
      attrs: { id: "blk_h", level: 1, anchor: "overview" },
      content: [{ type: "text", text: "Overview" }]
    },
    {
      type: "paragraph",
      attrs: { id: "blk_p" },
      content: [
        { type: "text", text: "Read " },
        { type: "crossReference", attrs: { id: "ref_h", targetId: "blk_h" }, content: [{ type: "text", text: "the overview" }] },
        { type: "text", text: "." }
      ]
    }
  ]
};

describe("exportMarkdown", () => {
  it("exports headings, anchors, and cross references", () => {
    expect(exportMarkdown(document)).toContain("# Overview {#overview}");
    expect(exportMarkdown(document)).toContain("[the overview](#overview)");
  });

  it("uses block ids as fallback anchors for headings", () => {
    const withoutAnchor: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_export" },
      content: [
        {
          type: "heading",
          attrs: { id: "blk_heading", level: 2 },
          content: [{ type: "text", text: "No Anchor" }]
        },
        {
          type: "paragraph",
          attrs: { id: "blk_ref" },
          content: [
            {
              type: "crossReference",
              attrs: { id: "ref_heading", targetId: "blk_heading" },
              content: [{ type: "text", text: "heading" }]
            }
          ]
        }
      ]
    };

    const markdown = exportMarkdown(withoutAnchor);
    expect(markdown).toContain("## No Anchor {#blk_heading}");
    expect(markdown).toContain("[heading](#blk_heading)");
  });

  it("exports warning callouts as admonitions", () => {
    const withWarning: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_warning" },
      content: [
        {
          type: "callout",
          attrs: { id: "blk_warning", kind: "warning" },
          content: [{ type: "paragraph", attrs: { id: "blk_warning_body" }, content: [{ type: "text", text: "Watch the limit." }] }]
        }
      ]
    };

    expect(exportMarkdown(withWarning)).toContain("> [!WARNING]\n> Watch the limit.");
  });

  it("exports figures with asset links and captions", () => {
    const withFigure: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_figure" },
      content: [
        {
          type: "figure",
          attrs: { id: "blk_figure", assetId: "asset_architecture.png", alt: "Architecture" },
          content: [{ type: "paragraph", attrs: { id: "blk_caption" }, content: [{ type: "text", text: "System architecture" }] }]
        }
      ]
    };

    const markdown = exportMarkdown(withFigure);
    expect(markdown).toContain("![Architecture](assets/asset_architecture.png)");
    expect(markdown).toContain("_Figure: System architecture_");
  });

  it("exports simple tables as Markdown pipe tables", () => {
    const withTable = createTableDocument("Ready");

    expect(exportMarkdown(withTable)).toContain("| Name | Status |\n| --- | --- |\n| API | Ready |");
  });

  it("exports inline and block equations as Markdown math", () => {
    const markdown = exportMarkdown(createEquationDocument("E=mc^2", "a^2+b^2=c^2"));

    expect(markdown).toContain("Energy $E=mc^2$");
    expect(markdown).toContain("$$\na^2+b^2=c^2\n$$");
  });
});

describe("exportDerivedOutputs", () => {
  it("creates regenerable derived artifacts", () => {
    const outputs = exportDerivedOutputs(document);

    expect(outputs["plain.md"]).toContain("Overview");
    expect(outputs["outline.json"]).toContain("blk_h");
    expect(outputs["references.json"]).toContain("overview");
    expect(outputs["chunks.jsonl"]).toContain("blk_p");
  });

  it("includes figure captions in derived outputs", () => {
    const withFigure: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_figure" },
      content: [
        {
          type: "figure",
          attrs: { id: "blk_figure", assetId: "asset_architecture.png" },
          content: [{ type: "paragraph", attrs: { id: "blk_caption" }, content: [{ type: "text", text: "System architecture" }] }]
        }
      ]
    };

    const outputs = exportDerivedOutputs(withFigure);

    expect(outputs["plain.md"]).toContain("_Figure: System architecture_");
    expect(outputs["references.json"]).toContain('"type": "figure"');
    expect(outputs["chunks.jsonl"]).toContain('"type":"figure"');
    expect(outputs["chunks.jsonl"]).toContain("System architecture");
  });

  it("includes table text in derived outputs", () => {
    const outputs = exportDerivedOutputs(createTableDocument("Ready"));

    expect(outputs["plain.md"]).toContain("| Name | Status |");
    expect(outputs["plain.md"]).toContain("| API | Ready |");
    expect(outputs["references.json"]).toContain('"type": "table"');
    expect(outputs["chunks.jsonl"]).toContain("Ready");
  });

  it("includes equation source in derived outputs", () => {
    const outputs = exportDerivedOutputs(createEquationDocument("E=mc^2", "a^2+b^2=c^2"));

    expect(outputs["plain.md"]).toContain("Energy $E=mc^2$");
    expect(outputs["plain.md"]).toContain("$$\na^2+b^2=c^2\n$$");
    expect(outputs["references.json"]).toContain('"type": "equationBlock"');
    expect(outputs["chunks.jsonl"]).toContain("a^2+b^2=c^2");
  });
});

function createEquationDocument(inlineLatex: string, blockLatex: string): SDocDocument {
  return {
    schemaVersion: 1,
    type: "doc",
    attrs: { id: "doc_equation" },
    content: [
      {
        type: "paragraph",
        attrs: { id: "blk_equation_text" },
        content: [
          { type: "text", text: "Energy " },
          { type: "equation", attrs: { latex: inlineLatex } }
        ]
      },
      {
        type: "equationBlock",
        attrs: { id: "blk_equation", latex: blockLatex }
      }
    ]
  };
}

function createTableDocument(status: string): SDocDocument {
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
              createTableCell("tableCell", "blk_cell_api", "blk_cell_api_text", "API"),
              createTableCell("tableCell", "blk_cell_ready", "blk_cell_ready_text", status)
            ]
          }
        ]
      }
    ]
  };
}

function createTableCell(type: "tableCell" | "tableHeader", id: string, paragraphId: string, text: string) {
  return {
    type,
    attrs: { id },
    content: [{ type: "paragraph", attrs: { id: paragraphId }, content: [{ type: "text", text }] }]
  };
}
