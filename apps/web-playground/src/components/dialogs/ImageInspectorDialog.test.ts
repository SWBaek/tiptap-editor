import { describe, expect, it } from "vitest";
import { isSupportedImageFile, validateImageInspectorValues, type ImageInspectorValues } from "./ImageInspectorDialog";

const validValues: ImageInspectorValues = {
  alt: "Architecture diagram",
  caption: "System architecture",
  alignment: "center",
  replacementFile: null
};

describe("ImageInspectorDialog helpers", () => {
  it("requires accessible alt text and a semantic caption", () => {
    expect(validateImageInspectorValues(validValues)).toBeNull();
    expect(validateImageInspectorValues({ ...validValues, alt: "" })).toContain("alt text");
    expect(validateImageInspectorValues({ ...validValues, caption: "" })).toContain("caption");
  });

  it("accepts only supported image replacement MIME types", () => {
    expect(isSupportedImageFile({ type: "image/png" })).toBe(true);
    expect(isSupportedImageFile({ type: "application/pdf" })).toBe(false);
  });
});
