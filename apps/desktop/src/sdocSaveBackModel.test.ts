import { describe, expect, it } from "vitest";
import { createNativeSdocSaveBackPlan, runNativeSdocSaveBack } from "./sdocSaveBackModel.js";

describe("sdocSaveBackModel", () => {
  it("plans native save-back for an opened .sdoc file", () => {
    const bytes = new Uint8Array([1, 2, 3]);

    expect(createNativeSdocSaveBackPlan({ path: "C:/docs/spec.sdoc", bytes, targetKind: "sdoc-file" })).toEqual({
      status: "ready",
      mode: "save",
      path: "C:/docs/spec.sdoc",
      byteLength: 3,
      canWrite: true,
      message: "Ready to update C:/docs/spec.sdoc."
    });
  });

  it("refuses native save-back without a concrete .sdoc target", () => {
    const bytes = new Uint8Array([1]);

    expect(createNativeSdocSaveBackPlan({ path: null, bytes })).toMatchObject({
      status: "missing-path",
      canWrite: false
    });
    expect(createNativeSdocSaveBackPlan({ path: "C:/docs/spec", bytes })).toMatchObject({
      status: "unsupported-target",
      canWrite: false
    });
    expect(createNativeSdocSaveBackPlan({ path: "C:/docs/unpacked", bytes, targetKind: "unpacked-sdoc-folder" })).toMatchObject({
      status: "unsupported-target",
      canWrite: false
    });
  });

  it("refuses empty payload writes", () => {
    expect(createNativeSdocSaveBackPlan({ path: "C:/docs/spec.sdoc", bytes: new Uint8Array() })).toMatchObject({
      status: "empty-payload",
      canWrite: false,
      byteLength: 0
    });
  });

  it("writes only ready plans through the native writer", async () => {
    const writes: Array<{ path: string; bytes: Uint8Array }> = [];
    const writer = {
      async writeSdoc(path: string, bytes: Uint8Array) {
        writes.push({ path, bytes });
      }
    };
    const bytes = new Uint8Array([1, 2, 3]);
    const plan = createNativeSdocSaveBackPlan({ path: "C:/docs/spec.sdoc", bytes });

    await expect(runNativeSdocSaveBack(writer, plan, bytes)).resolves.toEqual({
      status: "written",
      path: "C:/docs/spec.sdoc",
      byteLength: 3,
      message: "Saved C:/docs/spec.sdoc."
    });
    expect(writes).toEqual([{ path: "C:/docs/spec.sdoc", bytes }]);
  });

  it("skips writes when payload bytes no longer match the planned package", async () => {
    const writes: string[] = [];
    const writer = {
      async writeSdoc(path: string) {
        writes.push(path);
      }
    };
    const plan = createNativeSdocSaveBackPlan({ path: "C:/docs/spec.sdoc", bytes: new Uint8Array([1, 2, 3]) });

    await expect(runNativeSdocSaveBack(writer, plan, new Uint8Array([1, 2, 3, 4]))).resolves.toMatchObject({
      status: "skipped",
      message: "Cannot save because the payload changed after planning."
    });
    expect(writes).toEqual([]);
  });
});
