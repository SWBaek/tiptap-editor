import { describe, expect, it } from "vitest";
import { validatePastedImageDetails, validatePastedImageFilename } from "./ImagePasteDialog";

describe("ImagePasteDialog validation", () => {
  it("requires a local filename and accessible caption", () => {
    expect(validatePastedImageFilename("scope-capture.png")).toBeNull();
    expect(validatePastedImageFilename("../scope.png")).toContain("without folders");
    expect(validatePastedImageDetails("scope.png", "")).toContain("caption");
    expect(validatePastedImageDetails("scope.png", "Converter scope capture")).toBeNull();
  });
});
