import { describe, expect, it } from "vitest";
import {
  clearDocumentFileRuntimeState,
  createDocumentFileRuntime,
  createDocumentFileRuntimeState,
  detectDocumentFileRuntime,
  getRuntimeFileBoundaryLabel,
  resolveSdocSaveRoute
} from "./documentFileRuntime";

describe("document file runtime", () => {
  it("keeps browser saves as complete .sdoc downloads without native filesystem claims", () => {
    const runtime = createDocumentFileRuntime("browser");

    expect(runtime).toEqual({
      kind: "browser",
      canOpenNativeFile: false,
      canSaveNativeFile: false,
      canChooseNativeSavePath: false
    });
    expect(resolveSdocSaveRoute(runtime, "C:/docs/spec.sdoc")).toEqual({
      kind: "browser-download",
      label: "Download .sdoc",
      detail: "Browser runtime saves by downloading a complete .sdoc package.",
      nativePath: null,
      usesNativeFilesystem: false,
      requiresNativePath: false
    });
    expect(getRuntimeFileBoundaryLabel(runtime)).toBe("Browser download/open flow");
  });

  it("routes desktop saves to native save when an opened .sdoc path exists", () => {
    const runtime = createDocumentFileRuntime("desktop");

    expect(resolveSdocSaveRoute(runtime, "C:/docs/spec.sdoc")).toEqual({
      kind: "native-save",
      label: "Save .sdoc",
      detail: "Desktop runtime will update C:/docs/spec.sdoc.",
      nativePath: "C:/docs/spec.sdoc",
      usesNativeFilesystem: true,
      requiresNativePath: true
    });
    expect(getRuntimeFileBoundaryLabel(runtime)).toBe("Desktop native file access");
  });

  it("keeps native paths as runtime-only desktop state", () => {
    const browser = createDocumentFileRuntime("browser");
    const desktop = createDocumentFileRuntime("desktop");

    expect(createDocumentFileRuntimeState(browser, "Spec.sdoc", "C:/docs/Spec.sdoc")).toEqual({
      filename: "Spec.sdoc",
      nativePath: null
    });
    expect(createDocumentFileRuntimeState(desktop, "Spec.sdoc", " C:/docs/Spec.sdoc ")).toEqual({
      filename: "Spec.sdoc",
      nativePath: "C:/docs/Spec.sdoc"
    });
    expect(resolveSdocSaveRoute(desktop, createDocumentFileRuntimeState(desktop, "Spec.sdoc", "C:/docs/Spec.sdoc").nativePath).kind).toBe(
      "native-save"
    );
    expect(clearDocumentFileRuntimeState()).toEqual({
      filename: null,
      nativePath: null
    });
  });

  it("detects desktop runtime from Tauri internals without importing Tauri APIs", () => {
    expect(detectDocumentFileRuntime({ __TAURI_INTERNALS__: {} })).toEqual({
      kind: "desktop",
      canOpenNativeFile: true,
      canSaveNativeFile: true,
      canChooseNativeSavePath: true
    });
    expect(detectDocumentFileRuntime({})).toEqual({
      kind: "browser",
      canOpenNativeFile: false,
      canSaveNativeFile: false,
      canChooseNativeSavePath: false
    });
  });

  it("routes desktop saves to save-as when no native path has been chosen", () => {
    const runtime = createDocumentFileRuntime("desktop");

    expect(resolveSdocSaveRoute(runtime, "   ")).toEqual({
      kind: "native-save-as",
      label: "Save .sdoc As",
      detail: "Desktop runtime must choose a .sdoc destination before saving.",
      nativePath: null,
      usesNativeFilesystem: true,
      requiresNativePath: false
    });
  });

  it("reports unavailable save routes for incomplete native capability injection", () => {
    expect(
      resolveSdocSaveRoute(
        {
          kind: "desktop",
          canOpenNativeFile: true,
          canSaveNativeFile: false,
          canChooseNativeSavePath: false
        },
        null
      )
    ).toEqual({
      kind: "unavailable",
      label: "Save unavailable",
      detail: "No browser download or native save capability is available.",
      nativePath: null,
      usesNativeFilesystem: false,
      requiresNativePath: false
    });
  });
});
