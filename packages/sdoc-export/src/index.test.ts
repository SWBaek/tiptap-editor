import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  createDataGridPreview,
  createPptxSlideModel,
  exportDerivedOutputs,
  exportDocx,
  exportHtml,
  exportMarkdown,
  exportPptx,
  validateWordTemplateMapping,
  validateWordTemplatePackage
} from "./index";
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

  it("includes human-facing ids in AI/RAG derived outputs", () => {
    const withHumanId: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_req" },
      content: [
        {
          type: "paragraph",
          attrs: { id: "blk_req", humanId: "REQ-OBC-012" },
          content: [{ type: "text", text: "The converter shall report faults." }]
        }
      ]
    };

    const outputs = exportDerivedOutputs(withHumanId);
    expect(outputs["chunks.jsonl"]).toContain('"humanId":"REQ-OBC-012"');
    expect(outputs["references.json"]).toContain('"humanId": "REQ-OBC-012"');
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

  it("exports authored table captions to Markdown and HTML", () => {
    const withCaption = createTableDocument("Ready", undefined, "API readiness matrix");

    expect(exportMarkdown(withCaption)).toContain("_Table: API readiness matrix_");
    expect(exportHtml(withCaption)).toContain("<caption>API readiness matrix</caption>");
  });

  it("exports table cell alignment to Markdown and HTML", () => {
    const withAlignedTable = createTableDocument("Ready", "center");

    expect(exportMarkdown(withAlignedTable)).toContain("| Name | Status |\n| --- | :---: |\n| API | Ready |");
    expect(exportHtml(withAlignedTable)).toContain('<td style="text-align: center"><p>Ready</p></td>');
  });

  it("exports inline and block equations as Markdown math", () => {
    const markdown = exportMarkdown(createEquationDocument("E=mc^2", "a^2+b^2=c^2"));

    expect(markdown).toContain("Energy $E=mc^2$");
    expect(markdown).toContain("$$\na^2+b^2=c^2\n$$");
  });

  it("exports Mermaid diagrams as fenced source blocks", () => {
    expect(exportMarkdown(createDiagramDocument())).toContain("```mermaid\nflowchart TD\nA[Start] --> B[Done]\n```");
  });

  it("exports Draw.io diagrams as asset-backed references", () => {
    const markdown = exportMarkdown(createDrawioDocument());

    expect(markdown).toContain("![Draw.io diagram](assets/asset_architecture.svg)");
    expect(markdown).toContain("_Draw.io source: assets/asset_architecture.drawio_");
    expect(markdown).not.toContain("<mxfile");
  });

  it("exports dataGrid nodes as asset-backed references", () => {
    const markdown = exportMarkdown(createDataGridDocument());

    expect(markdown).toContain("> Data grid: MCU Pinout");
    expect(markdown).toContain("> Source: assets/asset_pinout.csv");
    expect(markdown).toContain("> Key columns: pin");
    expect(markdown).not.toContain("pin,signal");
  });
});

describe("exportHtml", () => {
  it("exports a complete themed HTML document with anchors and cross references", () => {
    const html = exportHtml(document, { title: "Published Spec" });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>Published Spec</title>");
    expect(html).toContain('<main class="sdoc-document">');
    expect(html).toContain('<h1 id="overview">Overview</h1>');
    expect(html).toContain('<a href="#overview">the overview</a>');
    expect(html).toContain(".sdoc-document");
  });

  it("includes print stylesheet rules for PDF-friendly output", () => {
    const html = exportHtml(document);

    expect(html).toContain("@media print");
    expect(html).toContain("@page");
    expect(html).toContain("break-inside: avoid;");
    expect(html).toContain('a[href^="http"]::after');
  });

  it("renders publishing style profiles without mutating canonical content", () => {
    const html = exportHtml(document, { styleProfile: "ieee" });

    expect(html).toContain('class="sdoc-profile-ieee"');
    expect(html).toContain('--sdoc-body-font: "Times New Roman", Times, serif;');
    expect(html).toContain("text-transform: uppercase;");
    expect(JSON.stringify(document)).not.toContain("sdoc-profile-ieee");
  });

  it("renders custom HTML export chrome and typography outside document.json", () => {
    const html = exportHtml(document, {
      customStyle: {
        logoDataUrl: "data:image/png;base64,abc",
        logoAlt: "Company",
        headerText: "Engineering Release",
        footerText: "Internal review",
        typography: {
          bodyFont: "Arial, sans-serif",
          baseFontSize: "14px"
        },
        css: "    .sdoc-document { border-color: #123456; }"
      }
    });

    expect(html).toContain('class="sdoc-profile-modern"');
    expect(html).toContain('class="sdoc-profile-header"');
    expect(html).toContain('alt="Company"');
    expect(html).toContain("Engineering Release");
    expect(html).toContain("Internal review");
    expect(html).toContain("--sdoc-body-font: Arial, sans-serif;");
    expect(html).toContain("border-color: #123456;");
    expect(JSON.stringify(document)).not.toContain("Engineering Release");
  });

  it("renders a controlled corporate template without changing document content", () => {
    const html = exportHtml(document, {
      title: "Controlled Spec",
      template: "controlled",
      metadata: {
        documentNumber: "DOC-OBC-001",
        version: "A",
        author: "Power Electronics",
        classification: "Internal",
        approvalStatus: "Approved",
        effectiveDate: "2026-07-03"
      }
    });

    expect(html).toContain('class="sdoc-profile-modern sdoc-corporate-template sdoc-corporate-template-controlled"');
    expect(html).toContain('aria-label="Corporate document control"');
    expect(html).toContain("DOC-OBC-001");
    expect(html).toContain("Approved");
    expect(html).toContain("Internal");
    expect(html).toContain('<main class="sdoc-document">');
    expect(html).toContain('<h1 id="overview">Overview</h1>');
    expect(JSON.stringify(document)).not.toContain("DOC-OBC-001");
  });

  it("exports dataGrid nodes without embedding raw source data", () => {
    const html = exportHtml(createDataGridDocument());

    expect(html).toContain('class="sdoc-data-grid"');
    expect(html).toContain('data-source-asset-id="asset_pinout.csv"');
    expect(html).toContain('data-key-columns="pin"');
    expect(html).toContain("Key columns: pin");
    expect(html).toContain("MCU Pinout");
    expect(html).not.toContain("pin,signal");
  });

  it("renders bounded dataGrid previews from source assets", () => {
    const html = exportHtml(createDataGridDocument(), {
      dataGridSourceResolver: (assetId) => (assetId === "asset_pinout.csv" ? "pin,signal\n1,VCC\n2,GND\n3,GPIO" : undefined),
      dataGridPreviewRows: 2
    });

    expect(html).toContain("<th>pin</th>");
    expect(html).toContain("<td>1</td>");
    expect(html).toContain("<td>VCC</td>");
    expect(html).toContain("Preview limited to 2 of 3 rows");
    expect(html).not.toContain("<td>3</td>");
  });

  it("escapes HTML text and blocks unsafe link hrefs", () => {
    const unsafeDocument: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_unsafe" },
      content: [
        {
          type: "paragraph",
          attrs: { id: "blk_unsafe" },
          content: [
            { type: "text", text: "<script>alert(1)</script> " },
            { type: "text", text: "blocked", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }
          ]
        }
      ]
    };

    const html = exportHtml(unsafeDocument);

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("blocked");
    expect(html).not.toContain("javascript:alert");
  });

  it("uses an asset resolver for single-file browser HTML exports", () => {
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

    const html = exportHtml(withFigure, {
      assetResolver: (assetId) => `data:image/png;base64,${assetId}`
    });

    expect(html).toContain('src="data:image/png;base64,asset_architecture.png"');
    expect(html).toContain("<figcaption>System architecture</figcaption>");
  });

  it("exports Draw.io HTML using preview assets and source references", () => {
    const html = exportHtml(createDrawioDocument(), {
      assetResolver: (assetId) => `data:image/svg+xml;base64,${assetId}`
    });

    expect(html).toContain('data-kind="drawio"');
    expect(html).toContain('data-source-asset-id="asset_architecture.drawio"');
    expect(html).toContain('src="data:image/svg+xml;base64,asset_architecture.svg"');
    expect(html).not.toContain("<mxfile");
  });
});

describe("createDataGridPreview", () => {
  it("parses quoted CSV cells with row and column limits", () => {
    const preview = createDataGridPreview('pin,signal,note\n1,VCC,"main, rail"\n2,GND,return', "csv", {
      maxRows: 1,
      maxColumns: 2
    });

    expect(preview).toEqual({
      columns: ["pin", "signal"],
      rows: [["1", "VCC"]],
      totalRows: 2,
      truncatedRows: true,
      truncatedColumns: true
    });
  });

  it("parses JSON object arrays as tabular previews", () => {
    const preview = createDataGridPreview(
      JSON.stringify([
        { pin: 1, signal: "VCC" },
        { pin: 2, signal: "GND", type: "power" }
      ]),
      "json"
    );

    expect(preview?.columns).toEqual(["pin", "signal", "type"]);
    expect(preview?.rows).toEqual([
      ["1", "VCC", ""],
      ["2", "GND", "power"]
    ]);
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

  it("includes Mermaid diagram source in derived outputs", () => {
    const outputs = exportDerivedOutputs(createDiagramDocument());

    expect(outputs["plain.md"]).toContain("```mermaid");
    expect(outputs["plain.md"]).toContain("A[Start] --> B[Done]");
    expect(outputs["references.json"]).toContain('"type": "diagram"');
    expect(outputs["chunks.jsonl"]).toContain("flowchart TD");
  });

  it("includes Draw.io source asset references in derived outputs", () => {
    const outputs = exportDerivedOutputs(createDrawioDocument());

    expect(outputs["plain.md"]).toContain("asset_architecture.drawio");
    expect(outputs["references.json"]).toContain('"type": "diagram"');
    expect(outputs["chunks.jsonl"]).toContain("asset_architecture.drawio");
    expect(outputs["chunks.jsonl"]).not.toContain("<mxfile");
  });
});

describe("exportPptx", () => {
  it("derives deterministic slide groups from h1 and h2 headings", () => {
    const model = createPptxSlideModel(createSlideDocument());

    expect(model.map((slide) => ({ title: slide.title, sectionTitle: slide.sectionTitle, sourceIds: slide.sourceIds }))).toEqual([
      { title: "System Overview", sectionTitle: "System Overview", sourceIds: ["blk_h1"] },
      { title: "API", sectionTitle: "System Overview", sourceIds: ["blk_h2_api", "blk_api_body"] },
      { title: "Operations", sectionTitle: "System Overview", sourceIds: ["blk_h2_ops", "blk_ops_body"] }
    ]);
  });

  it("writes a non-empty native PPTX containing editable slide text", async () => {
    const bytes = await exportPptx(createSlideDocument(), { title: "Generated Deck" });
    const zip = await JSZip.loadAsync(bytes);
    const slideNames = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
    const slideXml = await Promise.all(slideNames.sort().map((name) => zip.file(name)?.async("string")));
    const allSlides = slideXml.join("\n");

    expect(Buffer.from(bytes.subarray(0, 2)).toString("utf8")).toBe("PK");
    expect(bytes.length).toBeGreaterThan(1_000);
    expect(slideNames).toHaveLength(3);
    expect(allSlides).toContain("System Overview");
    expect(allSlides).toContain("API");
    expect(allSlides).toContain("Stable endpoints");
    expect(allSlides).toContain("Operations");
  });

  it("uses asset-backed figures without embedding export state in document JSON", async () => {
    const figureDocument: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_figure_deck" },
      content: [
        { type: "heading", attrs: { id: "blk_h1", level: 1 }, content: [{ type: "text", text: "Architecture" }] },
        {
          type: "figure",
          attrs: { id: "blk_figure", assetId: "asset_architecture.png", alt: "Architecture" },
          content: [{ type: "paragraph", attrs: { id: "blk_caption" }, content: [{ type: "text", text: "System architecture" }] }]
        }
      ]
    };
    const before = JSON.stringify(figureDocument);
    const bytes = await exportPptx(figureDocument, {
      assetResolver: (assetId) =>
        assetId === "asset_architecture.png"
          ? Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64"))
          : undefined
    });

    expect(bytes.length).toBeGreaterThan(1_000);
    expect(JSON.stringify(figureDocument)).toBe(before);
    expect(JSON.stringify(figureDocument)).not.toContain("pptx");
  });
});

describe("exportDocx", () => {
  it("writes an editable DOCX package derived from document content", async () => {
    const bytes = await exportDocx(document, { title: "Controlled Spec" });
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")?.async("string");

    expect(Buffer.from(bytes.subarray(0, 2)).toString("utf8")).toBe("PK");
    expect(zip.file("[Content_Types].xml")).toBeTruthy();
    expect(zip.file("word/styles.xml")).toBeTruthy();
    expect(documentXml).toContain("Overview");
    expect(documentXml).toContain("Read the overview.");
  });

  it("renders controlled metadata without mutating canonical document JSON", async () => {
    const before = JSON.stringify(document);
    const bytes = await exportDocx(document, {
      title: "Controlled Spec",
      template: "controlled",
      metadata: {
        documentNumber: "DOC-OBC-001",
        version: "A",
        author: "Power Electronics",
        classification: "Internal",
        approvalStatus: "Approved",
        effectiveDate: "2026-07-03"
      }
    });
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")?.async("string");
    const coreXml = await zip.file("docProps/core.xml")?.async("string");

    expect(documentXml).toContain("DOC-OBC-001");
    expect(documentXml).toContain("Approved");
    expect(documentXml).toContain("Internal");
    expect(coreXml).toContain("Power Electronics");
    expect(JSON.stringify(document)).toBe(before);
    expect(JSON.stringify(document)).not.toContain("DOC-OBC-001");
  });

  it("injects document body into a validated external Word template without mutating canonical JSON", async () => {
    const before = JSON.stringify(document);
    const templateBytes = await createTemplatePackage({
      stylesXml: createStylesXml(["Normal", "Heading1"]),
      documentXml: createDocumentXml(["sdoc-body"], {
        before: "Template cover",
        placeholderText: "Replace me",
        after: "Template appendix"
      })
    });

    const bytes = await exportDocx(document, {
      title: "External Template Spec",
      externalTemplate: {
        bytes: templateBytes,
        fileName: "company.dotx",
        requiredStyles: [{ nodeType: "heading", styleId: "Heading1" }],
        requiredPlaceholders: ["sdoc-body"]
      }
    });
    const zip = await JSZip.loadAsync(bytes);
    const coreXml = await zip.file("docProps/core.xml")?.async("string");
    const documentXml = await zip.file("word/document.xml")?.async("string");

    expect(coreXml).toContain("External Word template validated: company.dotx");
    expect(documentXml).toContain("Template cover");
    expect(documentXml).toContain("Overview");
    expect(documentXml).toContain("Read the overview.");
    expect(documentXml).toContain("Template appendix");
    expect(documentXml).not.toContain("Replace me");
    expect(JSON.stringify(document)).toBe(before);
    expect(JSON.stringify(document)).not.toContain("company.dotx");
  });

  it("applies external Word template style mappings to rendered SDoc blocks", async () => {
    const templateBytes = await createTemplatePackage({
      stylesXml: createStylesXml(["CorpHeading", "CorpBody"]),
      documentXml: createDocumentXml(["sdoc-body"])
    });

    const bytes = await exportDocx(document, {
      externalTemplate: {
        bytes: templateBytes,
        fileName: "company.dotx",
        requiredStyles: [
          { nodeType: "heading", styleId: "CorpHeading" },
          { nodeType: "paragraph", styleId: "CorpBody" }
        ],
        requiredPlaceholders: ["sdoc-body"]
      }
    });
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")?.async("string");

    expect(documentXml).toContain('<w:pStyle w:val="CorpHeading"');
    expect(documentXml).toContain('<w:pStyle w:val="CorpBody"');
    expect(documentXml).toContain("Overview");
    expect(documentXml).toContain("Read the overview.");
  });

  it("injects optional approval and revision metadata placeholders in external Word templates", async () => {
    const before = JSON.stringify(document);
    const templateBytes = await createTemplatePackage({
      stylesXml: createStylesXml(["Normal"]),
      documentXml: createDocumentXml(["sdoc-body", "sdoc-approval-table", "sdoc-revision-history"], {
        placeholderText: "Template placeholder"
      })
    });

    const bytes = await exportDocx(document, {
      externalTemplate: {
        bytes: templateBytes,
        fileName: "company.dotx",
        requiredPlaceholders: ["sdoc-body", "sdoc-approval-table", "sdoc-revision-history"]
      },
      metadata: {
        documentNumber: "DOC-OBC-001",
        version: "B",
        author: "Power Electronics",
        classification: "Internal",
        approvalStatus: "Approved",
        effectiveDate: "2026-07-04"
      }
    });
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")?.async("string");

    expect(documentXml).toContain("Overview");
    expect(documentXml).toContain("DOC-OBC-001");
    expect(documentXml).toContain("Power Electronics");
    expect(documentXml).toContain("Approved");
    expect(documentXml).toContain("2026-07-04");
    expect(documentXml).toContain("Version");
    expect(documentXml).not.toContain("Template placeholder");
    expect(JSON.stringify(document)).toBe(before);
    expect(JSON.stringify(document)).not.toContain("DOC-OBC-001");
  });

  it("rejects external Word templates with missing mapping requirements", async () => {
    const templateBytes = await createTemplatePackage({
      stylesXml: createStylesXml(["Normal"]),
      documentXml: createDocumentXml([])
    });

    await expect(
      exportDocx(document, {
        externalTemplate: {
          bytes: templateBytes,
          fileName: "company.dotx",
          requiredPlaceholders: ["sdoc-body"]
        }
      })
    ).rejects.toThrow('Template is missing required content-control placeholder "sdoc-body"');
  });

  it("rejects unsafe external Word templates before rendering", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", DOCX_CONTENT_TYPES_FOR_TEST);
    zip.folder("_rels")?.file(".rels", ROOT_RELS_FOR_TEST);
    zip.folder("word")?.file("document.xml", "<w:document/>");
    zip.folder("word")?.file("vbaProject.bin", "macro");

    await expect(
      exportDocx(document, {
        externalTemplate: {
          bytes: await zip.generateAsync({ type: "uint8array" }),
          fileName: "unsafe.dotx",
          requiredPlaceholders: ["sdoc-body"]
        }
      })
    ).rejects.toThrow("Macro-enabled Office package parts are not allowed");
  });
});

describe("validateWordTemplatePackage", () => {
  it("accepts the built-in DOCX handoff package as a valid template subset", async () => {
    const bytes = await exportDocx(document, { title: "Controlled Spec" });
    const result = await validateWordTemplatePackage(bytes, { fileName: "controlled.docx" });

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.partCount).toBeGreaterThan(0);
  });

  it("rejects macro-enabled package parts", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", DOCX_CONTENT_TYPES_FOR_TEST);
    zip.folder("_rels")?.file(".rels", ROOT_RELS_FOR_TEST);
    zip.folder("word")?.file("document.xml", "<w:document/>");
    zip.folder("word")?.file("vbaProject.bin", "macro");

    const result = await validateWordTemplatePackage(await zip.generateAsync({ type: "uint8array" }), { fileName: "template.dotx" });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "macro-enabled-template",
          path: "word/vbaProject.bin"
        })
      ])
    );
  });

  it("rejects external relationships and remote targets", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", DOCX_CONTENT_TYPES_FOR_TEST);
    zip.folder("_rels")?.file(".rels", ROOT_RELS_FOR_TEST);
    zip.folder("word")?.file("document.xml", "<w:document/>");
    zip
      .folder("word/_rels")
      ?.file(
        "document.xml.rels",
        '<Relationships><Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://example.test/logo.png" TargetMode="External"/></Relationships>'
      );

    const result = await validateWordTemplatePackage(await zip.generateAsync({ type: "uint8array" }), { fileName: "template.docx" });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "external-relationship",
          path: "word/_rels/document.xml.rels"
        })
      ])
    );
  });

  it("rejects non-template extensions before future injection uses the file", async () => {
    const bytes = await exportDocx(document, { title: "Controlled Spec" });
    const result = await validateWordTemplatePackage(bytes, { fileName: "template.docm" });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-extension",
          path: "template.docm"
        })
      ])
    );
  });
});

describe("validateWordTemplateMapping", () => {
  it("accepts templates that expose required styles and content controls", async () => {
    const bytes = await createTemplatePackage({
      stylesXml: createStylesXml(["Normal", "Heading1", "SDocCallout"]),
      documentXml: createDocumentXml(["sdoc-body", "sdoc-approval-table"])
    });

    const result = await validateWordTemplateMapping(bytes, {
      fileName: "company.dotx",
      requiredStyles: [
        { nodeType: "paragraph", styleId: "Normal" },
        { nodeType: "heading", styleId: "Heading1" },
        { nodeType: "callout", styleId: "SDocCallout" }
      ],
      requiredPlaceholders: ["sdoc-body", "sdoc-approval-table"]
    });

    expect(result.ok).toBe(true);
    expect(result.availableStyles).toEqual(["Heading1", "Normal", "SDocCallout"]);
    expect(result.availablePlaceholders).toEqual(["sdoc-approval-table", "sdoc-body"]);
    expect(result.issues).toEqual([]);
  });

  it("reports missing style and placeholder diagnostics without applying the template", async () => {
    const bytes = await createTemplatePackage({
      stylesXml: createStylesXml(["Normal"]),
      documentXml: createDocumentXml(["sdoc-body"])
    });

    const result = await validateWordTemplateMapping(bytes, {
      fileName: "company.dotx",
      requiredStyles: [
        { nodeType: "heading", styleId: "Heading1" },
        { nodeType: "dataGrid", styleId: "SDocDataGrid" }
      ],
      requiredPlaceholders: ["sdoc-body", "sdoc-revision-history"]
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-style", message: expect.stringContaining("Heading1") }),
        expect.objectContaining({ code: "missing-style", message: expect.stringContaining("SDocDataGrid") }),
        expect.objectContaining({ code: "missing-placeholder", message: expect.stringContaining("sdoc-revision-history") })
      ])
    );
  });

  it("returns package-invalid diagnostics before mapping checks for unsafe templates", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", DOCX_CONTENT_TYPES_FOR_TEST);
    zip.folder("_rels")?.file(".rels", ROOT_RELS_FOR_TEST);
    zip.folder("word")?.file("document.xml", "<w:document/>");
    zip.folder("word")?.file("vbaProject.bin", "macro");

    const result = await validateWordTemplateMapping(await zip.generateAsync({ type: "uint8array" }), {
      fileName: "unsafe.dotx",
      requiredStyles: [{ nodeType: "paragraph", styleId: "Normal" }]
    });

    expect(result.ok).toBe(false);
    expect(result.availableStyles).toEqual([]);
    expect(result.availablePlaceholders).toEqual([]);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "package-invalid",
          path: "word/vbaProject.bin"
        })
      ])
    );
  });
});

const DOCX_CONTENT_TYPES_FOR_TEST = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const ROOT_RELS_FOR_TEST = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

async function createTemplatePackage(parts: { stylesXml: string; documentXml: string }): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", DOCX_CONTENT_TYPES_FOR_TEST);
  zip.folder("_rels")?.file(".rels", ROOT_RELS_FOR_TEST);
  zip.folder("word")?.file("document.xml", parts.documentXml);
  zip.folder("word")?.file("styles.xml", parts.stylesXml);
  return zip.generateAsync({ type: "uint8array" });
}

function createStylesXml(styleIds: string[]): string {
  return `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${styleIds
    .map((styleId) => `<w:style w:type="paragraph" w:styleId="${styleId}"><w:name w:val="${styleId}"/></w:style>`)
    .join("")}</w:styles>`;
}

function createDocumentXml(placeholders: string[], options: { before?: string; placeholderText?: string; after?: string } = {}): string {
  const before = options.before ? `<w:p><w:r><w:t>${options.before}</w:t></w:r></w:p>` : "";
  const after = options.after ? `<w:p><w:r><w:t>${options.after}</w:t></w:r></w:p>` : "";
  return `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${before}${placeholders
    .map(
      (placeholder) =>
        `<w:sdt><w:sdtPr><w:tag w:val="${placeholder}"/><w:alias w:val="${placeholder}"/></w:sdtPr><w:sdtContent><w:p><w:r><w:t>${options.placeholderText ?? ""}</w:t></w:r></w:p></w:sdtContent></w:sdt>`
    )
    .join("")}${after}</w:body></w:document>`;
}

function createDiagramDocument(): SDocDocument {
  return {
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
}

function createSlideDocument(): SDocDocument {
  return {
    schemaVersion: 1,
    type: "doc",
    attrs: { id: "doc_slides" },
    content: [
      { type: "heading", attrs: { id: "blk_h1", level: 1 }, content: [{ type: "text", text: "System Overview" }] },
      { type: "heading", attrs: { id: "blk_h2_api", level: 2 }, content: [{ type: "text", text: "API" }] },
      { type: "paragraph", attrs: { id: "blk_api_body" }, content: [{ type: "text", text: "Stable endpoints" }] },
      { type: "heading", attrs: { id: "blk_h2_ops", level: 2 }, content: [{ type: "text", text: "Operations" }] },
      { type: "paragraph", attrs: { id: "blk_ops_body" }, content: [{ type: "text", text: "Runbook summary" }] }
    ]
  };
}

function createDrawioDocument(): SDocDocument {
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
          sourceAssetId: "asset_architecture.drawio",
          previewAssetId: "asset_architecture.svg"
        }
      }
    ]
  };
}

function createDataGridDocument(): SDocDocument {
  return {
    schemaVersion: 1,
    type: "doc",
    attrs: { id: "doc_grid" },
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
}

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

function createTableDocument(status: string, statusAlign?: "left" | "center" | "right", caption?: string): SDocDocument {
  return {
    schemaVersion: 1,
    type: "doc",
    attrs: { id: "doc_table" },
    content: [
      {
        type: "table",
        attrs: caption ? { id: "blk_table", caption } : { id: "blk_table" },
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
              createTableCell("tableCell", "blk_cell_ready", "blk_cell_ready_text", status, statusAlign)
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
