import { invoke } from "@tauri-apps/api/core";
import { nativeSdocFileAdapter } from "./nativeSdocFileAdapter.js";
import { isWorkspaceEntry, sortWorkspaceEntries, type NativeWorkspaceEntry } from "./workspaceModel.js";

export interface ListWorkspaceOptions {
  includeUnpackedFolders?: boolean;
}

export type NativeWorkspaceAdapter = {
  list(directoryPath: string, options?: ListWorkspaceOptions): Promise<NativeWorkspaceEntry[]>;
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

  readSdoc: nativeSdocFileAdapter.read,
  writeSdoc: nativeSdocFileAdapter.write
};
