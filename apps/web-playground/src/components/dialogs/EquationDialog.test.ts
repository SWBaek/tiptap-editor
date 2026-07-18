import { describe, expect, it } from "vitest";
import { renderEquationPreview } from "./EquationDialog";

describe("renderEquationPreview", () => {
  it("renders valid LaTeX and reports empty or malformed source", () => {
    expect(renderEquationPreview("E=mc^2", false)).toMatchObject({ error: null });
    expect(renderEquationPreview("E=mc^2", false).html).toContain("katex");
    expect(renderEquationPreview("", true).error).toContain("Enter LaTeX");
    expect(renderEquationPreview("\\notARealCommand{", true).error).toBeTruthy();
  });
});
