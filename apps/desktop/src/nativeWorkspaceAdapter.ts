import { invoke } from "@tauri-apps/api/core";
import { nativeSdocFileAdapter } from "./nativeSdocFileAdapter.js";
import {
  isWorkspaceEntry,
  isWorkspaceMutationResult,
  sortWorkspaceEntries,
  type NativeWorkspaceEntry,
  type NativeWorkspaceMutationResult
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

  readSdoc: nativeSdocFileAdapter.read,
  writeSdoc: nativeSdocFileAdapter.write
};
