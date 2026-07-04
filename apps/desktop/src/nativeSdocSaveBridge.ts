import { save as showSaveDialog } from "@tauri-apps/plugin-dialog";
import {
  saveSdocPackageToNativeFile,
  type NativeSdocSaveBackExecution
} from "./nativeSdocSaveBack.js";
import type { NativeSdocSaveBackRequest } from "./sdocSaveBackModel.js";

export const SDOC_NATIVE_SAVE_BRIDGE_KEY = "__SDOC_NATIVE_SAVE_BRIDGE__";

export interface WindowSdocNativeSaveBridge {
  saveSdoc(path: string, bytes: Uint8Array, filename: string): Promise<void>;
  chooseSdocSavePath(suggestedFilename: string): Promise<string | null>;
}

export type WindowWithSdocNativeSaveBridge = {
  [SDOC_NATIVE_SAVE_BRIDGE_KEY]?: WindowSdocNativeSaveBridge;
};

export interface NativeSdocSaveBridgeOptions {
  globalScope?: WindowWithSdocNativeSaveBridge;
  savePackage?: (request: NativeSdocSaveBackRequest) => Promise<NativeSdocSaveBackExecution>;
  chooseSavePath?: (suggestedFilename: string) => Promise<string | null>;
}

export function createNativeSdocSaveBridge(options: NativeSdocSaveBridgeOptions = {}): WindowSdocNativeSaveBridge {
  const savePackage = options.savePackage ?? saveSdocPackageToNativeFile;
  const chooseSavePath = options.chooseSavePath ?? chooseSdocSavePathWithDialog;

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

function ensureSdocFilename(filename: string): string {
  const trimmed = filename.trim();
  const fallback = trimmed.length > 0 ? trimmed : "document.sdoc";
  return /\.sdoc$/i.test(fallback) ? fallback : `${fallback}.sdoc`;
}

function normalizeDialogPath(path: string | null): string | null {
  const value = path?.trim() ?? "";
  return value.length > 0 ? value : null;
}
