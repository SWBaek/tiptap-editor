import { describe, expect, it } from "vitest";
import { createEmptySdocContainer, packSdoc, unpackSdoc, type SDocMetadata } from "@sdoc/format";
import type { SDocDocument } from "@sdoc/schema";
import { createHtmlPayload, createMarkdownPayload, createSdocPayload, openDocumentInput, safeFilename } from "./documentIo";

const document: SDocDocument = {
  schemaVersion: 1,
  type: "doc",
  attrs: { id: "doc_roundtrip" },
  content: [
    {
      type: "heading",
      attrs: { id: "blk_title", level: 1, anchor: "title" },
      content: [{ type: "text", text: "Round Trip" }]
    },
    {
      type: "paragraph",
      attrs: { id: "blk_body" },
      content: [{ type: "text", text: "The saved file should reopen with metadata and derived output." }]
    }
  ]
};

const metadata: SDocMetadata = {
  title: "Round Trip Spec",
  author: "SDoc",
  version: "1.0"
};

describe("createSdocPayload", () => {
  it("creates a .sdoc with canonical document, metadata, and derived outputs", async () => {
    const payload = await createSdocPayload(document, metadata, new Date("2026-07-01T00:00:00.000Z"));
    const container = await unpackSdoc(payload.bytes);

    expect(payload.filename).toBe("Round Trip Spec.sdoc");
    expect(container.manifest.documentId).toBe("doc_roundtrip");
    expect(container.document).toEqual(document);
    expect(container.metadata.title).toBe("Round Trip Spec");
    expect(container.metadata.updatedAt).toBe("2026-07-01T00:00:00.000Z");
    expect(container.derived?.["plain.md"]).toContain("# Round Trip {#title}");
    expect(container.derived?.["outline.json"]).toContain("blk_title");
    expect(container.derived?.["references.json"]).toContain("blk_body");
    expect(container.derived?.["chunks.jsonl"]).toContain("blk_body");
  });

  it("creates a .sdoc with referenced figure assets", async () => {
    const figureDocument: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_figure" },
      content: [
        {
          type: "figure",
          attrs: { id: "blk_figure", assetId: "asset_architecture.png", alt: "Architecture" },
          content: [{ type: "paragraph", attrs: { id: "blk_caption" }, content: [{ type: "text", text: "Architecture diagram" }] }]
        }
      ]
    };

    const payload = await createSdocPayload(
      figureDocument,
      metadata,
      new Date("2026-07-01T00:00:00.000Z"),
      {
        "asset_architecture.png": new Uint8Array([137, 80, 78, 71]),
        "asset_unused.png": new Uint8Array([0])
      }
    );
    const container = await unpackSdoc(payload.bytes);
    const opened = await openDocumentInput({
      name: payload.filename,
      data: payload.bytes,
      fallbackMetadata: { title: "Fallback" }
    });

    expect(Object.keys(container.assets ?? {})).toEqual(["asset_architecture.png"]);
    expect(Array.from(container.assets?.["asset_architecture.png"] ?? [])).toEqual([137, 80, 78, 71]);
    expect(container.derived?.["plain.md"]).toContain("_Figure: Architecture diagram_");
    expect(opened.document).toEqual(figureDocument);
    expect(Array.from(opened.assets["asset_architecture.png"] ?? [])).toEqual([137, 80, 78, 71]);
  });

  it("creates a .sdoc with referenced Draw.io source and preview assets", async () => {
    const drawioDocument: SDocDocument = {
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

    const payload = await createSdocPayload(drawioDocument, metadata, new Date("2026-07-01T00:00:00.000Z"), {
      "asset_architecture.drawio": new Uint8Array([60, 109, 120, 62]),
      "asset_architecture.svg": new Uint8Array([60, 115, 118, 103, 62]),
      "asset_unused.drawio": new Uint8Array([0])
    });
    const container = await unpackSdoc(payload.bytes);

    expect(Object.keys(container.assets ?? {})).toEqual(["asset_architecture.drawio", "asset_architecture.svg"]);
    expect(container.document).toEqual(drawioDocument);
    expect(container.derived?.["plain.md"]).toContain("asset_architecture.drawio");
  });

  it("sanitizes filenames", () => {
    expect(safeFilename('  A:B/C*D?  ')).toBe("A-B-C-D-");
    expect(safeFilename("   ")).toBe("document");
  });
});

describe("createMarkdownPayload", () => {
  it("creates a title-based Markdown export payload", () => {
    const payload = createMarkdownPayload(document, metadata);

    expect(payload.filename).toBe("Round Trip Spec.md");
    expect(payload.text).toContain("# Round Trip {#title}");
    expect(payload.text).toContain("The saved file should reopen with metadata and derived output.");
  });
});

describe("createHtmlPayload", () => {
  it("creates a title-based single-file HTML export payload", () => {
    const payload = createHtmlPayload(document, metadata);

    expect(payload.filename).toBe("Round Trip Spec.html");
    expect(payload.text).toContain("<!doctype html>");
    expect(payload.text).toContain("<title>Round Trip Spec</title>");
    expect(payload.text).toContain('<h1 id="title">Round Trip</h1>');
  });

  it("embeds available figure assets as data URLs", () => {
    const figureDocument: SDocDocument = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_figure" },
      content: [
        {
          type: "figure",
          attrs: { id: "blk_figure", assetId: "asset_architecture.png", alt: "Architecture" },
          content: [{ type: "paragraph", attrs: { id: "blk_caption" }, content: [{ type: "text", text: "Architecture diagram" }] }]
        }
      ]
    };

    const payload = createHtmlPayload(figureDocument, metadata, {
      "asset_architecture.png": new Uint8Array([137, 80, 78, 71])
    });

    expect(payload.text).toContain('src="data:image/png;base64,iVBORw=="');
    expect(payload.text).toContain("<figcaption>Architecture diagram</figcaption>");
  });

  it("embeds available Draw.io preview assets as data URLs", () => {
    const drawioDocument: SDocDocument = {
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

    const payload = createHtmlPayload(drawioDocument, metadata, {
      "asset_architecture.svg": new Uint8Array([60, 115, 118, 103, 62])
    });

    expect(payload.text).toContain('src="data:image/svg+xml;base64,PHN2Zz4="');
    expect(payload.text).toContain('data-source-asset-id="asset_architecture.drawio"');
  });
});

describe("openDocumentInput", () => {
  it("round-trips a saved .sdoc payload", async () => {
    const payload = await createSdocPayload(document, metadata, new Date("2026-07-01T00:00:00.000Z"));
    const opened = await openDocumentInput({
      name: payload.filename,
      data: payload.bytes,
      fallbackMetadata: { title: "Fallback" }
    });

    expect(opened.document).toEqual(document);
    expect(opened.metadata.title).toBe("Round Trip Spec");
    expect(opened.statusMessage).toBe("Opened Round Trip Spec.sdoc");
  });

  it("initializes an empty .sdoc file", async () => {
    const opened = await openDocumentInput({
      name: "Empty Spec.sdoc",
      data: new Uint8Array(),
      fallbackMetadata: { title: "Fallback", author: "Author" }
    });

    expect(opened.document.type).toBe("doc");
    expect(opened.document.content).toEqual([]);
    expect(opened.metadata.title).toBe("Empty Spec");
    expect(opened.metadata.author).toBe("Author");
    expect(opened.statusMessage).toBe("Initialized empty .sdoc");
  });

  it("opens canonical document JSON", async () => {
    const opened = await openDocumentInput({
      name: "document.json",
      data: new TextEncoder().encode(JSON.stringify(document)),
      fallbackMetadata: metadata
    });

    expect(opened.document).toEqual(document);
    expect(opened.metadata).toEqual(metadata);
    expect(opened.statusMessage).toBe("Opened document.json");
  });

  it("rejects unsupported file types before parsing", async () => {
    await expect(
      openDocumentInput({
        name: "notes.txt",
        data: new TextEncoder().encode(JSON.stringify(document)),
        fallbackMetadata: metadata
      })
    ).rejects.toThrow("Unsupported file type: notes.txt");
  });

  it("rejects malformed document JSON with filename context", async () => {
    await expect(
      openDocumentInput({
        name: "document.json",
        data: new TextEncoder().encode("{not json"),
        fallbackMetadata: metadata
      })
    ).rejects.toThrow("Invalid JSON in document.json");
  });

  it("rejects schema-invalid document JSON", async () => {
    await expect(
      openDocumentInput({
        name: "document.json",
        data: new TextEncoder().encode(JSON.stringify({ ...document, content: [{ type: "drawioDiagram" }] })),
        fallbackMetadata: metadata
      })
    ).rejects.toThrow("Invalid document JSON in document.json");
  });

  it("recreates stale derived outputs after opening and saving a .sdoc", async () => {
    const staleContainer = createEmptySdocContainer(metadata);
    const stalePayload = await packSdoc({
      ...staleContainer,
      manifest: {
        ...staleContainer.manifest,
        documentId: document.attrs.id
      },
      document,
      metadata,
      derived: {
        "plain.md": "stale markdown\n"
      }
    });

    const opened = await openDocumentInput({
      name: "Stale Derived.sdoc",
      data: stalePayload,
      fallbackMetadata: { title: "Fallback" }
    });
    const saved = await createSdocPayload(opened.document, opened.metadata, new Date("2026-07-02T00:00:00.000Z"));
    const roundTripped = await unpackSdoc(saved.bytes);

    expect(opened.document).toEqual(document);
    expect(roundTripped.derived?.["plain.md"]).toContain("# Round Trip {#title}");
    expect(roundTripped.derived?.["plain.md"]).not.toContain("stale markdown");
    expect(roundTripped.derived?.["outline.json"]).toContain("blk_title");
    expect(roundTripped.derived?.["chunks.jsonl"]).toContain("blk_body");
  });
});
