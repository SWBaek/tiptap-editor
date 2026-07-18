import { describe, expect, it } from "vitest";
import { normalizeWorkspaceEntryName, validateWorkspaceEntryName } from "./WorkspaceCreateDialog";

describe("WorkspaceCreateDialog", () => {
  it("normalizes document extensions and accepts ordinary folder names", () => {
    expect(normalizeWorkspaceEntryName("sdoc-file", "  Design Spec  ")).toBe("Design Spec.sdoc");
    expect(normalizeWorkspaceEntryName("sdoc-file", "Design Spec.SDOC")).toBe("Design Spec.SDOC");
    expect(normalizeWorkspaceEntryName("folder", "  Specifications  ")).toBe("Specifications");
    expect(validateWorkspaceEntryName("sdoc-file", "Design Spec")).toBeNull();
  });

  it("rejects traversal, separators, reserved names, and unsafe suffixes", () => {
    expect(validateWorkspaceEntryName("folder", "..")).toContain("dot or space");
    expect(validateWorkspaceEntryName("folder", "nested/specs")).toContain("path separators");
    expect(validateWorkspaceEntryName("sdoc-file", "CON")).toContain("reserved");
    expect(validateWorkspaceEntryName("folder", "Specs.")).toContain("dot or space");
  });
});
