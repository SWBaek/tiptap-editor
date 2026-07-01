import { describe, expect, it } from "vitest";
import { getSavedLabel, isMetadataDirty, renderDiffPreview, renderMetadataDiff } from "./documentState";

describe("document state helpers", () => {
  it("detects metadata changes with stable key ordering", () => {
    expect(isMetadataDirty({ title: "Spec", author: "A" }, { author: "A", title: "Spec" })).toBe(false);
    expect(isMetadataDirty({ title: "Spec", author: "B" }, { title: "Spec", author: "A" })).toBe(true);
  });

  it("shows unsaved changes ahead of the last save timestamp", () => {
    expect(getSavedLabel("10:00:00", false)).toBe("10:00:00");
    expect(getSavedLabel("10:00:00", true)).toBe("Unsaved changes");
  });

  it("renders metadata changes by field", () => {
    expect(renderMetadataDiff({ title: "Spec", author: "B", version: "1" }, { title: "Spec", author: "A" })).toEqual([
      'Metadata author changed: "A" -> "B"',
      'Metadata version added: "1"'
    ]);
  });

  it("combines document and metadata diff preview sections", () => {
    expect(renderDiffPreview(["Moved paragraph"], ['Metadata title changed: "A" -> "B"'])).toBe(
      'Document changes (1)\n- Moved paragraph\n\nMetadata changes (1)\n- Metadata title changed: "A" -> "B"\n'
    );
    expect(renderDiffPreview([], [])).toBe("NO_CHANGES\n");
  });
});
