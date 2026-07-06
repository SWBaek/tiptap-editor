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
  keyColumns: string[];
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

export type DataGridRowDiffSeverity = "info" | "warning" | "error";
export type DataGridRowDiffEventKind = "row-added" | "row-deleted" | "cell-modified" | "conflict";

export interface DataGridRowDiffEvent {
  kind: DataGridRowDiffEventKind;
  severity: DataGridRowDiffSeverity;
  gridId: string;
  sourceAssetId: string;
  rowKey?: string;
  column?: string;
  oldValue?: string;
  newValue?: string;
  oldRow?: Record<string, string>;
  newRow?: Record<string, string>;
  message: string;
}

export interface CreateDataGridRowDiffOptions {
  gridId: string;
  sourceAssetId: string;
  format: "csv" | "json";
  oldSource: string;
  newSource: string;
  keyColumns?: string[];
}

export interface DataGridRowDiff {
  gridId: string;
  sourceAssetId: string;
  format: "csv" | "json";
  keyColumns: string[];
  hasReliableKey: boolean;
  oldRowCount: number;
  newRowCount: number;
  events: DataGridRowDiffEvent[];
}

export interface ApplyDataGridRowMergeOptions {
  gridId: string;
  sourceAssetId: string;
  format: "csv" | "json";
  baselineSource: string;
  proposedSource: string;
  currentSource: string;
  event: DataGridRowDiffEvent;
  keyColumns?: string[];
}

export type ApplyDataGridRowMergeResult =
  | {
      ok: true;
      source: string;
      diff: DataGridRowDiff;
      appliedEvent: DataGridRowDiffEvent;
    }
  | {
      ok: false;
      reason: "conflict" | "stale" | "unsupported";
      message: string;
      diff: DataGridRowDiff;
    };

export type DataGridAssetRevisionPolicy = "update" | "revision";

export interface ApplyDataGridAssetRevisionOptions {
  sourceAssetId: string;
  source: string;
  format: "csv" | "json";
  assets?: Record<string, Uint8Array>;
  policy?: DataGridAssetRevisionPolicy;
}

export type ApplyDataGridAssetRevisionResult =
  | {
      ok: true;
      sourceAssetId: string;
      previousSourceAssetId: string;
      assets: Record<string, Uint8Array>;
      createdRevision: boolean;
    }
  | {
      ok: false;
      reason: "missing-asset" | "asset-conflict";
      message: string;
      sourceAssetId: string;
    };

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

export function createDataGridRowDiff(options: CreateDataGridRowDiffOptions): DataGridRowDiff {
  const oldGrid = parseDataGridRows(options.oldSource, options.format);
  const newGrid = parseDataGridRows(options.newSource, options.format);
  const events: DataGridRowDiffEvent[] = [
    ...oldGrid.issues.map((message) => createDataGridRowDiffConflict(options, message)),
    ...newGrid.issues.map((message) => createDataGridRowDiffConflict(options, message))
  ];
  const keyColumns = resolveDataGridKeyColumns(oldGrid.columns, newGrid.columns, options.keyColumns);

  if (keyColumns.length === 0) {
    return {
      gridId: options.gridId,
      sourceAssetId: options.sourceAssetId,
      format: options.format,
      keyColumns: [],
      hasReliableKey: false,
      oldRowCount: oldGrid.rows.length,
      newRowCount: newGrid.rows.length,
      events: [
        ...events,
        createDataGridRowDiffConflict(
          options,
          "No reliable row key found; row-level diff requires explicit keyColumns or a shared id/key/name column"
        )
      ]
    };
  }

  const oldIndexed = indexDataGridRows(options, oldGrid.rows, keyColumns, "old");
  const newIndexed = indexDataGridRows(options, newGrid.rows, keyColumns, "new");
  events.push(...oldIndexed.events, ...newIndexed.events);

  if (events.some((event) => event.severity === "error")) {
    return {
      gridId: options.gridId,
      sourceAssetId: options.sourceAssetId,
      format: options.format,
      keyColumns,
      hasReliableKey: true,
      oldRowCount: oldGrid.rows.length,
      newRowCount: newGrid.rows.length,
      events
    };
  }

  const allKeys = [...new Set([...oldIndexed.rows.keys(), ...newIndexed.rows.keys()])].sort((a, b) => a.localeCompare(b));
  for (const rowKey of allKeys) {
    const oldRow = oldIndexed.rows.get(rowKey);
    const newRow = newIndexed.rows.get(rowKey);
    if (!oldRow && newRow) {
      events.push({
        kind: "row-added",
        severity: "info",
        gridId: options.gridId,
        sourceAssetId: options.sourceAssetId,
        rowKey,
        newRow: copyDataGridRowForEvent(newRow),
        message: `Row ${rowKey} was added`
      });
      continue;
    }

    if (oldRow && !newRow) {
      events.push({
        kind: "row-deleted",
        severity: "info",
        gridId: options.gridId,
        sourceAssetId: options.sourceAssetId,
        rowKey,
        oldRow: copyDataGridRowForEvent(oldRow),
        message: `Row ${rowKey} was deleted`
      });
      continue;
    }

    if (!oldRow || !newRow) {
      continue;
    }

    const columns = [...new Set([...Object.keys(oldRow), ...Object.keys(newRow)])].sort((a, b) => a.localeCompare(b));
    for (const column of columns) {
      if (keyColumns.includes(column)) {
        continue;
      }

      const oldValue = oldRow[column] ?? "";
      const newValue = newRow[column] ?? "";
      if (oldValue !== newValue) {
        events.push({
          kind: "cell-modified",
          severity: "info",
          gridId: options.gridId,
          sourceAssetId: options.sourceAssetId,
          rowKey,
          column,
          oldValue,
          newValue,
          message: `Row ${rowKey} column ${column} changed`
        });
      }
    }
  }

  return {
    gridId: options.gridId,
    sourceAssetId: options.sourceAssetId,
    format: options.format,
    keyColumns,
    hasReliableKey: true,
    oldRowCount: oldGrid.rows.length,
    newRowCount: newGrid.rows.length,
    events
  };
}

export function applyDataGridRowMerge(options: ApplyDataGridRowMergeOptions): ApplyDataGridRowMergeResult {
  const diff = createDataGridRowDiff({
    gridId: options.gridId,
    sourceAssetId: options.sourceAssetId,
    format: options.format,
    oldSource: options.baselineSource,
    newSource: options.proposedSource,
    keyColumns: options.keyColumns
  });

  if (!diff.hasReliableKey || diff.events.some((event) => event.kind === "conflict")) {
    return { ok: false, reason: "conflict", message: "Row merge requires a conflict-free diff with reliable row keys", diff };
  }

  const currentDiff = createDataGridRowDiff({
    gridId: options.gridId,
    sourceAssetId: options.sourceAssetId,
    format: options.format,
    oldSource: options.baselineSource,
    newSource: options.currentSource,
    keyColumns: options.keyColumns
  });
  if (currentDiff.events.length > 0) {
    return { ok: false, reason: "stale", message: "Current data grid source changed since the row diff was created", diff };
  }

  const matchingEvent = diff.events.find((event) => dataGridRowDiffEventsMatch(event, options.event));
  if (!matchingEvent) {
    return { ok: false, reason: "stale", message: "Requested row merge event is no longer present", diff };
  }

  if (matchingEvent.kind === "conflict") {
    return { ok: false, reason: "conflict", message: matchingEvent.message, diff };
  }

  const baselineGrid = parseDataGridRows(options.baselineSource, options.format);
  const proposedGrid = parseDataGridRows(options.proposedSource, options.format);
  const currentGrid = parseDataGridRows(options.currentSource, options.format);
  const columns = mergeDataGridColumns(currentGrid.columns, proposedGrid.columns);
  const keyColumns = diff.keyColumns;
  const baselineRows = indexDataGridRows(options, baselineGrid.rows, keyColumns, "old").rows;
  const proposedRows = indexDataGridRows(options, proposedGrid.rows, keyColumns, "new").rows;
  const mergedRows = [...currentGrid.rows];

  if (matchingEvent.kind === "row-added") {
    const proposedRow = matchingEvent.rowKey ? proposedRows.get(matchingEvent.rowKey) : undefined;
    if (!proposedRow) {
      return { ok: false, reason: "stale", message: "Added row is no longer available in proposed source", diff };
    }
    mergedRows.push(copyDataGridRow(proposedRow, columns));
  }

  if (matchingEvent.kind === "row-deleted") {
    const rowIndex = findDataGridRowIndex(mergedRows, keyColumns, matchingEvent.rowKey);
    if (rowIndex < 0 || (matchingEvent.rowKey && !baselineRows.has(matchingEvent.rowKey))) {
      return { ok: false, reason: "stale", message: "Deleted row is no longer available in current source", diff };
    }
    mergedRows.splice(rowIndex, 1);
  }

  if (matchingEvent.kind === "cell-modified") {
    if (!matchingEvent.column) {
      return { ok: false, reason: "unsupported", message: "Cell merge event is missing a column", diff };
    }
    const rowIndex = findDataGridRowIndex(mergedRows, keyColumns, matchingEvent.rowKey);
    if (rowIndex < 0) {
      return { ok: false, reason: "stale", message: "Modified row is no longer available in current source", diff };
    }
    mergedRows[rowIndex] = { ...mergedRows[rowIndex], [matchingEvent.column]: matchingEvent.newValue ?? "" };
    if (!columns.includes(matchingEvent.column)) {
      columns.push(matchingEvent.column);
    }
  }

  return {
    ok: true,
    source: serializeDataGridRows(mergedRows, columns, options.format),
    diff,
    appliedEvent: matchingEvent
  };
}

export function applyDataGridAssetRevision(options: ApplyDataGridAssetRevisionOptions): ApplyDataGridAssetRevisionResult {
  const policy = options.policy ?? "update";
  const assets = options.assets ?? {};
  const currentAsset = assets[options.sourceAssetId];
  if (!currentAsset) {
    return {
      ok: false,
      reason: "missing-asset",
      message: `Missing dataGrid source asset ${options.sourceAssetId}`,
      sourceAssetId: options.sourceAssetId
    };
  }

  const encodedSource = new TextEncoder().encode(options.source);
  if (policy === "update") {
    return {
      ok: true,
      sourceAssetId: options.sourceAssetId,
      previousSourceAssetId: options.sourceAssetId,
      assets: { ...assets, [options.sourceAssetId]: encodedSource },
      createdRevision: false
    };
  }

  const revisionAssetId = createDataGridRevisionAssetId(options.sourceAssetId, assets, options.format);
  return {
    ok: true,
    sourceAssetId: revisionAssetId,
    previousSourceAssetId: options.sourceAssetId,
    assets: { ...assets, [revisionAssetId]: encodedSource },
    createdRevision: true
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
  const keyColumns = getDataGridKeyColumns(node);
  const issueBase = { gridId, sourceAssetId };
  const asset = assets[sourceAssetId];

  if (!asset) {
    return {
      gridId,
      title,
      sourceAssetId,
      format,
      keyColumns,
      rowCount: 0,
      columnCount: 0,
      issues: [{ ...issueBase, severity: "error", message: `Missing dataGrid source asset ${sourceAssetId || "(empty)"}` }]
    };
  }

  const source = decodeUtf8Asset(asset);
  if (format === "json") {
    return createJsonDataGridDiagnosticSummary(gridId, title, sourceAssetId, source, keyColumns);
  }

  return createCsvDataGridDiagnosticSummary(gridId, title, sourceAssetId, source, keyColumns);
}

function createCsvDataGridDiagnosticSummary(
  gridId: string,
  title: string,
  sourceAssetId: string,
  source: string,
  keyColumns: string[]
): DataGridDiagnosticSummary {
  const issues: DataGridDiagnosticIssue[] = [];
  const parsed = parseCsvRecordsWithDiagnostics(source);
  issues.push(...parsed.issues.map((issue) => ({ ...issue, gridId, sourceAssetId })));
  const records = parsed.records.filter((row) => row.some((cell) => cell.trim().length > 0));

  if (records.length === 0) {
    issues.push({ severity: "error", gridId, sourceAssetId, message: "CSV data grid is empty" });
    return { gridId, title, sourceAssetId, format: "csv", keyColumns, rowCount: 0, columnCount: 0, issues };
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
  addMissingDataGridKeyColumnIssues(issues, gridId, sourceAssetId, header, keyColumns);

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

  return { gridId, title, sourceAssetId, format: "csv", keyColumns, rowCount: body.length, columnCount, issues };
}

function createJsonDataGridDiagnosticSummary(
  gridId: string,
  title: string,
  sourceAssetId: string,
  source: string,
  keyColumns: string[]
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
      keyColumns,
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
      keyColumns,
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
      keyColumns,
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
    addMissingDataGridKeyColumnIssues(issues, gridId, sourceAssetId, [], keyColumns);
    return { gridId, title, sourceAssetId, format: "json", keyColumns, rowCount: rows.length, columnCount, issues };
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
    addMissingDataGridKeyColumnIssues(issues, gridId, sourceAssetId, columns, keyColumns);
    return { gridId, title, sourceAssetId, format: "json", keyColumns, rowCount: rows.length, columnCount: columns.length, issues };
  }

  return {
    gridId,
    title,
    sourceAssetId,
    format: "json",
    keyColumns,
    rowCount: value.length,
    columnCount: 0,
    issues: [{ severity: "error", gridId, sourceAssetId, message: "JSON data grid rows must be all arrays or all objects" }]
  };
}

function getDataGridKeyColumns(node: SDocNode): string[] {
  const keyColumns = node.attrs?.keyColumns;
  if (!Array.isArray(keyColumns)) {
    return [];
  }

  return keyColumns.filter((column): column is string => typeof column === "string" && column.trim().length > 0).map((column) => column.trim());
}

function addMissingDataGridKeyColumnIssues(
  issues: DataGridDiagnosticIssue[],
  gridId: string,
  sourceAssetId: string,
  columns: string[],
  keyColumns: string[]
): void {
  if (keyColumns.length === 0) {
    return;
  }

  const availableColumns = new Set(columns.map((column) => column.trim().toLowerCase()).filter(Boolean));
  for (const keyColumn of keyColumns) {
    if (!availableColumns.has(keyColumn.trim().toLowerCase())) {
      issues.push({
        severity: "error",
        gridId,
        sourceAssetId,
        message: `dataGrid keyColumn ${keyColumn} is missing from source columns`
      });
    }
  }
}

function parseDataGridRows(
  source: string,
  format: "csv" | "json"
): { columns: string[]; rows: Array<Record<string, string>>; issues: string[] } {
  if (format === "json") {
    return parseJsonDataGridRows(source);
  }

  return parseCsvDataGridRows(source);
}

function parseCsvDataGridRows(source: string): { columns: string[]; rows: Array<Record<string, string>>; issues: string[] } {
  const parsed = parseCsvRecordsWithDiagnostics(source);
  const records = parsed.records.filter((row) => row.some((cell) => cell.trim().length > 0));
  const issues = parsed.issues.map((issue) => issue.message);
  if (records.length === 0) {
    return { columns: [], rows: [], issues: [...issues, "CSV data grid is empty"] };
  }

  const [header, ...body] = records;
  const columns = header.map((cell, index) => cell.trim() || `column_${index + 1}`);
  const rows = body.map((row) => {
    const record: Record<string, string> = {};
    columns.forEach((column, index) => {
      record[column] = row[index] ?? "";
    });
    return record;
  });

  return { columns, rows, issues };
}

function parseJsonDataGridRows(source: string): { columns: string[]; rows: Array<Record<string, string>>; issues: string[] } {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    return { columns: [], rows: [], issues: [`Invalid JSON data grid: ${error instanceof Error ? error.message : String(error)}`] };
  }

  if (!Array.isArray(value)) {
    return { columns: [], rows: [], issues: ["JSON data grid root must be an array"] };
  }

  if (!value.every((row) => isPlainObject(row))) {
    return { columns: [], rows: [], issues: ["JSON row-level diff requires object rows"] };
  }

  const objectRows = value as Array<Record<string, unknown>>;
  const columns = [...new Set(objectRows.flatMap((row) => Object.keys(row)))];
  const rows = objectRows.map((row) => {
    const record: Record<string, string> = {};
    columns.forEach((column) => {
      record[column] = stringifyDataGridCellValue(row[column]);
    });
    return record;
  });

  return { columns, rows, issues: columns.length === 0 && rows.length > 0 ? ["JSON object rows do not define any columns"] : [] };
}

function resolveDataGridKeyColumns(oldColumns: string[], newColumns: string[], requestedKeyColumns: string[] | undefined): string[] {
  const sharedColumns = new Set(oldColumns.filter((column) => newColumns.includes(column)));
  const requested = (requestedKeyColumns ?? []).filter((column) => sharedColumns.has(column));
  if (requested.length > 0) {
    return requested;
  }

  for (const candidate of ["id", "key", "name"]) {
    const match = [...sharedColumns].find((column) => column.toLowerCase() === candidate);
    if (match) {
      return [match];
    }
  }

  return [];
}

function indexDataGridRows(
  options: Pick<CreateDataGridRowDiffOptions, "gridId" | "sourceAssetId">,
  rows: Array<Record<string, string>>,
  keyColumns: string[],
  side: "old" | "new"
): { rows: Map<string, Record<string, string>>; events: DataGridRowDiffEvent[] } {
  const indexedRows = new Map<string, Record<string, string>>();
  const events: DataGridRowDiffEvent[] = [];

  rows.forEach((row, index) => {
    const rowKey = createDataGridRowKey(row, keyColumns);
    const readableRowKey = keyColumns.map((column) => `${column}=${row[column]?.trim() ?? ""}`).join(", ");
    if (rowKey.replace(/\u001f/g, "").length === 0) {
      events.push(
        createDataGridRowDiffConflict(options, `${side} row ${index + 1} has an empty key`, readableRowKey || undefined)
      );
      return;
    }

    if (indexedRows.has(rowKey)) {
      events.push(createDataGridRowDiffConflict(options, `${side} row ${index + 1} duplicates key ${readableRowKey}`, readableRowKey));
      return;
    }

    indexedRows.set(rowKey, row);
  });

  return { rows: indexedRows, events };
}

function createDataGridRowDiffConflict(
  options: Pick<CreateDataGridRowDiffOptions, "gridId" | "sourceAssetId">,
  message: string,
  rowKey?: string
): DataGridRowDiffEvent {
  return {
    kind: "conflict",
    severity: "error",
    gridId: options.gridId,
    sourceAssetId: options.sourceAssetId,
    rowKey,
    message
  };
}

function stringifyDataGridCellValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function dataGridRowDiffEventsMatch(left: DataGridRowDiffEvent, right: DataGridRowDiffEvent): boolean {
  return (
    left.kind === right.kind &&
    left.gridId === right.gridId &&
    left.sourceAssetId === right.sourceAssetId &&
    left.rowKey === right.rowKey &&
    left.column === right.column &&
    left.oldValue === right.oldValue &&
    left.newValue === right.newValue
  );
}

function mergeDataGridColumns(left: string[], right: string[]): string[] {
  return [...left, ...right.filter((column) => !left.includes(column))];
}

function copyDataGridRow(row: Record<string, string>, columns: string[]): Record<string, string> {
  const copied: Record<string, string> = {};
  columns.forEach((column) => {
    copied[column] = row[column] ?? "";
  });
  return copied;
}

function copyDataGridRowForEvent(row: Record<string, string>): Record<string, string> {
  const copied: Record<string, string> = {};
  Object.keys(row)
    .sort((a, b) => a.localeCompare(b))
    .forEach((column) => {
      copied[column] = row[column] ?? "";
    });
  return copied;
}

function findDataGridRowIndex(rows: Array<Record<string, string>>, keyColumns: string[], rowKey: string | undefined): number {
  if (!rowKey) {
    return -1;
  }

  return rows.findIndex((row) => createDataGridRowKey(row, keyColumns) === rowKey);
}

function createDataGridRowKey(row: Record<string, string>, keyColumns: string[]): string {
  return keyColumns.map((column) => row[column]?.trim() ?? "").join("\u001f");
}

function serializeDataGridRows(rows: Array<Record<string, string>>, columns: string[], format: "csv" | "json"): string {
  if (format === "json") {
    const jsonRows = rows.map((row) => {
      const result: Record<string, string> = {};
      columns.forEach((column) => {
        result[column] = row[column] ?? "";
      });
      return result;
    });
    return `${JSON.stringify(jsonRows, null, 2)}\n`;
  }

  return `${[columns, ...rows.map((row) => columns.map((column) => row[column] ?? ""))]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n")}\n`;
}

function createDataGridRevisionAssetId(sourceAssetId: string, assets: Record<string, Uint8Array>, format: "csv" | "json"): string {
  const extension = sourceAssetId.includes(".") ? sourceAssetId.slice(sourceAssetId.lastIndexOf(".")) : `.${format}`;
  const base = sourceAssetId.endsWith(extension) ? sourceAssetId.slice(0, -extension.length) : sourceAssetId;
  let index = 1;
  let candidate = `${base}.rev${index}${extension}`;
  while (assets[candidate]) {
    index += 1;
    candidate = `${base}.rev${index}${extension}`;
  }

  return candidate;
}

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
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
