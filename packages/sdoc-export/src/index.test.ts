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
});

describe("exportDerivedOutputs", () => {
  it("creates regenerable derived artifacts", () => {
    const outputs = exportDerivedOutputs(document);

    expect(outputs["plain.md"]).toContain("Overview");
    expect(outputs["outline.json"]).toContain("blk_h");
    expect(outputs["references.json"]).toContain("overview");
    expect(outputs["chunks.jsonl"]).toContain("blk_p");
  });
});
