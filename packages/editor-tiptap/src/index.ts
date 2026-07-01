import { Extension, mergeAttributes, Node, type JSONContent } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { createBlockId, type SDocDocument, type SDocNode } from "@sdoc/schema";

export const BLOCK_TYPES_WITH_IDS = [
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "bulletList",
  "orderedList",
  "listItem",
  "callout"
] as const;

const blockTypeSet = new Set<string>(BLOCK_TYPES_WITH_IDS);
const BLOCK_ID_REPAIR_META = "sdocBlockIdRepair";

export type BlockMoveDirection = "up" | "down";

export interface EditorBlockIdTarget {
  state: {
    doc: BlockIdDocument;
    tr: BlockIdTransaction;
  };
  view: {
    dispatch: (transaction: any) => void;
  };
}

interface BlockIdNode {
  type: { name: string };
  attrs: Record<string, unknown>;
}

interface BlockIdDocument {
  descendants: (callback: (node: BlockIdNode, pos: number) => boolean) => void;
}

interface BlockIdTransaction {
  setNodeMarkup: (pos: number, type?: any, attrs?: Record<string, unknown>) => unknown;
  setMeta?: (key: string, value: unknown) => unknown;
}

export interface EditorBlockMoveTarget {
  state: {
    doc: TopLevelDocument;
    selection: {
      $from: {
        index: (depth: number) => number;
      };
    };
    tr: BlockMoveTransaction;
  };
  view: {
    dispatch: (transaction: any) => void;
  };
}

interface TopLevelDocument {
  childCount: number;
  child: (index: number) => TopLevelNode;
}

interface TopLevelNode {
  nodeSize: number;
}

interface BlockMoveTransaction {
  delete: (from: number, to: number) => BlockMoveTransaction;
  insert: (pos: number, node: any) => BlockMoveTransaction;
  scrollIntoView?: () => BlockMoveTransaction;
}

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

  onTransaction({ editor, transaction }) {
    if (!transaction.docChanged || transaction.getMeta(BLOCK_ID_REPAIR_META)) {
      return;
    }

    repairEditorBlockIds(editor);
  },

  addGlobalAttributes() {
    return [
      {
        types: [...BLOCK_TYPES_WITH_IDS],
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
          const updates = findBlockIdUpdates(newState.doc);
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

export function repairEditorBlockIds(editor: EditorBlockIdTarget): boolean {
  const updates = findBlockIdUpdates(editor.state.doc);
  if (updates.length === 0) {
    return false;
  }

  const transaction = editor.state.tr;
  transaction.setMeta?.(BLOCK_ID_REPAIR_META, true);
  updates.forEach((update) => {
    transaction.setNodeMarkup(update.pos, undefined, update.attrs);
  });
  editor.view.dispatch(transaction);
  return true;
}

export function canMoveSelectedTopLevelBlock(editor: EditorBlockMoveTarget, direction: BlockMoveDirection): boolean {
  return getMoveSelectedTopLevelBlockRange(editor.state, direction) !== null;
}

export function moveSelectedTopLevelBlock(editor: EditorBlockMoveTarget, direction: BlockMoveDirection): boolean {
  const move = getMoveSelectedTopLevelBlockRange(editor.state, direction);
  if (!move) {
    return false;
  }

  let transaction = editor.state.tr.delete(move.from, move.to);
  transaction = transaction.insert(move.insertAtAfterDelete, move.node);
  transaction.scrollIntoView?.();
  editor.view.dispatch(transaction);
  return true;
}

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

export function repairJsonBlockIds(content: JSONContent, createId = createBlockId): JSONContent {
  const seen = new Set<string>();

  function visit(node: JSONContent): JSONContent {
    const repaired: JSONContent = {
      ...node,
      attrs: node.attrs ? { ...node.attrs } : undefined,
      marks: node.marks ? node.marks.map((mark) => ({ ...mark, attrs: mark.attrs ? { ...mark.attrs } : undefined })) : undefined,
      content: node.content?.map(visit)
    };

    if (!repaired.type || !blockTypeSet.has(repaired.type)) {
      return removeEmptyCollections(repaired);
    }

    const attrs = { ...(repaired.attrs ?? {}) };
    const id = typeof attrs.id === "string" && attrs.id.length > 0 ? attrs.id : undefined;

    if (!id || seen.has(id)) {
      attrs.id = createId();
    }

    seen.add(String(attrs.id));
    repaired.attrs = attrs;
    return removeEmptyCollections(repaired);
  }

  return visit(content);
}

export function collectJsonBlockIds(content: JSONContent): string[] {
  const ids: string[] = [];

  function visit(node: JSONContent): void {
    if (node.type && blockTypeSet.has(node.type)) {
      const id = node.attrs?.id;
      if (typeof id === "string" && id.length > 0) {
        ids.push(id);
      }
    }

    node.content?.forEach(visit);
  }

  visit(content);
  return ids;
}

export function toSdocDocument(content: JSONContent, documentId = "doc_playground"): SDocDocument {
  const repaired = repairJsonBlockIds(content);
  return {
    schemaVersion: 1,
    type: "doc",
    attrs: { id: documentId },
    content: (repaired.content ?? []).map(toSdocNode)
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

function removeEmptyCollections(content: JSONContent): JSONContent {
  const cleaned = { ...content };
  if (cleaned.attrs && Object.keys(cleaned.attrs).length === 0) {
    delete cleaned.attrs;
  }
  if (cleaned.marks && cleaned.marks.length === 0) {
    delete cleaned.marks;
  }
  if (cleaned.content && cleaned.content.length === 0) {
    delete cleaned.content;
  }
  return cleaned;
}

interface TopLevelBlockRange {
  index: number;
  from: number;
  to: number;
  node: TopLevelNode;
}

interface TopLevelBlockMove {
  from: number;
  to: number;
  insertAtAfterDelete: number;
  node: TopLevelNode;
}

function getMoveSelectedTopLevelBlockRange(
  state: EditorBlockMoveTarget["state"],
  direction: BlockMoveDirection
): TopLevelBlockMove | null {
  const index = state.selection.$from.index(0);
  if (index < 0 || index >= state.doc.childCount) {
    return null;
  }

  const current = getTopLevelBlockRange(state.doc, index);
  if (!current) {
    return null;
  }

  if (direction === "up") {
    const previous = getTopLevelBlockRange(state.doc, current.index - 1);
    if (!previous) {
      return null;
    }

    return {
      from: current.from,
      to: current.to,
      insertAtAfterDelete: previous.from,
      node: current.node
    };
  }

  const next = getTopLevelBlockRange(state.doc, current.index + 1);
  if (!next) {
    return null;
  }

  return {
    from: current.from,
    to: current.to,
    insertAtAfterDelete: current.from + next.node.nodeSize,
    node: current.node
  };
}

function getTopLevelBlockRange(doc: TopLevelDocument, index: number): TopLevelBlockRange | null {
  if (index < 0 || index >= doc.childCount) {
    return null;
  }

  let from = 0;
  for (let i = 0; i < index; i += 1) {
    from += doc.child(i).nodeSize;
  }

  const node = doc.child(index);
  return {
    index,
    from,
    to: from + node.nodeSize,
    node
  };
}

function findBlockIdUpdates(doc: BlockIdDocument): Array<{ pos: number; attrs: Record<string, unknown> }> {
  const seen = new Set<string>();
  const updates: Array<{ pos: number; attrs: Record<string, unknown> }> = [];

  doc.descendants((node, pos) => {
    if (!blockTypeSet.has(node.type.name)) {
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

  return updates;
}
