import { describe, expect, it } from "vitest";
import type { WindowSdocWorkspaceEntry } from "../../documentNativeBridge";
import { createQuickOpenItems } from "./QuickOpenDialog";

const entries: WindowSdocWorkspaceEntry[] = [
  {
    name: "Guides",
    path: "C:\\Docs\\Guides",
    kind: "folder",
    children: [{ name: "Setup.sdoc", path: "C:\\Docs\\Guides\\Setup.sdoc", kind: "sdoc-file" }]
  },
  { name: "Architecture.sdoc", path: "C:\\Docs\\Architecture.sdoc", kind: "sdoc-file" }
];

describe("Quick Open model", () => {
  it("returns naturally sorted relative workspace paths", () => {
    expect(createQuickOpenItems(entries, "C:\\Docs", "").map((item) => item.relativePath)).toEqual([
      "Architecture.sdoc",
      "Guides/Setup.sdoc"
    ]);
  });

  it("filters on both filename and relative path", () => {
    expect(createQuickOpenItems(entries, "C:\\Docs", "guides").map((item) => item.entry.name)).toEqual(["Setup.sdoc"]);
    expect(createQuickOpenItems(entries, "C:\\Docs", "architecture").map((item) => item.entry.name)).toEqual(["Architecture.sdoc"]);
  });
});
