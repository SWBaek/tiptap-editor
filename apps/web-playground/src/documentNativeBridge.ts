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
  renameSdocWorkspaceEntry?(directoryPath: string, relativePath: string, newName: string): Promise<WindowSdocWorkspaceMutationResult>;
  trashSdocWorkspaceEntry?(directoryPath: string, relativePath: string): Promise<WindowSdocWorkspaceMutationResult>;
  startSdocWorkspaceWatch?(directoryPath: string): Promise<WindowSdocWorkspaceWatchStartResult>;
  readSdocWorkspaceWatchEvents?(watchId: string): Promise<WindowSdocWorkspaceWatchEvent[]>;
  stopSdocWorkspaceWatch?(watchId: string): Promise<boolean>;
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
  status: "created" | "renamed" | "trashed";
  path: string;
  relativePath: string;
  kind: "folder" | "sdoc-file";
  message: string;
}

export type WindowSdocWorkspaceWatchEventKind = "created" | "modified" | "removed" | "renamed" | "accessed" | "other" | "error";

export interface WindowSdocWorkspaceWatchStartResult {
  watchId: string;
  rootPath: string;
}

export interface WindowSdocWorkspaceWatchEvent {
  watchId: string;
  kind: WindowSdocWorkspaceWatchEventKind;
  path: string;
  isSdoc: boolean;
  occurredAtMs: number;
  message?: string;
}

export interface NativeSdocWorkspaceAdapter {
  chooseDirectory(): Promise<string | null>;
  list(directoryPath: string, options?: WindowSdocWorkspaceListOptions): Promise<WindowSdocWorkspaceEntry[]>;
  createFolder(directoryPath: string, relativePath: string): Promise<WindowSdocWorkspaceMutationResult>;
  createSdoc(directoryPath: string, relativePath: string, bytes: Uint8Array): Promise<WindowSdocWorkspaceMutationResult>;
  renameEntry(directoryPath: string, relativePath: string, newName: string): Promise<WindowSdocWorkspaceMutationResult>;
  trashEntry(directoryPath: string, relativePath: string): Promise<WindowSdocWorkspaceMutationResult>;
  startWatch(directoryPath: string): Promise<WindowSdocWorkspaceWatchStartResult>;
  readWatchEvents(watchId: string): Promise<WindowSdocWorkspaceWatchEvent[]>;
  stopWatch(watchId: string): Promise<boolean>;
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
    !bridge.renameSdocWorkspaceEntry ||
    !bridge.trashSdocWorkspaceEntry ||
    !bridge.startSdocWorkspaceWatch ||
    !bridge.readSdocWorkspaceWatchEvents ||
    !bridge.stopSdocWorkspaceWatch ||
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
    async renameEntry(directoryPath, relativePath, newName) {
      const result = await bridge.renameSdocWorkspaceEntry?.(directoryPath, relativePath, newName);
      if (!isWindowSdocWorkspaceMutationResult(result)) {
        throw new Error("Native workspace rename returned an invalid result.");
      }
      return result;
    },
    async trashEntry(directoryPath, relativePath) {
      const result = await bridge.trashSdocWorkspaceEntry?.(directoryPath, relativePath);
      if (!isWindowSdocWorkspaceMutationResult(result)) {
        throw new Error("Native workspace trash returned an invalid result.");
      }
      return result;
    },
    async startWatch(directoryPath) {
      const result = await bridge.startSdocWorkspaceWatch?.(directoryPath);
      if (!isWindowSdocWorkspaceWatchStartResult(result)) {
        throw new Error("Native workspace watcher returned an invalid start result.");
      }
      return result;
    },
    async readWatchEvents(watchId) {
      const events = await bridge.readSdocWorkspaceWatchEvents?.(watchId);
      if (!Array.isArray(events) || !events.every(isWindowSdocWorkspaceWatchEvent)) {
        throw new Error("Native workspace watcher returned invalid events.");
      }
      return events;
    },
    async stopWatch(watchId) {
      const result = await bridge.stopSdocWorkspaceWatch?.(watchId);
      if (typeof result !== "boolean") {
        throw new Error("Native workspace watcher returned an invalid stop result.");
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

export function replaceNativePathPrefix(path: string, oldPrefix: string, nextPrefix: string): string | null {
  const relativePath = getWorkspaceRelativePath(oldPrefix, path);
  if (relativePath === null) {
    return null;
  }
  if (!relativePath) {
    return nextPrefix;
  }
  const separator = nextPrefix.includes("\\") ? "\\" : "/";
  return `${nextPrefix.replace(/[\\/]+$/, "")}${separator}${relativePath.replaceAll("/", separator)}`;
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

  if (candidate.renameSdocWorkspaceEntry !== undefined && typeof candidate.renameSdocWorkspaceEntry !== "function") {
    return undefined;
  }

  if (candidate.trashSdocWorkspaceEntry !== undefined && typeof candidate.trashSdocWorkspaceEntry !== "function") {
    return undefined;
  }

  if (candidate.startSdocWorkspaceWatch !== undefined && typeof candidate.startSdocWorkspaceWatch !== "function") {
    return undefined;
  }

  if (candidate.readSdocWorkspaceWatchEvents !== undefined && typeof candidate.readSdocWorkspaceWatchEvents !== "function") {
    return undefined;
  }

  if (candidate.stopSdocWorkspaceWatch !== undefined && typeof candidate.stopSdocWorkspaceWatch !== "function") {
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
    (result.status === "created" || result.status === "renamed" || result.status === "trashed") &&
    typeof result.path === "string" &&
    typeof result.relativePath === "string" &&
    (result.kind === "folder" || result.kind === "sdoc-file") &&
    typeof result.message === "string"
  );
}

function isWindowSdocWorkspaceWatchStartResult(value: unknown): value is WindowSdocWorkspaceWatchStartResult {
  if (!value || typeof value !== "object") {
    return false;
  }
  const result = value as Record<string, unknown>;
  return typeof result.watchId === "string" && typeof result.rootPath === "string";
}

function isWindowSdocWorkspaceWatchEvent(value: unknown): value is WindowSdocWorkspaceWatchEvent {
  if (!value || typeof value !== "object") {
    return false;
  }
  const event = value as Record<string, unknown>;
  return (
    typeof event.watchId === "string" &&
    isWindowSdocWorkspaceWatchEventKind(event.kind) &&
    typeof event.path === "string" &&
    typeof event.isSdoc === "boolean" &&
    typeof event.occurredAtMs === "number" &&
    (event.message === undefined || typeof event.message === "string")
  );
}

function isWindowSdocWorkspaceWatchEventKind(value: unknown): value is WindowSdocWorkspaceWatchEventKind {
  return value === "created" || value === "modified" || value === "removed" || value === "renamed" ||
    value === "accessed" || value === "other" || value === "error";
}

function normalizeNativePath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+$/, "");
}
