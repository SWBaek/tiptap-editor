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
    const document = {
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
