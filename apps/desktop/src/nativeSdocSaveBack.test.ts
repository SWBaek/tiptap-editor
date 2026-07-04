import { describe, expect, it } from "vitest";
import { saveSdocPackageToNativeFile } from "./nativeSdocSaveBack.js";

describe("nativeSdocSaveBack", () => {
  it("routes ready .sdoc save-back plans through the workspace adapter writer", async () => {
    const writes: Array<{ path: string; bytes: Uint8Array }> = [];
    const bytes = new Uint8Array([80, 75, 3, 4]);
    const writer = {
      async writeSdoc(path: string, packageBytes: Uint8Array) {
        writes.push({ path, bytes: packageBytes });
      }
    };

    await expect(
      saveSdocPackageToNativeFile({ path: "C:/docs/spec.sdoc", bytes, mode: "save", targetKind: "sdoc-file" }, writer)
    ).resolves.toEqual({
      plan: expect.objectContaining({
        status: "ready",
        path: "C:/docs/spec.sdoc",
        canWrite: true
      }),
      result: {
        status: "written",
        path: "C:/docs/spec.sdoc",
        byteLength: 4,
        message: "Saved C:/docs/spec.sdoc."
      }
    });
    expect(writes).toEqual([{ path: "C:/docs/spec.sdoc", bytes }]);
  });

  it("does not call the workspace writer when save-back planning fails", async () => {
    const writes: string[] = [];
    const writer = {
      async writeSdoc(path: string) {
        writes.push(path);
      }
    };

    const execution = await saveSdocPackageToNativeFile(
      { path: "C:/docs/unpacked", bytes: new Uint8Array([1]), targetKind: "unpacked-sdoc-folder" },
      writer
    );

    expect(execution.plan).toMatchObject({
      status: "unsupported-target",
      canWrite: false
    });
    expect(execution.result).toMatchObject({
      status: "skipped",
      path: "C:/docs/unpacked"
    });
    expect(writes).toEqual([]);
  });
});
