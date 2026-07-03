import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const cliPath = path.join(process.cwd(), "packages/sdoc-cli/dist/index.js");
const validDocumentPath = path.join(process.cwd(), "examples/sdoc-json/basic.document.json");
const modifiedDocumentPath = path.join(process.cwd(), "examples/sdoc-json/modified.document.json");

describe("sdoc CLI", () => {
  it("validates a document JSON file", async () => {
    const result = await runSdoc(["validate", validDocumentPath]);

    expect(result.stdout).toContain(`VALID ${validDocumentPath}`);
    expect(result.stderr).toBe("");
  });

  it("rejects schema-invalid document JSON", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "sdoc-cli-"));
    const invalidPath = path.join(tempDir, "invalid.document.json");

    try {
      await writeFile(
        invalidPath,
        JSON.stringify({
          schemaVersion: 1,
          type: "doc",
          attrs: { id: "doc_bad" },
          content: [{ type: "drawioDiagram" }]
        }),
        "utf8"
      );

      await expect(runSdoc(["validate", invalidPath])).rejects.toMatchObject({
        stderr: expect.stringContaining("$.content[0].type: unsupported node type: drawioDiagram")
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("validates an unpacked .sdoc folder", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "sdoc-cli-"));
    const unpackedPath = path.join(tempDir, "document.sdoc.d");

    try {
      await createUnpackedFixture(unpackedPath);
      const result = await runSdoc(["validate", unpackedPath]);
      expect(result.stdout).toContain(`VALID ${unpackedPath}`);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("exports AI/RAG derived outputs", async () => {
    const chunks = await runSdoc(["export", validDocumentPath, "--format", "chunks"]);
    const outline = await runSdoc(["export", validDocumentPath, "--format", "outline"]);
    const references = await runSdoc(["export", validDocumentPath, "--format", "references"]);

    expect(chunks.stdout).toContain('"id":"blk_intro"');
    expect(outline.stdout).toContain('"id": "blk_overview"');
    expect(references.stdout).toContain('"anchor": "overview"');
  });

  it("exports themed HTML", async () => {
    const html = await runSdoc(["export", validDocumentPath, "--format", "html"]);

    expect(html.stdout).toContain("<!doctype html>");
    expect(html.stdout).toContain('<main class="sdoc-document">');
    expect(html.stdout).toContain('<h1 id="overview">System Overview</h1>');
    expect(html.stdout).toContain(".sdoc-document");
  });

  it("exports controlled corporate template HTML from .sdoc metadata", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "sdoc-cli-"));
    const unpackedPath = path.join(tempDir, "controlled.sdoc.d");

    try {
      await createUnpackedFixture(unpackedPath, validDocumentPath, "Controlled Spec", {
        documentNumber: "DOC-OBC-001",
        version: "A",
        author: "Power Electronics",
        classification: "Internal",
        approvalStatus: "Approved",
        effectiveDate: "2026-07-03"
      });

      const html = await runSdoc(["export", unpackedPath, "--format", "html", "--template", "controlled"]);

      expect(html.stdout).toContain('class="sdoc-corporate-template sdoc-corporate-template-controlled"');
      expect(html.stdout).toContain("Controlled Spec");
      expect(html.stdout).toContain("DOC-OBC-001");
      expect(html.stdout).toContain("Approved");
      expect(html.stdout).toContain('<main class="sdoc-document">');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("exports dataGrid HTML previews from referenced source assets", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "sdoc-cli-"));
    const unpackedPath = path.join(tempDir, "grid.sdoc.d");

    try {
      const document = {
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
              title: "Pinout"
            }
          }
        ]
      };
      const documentPath = path.join(tempDir, "grid.document.json");
      await writeFile(documentPath, JSON.stringify(document, null, 2), "utf8");
      await createUnpackedFixture(unpackedPath, documentPath, "Grid Spec");
      await mkdir(path.join(unpackedPath, "assets"), { recursive: true });
      await writeFile(path.join(unpackedPath, "assets", "asset_pinout.csv"), "pin,signal\n1,VCC\n2,GND", "utf8");

      const html = await runSdoc(["export", unpackedPath, "--format", "html"]);

      expect(html.stdout).toContain("<th>pin</th>");
      expect(html.stdout).toContain("<td>VCC</td>");
      expect(html.stdout).not.toContain("pin,signal");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("reports row-level dataGrid source diff events", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "sdoc-cli-"));
    const baselinePath = path.join(tempDir, "baseline.csv");
    const proposedPath = path.join(tempDir, "proposed.csv");

    try {
      await writeFile(baselinePath, "pin,signal\n1,VCC\n2,GND", "utf8");
      await writeFile(proposedPath, "pin,signal\n1,VCC\n2,GROUND\n3,GPIO", "utf8");

      const result = await runSdoc(["data-grid", "diff", baselinePath, proposedPath, "--format", "csv", "--key", "pin"]);

      expect(result.stdout).toContain('0 CELL_MODIFIED row=2 column=signal old="GND" new="GROUND"');
      expect(result.stdout).toContain("1 ROW_ADDED row=3");
      expect(result.stderr).toBe("");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("applies a guarded dataGrid row merge event to asset source output", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "sdoc-cli-"));
    const baselinePath = path.join(tempDir, "baseline.csv");
    const proposedPath = path.join(tempDir, "proposed.csv");
    const currentPath = path.join(tempDir, "current.csv");
    const outputPath = path.join(tempDir, "merged.csv");

    try {
      await writeFile(baselinePath, "pin,signal\n1,VCC\n2,GND", "utf8");
      await writeFile(proposedPath, "pin,signal\n1,VCC\n2,GROUND", "utf8");
      await writeFile(currentPath, "pin,signal\n1,VCC\n2,GND", "utf8");

      const result = await runSdoc([
        "data-grid",
        "apply",
        baselinePath,
        proposedPath,
        currentPath,
        "--format",
        "csv",
        "--key",
        "pin",
        "--event",
        "0",
        "-o",
        outputPath
      ]);

      expect(result.stdout).toBe("");
      expect(await readFile(outputPath, "utf8")).toBe("pin,signal\n1,VCC\n2,GROUND\n");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects stale dataGrid row merge events in the CLI", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "sdoc-cli-"));
    const baselinePath = path.join(tempDir, "baseline.csv");
    const proposedPath = path.join(tempDir, "proposed.csv");
    const currentPath = path.join(tempDir, "current.csv");

    try {
      await writeFile(baselinePath, "pin,signal\n1,VCC\n2,GND", "utf8");
      await writeFile(proposedPath, "pin,signal\n1,VCC\n2,GROUND", "utf8");
      await writeFile(currentPath, "pin,signal\n1,VDD\n2,GND", "utf8");

      await expect(
        runSdoc(["data-grid", "apply", baselinePath, proposedPath, currentPath, "--format", "csv", "--key", "pin", "--event", "0"])
      ).rejects.toMatchObject({
        stderr: expect.stringContaining("Current data grid source changed since the row diff was created")
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("exports PDF through the HTML print pipeline", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "sdoc-cli-"));
    const pdfPath = path.join(tempDir, "basic.pdf");

    try {
      const result = await runSdoc(["export", validDocumentPath, "--format", "pdf", "-o", pdfPath]);
      const pdf = await readFile(pdfPath);

      expect(result.stdout).toBe("");
      expect(pdf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
      expect(pdf.length).toBeGreaterThan(1_000);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("exports native PPTX as a binary CLI artifact", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "sdoc-cli-"));
    const pptxPath = path.join(tempDir, "basic.pptx");

    try {
      const result = await runSdoc(["export", validDocumentPath, "--format", "pptx", "-o", pptxPath]);
      const pptx = await readFile(pptxPath);

      expect(result.stdout).toBe("");
      expect(pptx.subarray(0, 2).toString("utf8")).toBe("PK");
      expect(pptx.length).toBeGreaterThan(1_000);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("exports controlled DOCX as a binary CLI artifact", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "sdoc-cli-"));
    const unpackedPath = path.join(tempDir, "controlled.sdoc.d");
    const docxPath = path.join(tempDir, "controlled.docx");

    try {
      await createUnpackedFixture(unpackedPath, validDocumentPath, "Controlled Spec", {
        documentNumber: "DOC-OBC-001",
        version: "A",
        author: "Power Electronics",
        classification: "Internal",
        approvalStatus: "Approved",
        effectiveDate: "2026-07-03"
      });

      const result = await runSdoc(["export", unpackedPath, "--format", "docx", "--template", "controlled", "-o", docxPath]);
      const docx = await readFile(docxPath);
      const zip = await JSZip.loadAsync(docx);
      const documentXml = await zip.file("word/document.xml")?.async("string");

      expect(result.stdout).toBe("");
      expect(docx.subarray(0, 2).toString("utf8")).toBe("PK");
      expect(documentXml).toContain("DOC-OBC-001");
      expect(documentXml).toContain("System Overview");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("validates a safe Word template package in the CLI", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "sdoc-cli-"));
    const docxPath = path.join(tempDir, "controlled.docx");

    try {
      await runSdoc(["export", validDocumentPath, "--format", "docx", "-o", docxPath]);

      const result = await runSdoc(["template", "validate", docxPath]);

      expect(result.stdout).toContain(`VALID_TEMPLATE ${docxPath}`);
      expect(result.stderr).toBe("");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects unsafe Word template packages in the CLI", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "sdoc-cli-"));
    const templatePath = path.join(tempDir, "unsafe.dotx");

    try {
      const zip = new JSZip();
      zip.file("[Content_Types].xml", DOCX_CONTENT_TYPES_FOR_TEST);
      zip.folder("_rels")?.file(".rels", ROOT_RELS_FOR_TEST);
      zip.folder("word")?.file("document.xml", "<w:document/>");
      zip.folder("word")?.file("vbaProject.bin", "macro");
      await writeFile(templatePath, await zip.generateAsync({ type: "nodebuffer" }));

      await expect(runSdoc(["template", "validate", templatePath])).rejects.toMatchObject({
        stderr: expect.stringContaining("Macro-enabled Office package parts are not allowed")
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("applies a review reject action to a semantic diff event", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "sdoc-cli-"));
    const outputPath = path.join(tempDir, "reviewed.document.json");

    try {
      await runSdoc(["review", "reject", validDocumentPath, modifiedDocumentPath, "--event", "blk_intro", "--kind", "modified", "-o", outputPath]);

      const reviewed = JSON.parse(await readFile(outputPath, "utf8"));
      const intro = reviewed.content.find((node: { attrs?: { id?: string } }) => node.attrs?.id === "blk_intro");
      expect(intro.content[0].text).toBe("This document describes the initial architecture.");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("runs the Phase 0 pack/unpack/diff/export smoke flow", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "sdoc-cli-"));
    const basicFolder = path.join(tempDir, "basic.sdoc.d");
    const modifiedFolder = path.join(tempDir, "modified.sdoc.d");
    const unpackedFolder = path.join(tempDir, "unpacked.sdoc.d");
    const basicSdoc = path.join(tempDir, "basic.sdoc");
    const modifiedSdoc = path.join(tempDir, "modified.sdoc");
    const markdownPath = path.join(tempDir, "basic.md");

    try {
      await createUnpackedFixture(basicFolder, validDocumentPath, "Basic Sample");
      await createUnpackedFixture(modifiedFolder, modifiedDocumentPath, "Modified Sample");

      await runSdoc(["pack", basicFolder, basicSdoc]);
      await runSdoc(["pack", modifiedFolder, "-o", modifiedSdoc]);

      const validate = await runSdoc(["validate", basicSdoc]);
      expect(validate.stdout).toContain(`VALID ${basicSdoc}`);

      await runSdoc(["unpack", basicSdoc, unpackedFolder]);
      const unpackedDocument = JSON.parse(await readFile(path.join(unpackedFolder, "document.json"), "utf8"));
      expect(unpackedDocument.attrs.id).toBe("doc_sample");

      const diff = await runSdoc(["diff", basicSdoc, modifiedSdoc]);
      expect(diff.stdout).toContain("MODIFIED heading blk_overview");
      expect(diff.stdout).toContain('text changed "[-System-] [+Architecture+] Overview"');

      await runSdoc(["export", basicSdoc, "--format", "markdown", "-o", markdownPath]);
      const markdown = await readFile(markdownPath, "utf8");
      expect(markdown).toContain("# System Overview {#overview}");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
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

async function runSdoc(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync(process.execPath, [cliPath, ...args], { encoding: "utf8" });
  return {
    stdout: String(result.stdout),
    stderr: String(result.stderr)
  };
}

async function createUnpackedFixture(
  folderPath: string,
  documentPath = validDocumentPath,
  title = "CLI Test",
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const documentText = await readFile(documentPath, "utf8");
  const document = JSON.parse(documentText) as { attrs?: { id?: string } };

  await mkdir(folderPath, { recursive: true });
  await writeFile(
    path.join(folderPath, "manifest.json"),
    JSON.stringify(
      {
        format: "sdoc",
        formatVersion: 1,
        schemaVersion: 1,
        documentId: document.attrs?.id ?? "doc_cli",
        createdBy: "test"
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(path.join(folderPath, "document.json"), documentText, "utf8");
  await writeFile(path.join(folderPath, "metadata.json"), JSON.stringify({ title, ...metadata }, null, 2), "utf8");
}
