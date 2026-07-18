import { describe, expect, it } from "vitest";
import {
  getWindowDrawioExternalEditorAdapter,
  getWindowSdocNativeOpenAdapter,
  getWindowSdocNativeSaveAdapter,
  getWindowSdocWorkspaceAdapter,
  getWorkspaceRelativePath,
  SDOC_NATIVE_SAVE_BRIDGE_KEY
} from "./documentNativeBridge";

const payload = {
  filename: "Spec.sdoc",
  bytes: new Uint8Array([80, 75, 3, 4])
};

describe("document native bridge", () => {
  it("derives workspace-relative paths without accepting sibling prefixes", () => {
    expect(getWorkspaceRelativePath("C:\\Docs", "c:\\docs\\Guides\\Spec.sdoc")).toBe("Guides/Spec.sdoc");
    expect(getWorkspaceRelativePath("/workspace/docs/", "/workspace/docs/Guides")).toBe("Guides");
    expect(getWorkspaceRelativePath("/workspace/docs", "/workspace/docs-other/Spec.sdoc")).toBeNull();
  });

  it("does not expose a native save adapter without an injected bridge", () => {
    expect(getWindowSdocNativeSaveAdapter({})).toBeUndefined();
    expect(getWindowSdocNativeSaveAdapter({ [SDOC_NATIVE_SAVE_BRIDGE_KEY]: { saveSdoc: "nope" } })).toBeUndefined();
    expect(getWindowSdocNativeSaveAdapter({ [SDOC_NATIVE_SAVE_BRIDGE_KEY]: { saveSdoc: async () => undefined, openSdoc: "nope" } })).toBeUndefined();
    expect(
      getWindowSdocNativeSaveAdapter({ [SDOC_NATIVE_SAVE_BRIDGE_KEY]: { saveSdoc: async () => undefined, listSdocWorkspaceEntries: "nope" } })
    ).toBeUndefined();
  });

  it("adapts an injected native save bridge without importing Tauri APIs", async () => {
    const saved: Array<{ path: string; filename: string; bytes: number[] }> = [];
    const adapter = getWindowSdocNativeSaveAdapter({
      [SDOC_NATIVE_SAVE_BRIDGE_KEY]: {
        async saveSdoc(path: string, bytes: Uint8Array, filename: string) {
          saved.push({ path, filename, bytes: Array.from(bytes) });
        }
      }
    });

    await adapter?.save("C:/docs/Spec.sdoc", payload);

    expect(saved).toEqual([{ path: "C:/docs/Spec.sdoc", filename: "Spec.sdoc", bytes: [80, 75, 3, 4] }]);
  });

  it("adapts an optional native save-as path chooser", async () => {
    const adapter = getWindowSdocNativeSaveAdapter({
      [SDOC_NATIVE_SAVE_BRIDGE_KEY]: {
        async saveSdoc() {
          return undefined;
        },
        async chooseSdocSavePath(suggestedFilename: string) {
          return `C:/docs/${suggestedFilename}`;
        }
      }
    });

    await expect(adapter?.chooseSavePath?.("Spec.sdoc")).resolves.toBe("C:/docs/Spec.sdoc");
  });

  it("adapts an optional native open bridge", async () => {
    const adapter = getWindowSdocNativeOpenAdapter({
      [SDOC_NATIVE_SAVE_BRIDGE_KEY]: {
        async saveSdoc() {
          return undefined;
        },
        async openSdoc() {
          return {
            path: "C:/docs/Spec.sdoc",
            bytes: new Uint8Array([80, 75, 3, 4])
          };
        }
      }
    });

    await expect(adapter?.open()).resolves.toEqual({
      path: "C:/docs/Spec.sdoc",
      bytes: new Uint8Array([80, 75, 3, 4])
    });
  });

  it("adapts an optional native workspace bridge", async () => {
    const adapter = getWindowSdocWorkspaceAdapter({
      [SDOC_NATIVE_SAVE_BRIDGE_KEY]: {
        async saveSdoc() {
          return undefined;
        },
        async chooseSdocWorkspaceDirectory() {
          return "C:/docs";
        },
        async listSdocWorkspaceEntries(directoryPath: string) {
          return [
            {
              name: "Guides",
              path: `${directoryPath}/Guides`,
              kind: "folder" as const,
              children: [{ name: "Spec.sdoc", path: `${directoryPath}/Guides/Spec.sdoc`, kind: "sdoc-file" as const }]
            }
          ];
        },
        async createSdocWorkspaceFolder(directoryPath: string, relativePath: string) {
          return {
            status: "created" as const,
            path: `${directoryPath}/${relativePath}`,
            relativePath,
            kind: "folder" as const,
            message: `Created folder ${relativePath}.`
          };
        },
        async createSdocWorkspaceFile(directoryPath: string, relativePath: string) {
          return {
            status: "created" as const,
            path: `${directoryPath}/${relativePath}`,
            relativePath,
            kind: "sdoc-file" as const,
            message: `Created document ${relativePath}.`
          };
        },
        async openSdocPath(path: string) {
          return {
            path,
            bytes: new Uint8Array([80, 75, 3, 4])
          };
        }
      }
    });

    await expect(adapter?.chooseDirectory()).resolves.toBe("C:/docs");
    await expect(adapter?.list("C:/docs")).resolves.toEqual([
      {
        name: "Guides",
        path: "C:/docs/Guides",
        kind: "folder",
        children: [{ name: "Spec.sdoc", path: "C:/docs/Guides/Spec.sdoc", kind: "sdoc-file" }]
      }
    ]);
    await expect(adapter?.createFolder("C:/docs", "Guides/New")).resolves.toMatchObject({
      relativePath: "Guides/New",
      kind: "folder"
    });
    await expect(adapter?.createSdoc("C:/docs", "Guides/Spec.sdoc", new Uint8Array([80, 75, 3, 4]))).resolves.toMatchObject({
      relativePath: "Guides/Spec.sdoc",
      kind: "sdoc-file"
    });
    await expect(adapter?.openFile("C:/docs/Spec.sdoc")).resolves.toEqual({
      path: "C:/docs/Spec.sdoc",
      bytes: new Uint8Array([80, 75, 3, 4])
    });
  });

  it("adapts an optional native Draw.io external editor bridge", async () => {
    const calls: string[] = [];
    const adapter = getWindowDrawioExternalEditorAdapter({
      [SDOC_NATIVE_SAVE_BRIDGE_KEY]: {
        async saveSdoc() {
          return undefined;
        },
        async checkoutDrawioSource(sourceAssetId: string, sourceBytes: Uint8Array) {
          calls.push(`checkout:${sourceAssetId}:${sourceBytes.byteLength}`);
          return {
            sessionId: "drawio-1",
            sourceAssetId,
            tempPath: "C:/Temp/asset.drawio",
            originalSourceHash: "hash-a"
          };
        },
        async openDrawioExternalEditor(sessionId: string) {
          calls.push(`open:${sessionId}`);
          return { status: "opened" as const, sessionId };
        },
        async readDrawioExternalEdit(sessionId: string, latestSourceBytes: Uint8Array) {
          calls.push(`read:${sessionId}:${latestSourceBytes.byteLength}`);
          return {
            status: "saved" as const,
            sessionId,
            sourceAssetId: "asset.drawio",
            sourceBytes: new Uint8Array([60, 109, 120])
          };
        },
        async closeDrawioExternalEdit(sessionId: string) {
          calls.push(`close:${sessionId}`);
          return { status: "closed" as const, sessionId };
        }
      }
    });

    const session = await adapter?.checkoutSource("asset.drawio", new Uint8Array([1, 2]));
    await expect(adapter?.openExternalEditor("drawio-1")).resolves.toEqual({ status: "opened", sessionId: "drawio-1" });
    await expect(adapter?.readEditedSource(session!, new Uint8Array([3]))).resolves.toEqual({
      status: "saved",
      sessionId: "drawio-1",
      sourceAssetId: "asset.drawio",
      sourceBytes: new Uint8Array([60, 109, 120])
    });
    await expect(adapter?.closeSession("drawio-1")).resolves.toEqual({ status: "closed", sessionId: "drawio-1" });
    expect(calls).toEqual(["checkout:asset.drawio:2", "open:drawio-1", "read:drawio-1:1", "close:drawio-1"]);
  });
});
