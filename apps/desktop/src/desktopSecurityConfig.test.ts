import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface DesktopConfig {
  app?: {
    security?: {
      csp?: Record<string, string> | string | null;
    };
  };
}

interface DesktopCapability {
  windows?: string[];
  permissions?: Array<string | { identifier?: string }>;
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8")) as T;
}

describe("desktop security configuration", () => {
  it("uses a restricted production CSP for the editor's local resources and IPC", () => {
    const config = readJson<DesktopConfig>("../src-tauri/tauri.conf.json");

    expect(config.app?.security?.csp).toEqual({
      "default-src": "'self'",
      "connect-src": "ipc: http://ipc.localhost",
      "font-src": "'self' data:",
      "img-src": "'self' data: blob:",
      "style-src": "'self' 'unsafe-inline'",
      "object-src": "'none'",
      "base-uri": "'self'",
      "frame-ancestors": "'none'"
    });
  });

  it("grants the main window only the dialog commands used by the injected bridge", () => {
    const capability = readJson<DesktopCapability>("../src-tauri/capabilities/default.json");

    expect(capability.windows).toEqual(["main"]);
    expect(capability.permissions).toEqual(["dialog:allow-open", "dialog:allow-save"]);
    expect(capability.permissions).not.toContain("core:default");
    expect(capability.permissions).not.toContain("dialog:default");
  });
});
