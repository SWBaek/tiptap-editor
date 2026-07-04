import { describe, expect, it } from "vitest";
import { runSdocSaveAction } from "./documentFileActions";
import { createDocumentFileRuntime, resolveSdocSaveRoute } from "./documentFileRuntime";
import type { CreateSdocPayloadResult } from "./documentIo";

const payload: CreateSdocPayloadResult = {
  filename: "Spec.sdoc",
  bytes: new Uint8Array([80, 75, 3, 4])
};

describe("document file actions", () => {
  it("runs browser save routes through the download adapter", async () => {
    const downloaded: string[] = [];
    const route = resolveSdocSaveRoute(createDocumentFileRuntime("browser"), null);

    await expect(
      runSdocSaveAction(route, payload, {
        browser: {
          download: (nextPayload) => downloaded.push(nextPayload.filename)
        }
      })
    ).resolves.toEqual({
      status: "downloaded",
      path: null,
      message: "Downloaded Spec.sdoc."
    });
    expect(downloaded).toEqual(["Spec.sdoc"]);
  });

  it("runs native save routes through an injected native adapter", async () => {
    const saved: Array<{ path: string; filename: string }> = [];
    const route = resolveSdocSaveRoute(createDocumentFileRuntime("desktop"), "C:/docs/Spec.sdoc");

    await expect(
      runSdocSaveAction(route, payload, {
        native: {
          async save(path, nextPayload) {
            saved.push({ path, filename: nextPayload.filename });
          }
        }
      })
    ).resolves.toEqual({
      status: "saved-native",
      path: "C:/docs/Spec.sdoc",
      message: "Saved C:/docs/Spec.sdoc."
    });
    expect(saved).toEqual([{ path: "C:/docs/Spec.sdoc", filename: "Spec.sdoc" }]);
  });

  it("requires an explicit native adapter before native routes can write", async () => {
    const route = resolveSdocSaveRoute(createDocumentFileRuntime("desktop"), "C:/docs/Spec.sdoc");

    await expect(runSdocSaveAction(route, payload, {})).resolves.toEqual({
      status: "unavailable",
      path: "C:/docs/Spec.sdoc",
      message: "Native save adapter is not available."
    });
  });

  it("runs native save-as through an injected chooser before saving", async () => {
    const saved: string[] = [];
    const route = resolveSdocSaveRoute(createDocumentFileRuntime("desktop"), null);

    await expect(
      runSdocSaveAction(route, payload, {
        native: {
          async chooseSavePath(suggestedFilename) {
            return `C:/docs/${suggestedFilename}`;
          },
          async save(path) {
            saved.push(path);
          }
        }
      })
    ).resolves.toEqual({
      status: "saved-native",
      path: "C:/docs/Spec.sdoc",
      message: "Saved C:/docs/Spec.sdoc."
    });
    expect(saved).toEqual(["C:/docs/Spec.sdoc"]);
  });
});
