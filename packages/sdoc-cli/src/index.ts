#!/usr/bin/env node

import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { diffDocuments, renderDiffEvents } from "@sdoc/diff";
import { exportDerivedOutputs, exportHtml, exportMarkdown, exportPptx, type CorporateTemplateName } from "@sdoc/export";
import { isLikelyZipContainer, normalizeDocument, packSdoc, stableStringify, unpackSdoc, type SDocContainer } from "@sdoc/format";
import { validateDocument, type SDocDocument, type ValidationIssue } from "@sdoc/schema";

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
    case "validate":
      await runValidate(rest);
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
      throw new Error("usage: sdoc export <input.sdoc|document.json> --format <markdown|html|pdf|pptx|chunks|outline|references> [--template controlled] [-o output]");
  }

  const positionals = getPositionals(rest, new Set(["--format", "-o", "--template"]));
  const format = getOption(rest, "--format") ?? positionals[0] ?? "markdown";
  const output = getOption(rest, "-o") ?? positionals[1];
  const template = parseCorporateTemplate(getOption(rest, "--template"));
  if (format.toLowerCase() === "pdf") {
    if (!output) {
      throw new Error("usage: sdoc export <input.sdoc|document.json> --format pdf -o output.pdf");
    }

    await writePdfExport(await loadExportInput(inputPath), output, template);
    return;
  }

  if (format.toLowerCase() === "pptx") {
    if (!output) {
      throw new Error("usage: sdoc export <input.sdoc|document.json> --format pptx -o output.pptx");
    }

    await writePptxExport(await loadExportInput(inputPath), output);
    return;
  }

  const exportText = renderExport(await loadExportInput(inputPath), format, template);

  if (output) {
    await writeFile(output, exportText, "utf8");
  } else {
    process.stdout.write(exportText);
  }
}

async function writePptxExport(input: ExportInput, outputPath: string): Promise<void> {
  const bytes = await exportPptx(input.document, {
    title: typeof input.metadata.title === "string" ? input.metadata.title : undefined,
    assetResolver: (assetId) => input.assets[assetId]
  });
  await writeFile(outputPath, bytes);
}

async function writePdfExport(input: ExportInput, outputPath: string, template?: CorporateTemplateName): Promise<void> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.emulateMedia({ media: "print" });
    await page.setContent(
      exportHtml(input.document, {
        title: typeof input.metadata.title === "string" ? input.metadata.title : undefined,
        metadata: input.metadata,
        template
      }),
      { waitUntil: "load" }
    );
    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true
    });
  } finally {
    await browser.close();
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

async function runValidate(args: string[]): Promise<void> {
  const [inputPath] = args;
  if (!inputPath) {
    throw new Error("usage: sdoc validate <input.sdoc|document.json|unpacked-folder>");
  }

  const inputStat = await stat(inputPath);
  if (inputStat.isDirectory()) {
    const container = await readContainerFolder(inputPath);
    await packSdoc(container);
    process.stdout.write(`VALID ${inputPath}\n`);
    return;
  }

  const data = await readFile(inputPath);
  if (inputPath.toLowerCase().endsWith(".sdoc") || isLikelyZipContainer(data)) {
    await unpackSdoc(data);
    process.stdout.write(`VALID ${inputPath}\n`);
    return;
  }

  parseDocumentJson(stripBom(data.toString("utf8")), inputPath);
  process.stdout.write(`VALID ${inputPath}\n`);
}

async function loadDocument(filePath: string): Promise<SDocDocument> {
  return (await loadExportInput(filePath)).document;
}

interface ExportInput {
  document: SDocDocument;
  metadata: Record<string, unknown>;
  assets: Record<string, Uint8Array>;
}

async function loadExportInput(filePath: string): Promise<ExportInput> {
  const inputStat = await stat(filePath);
  if (inputStat.isDirectory()) {
    const container = await readContainerFolder(filePath);
    return { document: container.document, metadata: container.metadata, assets: container.assets ?? {} };
  }

  const data = await readFile(filePath);
  if (filePath.toLowerCase().endsWith(".sdoc") || isLikelyZipContainer(data)) {
    const container = await unpackSdoc(data);
    return { document: container.document, metadata: container.metadata, assets: container.assets ?? {} };
  }

  return { document: parseDocumentJson(stripBom(data.toString("utf8")), filePath), metadata: {}, assets: {} };
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

function getPositionals(args: string[], optionsWithValues: Set<string>): string[] {
  const positionals: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (optionsWithValues.has(value)) {
      index += 1;
      continue;
    }

    if (!value.startsWith("-")) {
      positionals.push(value);
    }
  }
  return positionals;
}

function parseCorporateTemplate(value: string | undefined): CorporateTemplateName | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "controlled") {
    return value;
  }

  throw new Error(`unsupported export template: ${value}`);
}

function printHelp(): void {
  process.stdout.write(`sdoc phase0 cli

Commands:
  sdoc diff <old.sdoc|old.document.json> <new.sdoc|new.document.json>
  sdoc export <input.sdoc|document.json> <markdown|html|pdf|chunks|outline|references> [output]
  sdoc export <input.sdoc> --format html|pdf --template controlled [-o output]
  sdoc pack <folder> <output.sdoc>
  sdoc unpack <input.sdoc> <folder>
  sdoc validate <input.sdoc|document.json|unpacked-folder>
`);
}

function renderExport(input: ExportInput, format: string, template?: CorporateTemplateName): string {
  const document = input.document;
  const normalizedFormat = format.toLowerCase();
  if (normalizedFormat === "markdown" || normalizedFormat === "plain" || normalizedFormat === "plain.md") {
    return exportMarkdown(document);
  }

  if (normalizedFormat === "html" || normalizedFormat === "html.html") {
    return exportHtml(document, {
      title: typeof input.metadata.title === "string" ? input.metadata.title : undefined,
      metadata: input.metadata,
      template
    });
  }

  const derived = exportDerivedOutputs(document);
  switch (normalizedFormat) {
    case "chunks":
    case "chunks.jsonl":
      return derived["chunks.jsonl"];
    case "outline":
    case "outline.json":
      return derived["outline.json"];
    case "references":
    case "references.json":
      return derived["references.json"];
    default:
      throw new Error(`unsupported export format: ${format}`);
  }
}

function assertValidDocument(document: unknown, source: string): SDocDocument {
  const validation = validateDocument(document);
  if (!validation.ok) {
    throw new Error(`invalid document in ${source}:\n${formatValidationIssues(validation.issues)}`);
  }

  return document as SDocDocument;
}

function parseDocumentJson(text: string, source: string): SDocDocument {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid JSON in ${source}: ${error instanceof Error ? error.message : String(error)}`);
  }

  return assertValidDocument(document, source);
}

function formatValidationIssues(issues: ValidationIssue[]): string {
  return issues.length > 0 ? issues.map((issue) => `- ${issue.path}: ${issue.message}`).join("\n") : "- schema validation failed";
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

main(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
