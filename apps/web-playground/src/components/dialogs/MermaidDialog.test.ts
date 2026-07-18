import { describe, expect, it } from "vitest";
import { normalizeMermaidSource, renderMermaidPreview } from "./MermaidDialog";

describe("MermaidDialog helpers", () => {
  it("normalizes source and rejects an empty preview", async () => {
    expect(normalizeMermaidSource("  flowchart TD\nA --> B  ")).toBe("flowchart TD\nA --> B");
    await expect(renderMermaidPreview("   ")).resolves.toEqual({ svg: "", error: "Enter Mermaid source" });
  });
});
