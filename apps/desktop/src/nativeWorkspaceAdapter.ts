import { invoke } from "@tauri-apps/api/core";
import { nativeSdocFileAdapter } from "./nativeSdocFileAdapter.js";
import {
  isWorkspaceEntry,
  isWorkspaceMutationResult,
  isWorkspaceWatchEvent,
  isWorkspaceWatchStartResult,
  sortWorkspaceEntries,
  type NativeWorkspaceEntry,
  type NativeWorkspaceMutationResult,
  type NativeWorkspaceWatchEvent,
  type NativeWorkspaceWatchStartResult
} from "./workspaceModel.js";

export interface ListWorkspaceOptions {
  includeUnpackedFolders?: boolean;
}

export type NativeWorkspaceAdapter = {
  list(directoryPath: string, options?: ListWorkspaceOptions): Promise<NativeWorkspaceEntry[]>;
  createFolder(directoryPath: string, relativePath: string): Promise<NativeWorkspaceMutationResult>;
  createSdoc(directoryPath: string, relativePath: string, bytes: Uint8Array): Promise<NativeWorkspaceMutationResult>;
  renameEntry(directoryPath: string, relativePath: string, newName: string): Promise<NativeWorkspaceMutationResult>;
  trashEntry(directoryPath: string, relativePath: string): Promise<NativeWorkspaceMutationResult>;
  revealEntry(directoryPath: string, relativePath: string): Promise<boolean>;
  startWatch(directoryPath: string): Promise<NativeWorkspaceWatchStartResult>;
  readWatchEvents(watchId: string): Promise<NativeWorkspaceWatchEvent[]>;
  stopWatch(watchId: string): Promise<boolean>;
  readSdoc(path: string): Promise<Uint8Array>;
  writeSdoc(path: string, bytes: Uint8Array): Promise<void>;
};

export const nativeWorkspaceAdapter: NativeWorkspaceAdapter = {
  async list(directoryPath, options = {}) {
    const entries = await invoke<unknown[]>("list_sdoc_workspace_entries", {
      directoryPath,
      includeUnpackedFolders: options.includeUnpackedFolders ?? false
    });

    const validEntries = entries.filter(isWorkspaceEntry);
    return sortWorkspaceEntries(validEntries);
  },

  async createFolder(directoryPath, relativePath) {
    const result = await invoke<unknown>("create_sdoc_workspace_folder", { directoryPath, relativePath });
    if (!isWorkspaceMutationResult(result)) {
      throw new Error("Native workspace folder creation returned an invalid result.");
    }
    return result;
  },

  async createSdoc(directoryPath, relativePath, bytes) {
    const result = await invoke<unknown>("create_sdoc_workspace_file", {
      directoryPath,
      relativePath,
      bytes: Array.from(bytes)
    });
    if (!isWorkspaceMutationResult(result)) {
      throw new Error("Native workspace document creation returned an invalid result.");
    }
    return result;
  },

  async renameEntry(directoryPath, relativePath, newName) {
    const result = await invoke<unknown>("rename_sdoc_workspace_entry", {
      directoryPath,
      relativePath,
      newName
    });
    if (!isWorkspaceMutationResult(result)) {
      throw new Error("Native workspace rename returned an invalid result.");
    }
    return result;
  },

  async trashEntry(directoryPath, relativePath) {
    const result = await invoke<unknown>("trash_sdoc_workspace_entry", { directoryPath, relativePath });
    if (!isWorkspaceMutationResult(result)) {
      throw new Error("Native workspace trash returned an invalid result.");
    }
    return result;
  },

  async revealEntry(directoryPath, relativePath) {
    const result = await invoke<unknown>("reveal_sdoc_workspace_entry", { directoryPath, relativePath });
    if (typeof result !== "boolean") {
      throw new Error("Native workspace reveal returned an invalid result.");
    }
    return result;
  },

  async startWatch(directoryPath) {
    const result = await invoke<unknown>("start_sdoc_workspace_watch", { directoryPath });
    if (!isWorkspaceWatchStartResult(result)) {
      throw new Error("Native workspace watcher returned an invalid start result.");
    }
    return result;
  },

  async readWatchEvents(watchId) {
    const events = await invoke<unknown[]>("read_sdoc_workspace_watch_events", { watchId });
    if (!Array.isArray(events) || !events.every(isWorkspaceWatchEvent)) {
      throw new Error("Native workspace watcher returned invalid events.");
    }
    return events;
  },

  async stopWatch(watchId) {
    const result = await invoke<unknown>("stop_sdoc_workspace_watch", { watchId });
    if (typeof result !== "boolean") {
      throw new Error("Native workspace watcher returned an invalid stop result.");
    }
    return result;
  },

  readSdoc: nativeSdocFileAdapter.read,
  writeSdoc: nativeSdocFileAdapter.write
};
