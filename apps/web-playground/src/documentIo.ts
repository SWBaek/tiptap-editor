import { exportDerivedOutputs, exportHtml, exportMarkdown } from "@sdoc/export";
import { collectReferencedAssetIds, createEmptySdocContainer, packSdoc, unpackSdoc, type SDocMetadata } from "@sdoc/format";
import { createEmptyDocument, type SDocDocument, validateDocument } from "@sdoc/schema";

export interface OpenDocumentInput {
  name: string;
  data: ArrayBuffer | Uint8Array;
  fallbackMetadata: SDocMetadata;
}

export interface OpenDocumentResult {
  document: SDocDocument;
  metadata: SDocMetadata;
  assets: SDocAssets;
  statusMessage: string;
}

export interface CreateSdocPayloadResult {
  bytes: Uint8Array;
  filename: string;
}

export interface CreateMarkdownPayloadResult {
  text: string;
  filename: string;
}

export interface CreateHtmlPayloadResult {
  text: string;
  filename: string;
}

export type SDocAssets = Record<string, Uint8Array>;

export async function createSdocPayload(
  document: SDocDocument,
  metadata: SDocMetadata,
  now = new Date(),
  assets: SDocAssets = {}
): Promise<CreateSdocPayloadResult> {
  const timestamp = now.toISOString();
  const container = createEmptySdocContainer({ ...metadata, updatedAt: timestamp });
  const derived = exportDerivedOutputs(document);
  const referencedAssets = selectReferencedAssets(document, assets);

  const bytes = await packSdoc({
    ...container,
    manifest: {
      ...container.manifest,
      documentId: document.attrs.id,
      updatedAt: timestamp
    },
    document,
    metadata: {
      ...container.metadata,
      ...metadata,
      updatedAt: timestamp
    },
    assets: referencedAssets,
    derived
  });

  return {
    bytes,
    filename: `${safeFilename(metadata.title || "document")}.sdoc`
  };
}

export function createMarkdownPayload(document: SDocDocument, metadata: SDocMetadata): CreateMarkdownPayloadResult {
  return {
    text: exportMarkdown(document),
    filename: `${safeFilename(metadata.title || "document")}.md`
  };
}

export function createHtmlPayload(document: SDocDocument, metadata: SDocMetadata, assets: SDocAssets = {}): CreateHtmlPayloadResult {
  return {
    text: exportHtml(document, {
      title: metadata.title || undefined,
      assetResolver: (assetId) => {
        const asset = assets[assetId];
        return asset ? bytesToDataUrl(assetId, asset) : undefined;
      }
    }),
    filename: `${safeFilename(metadata.title || "document")}.html`
  };
}

export async function openDocumentInput(input: OpenDocumentInput): Promise<OpenDocumentResult> {
  const bytes = toUint8Array(input.data);
  const lowerName = input.name.toLowerCase();

  if (bytes.length === 0 && lowerName.endsWith(".sdoc")) {
    const document = createEmptyDocument();
    return {
      document,
      metadata: {
        ...input.fallbackMetadata,
        title: input.name.replace(/\.sdoc$/i, "") || "Untitled"
      },
      assets: {},
      statusMessage: "Initialized empty .sdoc"
    };
  }

  if (lowerName.endsWith(".sdoc")) {
    const container = await unpackSdoc(bytes);
    return {
      document: container.document,
      metadata: container.metadata,
      assets: container.assets ?? {},
      statusMessage: `Opened ${input.name}`
    };
  }

  if (!lowerName.endsWith(".json")) {
    throw new Error(`Unsupported file type: ${input.name}. Open a .sdoc or .json file.`);
  }

  const document = parseDocumentJson(decodeUtf8(bytes), input.name);
  return {
    document,
    metadata: input.fallbackMetadata,
    assets: {},
    statusMessage: `Opened ${input.name}`
  };
}

export function safeFilename(value: string): string {
  const name = value.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, "-");
  return name.length > 0 ? name : "document";
}

function toUint8Array(data: ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

function decodeUtf8(data: Uint8Array): string {
  return new TextDecoder().decode(data).replace(/^\uFEFF/, "");
}

function parseDocumentJson(text: string, filename: string): SDocDocument {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filename}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const validation = validateDocument(document);
  if (!validation.ok) {
    throw new Error(`Invalid document JSON in ${filename}: ${validation.issues[0]?.message ?? "schema validation failed"}`);
  }

  return document as SDocDocument;
}

function selectReferencedAssets(document: SDocDocument, assets: SDocAssets): SDocAssets {
  const referencedAssetIds = collectReferencedAssetIds(document);
  const selected: SDocAssets = {};

  for (const assetId of referencedAssetIds) {
    const asset = assets[assetId];
    if (asset) {
      selected[assetId] = asset;
    }
  }

  return selected;
}

function bytesToDataUrl(assetId: string, bytes: Uint8Array): string {
  return `data:${mimeTypeFromAssetId(assetId)};base64,${bytesToBase64(bytes)}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.slice(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function mimeTypeFromAssetId(assetId: string): string {
  const extension = assetId.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  switch (extension) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}
