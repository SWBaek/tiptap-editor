import { describe, expect, it } from "vitest";
import type { WindowSdocWorkspaceEntry } from "../../documentNativeBridge";
import {
  collectWorkspaceFolderPaths,
  filterWorkspaceEntries,
  findWorkspaceAncestorFolders,
  flattenWorkspaceDocuments,
  flattenVisibleWorkspaceEntries,
  sortWorkspaceEntries,
  workspacePathsEqual
} from "./explorerTreeModel";

const entries: WindowSdocWorkspaceEntry[] = [
  { name: "Spec10.sdoc", path: "C:\\Docs\\Spec10.sdoc", kind: "sdoc-file", modifiedAtMs: 10 },
  {
    name: "guides",
    path: "C:\\Docs\\guides",
    kind: "folder",
    children: [
      { name: "Spec.sdoc", path: "C:\\Docs\\guides\\Spec.sdoc", kind: "sdoc-file", modifiedAtMs: 30 }
    ]
  },
  { name: "Spec2.sdoc", path: "C:\\Docs\\Spec2.sdoc", kind: "sdoc-file", modifiedAtMs: 20 },
  { name: "API", path: "C:\\Docs\\API", kind: "folder", children: [] }
];

describe("Explorer tree model", () => {
  it("sorts folders first and uses natural case-insensitive filename order", () => {
    expect(sortWorkspaceEntries(entries).map((entry) => entry.name)).toEqual([
      "API",
      "guides",
      "Spec2.sdoc",
      "Spec10.sdoc"
    ]);
  });

  it("sorts by newest modified time within folders and files", () => {
    expect(sortWorkspaceEntries(entries, "modified").map((entry) => entry.name)).toEqual([
      "API",
      "guides",
      "Spec2.sdoc",
      "Spec10.sdoc"
    ]);
  });

  it("flattens only expanded branches with levels and parent paths", () => {
    const visible = flattenVisibleWorkspaceEntries(entries, new Set(["C:\\Docs\\guides"]));
    expect(visible.map(({ entry, level, parentPath }) => [entry.name, level, parentPath])).toEqual([
      ["API", 1, null],
      ["guides", 1, null],
      ["Spec.sdoc", 2, "C:\\Docs\\guides"],
      ["Spec2.sdoc", 1, null],
      ["Spec10.sdoc", 1, null]
    ]);
  });

  it("uses normalized full paths instead of duplicate basenames", () => {
    expect(workspacePathsEqual("C:\\Docs\\Spec.sdoc", "c:/docs/spec.sdoc")).toBe(true);
    expect(workspacePathsEqual("C:\\Docs\\Spec.sdoc", "C:\\Docs\\guides\\Spec.sdoc")).toBe(false);
  });

  it("finds the folders needed to reveal the current document", () => {
    expect(findWorkspaceAncestorFolders(entries, "c:/docs/guides/spec.sdoc")).toEqual(["C:\\Docs\\guides"]);
  });

  it("filters documents while retaining and expanding matching ancestors", () => {
    const filtered = filterWorkspaceEntries(entries, "spec.sdoc");
    expect(filtered.map((entry) => entry.name)).toEqual(["guides"]);
    expect(filtered[0].children?.map((entry) => entry.name)).toEqual(["Spec.sdoc"]);
    expect([...collectWorkspaceFolderPaths(filtered)]).toEqual(["C:\\Docs\\guides"]);
  });

  it("flattens all workspace documents for Quick Open", () => {
    expect(flattenWorkspaceDocuments(entries).map((entry) => entry.path)).toEqual([
      "C:\\Docs\\Spec10.sdoc",
      "C:\\Docs\\guides\\Spec.sdoc",
      "C:\\Docs\\Spec2.sdoc"
    ]);
  });
});
