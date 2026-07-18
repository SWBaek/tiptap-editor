import { describe, expect, it } from "vitest";
import { getWorkspaceEntryLabel, isWorkspaceEntry, sortWorkspaceEntries, type NativeWorkspaceEntry } from "./workspaceModel.js";

describe("workspaceModel", () => {
  it("sorts folders before .sdoc files and recursively sorts children", () => {
    const entries: NativeWorkspaceEntry[] = [
      { name: "zeta", path: "C:/docs/zeta", kind: "unpacked-sdoc-folder" },
      { name: "beta.sdoc", path: "C:/docs/beta.sdoc", kind: "sdoc-file" },
      { name: "alpha.sdoc", path: "C:/docs/alpha.sdoc", kind: "sdoc-file" },
      {
        name: "Guides",
        path: "C:/docs/Guides",
        kind: "folder",
        children: [
          { name: "zeta.sdoc", path: "C:/docs/Guides/zeta.sdoc", kind: "sdoc-file" },
          { name: "alpha.sdoc", path: "C:/docs/Guides/alpha.sdoc", kind: "sdoc-file" }
        ]
      }
    ];

    const sorted = sortWorkspaceEntries(entries);
    expect(sorted.map((entry) => entry.name)).toEqual(["Guides", "alpha.sdoc", "beta.sdoc", "zeta"]);
    expect(sorted[0].children?.map((entry) => entry.name)).toEqual(["alpha.sdoc", "zeta.sdoc"]);
  });

  it("labels unpacked folders without changing their identity", () => {
    expect(getWorkspaceEntryLabel({ name: "review-copy", path: "C:/docs/review-copy", kind: "unpacked-sdoc-folder" })).toBe("review-copy (unpacked)");
    expect(getWorkspaceEntryLabel({ name: "document.sdoc", path: "C:/docs/document.sdoc", kind: "sdoc-file" })).toBe("document.sdoc");
  });

  it("validates workspace entries returned by the desktop bridge", () => {
    expect(isWorkspaceEntry({ name: "doc.sdoc", path: "C:/docs/doc.sdoc", kind: "sdoc-file", sizeBytes: 10, modifiedAtMs: 20 })).toBe(true);
    expect(isWorkspaceEntry({ name: "Guides", path: "C:/docs/Guides", kind: "folder", children: [] })).toBe(true);
    expect(isWorkspaceEntry({ name: "Guides", path: "C:/docs/Guides", kind: "folder" })).toBe(false);
    expect(isWorkspaceEntry({ name: "doc.sdoc", path: "C:/docs/doc.sdoc", kind: "sdoc-file", children: [] })).toBe(false);
    expect(isWorkspaceEntry({ name: "doc.txt", path: "C:/docs/doc.txt", kind: "text" })).toBe(false);
  });
});
