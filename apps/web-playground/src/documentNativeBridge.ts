import type { NativeSdocSaveAdapter } from "./documentFileActions";
import type { CreateSdocPayloadResult } from "./documentIo";

export const SDOC_NATIVE_SAVE_BRIDGE_KEY = "__SDOC_NATIVE_SAVE_BRIDGE__";

export interface WindowSdocNativeSaveBridge {
  saveSdoc(path: string, bytes: Uint8Array, filename: string): Promise<void>;
  chooseSdocSavePath?(suggestedFilename: string): Promise<string | null>;
  openSdoc?(): Promise<WindowSdocNativeOpenResult | null>;
}

export interface WindowSdocNativeOpenResult {
  path: string;
  bytes: Uint8Array;
}

export interface NativeSdocOpenAdapter {
  open(): Promise<WindowSdocNativeOpenResult | null>;
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

  return candidate as WindowSdocNativeSaveBridge;
}
