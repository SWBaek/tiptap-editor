import { describe, expect, it } from "vitest";
import { loadStoredEditorZoom, normalizeEditorZoom } from "./ZoomControl";

describe("editor zoom model", () => {
  it("clamps and rounds zoom to the supported 10 percent steps", () => {
    expect(normalizeEditorZoom(55)).toBe(60);
    expect(normalizeEditorZoom(146)).toBe(150);
    expect(normalizeEditorZoom(240)).toBe(200);
    expect(normalizeEditorZoom(Number.NaN)).toBe(100);
  });

  it("loads a persisted preference without requiring browser storage", () => {
    expect(loadStoredEditorZoom({ getItem: () => "130" })).toBe(130);
    expect(loadStoredEditorZoom({ getItem: () => "invalid" })).toBe(100);
    expect(loadStoredEditorZoom(null)).toBe(100);
  });
});
