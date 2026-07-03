import { describe, expect, it } from "vitest";
import {
  createDataGridDiagnostics,
  createEmptySdocContainer,
  isLikelyZipContainer,
  normalizeDocument,
  packSdoc,
  stableStringify,
  tryUnpackSdoc,
  unpackSdoc
} from "./index";
import type { SDocDocument } from "@sdoc/schema";

describe("stableStringify", () => {
  it("produces deterministic document JSON", () => {
    const left = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_a", empty: "", optional: null },
      content: [
        {
          type: "heading",
          attrs: { level: 1, id: "blk_h" },
          content: [{ type: "text", text: "Overview" }]
        }
      ]
    };
    const right = {
      type: "doc",
      schemaVersion: 1,
      content: [
        {
          content: [{ text: "Overview", type: "text" }],
          attrs: { id: "blk_h", level: 1 },
          type: "heading"
        }
      ],
      attrs: { optional: null, id: "doc_a", empty: "" }
    };

    expect(stableStringify(normalizeDocument(left))).toBe(stableStringify(normalizeDocument(right)));
  });

  it("preserves empty strings in attributes", () => {
    const document: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_a" },
      content: [
        {
          type: "codeBlock",
          attrs: { id: "blk_code", language: "" },
          content: [{ type: "text", text: "echo test" }]
        }
      ]
    };

    expect(stableStringify(normalizeDocument(document))).toContain('"language": ""');
  });
});

describe("packSdoc", () => {
  it("round-trips a minimal sdoc container", async () => {
    const container = createEmptySdocContainer({ title: "Round Trip" });
    const packed = await packSdoc(container);

    expect(isLikelyZipContainer(packed)).toBe(true);

    const unpacked = await unpackSdoc(packed);
    expect(unpacked.manifest.documentId).toBe(container.document.attrs.id);
    expect(unpacked.metadata.title).toBe("Round Trip");
    expect(stableStringify(unpacked.document)).toBe(stableStringify(container.document));
  });

  it("packs the same container to identical bytes", async () => {
    const container = createEmptySdocContainer({ title: "Deterministic ZIP" });

    const first = await packSdoc(container);
    const second = await packSdoc(container);

    expect(Buffer.compare(Buffer.from(first), Buffer.from(second))).toBe(0);
  });

  it("round-trips figure asset references and binary assets", async () => {
    const container = createEmptySdocContainer({ title: "Figure Asset" });
    const document: SDocDocument = {
      schemaVersion: 1 as const,
      type: "doc" as const,
      attrs: { id: "doc_figure" },
      content: [
        {
          type: "figure",
          attrs: { id: "blk_figure", assetId: "asset_architecture.png", alt: "Architecture" },
          content: [{ type: "paragraph", attrs: { id: "blk_caption" }, content: [{ type: "text", text: "System architecture" }] }]
        }
      ]
    };

    const packed = await packSdoc({
      ...container,
      manifest: { ...container.manifest, documentId: document.attrs.id },
      document,
      assets: { "asset_architecture.png": new Uint8Array([1, 2, 3]) }
    });
    const unpacked = await unpackSdoc(packed);

    expect(unpacked.document.content[0]?.attrs?.assetId).toBe("asset_architecture.png");
    expect(Array.from(unpacked.assets?.["asset_architecture.png"] ?? [])).toEqual([1, 2, 3]);
  });

  it("rejects figure references to missing assets", async () => {
    const container = createEmptySdocContainer({ title: "Missing Figure Asset" });
    const document = {
      schemaVersion: 1 as const,
      type: "doc" as const,
      attrs: { id: "doc_figure" },
      content: [
        {
          type: "figure",
          attrs: { id: "blk_figure", assetId: "asset_missing.png" },
          content: [{ type: "paragraph", attrs: { id: "blk_caption" }, content: [{ type: "text", text: "Missing asset" }] }]
        }
      ]
    };

    await expect(
      packSdoc({
        ...container,
        manifest: { ...container.manifest, documentId: document.attrs.id },
        document
      })
    ).rejects.toThrow("missing assets: asset_missing.png");
  });

  it("round-trips Draw.io source and preview asset references", async () => {
    const container = createEmptySdocContainer({ title: "Draw.io Asset" });
    const document: SDocDocument = {
      schemaVersion: 1 as const,
      type: "doc" as const,
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

    const packed = await packSdoc({
      ...container,
      manifest: { ...container.manifest, documentId: document.attrs.id },
      document,
      assets: {
        "asset_architecture.drawio": new Uint8Array([60, 109, 120, 62]),
        "asset_architecture.svg": new Uint8Array([60, 115, 118, 103, 62])
      }
    });
    const unpacked = await unpackSdoc(packed);

    expect(unpacked.document.content[0]?.attrs?.sourceAssetId).toBe("asset_architecture.drawio");
    expect(Array.from(unpacked.assets?.["asset_architecture.drawio"] ?? [])).toEqual([60, 109, 120, 62]);
    expect(Array.from(unpacked.assets?.["asset_architecture.svg"] ?? [])).toEqual([60, 115, 118, 103, 62]);
  });

  it("rejects Draw.io references to missing source assets", async () => {
    const container = createEmptySdocContainer({ title: "Missing Draw.io Asset" });
    const document: SDocDocument = {
      schemaVersion: 1 as const,
      type: "doc" as const,
      attrs: { id: "doc_drawio" },
      content: [{ type: "diagram", attrs: { id: "blk_drawio", kind: "drawio", sourceAssetId: "asset_missing.drawio" } }]
    };

    await expect(
      packSdoc({
        ...container,
        manifest: { ...container.manifest, documentId: document.attrs.id },
        document
      })
    ).rejects.toThrow("missing assets: asset_missing.drawio");
  });

  it("round-trips dataGrid source asset references", async () => {
    const container = createEmptySdocContainer({ title: "Data Grid Asset" });
    const document: SDocDocument = {
      schemaVersion: 1 as const,
      type: "doc" as const,
      attrs: { id: "doc_grid" },
      content: [
        {
          type: "dataGrid",
          attrs: {
            id: "blk_grid",
            sourceAssetId: "asset_pinout.csv",
            format: "csv",
            title: "MCU Pinout"
          }
        }
      ]
    };

    const packed = await packSdoc({
      ...container,
      manifest: { ...container.manifest, documentId: document.attrs.id },
      document,
      assets: { "asset_pinout.csv": new TextEncoder().encode("pin,signal\n1,VCC") }
    });
    const unpacked = await unpackSdoc(packed);

    expect(unpacked.document.content[0]?.attrs?.sourceAssetId).toBe("asset_pinout.csv");
    expect(new TextDecoder().decode(unpacked.assets?.["asset_pinout.csv"])).toContain("pin,signal");
  });

  it("rejects dataGrid references to missing source assets", async () => {
    const container = createEmptySdocContainer({ title: "Missing Data Grid Asset" });
    const document: SDocDocument = {
      schemaVersion: 1 as const,
      type: "doc" as const,
      attrs: { id: "doc_grid" },
      content: [{ type: "dataGrid", attrs: { id: "blk_grid", sourceAssetId: "asset_missing.csv", format: "csv" } }]
    };

    await expect(
      packSdoc({
        ...container,
        manifest: { ...container.manifest, documentId: document.attrs.id },
        document
      })
    ).rejects.toThrow("missing assets: asset_missing.csv");
  });
});

describe("createDataGridDiagnostics", () => {
  it("reports CSV row-level diagnostics from referenced source assets", () => {
    const document = createDataGridDocument("asset_pinout.csv", "csv");
    const diagnostics = createDataGridDiagnostics(document, {
      "asset_pinout.csv": new TextEncoder().encode("pin,signal,signal\n1,VCC\n2,GND,return,extra\n3,")
    });

    expect(diagnostics).toMatchObject({
      gridCount: 1,
      errorCount: 0,
      warningCount: 4,
      summaries: [
        {
          gridId: "blk_grid",
          title: "MCU Pinout",
          sourceAssetId: "asset_pinout.csv",
          format: "csv",
          rowCount: 3,
          columnCount: 4
        }
      ]
    });
    expect(diagnostics.summaries[0].issues).toEqual([
      expect.objectContaining({ severity: "warning", row: 1, column: 3, message: "CSV header duplicates column 2" }),
      expect.objectContaining({ severity: "warning", row: 1, message: "CSV row has 3 cells; expected 4" }),
      expect.objectContaining({ severity: "warning", row: 2, message: "CSV row has 2 cells; expected 4" }),
      expect.objectContaining({ severity: "warning", row: 4, message: "CSV row has 2 cells; expected 4" })
    ]);
  });

  it("reports invalid JSON data grid assets without mutating canonical document", () => {
    const document = createDataGridDocument("asset_grid.json", "json");
    const diagnostics = createDataGridDiagnostics(document, {
      "asset_grid.json": new TextEncoder().encode('[{"pin":1}, {"signal":"GND"}]')
    });

    expect(diagnostics.errorCount).toBe(0);
    expect(diagnostics.warningCount).toBe(2);
    expect(diagnostics.summaries[0]).toMatchObject({ rowCount: 2, columnCount: 2 });
    expect(diagnostics.summaries[0].issues).toEqual([
      expect.objectContaining({ severity: "warning", row: 1, message: "JSON object row is missing columns: signal" }),
      expect.objectContaining({ severity: "warning", row: 2, message: "JSON object row is missing columns: pin" })
    ]);
    expect(JSON.stringify(document)).not.toContain("signal");
  });

  it("reports missing and malformed data grid source assets", () => {
    const missing = createDataGridDiagnostics(createDataGridDocument("asset_missing.csv", "csv"), {});
    expect(missing.errorCount).toBe(1);
    expect(missing.summaries[0].issues[0].message).toBe("Missing dataGrid source asset asset_missing.csv");

    const malformed = createDataGridDiagnostics(createDataGridDocument("asset_bad.json", "json"), {
      "asset_bad.json": new TextEncoder().encode("{not json")
    });
    expect(malformed.errorCount).toBe(1);
    expect(malformed.summaries[0].issues[0].message).toContain("Invalid JSON data grid");
  });
});

describe("tryUnpackSdoc", () => {
  it("classifies empty files", async () => {
    const result = await tryUnpackSdoc(new Uint8Array());
    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.code).toBe("empty-file");
  });

  it("classifies non-zip files", async () => {
    const result = await tryUnpackSdoc(Buffer.from("not a zip"));
    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.code).toBe("not-zip");
  });
});

function createDataGridDocument(sourceAssetId: string, format: "csv" | "json"): SDocDocument {
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
          format,
          title: "MCU Pinout"
        }
      }
    ]
  };
}
