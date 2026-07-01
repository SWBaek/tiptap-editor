import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const cliPath = path.join(process.cwd(), "packages/sdoc-cli/dist/index.js");
const validDocumentPath = path.join(process.cwd(), "examples/sdoc-json/basic.document.json");

describe("sdoc CLI", () => {
  it("validates a document JSON file", async () => {
    const result = await runSdoc(["validate", validDocumentPath]);

    expect(result.stdout).toContain(`VALID ${validDocumentPath}`);
    expect(result.stderr).toBe("");
  });

  it("rejects schema-invalid document JSON", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "sdoc-cli-"));
    const invalidPath = path.join(tempDir, "invalid.document.json");

    try {
      await writeFile(
        invalidPath,
        JSON.stringify({
          schemaVersion: 1,
          type: "doc",
          attrs: { id: "doc_bad" },
          content: [{ type: "figure" }]
        }),
        "utf8"
      );

      await expect(runSdoc(["validate", invalidPath])).rejects.toMatchObject({
        stderr: expect.stringContaining("$.content[0].type: unsupported node type: figure")
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("validates an unpacked .sdoc folder", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "sdoc-cli-"));
    const unpackedPath = path.join(tempDir, "document.sdoc.d");

    try {
      await createUnpackedFixture(unpackedPath);
      const result = await runSdoc(["validate", unpackedPath]);
      expect(result.stdout).toContain(`VALID ${unpackedPath}`);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

async function runSdoc(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync(process.execPath, [cliPath, ...args], { encoding: "utf8" });
  return {
    stdout: String(result.stdout),
    stderr: String(result.stderr)
  };
}

async function createUnpackedFixture(folderPath: string): Promise<void> {
  await mkdir(folderPath, { recursive: true });
  await writeFile(
    path.join(folderPath, "manifest.json"),
    JSON.stringify(
      {
        format: "sdoc",
        formatVersion: 1,
        schemaVersion: 1,
        documentId: "doc_cli",
        createdBy: "test"
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    path.join(folderPath, "document.json"),
    JSON.stringify({ schemaVersion: 1, type: "doc", attrs: { id: "doc_cli" }, content: [] }, null, 2),
    "utf8"
  );
  await writeFile(path.join(folderPath, "metadata.json"), JSON.stringify({ title: "CLI Test" }, null, 2), "utf8");
}
