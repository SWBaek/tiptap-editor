import { open as showOpenDialog, save as showSaveDialog } from "@tauri-apps/plugin-dialog";
import {
  saveSdocPackageToNativeFile,
  type NativeSdocSaveBackExecution
} from "./nativeSdocSaveBack.js";
import { nativeDrawioExternalEditorBridge, type DrawioExternalEditorBridge } from "./nativeDrawioExternalEditorBridge.js";
import { nativeWorkspaceAdapter } from "./nativeWorkspaceAdapter.js";
import type { NativeSdocSaveBackRequest } from "./sdocSaveBackModel.js";
import type { NativeWorkspaceEntry, NativeWorkspaceMutationResult } from "./workspaceModel.js";

export const SDOC_NATIVE_SAVE_BRIDGE_KEY = "__SDOC_NATIVE_SAVE_BRIDGE__";

export interface WindowSdocNativeSaveBridge {
  saveSdoc(path: string, bytes: Uint8Array, filename: string): Promise<void>;
  chooseSdocSavePath(suggestedFilename: string): Promise<string | null>;
  openSdoc(): Promise<WindowSdocNativeOpenResult | null>;
  openSdocPath(path: string): Promise<WindowSdocNativeOpenResult>;
  chooseSdocWorkspaceDirectory(): Promise<string | null>;
  listSdocWorkspaceEntries(directoryPath: string, options?: WindowSdocWorkspaceListOptions): Promise<NativeWorkspaceEntry[]>;
  createSdocWorkspaceFolder(directoryPath: string, relativePath: string): Promise<NativeWorkspaceMutationResult>;
  createSdocWorkspaceFile(directoryPath: string, relativePath: string, bytes: Uint8Array): Promise<NativeWorkspaceMutationResult>;
  renameSdocWorkspaceEntry(directoryPath: string, relativePath: string, newName: string): Promise<NativeWorkspaceMutationResult>;
  trashSdocWorkspaceEntry(directoryPath: string, relativePath: string): Promise<NativeWorkspaceMutationResult>;
  checkoutDrawioSource(sourceAssetId: string, sourceBytes: Uint8Array): Promise<WindowDrawioBridgeSession>;
  openDrawioExternalEditor(sessionId: string, executablePath?: string): Promise<WindowDrawioBridgeStatusEvent>;
  readDrawioExternalEdit(sessionId: string, latestSourceBytes: Uint8Array): Promise<WindowDrawioSaveBackResult>;
  closeDrawioExternalEdit(sessionId: string): Promise<WindowDrawioBridgeStatusEvent>;
}

export interface WindowSdocNativeOpenResult {
  path: string;
  bytes: Uint8Array;
}

export interface WindowSdocWorkspaceListOptions {
  includeUnpackedFolders?: boolean;
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

export type WindowWithSdocNativeSaveBridge = {
  [SDOC_NATIVE_SAVE_BRIDGE_KEY]?: WindowSdocNativeSaveBridge;
};

export interface NativeSdocSaveBridgeOptions {
  globalScope?: WindowWithSdocNativeSaveBridge;
  savePackage?: (request: NativeSdocSaveBackRequest) => Promise<NativeSdocSaveBackExecution>;
  chooseSavePath?: (suggestedFilename: string) => Promise<string | null>;
  chooseOpenPath?: () => Promise<string | null>;
  readPackage?: (path: string) => Promise<Uint8Array>;
  chooseWorkspaceDirectory?: () => Promise<string | null>;
  listWorkspaceEntries?: (directoryPath: string, options?: WindowSdocWorkspaceListOptions) => Promise<NativeWorkspaceEntry[]>;
  createWorkspaceFolder?: (directoryPath: string, relativePath: string) => Promise<NativeWorkspaceMutationResult>;
  createWorkspaceFile?: (directoryPath: string, relativePath: string, bytes: Uint8Array) => Promise<NativeWorkspaceMutationResult>;
  renameWorkspaceEntry?: (directoryPath: string, relativePath: string, newName: string) => Promise<NativeWorkspaceMutationResult>;
  trashWorkspaceEntry?: (directoryPath: string, relativePath: string) => Promise<NativeWorkspaceMutationResult>;
  drawioBridge?: DrawioExternalEditorBridge;
}

export function createNativeSdocSaveBridge(options: NativeSdocSaveBridgeOptions = {}): WindowSdocNativeSaveBridge {
  const savePackage = options.savePackage ?? saveSdocPackageToNativeFile;
  const chooseSavePath = options.chooseSavePath ?? chooseSdocSavePathWithDialog;
  const chooseOpenPath = options.chooseOpenPath ?? chooseSdocOpenPathWithDialog;
  const readPackage = options.readPackage ?? nativeWorkspaceAdapter.readSdoc;
  const chooseWorkspaceDirectory = options.chooseWorkspaceDirectory ?? chooseSdocWorkspaceDirectoryWithDialog;
  const listWorkspaceEntries = options.listWorkspaceEntries ?? nativeWorkspaceAdapter.list;
  const createWorkspaceFolder = options.createWorkspaceFolder ?? nativeWorkspaceAdapter.createFolder;
  const createWorkspaceFile = options.createWorkspaceFile ?? nativeWorkspaceAdapter.createSdoc;
  const renameWorkspaceEntry = options.renameWorkspaceEntry ?? nativeWorkspaceAdapter.renameEntry;
  const trashWorkspaceEntry = options.trashWorkspaceEntry ?? nativeWorkspaceAdapter.trashEntry;
  const drawioBridge = options.drawioBridge ?? nativeDrawioExternalEditorBridge;

  return {
    async saveSdoc(path, bytes) {
      const execution = await savePackage({
        path,
        bytes,
        mode: "save"
      });

      if (execution.result.status !== "written") {
        throw new Error(execution.result.message);
      }
    },

    chooseSdocSavePath(suggestedFilename) {
      return chooseSavePath(suggestedFilename);
    },

    async openSdoc() {
      const path = await chooseOpenPath();
      if (!path) {
        return null;
      }

      return openSdocPath(path, readPackage);
    },

    openSdocPath(path) {
      return openSdocPath(path, readPackage);
    },

    chooseSdocWorkspaceDirectory() {
      return chooseWorkspaceDirectory();
    },

    listSdocWorkspaceEntries(directoryPath, options = {}) {
      return listWorkspaceEntries(directoryPath, {
        includeUnpackedFolders: options.includeUnpackedFolders ?? false
      });
    },

    createSdocWorkspaceFolder(directoryPath, relativePath) {
      return createWorkspaceFolder(directoryPath, relativePath);
    },

    createSdocWorkspaceFile(directoryPath, relativePath, bytes) {
      return createWorkspaceFile(directoryPath, relativePath, bytes);
    },

    renameSdocWorkspaceEntry(directoryPath, relativePath, newName) {
      return renameWorkspaceEntry(directoryPath, relativePath, newName);
    },

    trashSdocWorkspaceEntry(directoryPath, relativePath) {
      return trashWorkspaceEntry(directoryPath, relativePath);
    },

    checkoutDrawioSource(sourceAssetId, sourceBytes) {
      return drawioBridge.checkoutSource(sourceAssetId, sourceBytes);
    },

    openDrawioExternalEditor(sessionId, executablePath) {
      return drawioBridge.openExternalEditor(sessionId, executablePath);
    },

    async readDrawioExternalEdit(sessionId, latestSourceBytes) {
      return drawioBridge.readEditedSource({ sessionId, sourceAssetId: "", tempPath: "", originalSourceHash: "" }, latestSourceBytes);
    },

    closeDrawioExternalEdit(sessionId) {
      return drawioBridge.closeSession(sessionId);
    }
  };
}

export function installNativeSdocSaveBridge(options: NativeSdocSaveBridgeOptions = {}): WindowSdocNativeSaveBridge {
  const globalScope = (options.globalScope ?? window) as WindowWithSdocNativeSaveBridge;
  const bridge = createNativeSdocSaveBridge(options);
  globalScope[SDOC_NATIVE_SAVE_BRIDGE_KEY] = bridge;
  return bridge;
}

export async function chooseSdocSavePathWithDialog(suggestedFilename: string): Promise<string | null> {
  const path = await showSaveDialog({
    title: "Save SDoc document",
    defaultPath: ensureSdocFilename(suggestedFilename),
    filters: [
      {
        name: "SDoc document",
        extensions: ["sdoc"]
      }
    ]
  });

  return normalizeDialogPath(path);
}

export async function chooseSdocOpenPathWithDialog(): Promise<string | null> {
  const path = await showOpenDialog({
    title: "Open SDoc document",
    multiple: false,
    directory: false,
    filters: [
      {
        name: "SDoc document",
        extensions: ["sdoc"]
      }
    ]
  });

  return Array.isArray(path) ? null : normalizeDialogPath(path);
}

export async function chooseSdocWorkspaceDirectoryWithDialog(): Promise<string | null> {
  const path = await showOpenDialog({
    title: "Open SDoc workspace folder",
    multiple: false,
    directory: true
  });

  return Array.isArray(path) ? null : normalizeDialogPath(path);
}

async function openSdocPath(path: string, readPackage: (path: string) => Promise<Uint8Array>): Promise<WindowSdocNativeOpenResult> {
  return {
    path,
    bytes: await readPackage(path)
  };
}

function ensureSdocFilename(filename: string): string {
  const trimmed = filename.trim();
  const fallback = trimmed.length > 0 ? trimmed : "document.sdoc";
  return /\.sdoc$/i.test(fallback) ? fallback : `${fallback}.sdoc`;
}

function normalizeDialogPath(path: string | null): string | null {
  const value = path?.trim() ?? "";
  return value.length > 0 ? value : null;
}
