import { describe, expect, it } from "vitest";
import { getWindowSdocNativeOpenAdapter, getWindowSdocNativeSaveAdapter, SDOC_NATIVE_SAVE_BRIDGE_KEY } from "./documentNativeBridge";

const payload = {
  filename: "Spec.sdoc",
  bytes: new Uint8Array([80, 75, 3, 4])
};

describe("document native bridge", () => {
  it("does not expose a native save adapter without an injected bridge", () => {
    expect(getWindowSdocNativeSaveAdapter({})).toBeUndefined();
    expect(getWindowSdocNativeSaveAdapter({ [SDOC_NATIVE_SAVE_BRIDGE_KEY]: { saveSdoc: "nope" } })).toBeUndefined();
    expect(getWindowSdocNativeSaveAdapter({ [SDOC_NATIVE_SAVE_BRIDGE_KEY]: { saveSdoc: async () => undefined, openSdoc: "nope" } })).toBeUndefined();
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
});
