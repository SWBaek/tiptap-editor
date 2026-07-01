import { describe, expect, it } from "vitest";
import { getSavedLabel, isMetadataDirty } from "./documentState";

describe("document state helpers", () => {
  it("detects metadata changes with stable key ordering", () => {
    expect(isMetadataDirty({ title: "Spec", author: "A" }, { author: "A", title: "Spec" })).toBe(false);
    expect(isMetadataDirty({ title: "Spec", author: "B" }, { title: "Spec", author: "A" })).toBe(true);
  });

  it("shows unsaved changes ahead of the last save timestamp", () => {
    expect(getSavedLabel("10:00:00", false)).toBe("10:00:00");
    expect(getSavedLabel("10:00:00", true)).toBe("Unsaved changes");
  });
});
