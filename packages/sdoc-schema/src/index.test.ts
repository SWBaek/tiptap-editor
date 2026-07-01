import { describe, expect, it } from "vitest";
import { createBlockId, createDocumentId, createEmptyDocument, validateDocument } from "./index";

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

  it("rejects nodes outside the v1 scope", () => {
    const document = {
      schemaVersion: 1,
      type: "doc",
      attrs: { id: "doc_test" },
      content: [{ type: "figure", attrs: { id: "blk_future" }, content: [] }]
    };

    const result = validateDocument(document);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("unsupported node type: figure"))).toBe(true);
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
