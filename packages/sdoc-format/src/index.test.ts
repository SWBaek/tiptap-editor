import { describe, expect, it } from "vitest";
import {
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
