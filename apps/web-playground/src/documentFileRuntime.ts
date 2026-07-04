export type DocumentRuntimeKind = "browser" | "desktop";

export interface DocumentFileRuntimeCapabilities {
  kind: DocumentRuntimeKind;
  canOpenNativeFile: boolean;
  canSaveNativeFile: boolean;
  canChooseNativeSavePath: boolean;
}

export type SDocSaveRouteKind = "browser-download" | "native-save" | "native-save-as" | "unavailable";

export interface SDocSaveRoute {
  kind: SDocSaveRouteKind;
  label: string;
  detail: string;
  usesNativeFilesystem: boolean;
  requiresNativePath: boolean;
}

export function createDocumentFileRuntime(kind: DocumentRuntimeKind): DocumentFileRuntimeCapabilities {
  if (kind === "desktop") {
    return {
      kind,
      canOpenNativeFile: true,
      canSaveNativeFile: true,
      canChooseNativeSavePath: true
    };
  }

  return {
    kind,
    canOpenNativeFile: false,
    canSaveNativeFile: false,
    canChooseNativeSavePath: false
  };
}

export function detectDocumentFileRuntime(globalScope: unknown = globalThis): DocumentFileRuntimeCapabilities {
  return createDocumentFileRuntime(hasTauriInternals(globalScope) ? "desktop" : "browser");
}

export function resolveSdocSaveRoute(
  runtime: DocumentFileRuntimeCapabilities,
  currentNativePath: string | null
): SDocSaveRoute {
  const path = normalizeNativePath(currentNativePath);

  if (runtime.kind === "browser") {
    return {
      kind: "browser-download",
      label: "Download .sdoc",
      detail: "Browser runtime saves by downloading a complete .sdoc package.",
      usesNativeFilesystem: false,
      requiresNativePath: false
    };
  }

  if (path && runtime.canSaveNativeFile) {
    return {
      kind: "native-save",
      label: "Save .sdoc",
      detail: `Desktop runtime will update ${path}.`,
      usesNativeFilesystem: true,
      requiresNativePath: true
    };
  }

  if (runtime.canChooseNativeSavePath) {
    return {
      kind: "native-save-as",
      label: "Save .sdoc As",
      detail: "Desktop runtime must choose a .sdoc destination before saving.",
      usesNativeFilesystem: true,
      requiresNativePath: false
    };
  }

  return {
    kind: "unavailable",
    label: "Save unavailable",
    detail: "No browser download or native save capability is available.",
    usesNativeFilesystem: false,
    requiresNativePath: false
  };
}

export function getRuntimeFileBoundaryLabel(runtime: DocumentFileRuntimeCapabilities): string {
  return runtime.kind === "desktop" ? "Desktop native file access" : "Browser download/open flow";
}

function normalizeNativePath(path: string | null): string | null {
  const value = path?.trim() ?? "";
  return value.length > 0 ? value : null;
}

function hasTauriInternals(value: unknown): boolean {
  return !!value && typeof value === "object" && "__TAURI_INTERNALS__" in value;
}
