import { exportDerivedOutputs } from "@sdoc/export";
import { createEmptySdocContainer, packSdoc, unpackSdoc, type SDocMetadata } from "@sdoc/format";
import { createEmptyDocument, type SDocDocument } from "@sdoc/schema";

export interface OpenDocumentInput {
  name: string;
  data: ArrayBuffer | Uint8Array;
  fallbackMetadata: SDocMetadata;
}

export interface OpenDocumentResult {
  document: SDocDocument;
  metadata: SDocMetadata;
  statusMessage: string;
}

export interface CreateSdocPayloadResult {
  bytes: Uint8Array;
  filename: string;
}

export async function createSdocPayload(
  document: SDocDocument,
  metadata: SDocMetadata,
  now = new Date()
): Promise<CreateSdocPayloadResult> {
  const timestamp = now.toISOString();
  const container = createEmptySdocContainer({ ...metadata, updatedAt: timestamp });
  const derived = exportDerivedOutputs(document);

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
    derived
  });

  return {
    bytes,
    filename: `${safeFilename(metadata.title || "document")}.sdoc`
  };
}

export async function openDocumentInput(input: OpenDocumentInput): Promise<OpenDocumentResult> {
  const bytes = toUint8Array(input.data);

  if (bytes.length === 0 && input.name.toLowerCase().endsWith(".sdoc")) {
    const document = createEmptyDocument();
    return {
      document,
      metadata: {
        ...input.fallbackMetadata,
        title: input.name.replace(/\.sdoc$/i, "") || "Untitled"
      },
      statusMessage: "Initialized empty .sdoc"
    };
  }

  if (input.name.toLowerCase().endsWith(".sdoc")) {
    const container = await unpackSdoc(bytes);
    return {
      document: container.document,
      metadata: container.metadata,
      statusMessage: `Opened ${input.name}`
    };
  }

  const document = JSON.parse(decodeUtf8(bytes)) as SDocDocument;
  return {
    document,
    metadata: input.fallbackMetadata,
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

