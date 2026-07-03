import { invoke } from "@tauri-apps/api/core";

export type NativeSdocFileAdapter = {
  read(path: string): Promise<Uint8Array>;
  write(path: string, bytes: Uint8Array): Promise<void>;
};

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export const nativeSdocFileAdapter: NativeSdocFileAdapter = {
  async read(path) {
    const bytes = await invoke<number[]>("read_sdoc_file", { path });
    return new Uint8Array(bytes);
  },

  async write(path, bytes) {
    await invoke("write_sdoc_file", { path, bytes: Array.from(bytes) });
  }
};
