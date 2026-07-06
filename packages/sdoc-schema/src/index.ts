export const SDOC_SCHEMA_VERSION = 1;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface SDocMark {
  type: string;
  attrs?: Record<string, JsonValue>;
}

export interface SDocNode {
  type: string;
  attrs?: Record<string, JsonValue>;
  content?: SDocNode[];
  marks?: SDocMark[];
  text?: string;
}

export interface SDocDocument extends SDocNode {
  schemaVersion: typeof SDOC_SCHEMA_VERSION;
  type: "doc";
  attrs: {
    id: string;
    [key: string]: JsonValue;
  };
  content: SDocNode[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

export const BLOCK_NODE_TYPES = new Set([
  "doc",
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
  "dataGrid",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader"
]);

export const INLINE_NODE_TYPES = new Set(["text", "hardBreak", "crossReference", "equation"]);

export const MARK_TYPES = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "link",
  "textColor",
  "highlight"
]);

const TABLE_CELL_ALIGNMENTS = new Set(["left", "center", "right"]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isBlockNode(node: SDocNode): boolean {
  return BLOCK_NODE_TYPES.has(node.type);
}

export function getNodeId(node: SDocNode): string | undefined {
  const id = node.attrs?.id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

export function getNodeAnchor(node: SDocNode): string | undefined {
  const anchor = node.attrs?.anchor;
  return typeof anchor === "string" && anchor.length > 0 ? anchor : undefined;
}

export function getNodeHumanId(node: SDocNode): string | undefined {
  const humanId = node.attrs?.humanId;
  return typeof humanId === "string" && humanId.length > 0 ? humanId : undefined;
}

export function getPlainText(node: SDocNode): string {
  if (node.type === "text") {
    return node.text ?? "";
  }

  if (node.type === "equation" || node.type === "equationBlock") {
    return typeof node.attrs?.latex === "string" ? node.attrs.latex : "";
  }

  if (node.type === "diagram") {
    if (node.attrs?.kind === "drawio") {
      return typeof node.attrs.sourceAssetId === "string" ? node.attrs.sourceAssetId : "";
    }

    return typeof node.attrs?.source === "string" ? node.attrs.source : "";
  }

  if (node.type === "dataGrid") {
    const parts = [
      typeof node.attrs?.title === "string" ? node.attrs.title : "",
      typeof node.attrs?.caption === "string" ? node.attrs.caption : "",
      typeof node.attrs?.sourceAssetId === "string" ? node.attrs.sourceAssetId : ""
    ].filter((part) => part.trim().length > 0);
    return parts.join("\n");
  }

  return (node.content ?? []).map(getPlainText).join("");
}

export function createDocumentId(): string {
  return `doc_${createOpaqueId()}`;
}

export function createBlockId(): string {
  return `blk_${createOpaqueId()}`;
}

export function createReferenceId(): string {
  return `ref_${createOpaqueId()}`;
}

export function createAssetId(): string {
  return `asset_${createOpaqueId()}`;
}

export function createEmptyDocument(id = createDocumentId()): SDocDocument {
  return {
    schemaVersion: SDOC_SCHEMA_VERSION,
    type: "doc",
    attrs: { id },
    content: []
  };
}

export function validateDocument(document: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!isRecord(document)) {
    return { ok: false, issues: [{ path: "$", message: "document must be an object" }] };
  }

  if (document.schemaVersion !== SDOC_SCHEMA_VERSION) {
    issues.push({
      path: "$.schemaVersion",
      message: `schemaVersion must be ${SDOC_SCHEMA_VERSION}`
    });
  }

  if (document.type !== "doc") {
    issues.push({ path: "$.type", message: "root type must be doc" });
  }

  if (!isRecord(document.attrs) || typeof document.attrs.id !== "string" || document.attrs.id.length === 0) {
    issues.push({ path: "$.attrs.id", message: "root document id is required" });
  }

  if (!Array.isArray(document.content)) {
    issues.push({ path: "$.content", message: "root content must be an array" });
  }

  const ids = new Map<string, string>();
  if (Array.isArray(document.content)) {
    document.content.forEach((node, index) => validateNode(node, `$.content[${index}]`, issues, ids));
  }

  return { ok: issues.length === 0, issues };
}

function validateNode(
  node: unknown,
  path: string,
  issues: ValidationIssue[],
  ids: Map<string, string>
): void {
  if (!isRecord(node)) {
    issues.push({ path, message: "node must be an object" });
    return;
  }

  if (typeof node.type !== "string" || node.type.length === 0) {
    issues.push({ path: `${path}.type`, message: "node type is required" });
    return;
  }

  const typedNode = node as unknown as SDocNode;
  if (typedNode.type === "text") {
    if (typeof typedNode.text !== "string") {
      issues.push({ path: `${path}.text`, message: "text node must contain text" });
    }
  } else if (!BLOCK_NODE_TYPES.has(typedNode.type) && !INLINE_NODE_TYPES.has(typedNode.type)) {
    issues.push({ path: `${path}.type`, message: `unsupported node type: ${typedNode.type}` });
  }

  if (isBlockNode(typedNode)) {
    const id = getNodeId(typedNode);
    if (!id) {
      issues.push({ path: `${path}.attrs.id`, message: "block node id is required" });
    } else if (ids.has(id)) {
      issues.push({ path: `${path}.attrs.id`, message: `duplicate block id, first seen at ${ids.get(id)}` });
    } else {
      ids.set(id, path);
    }
  }

  const humanId = typedNode.attrs?.humanId;
  if (humanId !== undefined && (typeof humanId !== "string" || humanId.trim().length === 0)) {
    issues.push({ path: `${path}.attrs.humanId`, message: "humanId must be a non-empty string when present" });
  }

  if (typedNode.type === "crossReference") {
    const targetId = typedNode.attrs?.targetId;
    if (typeof targetId !== "string" || targetId.length === 0) {
      issues.push({ path: `${path}.attrs.targetId`, message: "crossReference targetId is required" });
    }
  }

  if (typedNode.type === "equation" || typedNode.type === "equationBlock") {
    const latex = typedNode.attrs?.latex;
    if (typeof latex !== "string" || latex.trim().length === 0) {
      issues.push({ path: `${path}.attrs.latex`, message: `${typedNode.type} latex is required` });
    }
  }

  if (typedNode.type === "diagram") {
    const kind = typedNode.attrs?.kind;
    if (kind === "mermaid") {
      const source = typedNode.attrs?.source;
      if (typeof source !== "string" || source.trim().length === 0) {
        issues.push({ path: `${path}.attrs.source`, message: "Mermaid diagram source is required" });
      }
    } else if (kind === "drawio") {
      const sourceAssetId = typedNode.attrs?.sourceAssetId;
      if (typeof sourceAssetId !== "string" || sourceAssetId.length === 0) {
        issues.push({ path: `${path}.attrs.sourceAssetId`, message: "Draw.io diagram sourceAssetId is required" });
      }

      const previewAssetId = typedNode.attrs?.previewAssetId;
      if (previewAssetId !== undefined && (typeof previewAssetId !== "string" || previewAssetId.length === 0)) {
        issues.push({ path: `${path}.attrs.previewAssetId`, message: "Draw.io diagram previewAssetId must be a non-empty string" });
      }

      const source = typedNode.attrs?.source;
      if (typeof source === "string" && source.trim().length > 0) {
        issues.push({ path: `${path}.attrs.source`, message: "Draw.io diagram source must be stored as an asset reference" });
      }
    } else {
      issues.push({ path: `${path}.attrs.kind`, message: "diagram kind must be mermaid or drawio" });
    }
  }

  if (typedNode.type === "dataGrid") {
    const sourceAssetId = typedNode.attrs?.sourceAssetId;
    if (typeof sourceAssetId !== "string" || sourceAssetId.length === 0) {
      issues.push({ path: `${path}.attrs.sourceAssetId`, message: "dataGrid sourceAssetId is required" });
    }

    const format = typedNode.attrs?.format;
    if (format !== "csv" && format !== "json") {
      issues.push({ path: `${path}.attrs.format`, message: "dataGrid format must be csv or json" });
    }

    const title = typedNode.attrs?.title;
    if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
      issues.push({ path: `${path}.attrs.title`, message: "dataGrid title must be a non-empty string when present" });
    }

    const caption = typedNode.attrs?.caption;
    if (caption !== undefined && (typeof caption !== "string" || caption.trim().length === 0)) {
      issues.push({ path: `${path}.attrs.caption`, message: "dataGrid caption must be a non-empty string when present" });
    }

    validateDataGridKeyColumns(typedNode.attrs?.keyColumns, `${path}.attrs.keyColumns`, issues);

    if (Array.isArray(typedNode.content) && typedNode.content.length > 0) {
      issues.push({ path: `${path}.content`, message: "dataGrid content must not store grid rows" });
    }
  }

  if (typedNode.type === "figure") {
    const assetId = typedNode.attrs?.assetId;
    if (typeof assetId !== "string" || assetId.length === 0) {
      issues.push({ path: `${path}.attrs.assetId`, message: "figure assetId is required" });
    }

    const caption = Array.isArray(typedNode.content) ? typedNode.content.find((child) => child.type === "paragraph") : undefined;
    if (!caption || getPlainText(caption).trim().length === 0) {
      issues.push({ path: `${path}.content`, message: "figure caption paragraph is required" });
    }
  }

  if (typedNode.type === "table") {
    const caption = typedNode.attrs?.caption;
    if (caption !== undefined && (typeof caption !== "string" || caption.trim().length === 0)) {
      issues.push({ path: `${path}.attrs.caption`, message: "table caption must be a non-empty string when present" });
    }

    validateRequiredChildTypes(typedNode, path, issues, "table", ["tableRow"]);
  }

  if (typedNode.type === "tableRow") {
    validateRequiredChildTypes(typedNode, path, issues, "tableRow", ["tableCell", "tableHeader"]);
  }

  if (typedNode.type === "tableCell" || typedNode.type === "tableHeader") {
    if (!Array.isArray(typedNode.content) || typedNode.content.length === 0) {
      issues.push({ path: `${path}.content`, message: `${typedNode.type} content is required` });
    }

    const align = typedNode.attrs?.align;
    if (align !== undefined && (typeof align !== "string" || !TABLE_CELL_ALIGNMENTS.has(align))) {
      issues.push({ path: `${path}.attrs.align`, message: `${typedNode.type} align must be left, center, or right` });
    }
  }

  if (typedNode.marks !== undefined) {
    validateMarks(typedNode.marks, `${path}.marks`, issues);
  }

  if (typedNode.content !== undefined) {
    if (!Array.isArray(typedNode.content)) {
      issues.push({ path: `${path}.content`, message: "content must be an array" });
      return;
    }

    typedNode.content.forEach((child, index) => validateNode(child, `${path}.content[${index}]`, issues, ids));
  }
}

function validateRequiredChildTypes(
  node: SDocNode,
  path: string,
  issues: ValidationIssue[],
  parentType: string,
  allowedChildTypes: string[]
): void {
  if (!Array.isArray(node.content) || node.content.length === 0) {
    issues.push({ path: `${path}.content`, message: `${parentType} content is required` });
    return;
  }

  node.content.forEach((child, index) => {
    if (!isRecord(child)) {
      return;
    }

    const childType = child.type;
    if (typeof childType === "string" && !allowedChildTypes.includes(childType)) {
      issues.push({
        path: `${path}.content[${index}].type`,
        message: `${parentType} child must be ${allowedChildTypes.join(" or ")}`
      });
    }
  });
}

function validateDataGridKeyColumns(value: JsonValue | undefined, path: string, issues: ValidationIssue[]): void {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    issues.push({ path, message: "dataGrid keyColumns must be an array of non-empty strings when present" });
    return;
  }

  if (value.length === 0) {
    issues.push({ path, message: "dataGrid keyColumns must not be empty when present" });
    return;
  }

  const seen = new Set<string>();
  value.forEach((column, index) => {
    if (typeof column !== "string" || column.trim().length === 0) {
      issues.push({ path: `${path}[${index}]`, message: "dataGrid keyColumns entries must be non-empty strings" });
      return;
    }

    const normalized = column.trim().toLowerCase();
    if (seen.has(normalized)) {
      issues.push({ path: `${path}[${index}]`, message: `dataGrid keyColumns duplicates ${column.trim()}` });
    } else {
      seen.add(normalized);
    }
  });
}

function validateMarks(marks: unknown, path: string, issues: ValidationIssue[]): void {
  if (!Array.isArray(marks)) {
    issues.push({ path, message: "marks must be an array" });
    return;
  }

  marks.forEach((mark, index) => {
    const markPath = `${path}[${index}]`;
    if (!isRecord(mark)) {
      issues.push({ path: markPath, message: "mark must be an object" });
      return;
    }

    if (typeof mark.type !== "string" || mark.type.length === 0) {
      issues.push({ path: `${markPath}.type`, message: "mark type is required" });
      return;
    }

    if (!MARK_TYPES.has(mark.type)) {
      issues.push({ path: `${markPath}.type`, message: `unsupported mark type: ${mark.type}` });
    }
  });
}

function createOpaqueId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID().replaceAll("-", "").slice(0, 26).toLowerCase();
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}
