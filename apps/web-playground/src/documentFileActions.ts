import type { CreateSdocPayloadResult } from "./documentIo";
import type { SDocSaveRoute } from "./documentFileRuntime";

export interface BrowserSdocDownloadAdapter {
  download(payload: CreateSdocPayloadResult): void;
}

export interface NativeSdocSaveAdapter {
  save(path: string, payload: CreateSdocPayloadResult): Promise<void>;
  chooseSavePath?(suggestedFilename: string): Promise<string | null>;
}

export interface SDocSaveActionAdapters {
  browser?: BrowserSdocDownloadAdapter;
  native?: NativeSdocSaveAdapter;
}

export type SDocSaveActionStatus = "downloaded" | "saved-native" | "cancelled" | "unavailable";

export interface SDocSaveActionResult {
  status: SDocSaveActionStatus;
  path: string | null;
  message: string;
}

export async function runSdocSaveAction(
  route: SDocSaveRoute,
  payload: CreateSdocPayloadResult,
  adapters: SDocSaveActionAdapters
): Promise<SDocSaveActionResult> {
  if (route.kind === "browser-download") {
    if (!adapters.browser) {
      return {
        status: "unavailable",
        path: null,
        message: "Browser download adapter is not available."
      };
    }

    adapters.browser.download(payload);
    return {
      status: "downloaded",
      path: null,
      message: `Downloaded ${payload.filename}.`
    };
  }

  if (route.kind === "native-save") {
    if (!adapters.native || !route.nativePath) {
      return {
        status: "unavailable",
        path: route.nativePath ?? null,
        message: "Native save adapter is not available."
      };
    }

    await adapters.native.save(route.nativePath, payload);
    return {
      status: "saved-native",
      path: route.nativePath,
      message: `Saved ${route.nativePath}.`
    };
  }

  if (route.kind === "native-save-as") {
    if (!adapters.native?.chooseSavePath) {
      return {
        status: "unavailable",
        path: null,
        message: "Native save-as adapter is not available."
      };
    }

    const path = await adapters.native.chooseSavePath(payload.filename);
    if (!path) {
      return {
        status: "cancelled",
        path: null,
        message: "Save-as cancelled."
      };
    }

    await adapters.native.save(path, payload);
    return {
      status: "saved-native",
      path,
      message: `Saved ${path}.`
    };
  }

  return {
    status: "unavailable",
    path: null,
    message: route.detail
  };
}
