import type { NativeSdocSaveAdapter } from "./documentFileActions";
import type { CreateSdocPayloadResult } from "./documentIo";

export const SDOC_NATIVE_SAVE_BRIDGE_KEY = "__SDOC_NATIVE_SAVE_BRIDGE__";

export interface WindowSdocNativeSaveBridge {
  saveSdoc(path: string, bytes: Uint8Array, filename: string): Promise<void>;
  chooseSdocSavePath?(suggestedFilename: string): Promise<string | null>;
  openSdoc?(): Promise<WindowSdocNativeOpenResult | null>;
  openSdocPath?(path: string): Promise<WindowSdocNativeOpenResult>;
  chooseSdocWorkspaceDirectory?(): Promise<string | null>;
  listSdocWorkspaceEntries?(directoryPath: string, options?: WindowSdocWorkspaceListOptions): Promise<WindowSdocWorkspaceEntry[]>;
  createSdocWorkspaceFolder?(directoryPath: string, relativePath: string): Promise<WindowSdocWorkspaceMutationResult>;
  createSdocWorkspaceFile?(directoryPath: string, relativePath: string, bytes: Uint8Array): Promise<WindowSdocWorkspaceMutationResult>;
  checkoutDrawioSource?(sourceAssetId: string, sourceBytes: Uint8Array): Promise<WindowDrawioBridgeSession>;
  openDrawioExternalEditor?(sessionId: string, executablePath?: string): Promise<WindowDrawioBridgeStatusEvent>;
  readDrawioExternalEdit?(sessionId: string, latestSourceBytes: Uint8Array): Promise<WindowDrawioSaveBackResult>;
  closeDrawioExternalEdit?(sessionId: string): Promise<WindowDrawioBridgeStatusEvent>;
}

export interface WindowSdocNativeOpenResult {
  path: string;
  bytes: Uint8Array;
}

export interface NativeSdocOpenAdapter {
  open(): Promise<WindowSdocNativeOpenResult | null>;
}

export interface WindowSdocWorkspaceEntry {
  name: string;
  path: string;
  kind: "folder" | "sdoc-file" | "unpacked-sdoc-folder";
  children?: WindowSdocWorkspaceEntry[];
  sizeBytes?: number;
  modifiedAtMs?: number;
}

export interface WindowSdocWorkspaceListOptions {
  includeUnpackedFolders?: boolean;
}

export interface WindowSdocWorkspaceMutationResult {
  status: "created";
  path: string;
  relativePath: string;
  kind: "folder" | "sdoc-file";
  message: string;
}

export interface NativeSdocWorkspaceAdapter {
  chooseDirectory(): Promise<string | null>;
  list(directoryPath: string, options?: WindowSdocWorkspaceListOptions): Promise<WindowSdocWorkspaceEntry[]>;
  createFolder(directoryPath: string, relativePath: string): Promise<WindowSdocWorkspaceMutationResult>;
  createSdoc(directoryPath: string, relativePath: string, bytes: Uint8Array): Promise<WindowSdocWorkspaceMutationResult>;
  openFile(path: string): Promise<WindowSdocNativeOpenResult>;
}

export type WindowDrawioExternalEditorStatus = "opened" | "saved" | "preview-updated" | "invalid-source" | "conflict" | "closed" | "launch-failed";

export interface WindowDrawioBridgeSession {
  sessionId: string;
  sourceAssetId: string;
  tempPath: string;
  originalSourceHash: string;
}

export interface WindowDrawioBridgeStatusEvent {
  status: WindowDrawioExternalEditorStatus;
  sessionId?: string;
  sourceAssetId?: string;
  tempPath?: string;
  sourceHash?: string;
  message?: string;
}

export interface WindowDrawioSaveBackResult extends WindowDrawioBridgeStatusEvent {
  sourceBytes?: Uint8Array;
}

export interface NativeDrawioExternalEditorAdapter {
  checkoutSource(sourceAssetId: string, sourceBytes: Uint8Array): Promise<WindowDrawioBridgeSession>;
  openExternalEditor(sessionId: string, executablePath?: string): Promise<WindowDrawioBridgeStatusEvent>;
  readEditedSource(session: WindowDrawioBridgeSession, latestSourceBytes: Uint8Array): Promise<WindowDrawioSaveBackResult>;
  closeSession(sessionId: string): Promise<WindowDrawioBridgeStatusEvent>;
}

export type WindowWithSdocNativeSaveBridge = {
  [SDOC_NATIVE_SAVE_BRIDGE_KEY]?: unknown;
};

export function getWindowSdocNativeSaveAdapter(globalScope: unknown = globalThis): NativeSdocSaveAdapter | undefined {
  const bridge = getWindowSdocNativeSaveBridge(globalScope);
  if (!bridge) {
    return undefined;
  }

  return {
    save(path: string, payload: CreateSdocPayloadResult): Promise<void> {
      return bridge.saveSdoc(path, payload.bytes, payload.filename);
    },
    chooseSavePath: bridge.chooseSdocSavePath
      ? (suggestedFilename: string): Promise<string | null> => bridge.chooseSdocSavePath?.(suggestedFilename) ?? Promise.resolve(null)
      : undefined
  };
}

export function getWindowSdocNativeOpenAdapter(globalScope: unknown = globalThis): NativeSdocOpenAdapter | undefined {
  const bridge = getWindowSdocNativeSaveBridge(globalScope);
  if (!bridge?.openSdoc) {
    return undefined;
  }

  return {
    open() {
      return bridge.openSdoc?.() ?? Promise.resolve(null);
    }
  };
}

export function getWindowSdocWorkspaceAdapter(globalScope: unknown = globalThis): NativeSdocWorkspaceAdapter | undefined {
  const bridge = getWindowSdocNativeSaveBridge(globalScope);
  if (
    !bridge?.chooseSdocWorkspaceDirectory ||
    !bridge.listSdocWorkspaceEntries ||
    !bridge.createSdocWorkspaceFolder ||
    !bridge.createSdocWorkspaceFile ||
    !bridge.openSdocPath
  ) {
    return undefined;
  }

  return {
    chooseDirectory() {
      return bridge.chooseSdocWorkspaceDirectory?.() ?? Promise.resolve(null);
    },
    list(directoryPath, options = {}) {
      return bridge.listSdocWorkspaceEntries?.(directoryPath, options) ?? Promise.resolve([]);
    },
    async createFolder(directoryPath, relativePath) {
      const result = await bridge.createSdocWorkspaceFolder?.(directoryPath, relativePath);
      if (!isWindowSdocWorkspaceMutationResult(result)) {
        throw new Error("Native workspace folder creation returned an invalid result.");
      }
      return result;
    },
    async createSdoc(directoryPath, relativePath, bytes) {
      const result = await bridge.createSdocWorkspaceFile?.(directoryPath, relativePath, bytes);
      if (!isWindowSdocWorkspaceMutationResult(result)) {
        throw new Error("Native workspace document creation returned an invalid result.");
      }
      return result;
    },
    openFile(path) {
      return bridge.openSdocPath?.(path) ?? Promise.reject(new Error("Native workspace open is not available."));
    }
  };
}

export function getWorkspaceRelativePath(directoryPath: string, targetPath: string): string | null {
  const normalizedDirectory = normalizeNativePath(directoryPath);
  const normalizedTarget = normalizeNativePath(targetPath);
  const isWindowsPath = /^[a-z]:\//i.test(normalizedDirectory);
  const comparableDirectory = isWindowsPath ? normalizedDirectory.toLowerCase() : normalizedDirectory;
  const comparableTarget = isWindowsPath ? normalizedTarget.toLowerCase() : normalizedTarget;
  if (comparableTarget === comparableDirectory) {
    return "";
  }
  const prefix = `${comparableDirectory}/`;
  if (!comparableTarget.startsWith(prefix)) {
    return null;
  }
  return normalizedTarget.slice(normalizedDirectory.length + 1);
}

export function getWindowDrawioExternalEditorAdapter(globalScope: unknown = globalThis): NativeDrawioExternalEditorAdapter | undefined {
  const bridge = getWindowSdocNativeSaveBridge(globalScope);
  if (!bridge?.checkoutDrawioSource || !bridge.openDrawioExternalEditor || !bridge.readDrawioExternalEdit || !bridge.closeDrawioExternalEdit) {
    return undefined;
  }

  return {
    checkoutSource(sourceAssetId, sourceBytes) {
      return bridge.checkoutDrawioSource?.(sourceAssetId, sourceBytes) ?? Promise.reject(new Error("Native Draw.io checkout is not available."));
    },
    openExternalEditor(sessionId, executablePath) {
      return bridge.openDrawioExternalEditor?.(sessionId, executablePath) ?? Promise.reject(new Error("Native Draw.io editor launch is not available."));
    },
    readEditedSource(session, latestSourceBytes) {
      return bridge.readDrawioExternalEdit?.(session.sessionId, latestSourceBytes) ?? Promise.reject(new Error("Native Draw.io read-back is not available."));
    },
    closeSession(sessionId) {
      return bridge.closeDrawioExternalEdit?.(sessionId) ?? Promise.reject(new Error("Native Draw.io close is not available."));
    }
  };
}

function getWindowSdocNativeSaveBridge(globalScope: unknown): WindowSdocNativeSaveBridge | undefined {
  if (!globalScope || typeof globalScope !== "object") {
    return undefined;
  }

  const bridge = (globalScope as WindowWithSdocNativeSaveBridge)[SDOC_NATIVE_SAVE_BRIDGE_KEY];
  if (!bridge || typeof bridge !== "object") {
    return undefined;
  }

  const candidate = bridge as Partial<WindowSdocNativeSaveBridge>;
  if (typeof candidate.saveSdoc !== "function") {
    return undefined;
  }

  if (candidate.chooseSdocSavePath !== undefined && typeof candidate.chooseSdocSavePath !== "function") {
    return undefined;
  }

  if (candidate.openSdoc !== undefined && typeof candidate.openSdoc !== "function") {
    return undefined;
  }

  if (candidate.openSdocPath !== undefined && typeof candidate.openSdocPath !== "function") {
    return undefined;
  }

  if (candidate.chooseSdocWorkspaceDirectory !== undefined && typeof candidate.chooseSdocWorkspaceDirectory !== "function") {
    return undefined;
  }

  if (candidate.listSdocWorkspaceEntries !== undefined && typeof candidate.listSdocWorkspaceEntries !== "function") {
    return undefined;
  }

  if (candidate.createSdocWorkspaceFolder !== undefined && typeof candidate.createSdocWorkspaceFolder !== "function") {
    return undefined;
  }

  if (candidate.createSdocWorkspaceFile !== undefined && typeof candidate.createSdocWorkspaceFile !== "function") {
    return undefined;
  }

  if (candidate.checkoutDrawioSource !== undefined && typeof candidate.checkoutDrawioSource !== "function") {
    return undefined;
  }

  if (candidate.openDrawioExternalEditor !== undefined && typeof candidate.openDrawioExternalEditor !== "function") {
    return undefined;
  }

  if (candidate.readDrawioExternalEdit !== undefined && typeof candidate.readDrawioExternalEdit !== "function") {
    return undefined;
  }

  if (candidate.closeDrawioExternalEdit !== undefined && typeof candidate.closeDrawioExternalEdit !== "function") {
    return undefined;
  }

  return candidate as WindowSdocNativeSaveBridge;
}

function isWindowSdocWorkspaceMutationResult(value: unknown): value is WindowSdocWorkspaceMutationResult {
  if (!value || typeof value !== "object") {
    return false;
  }
  const result = value as Record<string, unknown>;
  return (
    result.status === "created" &&
    typeof result.path === "string" &&
    typeof result.relativePath === "string" &&
    (result.kind === "folder" || result.kind === "sdoc-file") &&
    typeof result.message === "string"
  );
}

function normalizeNativePath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+$/, "");
}
