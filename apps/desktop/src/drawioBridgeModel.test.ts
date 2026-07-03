import { describe, expect, it } from "vitest";
import {
  createDrawioStatusEvent,
  getDrawioSaveBackStatus,
  hashDrawioSourceBytes,
  isUsableDrawioSource,
  resolveDrawioDiagramReference,
  type DrawioBridgeSession
} from "./drawioBridgeModel.js";

describe("drawioBridgeModel", () => {
  it("resolves Draw.io diagram asset references without reading XML from document nodes", () => {
    expect(
      resolveDrawioDiagramReference({
        type: "diagram",
        attrs: {
          id: "blk_drawio",
          kind: "drawio",
          sourceAssetId: "asset_architecture.drawio",
          previewAssetId: "asset_architecture.svg"
        }
      })
    ).toEqual({
      blockId: "blk_drawio",
      sourceAssetId: "asset_architecture.drawio",
      previewAssetId: "asset_architecture.svg"
    });
  });

  it("rejects non-Draw.io diagram nodes as bridge targets", () => {
    expect(resolveDrawioDiagramReference({ type: "diagram", attrs: { id: "blk_mermaid", kind: "mermaid", source: "flowchart TD" } })).toBeNull();
    expect(resolveDrawioDiagramReference({ type: "paragraph", attrs: { id: "blk_text" } })).toBeNull();
  });

  it("validates source-preserving Draw.io XML before save-back", () => {
    expect(isUsableDrawioSource(new TextEncoder().encode("<mxfile><diagram /></mxfile>"))).toBe(true);
    expect(isUsableDrawioSource(new TextEncoder().encode("<diagram id=\"a\" />"))).toBe(true);
    expect(isUsableDrawioSource(new TextEncoder().encode("<html></html>"))).toBe(false);
  });

  it("detects save-back conflicts without storing conflict state in canonical JSON", () => {
    expect(getDrawioSaveBackStatus("hash-a", "hash-a", "hash-b")).toBe("saved");
    expect(getDrawioSaveBackStatus("hash-a", "hash-c", "hash-b")).toBe("conflict");
    expect(getDrawioSaveBackStatus("hash-a", "hash-a", "")).toBe("invalid-source");
  });

  it("hashes source bytes deterministically for runtime conflict checks", () => {
    const bytes = new TextEncoder().encode("<mxfile><diagram /></mxfile>");
    expect(hashDrawioSourceBytes(bytes)).toBe(hashDrawioSourceBytes(bytes));
    expect(hashDrawioSourceBytes(bytes)).not.toBe(hashDrawioSourceBytes(new TextEncoder().encode("<mxfile><diagram id=\"b\" /></mxfile>")));
  });

  it("creates runtime status events from a bridge session", () => {
    const session: DrawioBridgeSession = {
      sessionId: "drawio-1",
      sourceAssetId: "asset.drawio",
      tempPath: "C:/Temp/asset.drawio",
      originalSourceHash: "hash-a"
    };

    expect(createDrawioStatusEvent("opened", session)).toEqual({
      status: "opened",
      sessionId: "drawio-1",
      sourceAssetId: "asset.drawio",
      tempPath: "C:/Temp/asset.drawio",
      message: undefined
    });
  });
});
