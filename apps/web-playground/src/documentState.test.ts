import { describe, expect, it } from "vitest";
import {
  getFileLabel,
  getSavedLabel,
  getValidationFailureMessage,
  isMetadataDirty,
  renderDiffPreview,
  renderMetadataDiff
} from "./documentState";

describe("document state helpers", () => {
  it("detects metadata changes with stable key ordering", () => {
    expect(isMetadataDirty({ title: "Spec", author: "A" }, { author: "A", title: "Spec" })).toBe(false);
    expect(isMetadataDirty({ title: "Spec", author: "B" }, { title: "Spec", author: "A" })).toBe(true);
  });

  it("shows unsaved changes ahead of the last save timestamp", () => {
    expect(getSavedLabel("10:00:00", false)).toBe("10:00:00");
    expect(getSavedLabel("10:00:00", true)).toBe("Unsaved changes");
  });

  it("uses the opened filename before deriving a draft filename from metadata", () => {
    expect(getFileLabel("Opened.sdoc", { title: "Draft" })).toBe("Opened.sdoc");
    expect(getFileLabel(null, { title: "Draft" })).toBe("Draft.sdoc");
    expect(getFileLabel(null, { title: "   " })).toBe("Untitled.sdoc");
  });

  it("formats validation failures for export actions", () => {
    expect(getValidationFailureMessage({ ok: true, issues: [] }, "save .sdoc")).toBeNull();
    expect(
      getValidationFailureMessage(
        { ok: false, issues: [{ path: "$.content[0].type", message: "unsupported node type: equationBlock" }] },
        "export Markdown"
      )
    ).toBe("Cannot export Markdown: $.content[0].type: unsupported node type: equationBlock");
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
