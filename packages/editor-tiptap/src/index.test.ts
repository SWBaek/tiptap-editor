import { describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { validateDocument } from "@sdoc/schema";
import {
  BlockIdExtension,
  CalloutNode,
  collectJsonBlockIds,
  CrossReferenceNode,
  DataGridNode,
  DiagramNode,
  EquationBlockNode,
  FigureNode,
  fromSdocDocument,
  getNextHeadingLevel,
  getSelectedBlockHumanIdTarget,
  insertCrossReference,
  insertDataGrid,
  InlineEquationNode,
  insertEquationBlock,
  insertDrawioDiagram,
  insertInlineEquation,
  insertMermaidDiagram,
  moveSelectedTopLevelBlock,
  repairJsonBlockIds,
  repairEditorBlockIds,
  runAdvancedTableCommand,
  setSelectedBlockHumanId,
  setSelectedTableCellsAlignment,
  TableExtensions,
  toSdocDocument
} from "./index";

describe("getNextHeadingLevel", () => {
  it("changes supported levels and yields at heading boundaries", () => {
    expect(getNextHeadingLevel(2, "deeper")).toBe(3);
    expect(getNextHeadingLevel(2, "shallower")).toBe(1);
    expect(getNextHeadingLevel(6, "deeper")).toBeNull();
    expect(getNextHeadingLevel(1, "shallower")).toBeNull();
    expect(getNextHeadingLevel("2", "deeper")).toBeNull();
  });
});

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

  it("preserves authored text alignment while omitting the left runtime default", () => {
    const document = toSdocDocument(
      {
        type: "doc",
        content: [
          { type: "heading", attrs: { id: "blk_center", level: 2, textAlign: "center" }, content: [{ type: "text", text: "Centered" }] },
          { type: "paragraph", attrs: { id: "blk_left", textAlign: "left" }, content: [{ type: "text", text: "Default" }] }
        ]
      },
      "doc_alignment"
    );

    expect(document.content[0].attrs).toEqual({ id: "blk_center", level: 2, textAlign: "center" });
    expect(document.content[1].attrs).toEqual({ id: "blk_left" });
    expect(validateDocument(document).ok).toBe(true);
  });

  it("round-trips task list checked state and stable block ids", () => {
    const editorJson = {
      type: "doc",
      content: [
        {
          type: "taskList",
          attrs: { id: "blk_tasks" },
          content: [
            {
              type: "taskItem",
              attrs: { id: "blk_task", checked: true },
              content: [{ type: "paragraph", attrs: { id: "blk_task_text" }, content: [{ type: "text", text: "Verify limits" }] }]
            }
          ]
        }
      ]
    };
    const document = toSdocDocument(editorJson, "doc_tasks");

    expect(validateDocument(document).ok).toBe(true);
    expect(document.content[0].attrs).toEqual({ id: "blk_tasks" });
    expect(document.content[0].content?.[0].attrs).toEqual({ checked: true, id: "blk_task" });
    expect(fromSdocDocument(document)).toEqual(editorJson);
  });

  it("normalizes link marks without editor-runtime defaults or null attrs", () => {
    const document = toSdocDocument(
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            attrs: { id: "blk_link" },
            content: [
              {
                type: "text",
                text: "Specification",
                marks: [
                  {
                    type: "link",
                    attrs: {
                      href: "https://example.com/spec",
                      target: "_blank",
                      rel: "noopener noreferrer nofollow",
                      class: null,
                      title: null
                    }
                  }
                ]
              }
            ]
          }
        ]
      },
      "doc_link"
    );

    expect(document.content[0].content?.[0].marks).toEqual([{ type: "link", attrs: { href: "https://example.com/spec" } }]);
    expect(JSON.stringify(document)).not.toContain("null");
  });

  it("preserves callout kind across SDoc conversion", () => {
    const document = toSdocDocument(
      {
        type: "doc",
        content: [
          {
            type: "callout",
            attrs: { id: "blk_warning", kind: "warning" },
            content: [{ type: "paragraph", attrs: { id: "blk_warning_body" }, content: [{ type: "text", text: "Check this" }] }]
          }
        ]
      },
      "doc_callout"
    );

    expect(fromSdocDocument(document)).toEqual({
      type: "doc",
      content: [
        {
          type: "callout",
          attrs: { id: "blk_warning", kind: "warning" },
          content: [{ type: "paragraph", attrs: { id: "blk_warning_body" }, content: [{ type: "text", text: "Check this" }] }]
        }
      ]
    });
  });

  it("preserves figure asset references while stripping preview src from SDoc", () => {
    const document = toSdocDocument(
      {
        type: "doc",
        content: [
          {
            type: "figure",
            attrs: {
              id: "blk_figure",
              assetId: "asset_diagram.png",
              alt: "Diagram",
              src: "data:image/png;base64,preview"
            },
            content: [{ type: "paragraph", attrs: { id: "blk_caption" }, content: [{ type: "text", text: "Architecture diagram" }] }]
          }
        ]
      },
      "doc_figure"
    );

    expect(document.content[0].attrs).toEqual({
      id: "blk_figure",
      assetId: "asset_diagram.png",
      alt: "Diagram"
    });
    expect(validateDocument(document).ok).toBe(true);
    expect(fromSdocDocument(document, { "asset_diagram.png": "blob:asset_diagram" })).toEqual({
      type: "doc",
      content: [
        {
          type: "figure",
          attrs: {
            id: "blk_figure",
            assetId: "asset_diagram.png",
            alt: "Diagram",
            src: "blob:asset_diagram"
          },
          content: [{ type: "paragraph", attrs: { id: "blk_caption" }, content: [{ type: "text", text: "Architecture diagram" }] }]
        }
      ]
    });
  });

  it("round-trips simple tables across SDoc conversion", () => {
    const document = toSdocDocument(
      {
        type: "doc",
        content: [
          {
            type: "table",
            attrs: { id: "blk_table", caption: "API readiness matrix" },
            content: [
              {
                type: "tableRow",
                attrs: { id: "blk_row" },
                content: [
                  {
                    type: "tableHeader",
                    attrs: { id: "blk_header" },
                    content: [{ type: "paragraph", attrs: { id: "blk_header_text" }, content: [{ type: "text", text: "Name" }] }]
                  },
                  {
                    type: "tableCell",
                    attrs: { id: "blk_cell" },
                    content: [{ type: "paragraph", attrs: { id: "blk_cell_text" }, content: [{ type: "text", text: "API" }] }]
                  }
                ]
              }
            ]
          }
        ]
      },
      "doc_table"
    );

    expect(validateDocument(document).ok).toBe(true);
    expect(fromSdocDocument(document)).toEqual({
      type: "doc",
      content: [
        {
          type: "table",
          attrs: { id: "blk_table", caption: "API readiness matrix" },
          content: [
            {
              type: "tableRow",
              attrs: { id: "blk_row" },
              content: [
                {
                  type: "tableHeader",
                  attrs: { id: "blk_header" },
                  content: [{ type: "paragraph", attrs: { id: "blk_header_text" }, content: [{ type: "text", text: "Name" }] }]
                },
                {
                  type: "tableCell",
                  attrs: { id: "blk_cell" },
                  content: [{ type: "paragraph", attrs: { id: "blk_cell_text" }, content: [{ type: "text", text: "API" }] }]
                }
              ]
            }
          ]
        }
      ]
    });
  });

  it("round-trips inline and block equations across SDoc conversion", () => {
    const document = toSdocDocument(
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            attrs: { id: "blk_equation_text" },
            content: [
              { type: "text", text: "Energy " },
              { type: "equation", attrs: { latex: "E=mc^2" } }
            ]
          },
          {
            type: "equationBlock",
            attrs: { id: "blk_equation", latex: "a^2+b^2=c^2" }
          }
        ]
      },
      "doc_equation"
    );

    expect(validateDocument(document).ok).toBe(true);
    expect(fromSdocDocument(document)).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { id: "blk_equation_text" },
          content: [
            { type: "text", text: "Energy " },
            { type: "equation", attrs: { latex: "E=mc^2" } }
          ]
        },
        {
          type: "equationBlock",
          attrs: { id: "blk_equation", latex: "a^2+b^2=c^2" }
        }
      ]
    });
  });

  it("round-trips cross references across SDoc conversion", () => {
    const document = toSdocDocument(
      {
        type: "doc",
        content: [
          { type: "heading", attrs: { id: "blk_target", level: 2 }, content: [{ type: "text", text: "Target" }] },
          {
            type: "paragraph",
            attrs: { id: "blk_ref" },
            content: [
              { type: "text", text: "See " },
              { type: "crossReference", attrs: { id: "ref_target", targetId: "blk_target" }, content: [{ type: "text", text: "Target" }] }
            ]
          }
        ]
      },
      "doc_reference"
    );

    expect(validateDocument(document).ok).toBe(true);
    expect(fromSdocDocument(document)).toEqual({
      type: "doc",
      content: [
        { type: "heading", attrs: { id: "blk_target", level: 2 }, content: [{ type: "text", text: "Target" }] },
        {
          type: "paragraph",
          attrs: { id: "blk_ref" },
          content: [
            { type: "text", text: "See " },
            { type: "crossReference", attrs: { id: "ref_target", targetId: "blk_target" }, content: [{ type: "text", text: "Target" }] }
          ]
        }
      ]
    });
  });

  it("round-trips Mermaid diagrams across SDoc conversion", () => {
    const document = toSdocDocument(
      {
        type: "doc",
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
      },
      "doc_diagram"
    );

    expect(validateDocument(document).ok).toBe(true);
    expect(fromSdocDocument(document)).toEqual({
      type: "doc",
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
    });
  });

  it("round-trips Draw.io diagrams across SDoc conversion without preview runtime state", () => {
    const document = toSdocDocument(
      {
        type: "doc",
        content: [
          {
            type: "diagram",
            attrs: {
              id: "blk_drawio",
              kind: "drawio",
              sourceAssetId: "asset_architecture.drawio",
              previewAssetId: "asset_architecture.svg",
              previewSrc: "blob:preview"
            }
          }
        ]
      },
      "doc_drawio"
    );

    expect(validateDocument(document).ok).toBe(true);
    expect(document.content[0].attrs).toEqual({
      id: "blk_drawio",
      kind: "drawio",
      sourceAssetId: "asset_architecture.drawio",
      previewAssetId: "asset_architecture.svg"
    });
    expect(fromSdocDocument(document, { "asset_architecture.svg": "blob:asset_architecture" })).toEqual({
      type: "doc",
      content: [
        {
          type: "diagram",
          attrs: {
            id: "blk_drawio",
            kind: "drawio",
            sourceAssetId: "asset_architecture.drawio",
            previewAssetId: "asset_architecture.svg",
            previewSrc: "blob:asset_architecture"
          }
        }
      ]
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
    const noOpAfterAutomaticRepair = repairEditorBlockIds(editor);

    const ids = collectJsonBlockIds(editor.getJSON());
    editor.destroy();

    expect(noOpAfterAutomaticRepair).toBe(false);
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
    const noOpAfterAutomaticRepair = repairEditorBlockIds(editor);

    const ids = collectJsonBlockIds(editor.getJSON());
    editor.destroy();

    expect(noOpAfterAutomaticRepair).toBe(false);
    expect(ids).toHaveLength(3);
    expect(ids.every((id) => id.startsWith("blk_"))).toBe(true);
    expect(new Set(ids).size).toBe(3);
  });

  it("repairs duplicated ids created by splitBlock commands", () => {
    const editor = new Editor({
      extensions: [StarterKit, CalloutNode, BlockIdExtension],
      content: {
        type: "doc",
        content: [{ type: "paragraph", attrs: { id: "blk_split" }, content: [{ type: "text", text: "Alpha Beta" }] }]
      }
    });

    editor.commands.setTextSelection(7);
    const split = editor.commands.splitBlock();

    const ids = collectJsonBlockIds(editor.getJSON());
    editor.destroy();

    expect(split).toBe(true);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe("blk_split");
    expect(ids[1]).not.toBe("blk_split");
    expect(ids[1].startsWith("blk_")).toBe(true);
  });

  it("assigns ids to list wrappers created by toggleBulletList commands", () => {
    const editor = new Editor({
      extensions: [StarterKit, CalloutNode, BlockIdExtension],
      content: {
        type: "doc",
        content: [{ type: "paragraph", attrs: { id: "blk_item" }, content: [{ type: "text", text: "List me" }] }]
      }
    });

    editor.commands.setTextSelection(3);
    const toggled = editor.commands.toggleBulletList();

    const ids = collectJsonBlockIds(editor.getJSON());
    editor.destroy();

    expect(toggled).toBe(true);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => id.startsWith("blk_"))).toBe(true);
  });

  it("preserves heading anchors in a real Tiptap editor state", () => {
    const editor = new Editor({
      extensions: [StarterKit, CalloutNode, BlockIdExtension],
      content: {
        type: "doc",
        content: [{ type: "heading", attrs: { id: "blk_heading", level: 1, anchor: "overview" }, content: [{ type: "text", text: "Overview" }] }]
      }
    });

    const document = toSdocDocument(editor.getJSON(), "doc_anchor");
    editor.destroy();

    expect(document.content[0].attrs?.anchor).toBe("overview");
  });

  it("preserves human-facing ids on block nodes", () => {
    const editor = new Editor({
      extensions: [StarterKit, CalloutNode, BlockIdExtension],
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            attrs: { id: "blk_req", humanId: "REQ-OBC-012" },
            content: [{ type: "text", text: "Requirement text" }]
          }
        ]
      }
    });

    const document = toSdocDocument(editor.getJSON(), "doc_req");
    editor.destroy();

    expect(document.content[0].attrs?.humanId).toBe("REQ-OBC-012");
  });

  it("sets and clears the selected block human-facing id", () => {
    const editor = new Editor({
      extensions: [StarterKit, CalloutNode, BlockIdExtension],
      content: {
        type: "doc",
        content: [{ type: "paragraph", attrs: { id: "blk_req" }, content: [{ type: "text", text: "Requirement text" }] }]
      }
    });

    editor.commands.setTextSelection(3);
    const before = getSelectedBlockHumanIdTarget(editor);
    const tagged = setSelectedBlockHumanId(editor, "  REQ-OBC-013  ");
    const afterTag = toSdocDocument(editor.getJSON(), "doc_req_set");
    const cleared = setSelectedBlockHumanId(editor, null);
    const afterClear = toSdocDocument(editor.getJSON(), "doc_req_clear");
    editor.destroy();

    expect(before).toEqual({ id: "blk_req", type: "paragraph", humanId: null });
    expect(tagged).toBe(true);
    expect(afterTag.content[0].attrs?.humanId).toBe("REQ-OBC-013");
    expect(cleared).toBe(true);
    expect(afterClear.content[0].attrs).not.toHaveProperty("humanId");
    expect(validateDocument(afterClear).ok).toBe(true);
  });

  it("assigns ids to figure blocks and captions in editor state", () => {
    const editor = new Editor({
      extensions: [StarterKit, FigureNode, CalloutNode, BlockIdExtension],
      content: {
        type: "doc",
        content: [
          {
            type: "figure",
            attrs: { assetId: "asset_diagram.png", alt: "Diagram", src: "blob:asset_diagram" },
            content: [{ type: "paragraph", content: [{ type: "text", text: "Architecture diagram" }] }]
          }
        ]
      }
    });

    const repaired = repairEditorBlockIds(editor);
    const ids = collectJsonBlockIds(editor.getJSON());
    const document = toSdocDocument(editor.getJSON(), "doc_figure");
    editor.destroy();

    expect(repaired).toBe(true);
    expect(ids).toHaveLength(2);
    expect(ids.every((id) => id.startsWith("blk_"))).toBe(true);
    expect(document.content[0].attrs).not.toHaveProperty("src");
    expect(validateDocument(document).ok).toBe(true);
  });

  it("assigns ids to tables inserted by Tiptap commands", () => {
    const editor = new Editor({
      extensions: [StarterKit, ...TableExtensions, FigureNode, CalloutNode, BlockIdExtension],
      content: {
        type: "doc",
        content: [{ type: "paragraph", attrs: { id: "blk_initial" }, content: [{ type: "text", text: "Initial" }] }]
      }
    });

    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
    const repaired = repairEditorBlockIds(editor);
    const document = toSdocDocument(editor.getJSON(), "doc_table");
    const ids = collectJsonBlockIds(editor.getJSON());
    editor.destroy();

    expect(repaired).toBe(false);
    expect(document.content.some((node) => node.type === "table")).toBe(true);
    expect(ids.length).toBeGreaterThanOrEqual(8);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateDocument(document).ok).toBe(true);
  });

  it("runs advanced table commands while keeping canonical table ids valid", () => {
    const editor = new Editor({
      extensions: [StarterKit, ...TableExtensions, FigureNode, CalloutNode, BlockIdExtension],
      content: {
        type: "doc",
        content: [{ type: "paragraph", attrs: { id: "blk_initial" }, content: [{ type: "text", text: "Initial" }] }]
      }
    });

    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
    editor.commands.setTextSelection(firstTableCellTextPosition(editor));
    const beforeIds = collectJsonBlockIds(editor.getJSON());
    const rowAdded = runAdvancedTableCommand(editor, "addRowAfter");
    const columnAdded = runAdvancedTableCommand(editor, "addColumnAfter");
    const aligned = setSelectedTableCellsAlignment(editor, "center");
    const document = toSdocDocument(editor.getJSON(), "doc_table_advanced");
    const afterIds = collectJsonBlockIds(editor.getJSON());
    editor.destroy();

    expect(rowAdded).toBe(true);
    expect(columnAdded).toBe(true);
    expect(aligned).toBe(true);
    expect(afterIds.length).toBeGreaterThan(beforeIds.length);
    expect(new Set(afterIds).size).toBe(afterIds.length);
    expect(JSON.stringify(document)).toContain('"align":"center"');
    expect(validateDocument(document).ok).toBe(true);
  });

  it("inserts inline and block equations with preserved latex source", () => {
    const editor = new Editor({
      extensions: [StarterKit, InlineEquationNode, EquationBlockNode, ...TableExtensions, FigureNode, CalloutNode, BlockIdExtension],
      content: {
        type: "doc",
        content: [{ type: "paragraph", attrs: { id: "blk_initial" }, content: [{ type: "text", text: "Energy " }] }]
      }
    });

    editor.commands.setTextSelection(8);
    const inlineInserted = insertInlineEquation(editor, "E=mc^2");
    const blockInserted = insertEquationBlock(editor, "a^2+b^2=c^2", "blk_equation");
    const document = toSdocDocument(editor.getJSON(), "doc_equation");
    editor.destroy();

    expect(inlineInserted).toBe(true);
    expect(blockInserted).toBe(true);
    expect(JSON.stringify(document)).toContain('"type":"equation"');
    expect(JSON.stringify(document)).toContain('"type":"equationBlock"');
    expect(document.content[1].attrs?.id).toBe("blk_equation");
    expect(validateDocument(document).ok).toBe(true);
  });

  it("inserts cross references with stable reference ids", () => {
    const editor = new Editor({
      extensions: [StarterKit, CrossReferenceNode, InlineEquationNode, EquationBlockNode, ...TableExtensions, FigureNode, CalloutNode, BlockIdExtension],
      content: {
        type: "doc",
        content: [
          { type: "heading", attrs: { id: "blk_target", level: 1 }, content: [{ type: "text", text: "Target" }] },
          { type: "paragraph", attrs: { id: "blk_initial" }, content: [{ type: "text", text: "See " }] }
        ]
      }
    });

    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    const inserted = insertCrossReference(editor, "blk_target", "ref_target", "Target");
    const document = toSdocDocument(editor.getJSON(), "doc_reference");
    editor.destroy();

    expect(inserted).toBe(true);
    expect(JSON.stringify(document)).toContain('"type":"crossReference"');
    expect(JSON.stringify(document)).toContain('"targetId":"blk_target"');
    expect(JSON.stringify(document)).toContain('"id":"ref_target"');
    expect(JSON.stringify(document)).toContain('"text":"Target"');
    expect(validateDocument(document).ok).toBe(true);
  });

  it("inserts Mermaid diagrams with preserved source", () => {
    const editor = new Editor({
      extensions: [StarterKit, InlineEquationNode, EquationBlockNode, DiagramNode, ...TableExtensions, FigureNode, CalloutNode, BlockIdExtension],
      content: {
        type: "doc",
        content: [{ type: "paragraph", attrs: { id: "blk_initial" }, content: [{ type: "text", text: "Initial" }] }]
      }
    });

    const inserted = insertMermaidDiagram(editor, "flowchart TD\nA[Start] --> B[Done]", "blk_diagram");
    const document = toSdocDocument(editor.getJSON(), "doc_diagram");
    editor.destroy();

    expect(inserted).toBe(true);
    expect(JSON.stringify(document)).toContain('"type":"diagram"');
    expect(document.content.find((node) => node.type === "diagram")?.attrs).toEqual({
      id: "blk_diagram",
      kind: "mermaid",
      source: "flowchart TD\nA[Start] --> B[Done]"
    });
    expect(validateDocument(document).ok).toBe(true);
  });

  it("inserts Draw.io diagrams with asset-backed source references", () => {
    const editor = new Editor({
      extensions: [StarterKit, InlineEquationNode, EquationBlockNode, DiagramNode, ...TableExtensions, FigureNode, CalloutNode, BlockIdExtension],
      content: {
        type: "doc",
        content: [{ type: "paragraph", attrs: { id: "blk_initial" }, content: [{ type: "text", text: "Initial" }] }]
      }
    });

    const inserted = insertDrawioDiagram(editor, "asset_architecture.drawio", "asset_architecture.svg", "blk_drawio");
    const document = toSdocDocument(editor.getJSON(), "doc_drawio");
    editor.destroy();

    expect(inserted).toBe(true);
    expect(document.content.find((node) => node.type === "diagram")?.attrs).toEqual({
      id: "blk_drawio",
      kind: "drawio",
      sourceAssetId: "asset_architecture.drawio",
      previewAssetId: "asset_architecture.svg"
    });
    expect(JSON.stringify(document)).not.toContain("previewSrc");
    expect(validateDocument(document).ok).toBe(true);
  });

  it("inserts dataGrid nodes with asset-backed source references", () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        InlineEquationNode,
        EquationBlockNode,
        DiagramNode,
        DataGridNode,
        ...TableExtensions,
        FigureNode,
        CalloutNode,
        BlockIdExtension
      ],
      content: {
        type: "doc",
        content: [{ type: "paragraph", attrs: { id: "blk_initial" }, content: [{ type: "text", text: "Initial" }] }]
      }
    });

    const inserted = insertDataGrid(editor, "asset_pinout.csv", "csv", "MCU Pinout", "Connector J1", "blk_grid", ["pin"]);
    const document = toSdocDocument(editor.getJSON(), "doc_grid");
    editor.destroy();

    expect(inserted).toBe(true);
    expect(document.content.find((node) => node.type === "dataGrid")?.attrs).toEqual({
      id: "blk_grid",
      sourceAssetId: "asset_pinout.csv",
      format: "csv",
      title: "MCU Pinout",
      caption: "Connector J1",
      keyColumns: ["pin"]
    });
    expect(JSON.stringify(document)).not.toContain("pin,signal");
    expect(validateDocument(document).ok).toBe(true);
  });
});

describe("moveSelectedTopLevelBlock", () => {
  it("moves the selected top-level block down without changing block ids", () => {
    const editor = createMoveTestEditor();
    editor.commands.setTextSelection(topLevelTextPositionById(editor, "blk_a"));
    const moved = moveSelectedTopLevelBlock(editor, "down");

    const ids = topLevelIds(editor.getJSON());
    const validation = validateDocument(toSdocDocument(editor.getJSON()));
    editor.destroy();

    expect(moved).toBe(true);
    expect(ids).toEqual(["blk_b", "blk_a", "blk_c"]);
    expect(validation.ok).toBe(true);
  });

  it("moves the selected top-level block up without changing block ids", () => {
    const editor = createMoveTestEditor();
    editor.commands.setTextSelection(topLevelTextPositionById(editor, "blk_c"));
    const moved = moveSelectedTopLevelBlock(editor, "up");

    const ids = topLevelIds(editor.getJSON());
    editor.destroy();

    expect(moved).toBe(true);
    expect(ids).toEqual(["blk_a", "blk_c", "blk_b"]);
  });

  it("does not move beyond document boundaries", () => {
    const editor = createMoveTestEditor();
    editor.commands.setTextSelection(topLevelTextPositionById(editor, "blk_a"));
    const moved = moveSelectedTopLevelBlock(editor, "up");

    const ids = topLevelIds(editor.getJSON());
    editor.destroy();

    expect(moved).toBe(false);
    expect(ids).toEqual(["blk_a", "blk_b", "blk_c"]);
  });
});

function createMoveTestEditor(): Editor {
  return new Editor({
    extensions: [StarterKit, CalloutNode, BlockIdExtension],
    content: {
      type: "doc",
      content: [
        { type: "heading", attrs: { id: "blk_a", level: 1 }, content: [{ type: "text", text: "Alpha" }] },
        { type: "paragraph", attrs: { id: "blk_b" }, content: [{ type: "text", text: "Bravo" }] },
        { type: "codeBlock", attrs: { id: "blk_c" }, content: [{ type: "text", text: "charlie();" }] }
      ]
    }
  });
}

function topLevelIds(content: JSONContent): string[] {
  return (content.content ?? []).map((node) => String(node.attrs?.id));
}

function topLevelTextPositionById(editor: Editor, id: string): number {
  let pos = 0;
  for (let index = 0; index < editor.state.doc.childCount; index += 1) {
    const node = editor.state.doc.child(index);
    if (node.attrs.id === id) {
      return pos + 1;
    }
    pos += node.nodeSize;
  }

  throw new Error(`missing top-level block ${id}`);
}

function firstTableCellTextPosition(editor: Editor): number {
  let position: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (position !== null) {
      return false;
    }

    if (node.type.name === "paragraph") {
      const parent = editor.state.doc.resolve(pos).parent;
      if (parent.type.name === "tableCell") {
        position = pos + 1;
        return false;
      }
    }

    return true;
  });

  if (position === null) {
    throw new Error("missing table cell text position");
  }

  return position;
}
