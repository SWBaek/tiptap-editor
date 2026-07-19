import { describe, expect, it } from "vitest";
import {
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_STORAGE_KEY,
  clampSidebarWidth,
  loadStoredSidebarWidth,
  storeSidebarWidth
} from "./sidebarPreferences";

describe("sidebar preferences", () => {
  it("clamps widths to the supported desktop range", () => {
    expect(clampSidebarWidth(120)).toBe(MIN_SIDEBAR_WIDTH);
    expect(clampSidebarWidth(314.6)).toBe(315);
    expect(clampSidebarWidth(900)).toBe(MAX_SIDEBAR_WIDTH);
    expect(clampSidebarWidth(Number.NaN)).toBe(DEFAULT_SIDEBAR_WIDTH);
  });

  it("loads a valid runtime preference and falls back safely", () => {
    expect(loadStoredSidebarWidth({ getItem: () => "312" })).toBe(312);
    expect(loadStoredSidebarWidth({ getItem: () => "bad" })).toBe(DEFAULT_SIDEBAR_WIDTH);
    expect(loadStoredSidebarWidth({ getItem: () => null })).toBe(DEFAULT_SIDEBAR_WIDTH);
    expect(loadStoredSidebarWidth(null)).toBe(DEFAULT_SIDEBAR_WIDTH);
  });

  it("stores only the clamped UI preference", () => {
    const values = new Map<string, string>();
    storeSidebarWidth({ setItem: (key, value) => values.set(key, value) }, 500);
    expect(values.get(SIDEBAR_WIDTH_STORAGE_KEY)).toBe(String(MAX_SIDEBAR_WIDTH));
  });
});
