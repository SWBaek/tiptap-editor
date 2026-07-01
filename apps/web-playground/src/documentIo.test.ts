import { describe, expect, it } from "vitest";
import { unpackSdoc, type SDocMetadata } from "@sdoc/format";
import type { SDocDocument } from "@sdoc/schema";
import { createMarkdownPayload, createSdocPayload, openDocumentInput, safeFilename } from "./documentIo";

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
});
