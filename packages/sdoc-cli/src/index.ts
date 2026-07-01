#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { diffDocuments, renderDiffEvents } from "@sdoc/diff";
import { exportDerivedOutputs, exportMarkdown } from "@sdoc/export";
import { isLikelyZipContainer, normalizeDocument, packSdoc, stableStringify, unpackSdoc, type SDocContainer } from "@sdoc/format";
import type { SDocDocument } from "@sdoc/schema";

async function main(args: string[]): Promise<void> {
  const [command, ...rest] = args;

  switch (command) {
    case "diff":
      await runDiff(rest);
      break;
    case "export":
      await runExport(rest);
      break;
    case "pack":
      await runPack(rest);
      break;
    case "unpack":
      await runUnpack(rest);
      break;
    default:
      printHelp();
      process.exitCode = command ? 1 : 0;
  }
}

async function runDiff(args: string[]): Promise<void> {
  const [oldPath, newPath] = args;
  if (!oldPath || !newPath) {
    throw new Error("usage: sdoc diff <old.sdoc|old.document.json> <new.sdoc|new.document.json>");
  }

  const oldDocument = await loadDocument(oldPath);
  const newDocument = await loadDocument(newPath);
  const lines = renderDiffEvents(diffDocuments(oldDocument, newDocument));
  process.stdout.write(lines.length > 0 ? `${lines.join("\n")}\n` : "NO_CHANGES\n");
}

async function runExport(args: string[]): Promise<void> {
  const [inputPath, ...rest] = args;
  if (!inputPath) {
    throw new Error("usage: sdoc export <input.sdoc|document.json> --format markdown [-o output.md]");
  }

  const positionals = rest.filter((value) => !value.startsWith("-"));
  const format = getOption(rest, "--format") ?? positionals[0] ?? "markdown";
  const output = getOption(rest, "-o") ?? positionals[1];
  if (format !== "markdown") {
    throw new Error(`unsupported export format: ${format}`);
  }

  const markdown = exportMarkdown(await loadDocument(inputPath));
  if (output) {
    await writeFile(output, markdown, "utf8");
  } else {
    process.stdout.write(markdown);
  }
}

async function runPack(args: string[]): Promise<void> {
  const [folderPath, ...rest] = args;
  const output = getOption(rest, "-o") ?? rest.find((value) => !value.startsWith("-"));
  if (!folderPath || !output) {
    throw new Error("usage: sdoc pack <folder> <output.sdoc>");
  }

  const container = await readContainerFolder(folderPath);
  const derived = exportDerivedOutputs(container.document);
  const packed = await packSdoc({ ...container, derived: { ...container.derived, ...derived } });
  await writeFile(output, packed);
}

async function runUnpack(args: string[]): Promise<void> {
  const [inputPath, ...rest] = args;
  const output = getOption(rest, "-o") ?? rest.find((value) => !value.startsWith("-"));
  if (!inputPath || !output) {
    throw new Error("usage: sdoc unpack <input.sdoc> <folder>");
  }

  const container = await unpackSdoc(await readFile(inputPath));
  await writeContainerFolder(output, container);
}

async function loadDocument(filePath: string): Promise<SDocDocument> {
  const data = await readFile(filePath);
  if (filePath.endsWith(".sdoc") || isLikelyZipContainer(data)) {
    return (await unpackSdoc(data)).document;
  }

  return JSON.parse(stripBom(data.toString("utf8"))) as SDocDocument;
}

async function readContainerFolder(folderPath: string): Promise<SDocContainer> {
  const manifest = JSON.parse(await readText(path.join(folderPath, "manifest.json")));
  const document = JSON.parse(await readText(path.join(folderPath, "document.json")));
  const metadata = JSON.parse(await readText(path.join(folderPath, "metadata.json")));

  return {
    manifest,
    document,
    metadata,
    assets: await readBinaryDirectory(path.join(folderPath, "assets")),
    derived: await readTextDirectory(path.join(folderPath, "derived"))
  };
}

async function writeContainerFolder(folderPath: string, container: SDocContainer): Promise<void> {
  await mkdir(folderPath, { recursive: true });
  await writeFile(path.join(folderPath, "manifest.json"), stableStringify(container.manifest), "utf8");
  await writeFile(path.join(folderPath, "document.json"), stableStringify(normalizeDocument(container.document)), "utf8");
  await writeFile(path.join(folderPath, "metadata.json"), stableStringify(container.metadata), "utf8");

  if (container.assets && Object.keys(container.assets).length > 0) {
    const assetsPath = path.join(folderPath, "assets");
    await mkdir(assetsPath, { recursive: true });
    for (const [name, data] of Object.entries(container.assets)) {
      await writeFile(path.join(assetsPath, name), data);
    }
  }

  if (container.derived && Object.keys(container.derived).length > 0) {
    const derivedPath = path.join(folderPath, "derived");
    await mkdir(derivedPath, { recursive: true });
    for (const [name, data] of Object.entries(container.derived)) {
      await writeFile(path.join(derivedPath, name), data, "utf8");
    }
  }
}

async function readText(filePath: string): Promise<string> {
  return stripBom(await readFile(filePath, "utf8"));
}

async function readTextDirectory(folderPath: string): Promise<Record<string, string>> {
  try {
    const entries = await readdir(folderPath, { withFileTypes: true });
    const result: Record<string, string> = {};
    for (const entry of entries) {
      if (entry.isFile()) {
        result[entry.name] = await readText(path.join(folderPath, entry.name));
      }
    }
    return result;
  } catch {
    return {};
  }
}

async function readBinaryDirectory(folderPath: string): Promise<Record<string, Uint8Array>> {
  try {
    const entries = await readdir(folderPath, { withFileTypes: true });
    const result: Record<string, Uint8Array> = {};
    for (const entry of entries) {
      if (entry.isFile()) {
        result[entry.name] = await readFile(path.join(folderPath, entry.name));
      }
    }
    return result;
  } catch {
    return {};
  }
}

function getOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function printHelp(): void {
  process.stdout.write(`sdoc phase0 cli

Commands:
  sdoc diff <old.sdoc|old.document.json> <new.sdoc|new.document.json>
  sdoc export <input.sdoc|document.json> markdown [output.md]
  sdoc pack <folder> <output.sdoc>
  sdoc unpack <input.sdoc> <folder>
`);
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

main(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
