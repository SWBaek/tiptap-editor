import type { NativeWorkspaceEntryKind } from "./workspaceModel.js";

export type NativeSdocSaveBackMode = "save" | "save-as";

export type NativeSdocSaveBackStatus = "ready" | "missing-path" | "unsupported-target" | "empty-payload";

export interface NativeSdocSaveBackRequest {
  path: string | null;
  bytes: Uint8Array;
  mode?: NativeSdocSaveBackMode;
  targetKind?: NativeWorkspaceEntryKind;
}

export interface NativeSdocSaveBackPlan {
  status: NativeSdocSaveBackStatus;
  mode: NativeSdocSaveBackMode;
  path: string | null;
  byteLength: number;
  canWrite: boolean;
  message: string;
}

export interface NativeSdocSaveBackWriter {
  writeSdoc(path: string, bytes: Uint8Array): Promise<void>;
}

export interface NativeSdocSaveBackResult {
  status: "written" | "skipped";
  path: string | null;
  byteLength: number;
  message: string;
}

export function createNativeSdocSaveBackPlan(request: NativeSdocSaveBackRequest): NativeSdocSaveBackPlan {
  const mode = request.mode ?? "save";
  const path = normalizeSaveBackPath(request.path);
  const byteLength = request.bytes.byteLength;

  if (!path) {
    return {
      status: "missing-path",
      mode,
      path: null,
      byteLength,
      canWrite: false,
      message: mode === "save-as" ? "Choose a .sdoc destination before saving." : "Open a .sdoc file before saving."
    };
  }

  if (request.targetKind && request.targetKind !== "sdoc-file") {
    return {
      status: "unsupported-target",
      mode,
      path,
      byteLength,
      canWrite: false,
      message: "Native save-back only writes user-facing .sdoc files."
    };
  }

  if (!isSdocFilePath(path)) {
    return {
      status: "unsupported-target",
      mode,
      path,
      byteLength,
      canWrite: false,
      message: "Native save-back requires a .sdoc file path."
    };
  }

  if (byteLength === 0) {
    return {
      status: "empty-payload",
      mode,
      path,
      byteLength,
      canWrite: false,
      message: "Cannot save an empty .sdoc payload."
    };
  }

  return {
    status: "ready",
    mode,
    path,
    byteLength,
    canWrite: true,
    message: mode === "save-as" ? `Ready to save ${path}.` : `Ready to update ${path}.`
  };
}

export async function runNativeSdocSaveBack(
  writer: NativeSdocSaveBackWriter,
  plan: NativeSdocSaveBackPlan,
  bytes: Uint8Array
): Promise<NativeSdocSaveBackResult> {
  if (!plan.canWrite || !plan.path) {
    return {
      status: "skipped",
      path: plan.path,
      byteLength: plan.byteLength,
      message: plan.message
    };
  }

  if (bytes.byteLength !== plan.byteLength) {
    return {
      status: "skipped",
      path: plan.path,
      byteLength: bytes.byteLength,
      message: "Cannot save because the payload changed after planning."
    };
  }

  await writer.writeSdoc(plan.path, bytes);
  return {
    status: "written",
    path: plan.path,
    byteLength: bytes.byteLength,
    message: `Saved ${plan.path}.`
  };
}

function normalizeSaveBackPath(path: string | null): string | null {
  const normalized = path?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function isSdocFilePath(path: string): boolean {
  return /\.sdoc$/i.test(path);
}
