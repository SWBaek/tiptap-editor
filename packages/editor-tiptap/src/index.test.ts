import { describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { validateDocument } from "@sdoc/schema";
import {
  BlockIdExtension,
  CalloutNode,
  collectJsonBlockIds,
  fromSdocDocument,
  repairJsonBlockIds,
  repairEditorBlockIds,
  toSdocDocument
} from "./index";

describe("repairJsonBlockIds", () => {
  it("preserves first-seen ids and assigns missing block ids", () => {
    let next = 0;
    const content: JSONContent = {
      type: "doc",
      content: [
        { type: "heading", attrs: { id: "blk_keep", level: 1 }, content: [{ type: "text", text: "Keep" }] },
        { type: "paragraph", content: [{ type: "text", text: "Missing" }] }
      ]
    };

    const repaired = repairJsonBlockIds(content, () => `blk_new_${next++}`);

    expect(collectJsonBlockIds(repaired)).toEqual(["blk_keep", "blk_new_0"]);
  });

  it("rewrites later duplicate ids while preserving the original block", () => {
    let next = 0;
    const content: JSONContent = {
      type: "doc",
      content: [
        { type: "paragraph", attrs: { id: "blk_dup" }, content: [{ type: "text", text: "Original" }] },
        { type: "paragraph", attrs: { id: "blk_dup" }, content: [{ type: "text", text: "Pasted copy" }] },
        {
          type: "callout",
          attrs: { id: "blk_callout", kind: "note" },
          content: [
            { type: "paragraph", attrs: { id: "blk_dup" }, content: [{ type: "text", text: "Nested duplicate" }] }
          ]
        }
      ]
    };

    const repaired = repairJsonBlockIds(content, () => `blk_repaired_${next++}`);

    expect(collectJsonBlockIds(repaired)).toEqual(["blk_dup", "blk_repaired_0", "blk_callout", "blk_repaired_1"]);
  });

  it("does not assign block ids to inline text", () => {
    const content: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { id: "blk_text" },
          content: [{ type: "text", text: "Inline" }]
        }
      ]
    };

    const repaired = repairJsonBlockIds(content, () => "blk_unused");
    expect(JSON.stringify(repaired)).not.toContain("blk_unused");
    expect(collectJsonBlockIds(repaired)).toEqual(["blk_text"]);
  });
});

describe("SDoc conversion", () => {
  it("repairs ids before converting editor JSON to SDoc", () => {
    const content: JSONContent = {
      type: "doc",
      content: [
        { type: "heading", attrs: { id: "blk_title", level: 1 }, content: [{ type: "text", text: "Title" }] },
        { type: "paragraph", attrs: { id: "blk_title" }, content: [{ type: "text", text: "Duplicate" }] }
      ]
    };

    const document = toSdocDocument(content, "doc_test");
    const validation = validateDocument(document);

    expect(validation.ok).toBe(true);
    expect(document.content[0].attrs?.id).toBe("blk_title");
    expect(document.content[1].attrs?.id).not.toBe("blk_title");
  });

  it("round-trips SDoc documents back to editor JSON", () => {
    const document = toSdocDocument(
      {
        type: "doc",
        content: [{ type: "paragraph", attrs: { id: "blk_round" }, content: [{ type: "text", text: "Round trip" }] }]
      },
      "doc_round"
    );

    expect(fromSdocDocument(document)).toEqual({
      type: "doc",
      content: [{ type: "paragraph", attrs: { id: "blk_round" }, content: [{ type: "text", text: "Round trip" }] }]
    });
  });
});

describe("BlockIdExtension", () => {
  it("repairs missing and duplicate ids in a real Tiptap editor transaction", () => {
    const editor = new Editor({
      extensions: [StarterKit, CalloutNode, BlockIdExtension],
      content: {
        type: "doc",
        content: [{ type: "paragraph", attrs: { id: "blk_initial" }, content: [{ type: "text", text: "Initial" }] }]
      }
    });

    editor.commands.setContent({
      type: "doc",
      content: [
        { type: "paragraph", attrs: { id: "blk_keep" }, content: [{ type: "text", text: "Keep" }] },
        { type: "paragraph", attrs: { id: "blk_keep" }, content: [{ type: "text", text: "Duplicate" }] },
        { type: "paragraph", content: [{ type: "text", text: "Missing" }] }
      ]
    });
    const repaired = repairEditorBlockIds(editor);

    const ids = collectJsonBlockIds(editor.getJSON());
    editor.destroy();

    expect(repaired).toBe(true);
    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe("blk_keep");
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => id.startsWith("blk_"))).toBe(true);
  });

  it("assigns ids to nested list blocks in editor state", () => {
    const editor = new Editor({
      extensions: [StarterKit, CalloutNode, BlockIdExtension],
      content: {
        type: "doc",
        content: [{ type: "paragraph", attrs: { id: "blk_initial" }, content: [{ type: "text", text: "Initial" }] }]
      }
    });

    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "List item" }] }]
            }
          ]
        }
      ]
    });
    const repaired = repairEditorBlockIds(editor);

    const ids = collectJsonBlockIds(editor.getJSON());
    editor.destroy();

    expect(repaired).toBe(true);
    expect(ids).toHaveLength(3);
    expect(ids.every((id) => id.startsWith("blk_"))).toBe(true);
    expect(new Set(ids).size).toBe(3);
  });
});
