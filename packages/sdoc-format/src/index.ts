import JSZip from "jszip";
import {
  SDOC_SCHEMA_VERSION,
  type JsonValue,
  type SDocDocument,
  type SDocMark,
  type SDocNode,
  createEmptyDocument,
  validateDocument
} from "@sdoc/schema";

export const SDOC_FORMAT_VERSION = 1;
const ZIP_ENTRY_DATE = new Date("1980-01-01T00:00:00.000Z");

export type SDocFormatErrorCode =
  | "empty-file"
  | "not-zip"
  | "missing-entry"
  | "invalid-json"
  | "unsupported-format-version"
  | "unsupported-schema-version"
  | "manifest-document-mismatch"
  | "invalid-document";

export class SDocFormatError extends Error {
  constructor(
    readonly code: SDocFormatErrorCode,
    message: string
  ) {
    super(message);
    this.name = "SDocFormatError";
  }
}

export type TryUnpackSdocResult =
  | { ok: true; container: SDocContainer }
  | { ok: false; error: SDocFormatError };

export interface SDocManifest {
  format: "sdoc";
  formatVersion: typeof SDOC_FORMAT_VERSION;
  schemaVersion: typeof SDOC_SCHEMA_VERSION;
  documentId: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SDocMetadata {
  title: string;
  author?: string;
  version?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: JsonValue | undefined;
}

export interface SDocContainer {
  manifest: SDocManifest;
  document: SDocDocument;
  metadata: SDocMetadata;
  assets?: Record<string, Uint8Array>;
  derived?: Record<string, string>;
}

export function createEmptySdocContainer(options: Partial<SDocMetadata> = {}): SDocContainer {
  const document = createEmptyDocument();
  const now = new Date().toISOString();

  return {
    manifest: {
      format: "sdoc",
      formatVersion: SDOC_FORMAT_VERSION,
      schemaVersion: SDOC_SCHEMA_VERSION,
      documentId: document.attrs.id,
      createdBy: "sdoc-phase0",
      createdAt: now,
      updatedAt: now
    },
    document,
    metadata: {
      title: "Untitled",
      createdAt: now,
      updatedAt: now,
      ...options
    }
  };
}

export function stableStringify(value: unknown): string {
  return `${JSON.stringify(normalizeJson(value), null, 2)}\n`;
}

export function normalizeDocument(document: SDocDocument): SDocDocument {
  return normalizeNode(document, true) as SDocDocument;
}

export async function packSdoc(container: SDocContainer): Promise<Uint8Array> {
  assertValidContainer(container);

  const zip = new JSZip();
  zip.file("manifest.json", stableStringify(container.manifest), { date: ZIP_ENTRY_DATE });
  zip.file("document.json", stableStringify(normalizeDocument(container.document)), { date: ZIP_ENTRY_DATE });
  zip.file("metadata.json", stableStringify(container.metadata), { date: ZIP_ENTRY_DATE });

  const assets = container.assets ?? {};
  for (const [name, data] of Object.entries(assets).sort(([a], [b]) => a.localeCompare(b))) {
    zip.file(`assets/${name}`, data, { date: ZIP_ENTRY_DATE });
  }

  const derived = container.derived ?? {};
  for (const [name, data] of Object.entries(derived).sort(([a], [b]) => a.localeCompare(b))) {
    zip.file(`derived/${name}`, data, { date: ZIP_ENTRY_DATE });
  }

  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

export async function unpackSdoc(data: ArrayBuffer | Uint8Array | Buffer): Promise<SDocContainer> {
  const result = await tryUnpackSdoc(data);
  if (!result.ok) {
    throw result.error;
  }

  return result.container;
}

export async function tryUnpackSdoc(data: ArrayBuffer | Uint8Array | Buffer): Promise<TryUnpackSdocResult> {
  try {
    const bytes = toUint8Array(data);
    if (bytes.length === 0) {
      return { ok: false, error: new SDocFormatError("empty-file", "empty .sdoc file") };
    }

    if (!isLikelyZipContainer(bytes)) {
      return { ok: false, error: new SDocFormatError("not-zip", "not a ZIP-based .sdoc container") };
    }

    const zip = await JSZip.loadAsync(bytes);
    const manifest = await readJsonFile<SDocManifest>(zip, "manifest.json");
    const document = await readJsonFile<SDocDocument>(zip, "document.json");
    const metadata = await readJsonFile<SDocMetadata>(zip, "metadata.json");

    const container: SDocContainer = {
      manifest,
      document: normalizeDocument(document),
      metadata,
      assets: {},
      derived: {}
    };

    for (const path of Object.keys(zip.files).sort()) {
      const file = zip.files[path];
      if (file.dir) {
        continue;
      }

      if (path.startsWith("assets/")) {
        container.assets![path.slice("assets/".length)] = await file.async("uint8array");
      }

      if (path.startsWith("derived/")) {
        container.derived![path.slice("derived/".length)] = await file.async("string");
      }
    }

    assertValidContainer(container);
    return { ok: true, container };
  } catch (error) {
    if (error instanceof SDocFormatError) {
      return { ok: false, error };
    }

    return {
      ok: false,
      error: new SDocFormatError("not-zip", error instanceof Error ? error.message : String(error))
    };
  }
}

export function isLikelyZipContainer(data: Uint8Array): boolean {
  return (
    data.length >= 4 &&
    data[0] === 0x50 &&
    data[1] === 0x4b &&
    ((data[2] === 0x03 && data[3] === 0x04) ||
      (data[2] === 0x05 && data[3] === 0x06) ||
      (data[2] === 0x07 && data[3] === 0x08))
  );
}

function assertValidContainer(container: SDocContainer): void {
  if (container.manifest.format !== "sdoc") {
    throw new SDocFormatError("unsupported-format-version", "manifest.format must be sdoc");
  }

  if (container.manifest.formatVersion !== SDOC_FORMAT_VERSION) {
    throw new SDocFormatError(
      "unsupported-format-version",
      `unsupported sdoc formatVersion: ${container.manifest.formatVersion}`
    );
  }

  if (container.manifest.schemaVersion !== SDOC_SCHEMA_VERSION) {
    throw new SDocFormatError("unsupported-schema-version", `unsupported schemaVersion: ${container.manifest.schemaVersion}`);
  }

  if (container.manifest.documentId !== container.document.attrs.id) {
    throw new SDocFormatError("manifest-document-mismatch", "manifest.documentId must match document.attrs.id");
  }

  const validation = validateDocument(container.document);
  if (!validation.ok) {
    const messages = validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
    throw new SDocFormatError("invalid-document", `invalid document: ${messages}`);
  }

  const assets = container.assets ?? {};
  const missingAssetIds = collectReferencedAssetIds(container.document).filter((assetId) => !(assetId in assets));
  if (missingAssetIds.length > 0) {
    throw new SDocFormatError("invalid-document", `missing assets: ${missingAssetIds.join(", ")}`);
  }
}

function collectReferencedAssetIds(document: SDocDocument): string[] {
  const assetIds = new Set<string>();

  function visit(node: SDocNode): void {
    if (node.type === "figure" && typeof node.attrs?.assetId === "string" && node.attrs.assetId.length > 0) {
      assetIds.add(node.attrs.assetId);
    }

    node.content?.forEach(visit);
  }

  document.content.forEach(visit);
  return [...assetIds].sort((a, b) => a.localeCompare(b));
}

async function readJsonFile<T>(zip: JSZip, path: string): Promise<T> {
  const file = zip.file(path);
  if (!file) {
    throw new SDocFormatError("missing-entry", `missing ${path}`);
  }

  try {
    return JSON.parse(stripBom(await file.async("string"))) as T;
  } catch (error) {
    throw new SDocFormatError(
      "invalid-json",
      `invalid JSON in ${path}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function toUint8Array(data: ArrayBuffer | Uint8Array | Buffer): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }

  return new Uint8Array(data);
}

function normalizeNode(node: SDocNode, includeSchemaVersion = false): SDocNode {
  const normalized: Record<string, unknown> = {};

  if (includeSchemaVersion && "schemaVersion" in node) {
    normalized.schemaVersion = (node as SDocDocument).schemaVersion;
  }

  normalized.type = node.type;

  if (node.text !== undefined) {
    normalized.text = node.text;
  }

  const attrs = normalizeAttrs(node.attrs);
  if (attrs) {
    normalized.attrs = attrs;
  }

  const marks = normalizeMarks(node.marks);
  if (marks) {
    normalized.marks = marks;
  }

  const content = node.content?.map((child) => normalizeNode(child));
  if (content && content.length > 0) {
    normalized.content = content;
  } else if (node.type === "doc") {
    normalized.content = [];
  }

  return sortObject(normalized) as unknown as SDocNode;
}

function normalizeMarks(marks: SDocMark[] | undefined): SDocMark[] | undefined {
  if (!marks || marks.length === 0) {
    return undefined;
  }

  return marks
    .map((mark) => {
      const attrs = normalizeAttrs(mark.attrs);
      return sortObject(attrs ? { type: mark.type, attrs } : { type: mark.type }) as unknown as SDocMark;
    })
    .sort((a, b) => a.type.localeCompare(b.type));
}

function normalizeAttrs(attrs: Record<string, unknown> | undefined): Record<string, JsonValue> | undefined {
  if (!attrs) {
    return undefined;
  }

  const cleaned: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(attrs)) {
    const normalized = normalizeAttrValue(value);
    if (normalized !== undefined) {
      cleaned[key] = normalized;
    }
  }

  return Object.keys(cleaned).length > 0 ? (sortObject(cleaned) as Record<string, JsonValue>) : undefined;
}

function normalizeAttrValue(value: unknown): JsonValue | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const items = value.map(normalizeAttrValue).filter((item): item is JsonValue => item !== undefined);
    return items;
  }

  if (typeof value === "object") {
    return normalizeJson(value) as JsonValue;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return undefined;
}

function normalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(normalizeJson)
      .filter((item) => item !== undefined);
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort(compareKeys)) {
      const normalized = normalizeJson((value as Record<string, unknown>)[key]);
      if (normalized !== undefined) {
        result[key] = normalized;
      }
    }

    return result;
  }

  if (value === undefined) {
    return undefined;
  }

  return value;
}

function sortObject(value: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort(compareKeys)) {
    sorted[key] = value[key];
  }

  return sorted;
}

function compareKeys(a: string, b: string): number {
  const order = ["schemaVersion", "type", "text", "attrs", "marks", "content"];
  const aIndex = order.indexOf(a);
  const bIndex = order.indexOf(b);

  if (aIndex !== -1 || bIndex !== -1) {
    return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
  }

  return a.localeCompare(b);
}
