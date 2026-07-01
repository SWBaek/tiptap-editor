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
  "callout"
]);

export const INLINE_NODE_TYPES = new Set(["text", "hardBreak", "crossReference"]);

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

export function getPlainText(node: SDocNode): string {
  if (node.type === "text") {
    return node.text ?? "";
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

  if (typedNode.type === "crossReference") {
    const targetId = typedNode.attrs?.targetId;
    if (typeof targetId !== "string" || targetId.length === 0) {
      issues.push({ path: `${path}.attrs.targetId`, message: "crossReference targetId is required" });
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
