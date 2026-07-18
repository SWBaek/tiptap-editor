import { describe, expect, it } from "vitest";
import type { WindowSdocWorkspaceEntry } from "../../documentNativeBridge";
import {
  findWorkspaceAncestorFolders,
  flattenVisibleWorkspaceEntries,
  sortWorkspaceEntries,
  workspacePathsEqual
} from "./explorerTreeModel";

const entries: WindowSdocWorkspaceEntry[] = [
  { name: "Spec10.sdoc", path: "C:\\Docs\\Spec10.sdoc", kind: "sdoc-file" },
  {
    name: "guides",
    path: "C:\\Docs\\guides",
    kind: "folder",
    children: [
      { name: "Spec.sdoc", path: "C:\\Docs\\guides\\Spec.sdoc", kind: "sdoc-file" }
    ]
  },
  { name: "Spec2.sdoc", path: "C:\\Docs\\Spec2.sdoc", kind: "sdoc-file" },
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
});
