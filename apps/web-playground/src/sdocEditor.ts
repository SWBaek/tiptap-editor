import { Extension, mergeAttributes, Node, type JSONContent } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { createBlockId, type SDocDocument, type SDocNode } from "@sdoc/schema";

const BLOCK_TYPES_WITH_IDS = [
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "bulletList",
  "orderedList",
  "listItem",
  "callout"
];

export const CalloutNode = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      kind: {
        default: "note",
        parseHTML: (element) => element.getAttribute("data-kind") ?? "note",
        renderHTML: (attributes) => ({ "data-kind": attributes.kind })
      }
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='callout']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "callout" }), 0];
  }
});

export const BlockIdExtension = Extension.create({
  name: "blockId",

  addGlobalAttributes() {
    return [
      {
        types: BLOCK_TYPES_WITH_IDS,
        attributes: {
          id: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-id"),
            renderHTML: (attributes) => (attributes.id ? { "data-id": attributes.id } : {})
          }
        }
      }
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("sdocBlockIds"),
        appendTransaction: (_transactions, _oldState, newState) => {
          const seen = new Set<string>();
          const updates: Array<{ pos: number; attrs: Record<string, unknown> }> = [];

          newState.doc.descendants((node, pos) => {
            if (!BLOCK_TYPES_WITH_IDS.includes(node.type.name)) {
              return true;
            }

            const id = typeof node.attrs.id === "string" && node.attrs.id.length > 0 ? node.attrs.id : undefined;
            if (!id || seen.has(id)) {
              updates.push({ pos, attrs: { ...node.attrs, id: createBlockId() } });
              return true;
            }

            seen.add(id);
            return true;
          });

          if (updates.length === 0) {
            return null;
          }

          const transaction = newState.tr;
          updates.forEach((update) => {
            transaction.setNodeMarkup(update.pos, undefined, update.attrs);
          });
          return transaction;
        }
      })
    ];
  }
});

export const initialContent: JSONContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { id: "blk_overview", level: 1, anchor: "overview" },
      content: [{ type: "text", text: "System Overview" }]
    },
    {
      type: "paragraph",
      attrs: { id: "blk_intro" },
      content: [{ type: "text", text: "This document describes the initial SDoc editor shell." }]
    },
    {
      type: "callout",
      attrs: { id: "blk_note", kind: "note" },
      content: [
        {
          type: "paragraph",
          attrs: { id: "blk_note_body" },
          content: [{ type: "text", text: "Every block has a stable ID for semantic diff." }]
        }
      ]
    },
    {
      type: "codeBlock",
      attrs: { id: "blk_code", language: "ts" },
      content: [{ type: "text", text: "const canonical = \"document.json\";" }]
    }
  ]
};

export function toSdocDocument(content: JSONContent, documentId = "doc_playground"): SDocDocument {
  return {
    schemaVersion: 1,
    type: "doc",
    attrs: { id: documentId },
    content: (content.content ?? []).map(toSdocNode)
  };
}

export function fromSdocDocument(document: SDocDocument): JSONContent {
  return {
    type: "doc",
    content: document.content.map(fromSdocNode)
  };
}

function toSdocNode(node: JSONContent): SDocNode {
  const sdocNode: SDocNode = {
    type: node.type ?? "paragraph"
  };

  if (node.text !== undefined) {
    sdocNode.text = node.text;
  }

  if (node.attrs && Object.keys(node.attrs).length > 0) {
    sdocNode.attrs = node.attrs as Record<string, never>;
  }

  if (node.marks && node.marks.length > 0) {
    sdocNode.marks = node.marks.map((mark) => ({
      type: mark.type,
      attrs: mark.attrs as Record<string, never> | undefined
    }));
  }

  if (node.content && node.content.length > 0) {
    sdocNode.content = node.content.map(toSdocNode);
  }

  return sdocNode;
}

function fromSdocNode(node: SDocNode): JSONContent {
  const content: JSONContent = {
    type: node.type
  };

  if (node.text !== undefined) {
    content.text = node.text;
  }

  if (node.attrs && Object.keys(node.attrs).length > 0) {
    content.attrs = node.attrs;
  }

  if (node.marks && node.marks.length > 0) {
    content.marks = node.marks.map((mark) => ({
      type: mark.type,
      attrs: mark.attrs
    }));
  }

  if (node.content && node.content.length > 0) {
    content.content = node.content.map(fromSdocNode);
  }

  return content;
}
