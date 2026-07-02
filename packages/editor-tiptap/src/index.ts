import { Extension, mergeAttributes, Node, type JSONContent } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import katex from "katex";
import { createBlockId, type JsonValue, type SDocDocument, type SDocNode } from "@sdoc/schema";

export const BLOCK_TYPES_WITH_IDS = [
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "bulletList",
  "orderedList",
  "listItem",
  "callout",
  "figure",
  "equationBlock",
  "diagram",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader"
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

export const FigureNode = Node.create({
  name: "figure",
  group: "block",
  content: "paragraph",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      assetId: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("data-asset-id") ?? element.querySelector("img")?.getAttribute("data-asset-id") ?? null,
        renderHTML: () => ({})
      },
      alt: {
        default: "",
        parseHTML: (element) => element.querySelector("img")?.getAttribute("alt") ?? "",
        renderHTML: () => ({})
      },
      src: {
        default: null,
        parseHTML: (element) => element.querySelector("img")?.getAttribute("src") ?? null,
        renderHTML: () => ({})
      }
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-type='figure']", contentElement: "figcaption" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const imageAttributes: Record<string, string> = {
      "data-asset-id": String(node.attrs.assetId ?? ""),
      alt: String(node.attrs.alt ?? "")
    };

    if (typeof node.attrs.src === "string" && node.attrs.src.length > 0) {
      imageAttributes.src = node.attrs.src;
    }

    return [
      "figure",
      mergeAttributes(HTMLAttributes, { "data-type": "figure" }),
      ["img", imageAttributes],
      ["figcaption", 0]
    ];
  }
});

export const InlineEquationNode = Node.create({
  name: "equation",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-latex") ?? stripMathDelimiters(element.textContent ?? ""),
        renderHTML: (attributes) => ({ "data-latex": attributes.latex })
      }
    };
  },

  parseHTML() {
    return [{ tag: "span[data-type='equation']" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const latex = String(node.attrs.latex ?? "");
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-type": "equation", class: "sdoc-inline-equation" }),
      `$${latex}$`
    ];
  },

  addNodeView() {
    return createEquationNodeView("span", "equation", false);
  }
});

export const EquationBlockNode = Node.create({
  name: "equationBlock",
  group: "block",
  atom: true,
  defining: true,
  selectable: true,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-latex") ?? stripMathDelimiters(element.textContent ?? ""),
        renderHTML: (attributes) => ({ "data-latex": attributes.latex })
      }
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='equationBlock']" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const latex = String(node.attrs.latex ?? "");
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "equationBlock", class: "sdoc-equation-block" }),
      `$$\n${latex}\n$$`
    ];
  },

  addNodeView() {
    return createEquationNodeView("div", "equationBlock", true);
  }
});

export const DiagramNode = Node.create({
  name: "diagram",
  group: "block",
  atom: true,
  defining: true,
  selectable: true,

  addAttributes() {
    return {
      kind: {
        default: "mermaid",
        parseHTML: (element) => element.getAttribute("data-kind") ?? "mermaid",
        renderHTML: (attributes) => ({ "data-kind": attributes.kind })
      },
      source: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-source") ?? element.textContent ?? "",
        renderHTML: () => ({})
      }
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='diagram']" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const source = String(node.attrs.source ?? "");
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "diagram", class: "sdoc-diagram" }),
      ["pre", source]
    ];
  },

  addNodeView() {
    return createDiagramNodeView();
  }
});

export const TableNode = Table.configure({
  resizable: false,
  HTMLAttributes: {
    "data-type": "table"
  }
});

export const TableRowNode = TableRow;
export const TableCellNode = TableCell;
export const TableHeaderNode = TableHeader;
export const TableExtensions = [TableNode, TableRowNode, TableHeaderNode, TableCellNode] as const;

export interface TableInsertTarget {
  chain: () => unknown;
}

interface TableChain {
  focus: () => {
    insertTable: (options: { rows: number; cols: number; withHeaderRow: boolean }) => { run: () => boolean };
  };
}

export function insertSimpleTable(editor: TableInsertTarget, rows = 3, cols = 2): boolean {
  const chain = editor.chain() as TableChain;
  return chain.focus().insertTable({ rows, cols, withHeaderRow: true }).run();
}

export interface EquationInsertTarget {
  chain: () => unknown;
  getJSON?: () => unknown;
}

interface InsertContentChain {
  focus: () => {
    insertContent: (content: JSONContent) => { run: () => boolean };
  };
}

export function insertInlineEquation(editor: EquationInsertTarget, latex: string): boolean {
  const before = fingerprintEditorJson(editor);
  const chain = editor.chain() as InsertContentChain;
  const result = chain.focus().insertContent({ type: "equation", attrs: { latex } }).run();
  return result || fingerprintEditorJson(editor) !== before;
}

export function insertEquationBlock(editor: EquationInsertTarget, latex: string, id = createBlockId()): boolean {
  const before = fingerprintEditorJson(editor);
  const chain = editor.chain() as InsertContentChain;
  const result = chain.focus().insertContent({ type: "equationBlock", attrs: { id, latex } }).run();
  return result || fingerprintEditorJson(editor) !== before;
}

export interface DiagramInsertTarget {
  chain: () => unknown;
  getJSON?: () => unknown;
}

export function insertMermaidDiagram(editor: DiagramInsertTarget, source: string, id = createBlockId()): boolean {
  const before = fingerprintEditorJson(editor);
  const chain = editor.chain() as InsertContentChain;
  const result = chain.focus().insertContent({ type: "diagram", attrs: { id, kind: "mermaid", source } }).run();
  return result || fingerprintEditorJson(editor) !== before;
}

function fingerprintEditorJson(editor: EquationInsertTarget): string {
  return editor.getJSON ? JSON.stringify(editor.getJSON()) : "";
}

function createEquationNodeView(tagName: "span" | "div", nodeType: "equation" | "equationBlock", displayMode: boolean) {
  return ({ node }: { node: { type: { name: string }; attrs: Record<string, unknown> } }) => {
    const dom = document.createElement(tagName);

    function render(currentNode: typeof node): void {
      const latex = typeof currentNode.attrs.latex === "string" ? currentNode.attrs.latex : "";
      dom.className = displayMode ? "sdoc-equation-block" : "sdoc-inline-equation";
      dom.setAttribute("data-type", nodeType);
      dom.setAttribute("data-latex", latex);
      dom.setAttribute("title", latex);
      dom.innerHTML = renderKatex(latex, displayMode);
    }

    render(node);

    return {
      dom,
      update(updatedNode: typeof node) {
        if (updatedNode.type.name !== nodeType) {
          return false;
        }

        render(updatedNode);
        return true;
      }
    };
  };
}

function renderKatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: "ignore"
    });
  } catch {
    return escapeHtml(latex);
  }
}

function stripMathDelimiters(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("$$") && trimmed.endsWith("$$")) {
    return trimmed.slice(2, -2).trim();
  }

  if (trimmed.startsWith("$") && trimmed.endsWith("$")) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

let diagramRenderSequence = 0;
let mermaidInitialized = false;

function createDiagramNodeView() {
  return ({ node }: { node: { type: { name: string }; attrs: Record<string, unknown> } }) => {
    const dom = document.createElement("div");
    let renderVersion = 0;

    function render(currentNode: typeof node): void {
      const source = typeof currentNode.attrs.source === "string" ? currentNode.attrs.source : "";
      const kind = typeof currentNode.attrs.kind === "string" ? currentNode.attrs.kind : "mermaid";
      renderVersion += 1;
      const version = renderVersion;

      dom.className = "sdoc-diagram";
      dom.setAttribute("data-type", "diagram");
      dom.setAttribute("data-kind", kind);
      dom.setAttribute("data-source", source);
      dom.innerHTML = `<pre>${escapeHtml(source)}</pre>`;

      if (kind !== "mermaid" || source.trim().length === 0) {
        return;
      }

      void renderMermaidInto(dom, source, version, () => renderVersion);
    }

    render(node);

    return {
      dom,
      update(updatedNode: typeof node) {
        if (updatedNode.type.name !== "diagram") {
          return false;
        }

        render(updatedNode);
        return true;
      }
    };
  };
}

async function renderMermaidInto(
  container: HTMLElement,
  source: string,
  version: number,
  getCurrentVersion: () => number
): Promise<void> {
  try {
    const mermaidModule = await import("mermaid");
    const mermaid = mermaidModule.default;
    if (!mermaidInitialized) {
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "default" });
      mermaidInitialized = true;
    }

    const id = `sdoc-mermaid-${++diagramRenderSequence}`;
    const { svg } = await mermaid.render(id, source);
    if (getCurrentVersion() !== version) {
      return;
    }

    container.innerHTML = svg;
  } catch (error) {
    if (getCurrentVersion() !== version) {
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    container.innerHTML = `<pre>${escapeHtml(source)}</pre><div class="sdoc-diagram-error">${escapeHtml(message)}</div>`;
  }
}

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
      },
      {
        types: ["heading"],
        attributes: {
          anchor: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-anchor"),
            renderHTML: (attributes) => (attributes.anchor ? { "data-anchor": attributes.anchor } : {})
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

export function fromSdocDocument(document: SDocDocument, assetSources: Record<string, string> = {}): JSONContent {
  return {
    type: "doc",
    content: document.content.map((node) => fromSdocNode(node, assetSources))
  };
}

function toSdocNode(node: JSONContent): SDocNode {
  const sdocNode: SDocNode = {
    type: node.type ?? "paragraph"
  };

  if (node.text !== undefined) {
    sdocNode.text = node.text;
  }

  const attrs = getCanonicalAttrs(node);
  if (attrs && Object.keys(attrs).length > 0) {
    sdocNode.attrs = attrs;
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

function fromSdocNode(node: SDocNode, assetSources: Record<string, string>): JSONContent {
  const content: JSONContent = {
    type: node.type
  };

  if (node.text !== undefined) {
    content.text = node.text;
  }

  const attrs = getEditorAttrs(node, assetSources);
  if (attrs && Object.keys(attrs).length > 0) {
    content.attrs = attrs;
  }

  if (node.marks && node.marks.length > 0) {
    content.marks = node.marks.map((mark) => ({
      type: mark.type,
      attrs: mark.attrs
    }));
  }

  if (node.content && node.content.length > 0) {
    content.content = node.content.map((child) => fromSdocNode(child, assetSources));
  }

  return content;
}

function getCanonicalAttrs(node: JSONContent): Record<string, JsonValue> | undefined {
  if (!node.attrs || Object.keys(node.attrs).length === 0) {
    return undefined;
  }

  const attrs = { ...(node.attrs as Record<string, JsonValue>) };
  if (node.type === "figure") {
    delete attrs.src;
  }
  return attrs;
}

function getEditorAttrs(node: SDocNode, assetSources: Record<string, string>): Record<string, JsonValue> | undefined {
  if (!node.attrs || Object.keys(node.attrs).length === 0) {
    return undefined;
  }

  const attrs = { ...node.attrs };
  if (node.type === "figure") {
    const assetId = typeof attrs.assetId === "string" ? attrs.assetId : undefined;
    const src = assetId ? assetSources[assetId] : undefined;
    if (src) {
      attrs.src = src;
    }
  }
  return attrs;
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
