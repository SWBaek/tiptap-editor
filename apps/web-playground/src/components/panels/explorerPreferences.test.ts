import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPLORER_PREFERENCES,
  EXPLORER_PREFERENCES_STORAGE_KEY,
  loadExplorerPreferences,
  storeExplorerPreferences
} from "./explorerPreferences";

describe("Explorer preferences", () => {
  it("loads safe defaults and accepted values", () => {
    expect(loadExplorerPreferences(null)).toEqual(DEFAULT_EXPLORER_PREFERENCES);
    expect(loadExplorerPreferences({ getItem: () => "invalid" })).toEqual(DEFAULT_EXPLORER_PREFERENCES);
    expect(loadExplorerPreferences({ getItem: () => JSON.stringify({ sortMode: "modified", autoReveal: false }) })).toEqual({
      sortMode: "modified",
      autoReveal: false
    });
  });

  it("stores one runtime preference record", () => {
    const values = new Map<string, string>();
    storeExplorerPreferences({ setItem: (key, value) => values.set(key, value) }, { sortMode: "name", autoReveal: true });
    expect(JSON.parse(values.get(EXPLORER_PREFERENCES_STORAGE_KEY) ?? "{}")).toEqual({ sortMode: "name", autoReveal: true });
  });
});
