import { describe, expect, it } from "vitest";
import { getWorkspaceEntryLabel, isWorkspaceEntry, sortWorkspaceEntries, type NativeWorkspaceEntry } from "./workspaceModel.js";

describe("workspaceModel", () => {
  it("sorts .sdoc files before unpacked folders by display name", () => {
    const entries: NativeWorkspaceEntry[] = [
      { name: "zeta", path: "C:/docs/zeta", kind: "unpacked-sdoc-folder" },
      { name: "beta.sdoc", path: "C:/docs/beta.sdoc", kind: "sdoc-file" },
      { name: "alpha.sdoc", path: "C:/docs/alpha.sdoc", kind: "sdoc-file" }
    ];

    expect(sortWorkspaceEntries(entries).map((entry) => entry.name)).toEqual(["alpha.sdoc", "beta.sdoc", "zeta"]);
  });

  it("labels unpacked folders without changing their identity", () => {
    expect(getWorkspaceEntryLabel({ name: "review-copy", path: "C:/docs/review-copy", kind: "unpacked-sdoc-folder" })).toBe("review-copy (unpacked)");
    expect(getWorkspaceEntryLabel({ name: "document.sdoc", path: "C:/docs/document.sdoc", kind: "sdoc-file" })).toBe("document.sdoc");
  });

  it("validates workspace entries returned by the desktop bridge", () => {
    expect(isWorkspaceEntry({ name: "doc.sdoc", path: "C:/docs/doc.sdoc", kind: "sdoc-file", sizeBytes: 10, modifiedAtMs: 20 })).toBe(true);
    expect(isWorkspaceEntry({ name: "doc.txt", path: "C:/docs/doc.txt", kind: "text" })).toBe(false);
  });
});
