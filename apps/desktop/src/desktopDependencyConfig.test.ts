import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface PackageManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface PackageLock {
  packages?: Record<string, {
    version?: string;
    optional?: boolean;
    os?: string[];
    cpu?: string[];
  }>;
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8")) as T;
}

describe("desktop dependency configuration", () => {
  it("keeps the Windows Tauri CLI binding in the cross-platform lockfile", () => {
    const desktopManifest = readJson<PackageManifest>("../package.json");
    const lock = readJson<PackageLock>("../../../package-lock.json");
    const cliVersion = desktopManifest.devDependencies?.["@tauri-apps/cli"]?.replace(/^\^/, "");
    const windowsBinding = lock.packages?.["node_modules/@tauri-apps/cli-win32-x64-msvc"];

    expect(cliVersion).toBeTruthy();
    expect(windowsBinding).toEqual(expect.objectContaining({
      version: cliVersion,
      optional: true,
      os: ["win32"],
      cpu: ["x64"]
    }));
  });

  it("pins direct Tiptap extensions to the editor runtime version", () => {
    const rootManifest = readJson<PackageManifest>("../../../package.json");
    const webManifest = readJson<PackageManifest>("../../web-playground/package.json");
    const runtimeVersion = rootManifest.dependencies?.["@tiptap/core"];

    expect(runtimeVersion).toBe("3.27.1");
    expect(webManifest.dependencies?.["@tiptap/core"]).toBe(runtimeVersion);
    expect(webManifest.dependencies?.["@tiptap/extension-list"]).toBe(runtimeVersion);
    expect(webManifest.dependencies?.["@tiptap/extension-text-align"]).toBe(runtimeVersion);
  });
});
