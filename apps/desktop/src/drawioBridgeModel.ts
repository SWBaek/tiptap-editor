export type DrawioExternalEditorStatus = "opened" | "saved" | "preview-updated" | "invalid-source" | "conflict" | "closed" | "launch-failed";

export interface DrawioBridgeSession {
  sessionId: string;
  sourceAssetId: string;
  tempPath: string;
  originalSourceHash: string;
}

export interface DrawioBridgeStatusEvent {
  status: DrawioExternalEditorStatus;
  sessionId?: string;
  sourceAssetId?: string;
  tempPath?: string;
  sourceHash?: string;
  message?: string;
}

export interface DrawioSaveBackResult extends DrawioBridgeStatusEvent {
  sourceBytes?: Uint8Array;
}

export interface DrawioDiagramReference {
  blockId: string;
  sourceAssetId: string;
  previewAssetId?: string;
}

export function resolveDrawioDiagramReference(node: unknown): DrawioDiagramReference | null {
  if (!node || typeof node !== "object") {
    return null;
  }

  const candidate = node as { type?: unknown; attrs?: Record<string, unknown> };
  const attrs = candidate.attrs;

  if (candidate.type !== "diagram" || attrs?.kind !== "drawio") {
    return null;
  }

  if (typeof attrs.id !== "string" || attrs.id.length === 0 || typeof attrs.sourceAssetId !== "string" || attrs.sourceAssetId.length === 0) {
    return null;
  }

  return {
    blockId: attrs.id,
    sourceAssetId: attrs.sourceAssetId,
    previewAssetId: typeof attrs.previewAssetId === "string" && attrs.previewAssetId.length > 0 ? attrs.previewAssetId : undefined
  };
}

export function isUsableDrawioSource(bytes: Uint8Array): boolean {
  const text = decodeUtf8(bytes).trimStart();
  return text.startsWith("<mxfile") || text.startsWith("<diagram") || text.includes("<mxfile ");
}

export function getDrawioSaveBackStatus(originalSourceHash: string, latestSourceHash: string, editedSourceHash: string): DrawioExternalEditorStatus {
  if (editedSourceHash.length === 0) {
    return "invalid-source";
  }

  return originalSourceHash === latestSourceHash ? "saved" : "conflict";
}

export function hashDrawioSourceBytes(bytes: Uint8Array): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;

  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & mask;
  }

  return hash.toString(16).padStart(16, "0");
}

export function createDrawioStatusEvent(status: DrawioExternalEditorStatus, session: DrawioBridgeSession, message?: string): DrawioBridgeStatusEvent {
  return {
    status,
    sessionId: session.sessionId,
    sourceAssetId: session.sourceAssetId,
    tempPath: session.tempPath,
    message
  };
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes).replace(/^\uFEFF/, "");
}
