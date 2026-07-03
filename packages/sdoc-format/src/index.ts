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

export type DataGridDiagnosticSeverity = "error" | "warning";

export interface DataGridDiagnosticIssue {
  severity: DataGridDiagnosticSeverity;
  gridId: string;
  sourceAssetId: string;
  row?: number;
  column?: number;
  message: string;
}

export interface DataGridDiagnosticSummary {
  gridId: string;
  title: string;
  sourceAssetId: string;
  format: "csv" | "json";
  rowCount: number;
  columnCount: number;
  issues: DataGridDiagnosticIssue[];
}

export interface DataGridDiagnostics {
  gridCount: number;
  errorCount: number;
  warningCount: number;
  summaries: DataGridDiagnosticSummary[];
}

export interface DiagramSourceStore {
  collectReferencedAssetIds(node: SDocNode): string[];
}

export const assetBackedDiagramSourceStore: DiagramSourceStore = {
  collectReferencedAssetIds(node) {
    if (node.type !== "diagram" || node.attrs?.kind !== "drawio") {
      return [];
    }

    const assetIds: string[] = [];
    const sourceAssetId = node.attrs.sourceAssetId;
    if (typeof sourceAssetId === "string" && sourceAssetId.length > 0) {
      assetIds.push(sourceAssetId);
    }

    const previewAssetId = node.attrs.previewAssetId;
    if (typeof previewAssetId === "string" && previewAssetId.length > 0) {
      assetIds.push(previewAssetId);
    }

    return assetIds;
  }
};

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

export function collectReferencedAssetIds(
  document: SDocDocument,
  diagramSourceStore: DiagramSourceStore = assetBackedDiagramSourceStore
): string[] {
  const assetIds = new Set<string>();

  function visit(node: SDocNode): void {
    if (node.type === "figure" && typeof node.attrs?.assetId === "string" && node.attrs.assetId.length > 0) {
      assetIds.add(node.attrs.assetId);
    }

    for (const assetId of diagramSourceStore.collectReferencedAssetIds(node)) {
      assetIds.add(assetId);
    }

    if (node.type === "dataGrid" && typeof node.attrs?.sourceAssetId === "string" && node.attrs.sourceAssetId.length > 0) {
      assetIds.add(node.attrs.sourceAssetId);
    }

    node.content?.forEach(visit);
  }

  document.content.forEach(visit);
  return [...assetIds].sort((a, b) => a.localeCompare(b));
}

export function createDataGridDiagnostics(document: SDocDocument, assets: Record<string, Uint8Array> = {}): DataGridDiagnostics {
  const summaries: DataGridDiagnosticSummary[] = [];

  function visit(node: SDocNode): void {
    if (node.type === "dataGrid") {
      summaries.push(createDataGridDiagnosticSummary(node, assets));
    }

    node.content?.forEach(visit);
  }

  document.content.forEach(visit);
  const issues = summaries.flatMap((summary) => summary.issues);
  return {
    gridCount: summaries.length,
    errorCount: issues.filter((issue) => issue.severity === "error").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
    summaries
  };
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

function createDataGridDiagnosticSummary(node: SDocNode, assets: Record<string, Uint8Array>): DataGridDiagnosticSummary {
  const gridId = typeof node.attrs?.id === "string" ? node.attrs.id : "unknown-grid";
  const sourceAssetId = typeof node.attrs?.sourceAssetId === "string" ? node.attrs.sourceAssetId : "";
  const format = node.attrs?.format === "json" ? "json" : "csv";
  const title = typeof node.attrs?.title === "string" && node.attrs.title.trim().length > 0 ? node.attrs.title.trim() : sourceAssetId || gridId;
  const issueBase = { gridId, sourceAssetId };
  const asset = assets[sourceAssetId];

  if (!asset) {
    return {
      gridId,
      title,
      sourceAssetId,
      format,
      rowCount: 0,
      columnCount: 0,
      issues: [{ ...issueBase, severity: "error", message: `Missing dataGrid source asset ${sourceAssetId || "(empty)"}` }]
    };
  }

  const source = decodeUtf8Asset(asset);
  if (format === "json") {
    return createJsonDataGridDiagnosticSummary(gridId, title, sourceAssetId, source);
  }

  return createCsvDataGridDiagnosticSummary(gridId, title, sourceAssetId, source);
}

function createCsvDataGridDiagnosticSummary(
  gridId: string,
  title: string,
  sourceAssetId: string,
  source: string
): DataGridDiagnosticSummary {
  const issues: DataGridDiagnosticIssue[] = [];
  const parsed = parseCsvRecordsWithDiagnostics(source);
  issues.push(...parsed.issues.map((issue) => ({ ...issue, gridId, sourceAssetId })));
  const records = parsed.records.filter((row) => row.some((cell) => cell.trim().length > 0));

  if (records.length === 0) {
    issues.push({ severity: "error", gridId, sourceAssetId, message: "CSV data grid is empty" });
    return { gridId, title, sourceAssetId, format: "csv", rowCount: 0, columnCount: 0, issues };
  }

  const [header, ...body] = records;
  const columnCount = Math.max(header.length, ...body.map((row) => row.length));
  const seenHeaders = new Map<string, number>();
  header.forEach((cell, index) => {
    const normalized = cell.trim().toLowerCase();
    if (normalized.length === 0) {
      issues.push({ severity: "warning", gridId, sourceAssetId, row: 1, column: index + 1, message: "CSV header cell is empty" });
      return;
    }

    const previous = seenHeaders.get(normalized);
    if (previous !== undefined) {
      issues.push({
        severity: "warning",
        gridId,
        sourceAssetId,
        row: 1,
        column: index + 1,
        message: `CSV header duplicates column ${previous}`
      });
    } else {
      seenHeaders.set(normalized, index + 1);
    }
  });

  records.forEach((row, index) => {
    if (row.length !== columnCount) {
      issues.push({
        severity: "warning",
        gridId,
        sourceAssetId,
        row: index + 1,
        message: `CSV row has ${row.length} cells; expected ${columnCount}`
      });
    }
  });

  return { gridId, title, sourceAssetId, format: "csv", rowCount: body.length, columnCount, issues };
}

function createJsonDataGridDiagnosticSummary(
  gridId: string,
  title: string,
  sourceAssetId: string,
  source: string
): DataGridDiagnosticSummary {
  const issues: DataGridDiagnosticIssue[] = [];
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    return {
      gridId,
      title,
      sourceAssetId,
      format: "json",
      rowCount: 0,
      columnCount: 0,
      issues: [
        {
          severity: "error",
          gridId,
          sourceAssetId,
          message: `Invalid JSON data grid: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }

  if (!Array.isArray(value)) {
    return {
      gridId,
      title,
      sourceAssetId,
      format: "json",
      rowCount: 0,
      columnCount: 0,
      issues: [{ severity: "error", gridId, sourceAssetId, message: "JSON data grid root must be an array" }]
    };
  }

  if (value.length === 0) {
    return {
      gridId,
      title,
      sourceAssetId,
      format: "json",
      rowCount: 0,
      columnCount: 0,
      issues: [{ severity: "error", gridId, sourceAssetId, message: "JSON data grid array is empty" }]
    };
  }

  if (value.every((row) => Array.isArray(row))) {
    const rows = value as unknown[][];
    const columnCount = Math.max(0, ...rows.map((row) => row.length));
    rows.forEach((row, index) => {
      if (row.length !== columnCount) {
        issues.push({
          severity: "warning",
          gridId,
          sourceAssetId,
          row: index + 1,
          message: `JSON array row has ${row.length} cells; expected ${columnCount}`
        });
      }
    });
    return { gridId, title, sourceAssetId, format: "json", rowCount: rows.length, columnCount, issues };
  }

  if (value.every((row) => isPlainObject(row))) {
    const rows = value as Array<Record<string, unknown>>;
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    if (columns.length === 0) {
      issues.push({ severity: "error", gridId, sourceAssetId, message: "JSON object rows do not define any columns" });
    }

    rows.forEach((row, index) => {
      const missingColumns = columns.filter((column) => !(column in row));
      if (missingColumns.length > 0) {
        issues.push({
          severity: "warning",
          gridId,
          sourceAssetId,
          row: index + 1,
          message: `JSON object row is missing columns: ${missingColumns.join(", ")}`
        });
      }
    });
    return { gridId, title, sourceAssetId, format: "json", rowCount: rows.length, columnCount: columns.length, issues };
  }

  return {
    gridId,
    title,
    sourceAssetId,
    format: "json",
    rowCount: value.length,
    columnCount: 0,
    issues: [{ severity: "error", gridId, sourceAssetId, message: "JSON data grid rows must be all arrays or all objects" }]
  };
}

function parseCsvRecordsWithDiagnostics(source: string): {
  records: string[][];
  issues: Array<Omit<DataGridDiagnosticIssue, "gridId" | "sourceAssetId">>;
} {
  const records: string[][] = [];
  const issues: Array<Omit<DataGridDiagnosticIssue, "gridId" | "sourceAssetId">> = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let currentRow = 1;
  let quoteStartRow = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
        if (inQuotes) {
          quoteStartRow = currentRow;
        }
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      records.push(row);
      row = [];
      cell = "";
      currentRow += 1;
      continue;
    }

    if ((char === "\n" || char === "\r") && inQuotes) {
      currentRow += 1;
    }
    cell += char;
  }

  row.push(cell);
  records.push(row);

  if (inQuotes) {
    issues.push({ severity: "error", row: quoteStartRow || currentRow, message: "CSV quoted field is not closed" });
  }

  return { records, issues };
}

function decodeUtf8Asset(data: Uint8Array): string {
  return new TextDecoder().decode(data).replace(/^\uFEFF/, "");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
