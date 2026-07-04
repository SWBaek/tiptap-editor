import { describe, expect, it } from "vitest";
import {
  createNativeSdocSaveBridge,
  installNativeSdocSaveBridge,
  SDOC_NATIVE_SAVE_BRIDGE_KEY,
  type WindowWithSdocNativeSaveBridge
} from "./nativeSdocSaveBridge.js";
import type { NativeSdocSaveBackRequest } from "./sdocSaveBackModel.js";

describe("native sdoc save bridge", () => {
  it("writes .sdoc bytes through the validated native save-back path", async () => {
    const requests: NativeSdocSaveBackRequest[] = [];
    const bridge = createNativeSdocSaveBridge({
      async savePackage(request: NativeSdocSaveBackRequest) {
        requests.push(request);
        return {
          plan: {
            status: "ready",
            mode: "save",
            path: request.path,
            byteLength: request.bytes.byteLength,
            canWrite: true,
            message: "Ready."
          },
          result: {
            status: "written",
            path: request.path,
            byteLength: request.bytes.byteLength,
            message: `Saved ${request.path}.`
          }
        };
      }
    });

    await bridge.saveSdoc("C:/docs/Spec.sdoc", new Uint8Array([80, 75, 3, 4]), "Spec.sdoc");

    expect(requests).toEqual([
      {
        path: "C:/docs/Spec.sdoc",
        bytes: new Uint8Array([80, 75, 3, 4]),
        mode: "save"
      }
    ]);
  });

  it("throws when save-back validation refuses the write", async () => {
    const bridge = createNativeSdocSaveBridge({
      async savePackage(request: NativeSdocSaveBackRequest) {
        return {
          plan: {
            status: "unsupported-target",
            mode: "save",
            path: request.path,
            byteLength: request.bytes.byteLength,
            canWrite: false,
            message: "Native save-back requires a .sdoc file path."
          },
          result: {
            status: "skipped",
            path: request.path,
            byteLength: request.bytes.byteLength,
            message: "Native save-back requires a .sdoc file path."
          }
        };
      }
    });

    await expect(bridge.saveSdoc("C:/docs/Spec.zip", new Uint8Array([1]), "Spec.sdoc")).rejects.toThrow(
      "Native save-back requires a .sdoc file path."
    );
  });

  it("uses the injected save-as chooser", async () => {
    const bridge = createNativeSdocSaveBridge({
      async chooseSavePath(suggestedFilename: string) {
        return `C:/docs/${suggestedFilename}`;
      }
    });

    await expect(bridge.chooseSdocSavePath("Spec.sdoc")).resolves.toBe("C:/docs/Spec.sdoc");
  });

  it("opens .sdoc bytes through the injected native reader", async () => {
    const bridge = createNativeSdocSaveBridge({
      async chooseOpenPath() {
        return "C:/docs/Spec.sdoc";
      },
      async readPackage(path: string) {
        return new Uint8Array(path.endsWith("Spec.sdoc") ? [80, 75, 3, 4] : []);
      }
    });

    await expect(bridge.openSdoc()).resolves.toEqual({
      path: "C:/docs/Spec.sdoc",
      bytes: new Uint8Array([80, 75, 3, 4])
    });
  });

  it("returns null when native open is cancelled", async () => {
    const bridge = createNativeSdocSaveBridge({
      async chooseOpenPath() {
        return null;
      },
      async readPackage() {
        throw new Error("should not read after cancellation");
      }
    });

    await expect(bridge.openSdoc()).resolves.toBeNull();
  });

  it("opens a listed workspace .sdoc file by path", async () => {
    const bridge = createNativeSdocSaveBridge({
      async readPackage(path: string) {
        return new Uint8Array(path === "C:/docs/Listed.sdoc" ? [80, 75, 3, 4] : []);
      }
    });

    await expect(bridge.openSdocPath("C:/docs/Listed.sdoc")).resolves.toEqual({
      path: "C:/docs/Listed.sdoc",
      bytes: new Uint8Array([80, 75, 3, 4])
    });
  });

  it("lists workspace entries through injected desktop adapter functions", async () => {
    const bridge = createNativeSdocSaveBridge({
      async chooseWorkspaceDirectory() {
        return "C:/docs";
      },
      async listWorkspaceEntries(directoryPath, options) {
        return [
          {
            name: options?.includeUnpackedFolders ? "review-copy" : "Spec.sdoc",
            path: `${directoryPath}/Spec.sdoc`,
            kind: "sdoc-file"
          }
        ];
      }
    });

    await expect(bridge.chooseSdocWorkspaceDirectory()).resolves.toBe("C:/docs");
    await expect(bridge.listSdocWorkspaceEntries("C:/docs")).resolves.toEqual([
      {
        name: "Spec.sdoc",
        path: "C:/docs/Spec.sdoc",
        kind: "sdoc-file"
      }
    ]);
  });

  it("routes Draw.io external editor calls through the injected bridge", async () => {
    const calls: string[] = [];
    const bridge = createNativeSdocSaveBridge({
      drawioBridge: {
        async checkoutSource(sourceAssetId, sourceBytes) {
          calls.push(`checkout:${sourceAssetId}:${sourceBytes.byteLength}`);
          return {
            sessionId: "drawio-1",
            sourceAssetId,
            tempPath: "C:/Temp/asset.drawio",
            originalSourceHash: "hash-a"
          };
        },
        async openExternalEditor(sessionId) {
          calls.push(`open:${sessionId}`);
          return { status: "opened", sessionId };
        },
        async readEditedSource(session, latestSourceBytes) {
          calls.push(`read:${session.sessionId}:${latestSourceBytes.byteLength}`);
          return {
            status: "saved",
            sessionId: session.sessionId,
            sourceAssetId: "asset.drawio",
            sourceBytes: new Uint8Array([60, 109, 120])
          };
        },
        async closeSession(sessionId) {
          calls.push(`close:${sessionId}`);
          return { status: "closed", sessionId };
        }
      }
    });

    await expect(bridge.checkoutDrawioSource("asset.drawio", new Uint8Array([1, 2]))).resolves.toEqual({
      sessionId: "drawio-1",
      sourceAssetId: "asset.drawio",
      tempPath: "C:/Temp/asset.drawio",
      originalSourceHash: "hash-a"
    });
    await expect(bridge.openDrawioExternalEditor("drawio-1")).resolves.toEqual({ status: "opened", sessionId: "drawio-1" });
    await expect(bridge.readDrawioExternalEdit("drawio-1", new Uint8Array([3]))).resolves.toEqual({
      status: "saved",
      sessionId: "drawio-1",
      sourceAssetId: "asset.drawio",
      sourceBytes: new Uint8Array([60, 109, 120])
    });
    await expect(bridge.closeDrawioExternalEdit("drawio-1")).resolves.toEqual({ status: "closed", sessionId: "drawio-1" });
    expect(calls).toEqual(["checkout:asset.drawio:2", "open:drawio-1", "read:drawio-1:1", "close:drawio-1"]);
  });

  it("installs the bridge on an explicit global scope", () => {
    const globalScope: WindowWithSdocNativeSaveBridge = {};
    const bridge = installNativeSdocSaveBridge({
      globalScope,
      async chooseSavePath() {
        return null;
      }
    });

    expect(globalScope[SDOC_NATIVE_SAVE_BRIDGE_KEY]).toBe(bridge);
  });
});
