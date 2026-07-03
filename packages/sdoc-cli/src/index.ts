#!/usr/bin/env node

import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyDiffEventAction, diffDocuments, renderDiffEvents, type SDocDiffEvent, type SDocReviewAction } from "@sdoc/diff";
import {
  exportDerivedOutputs,
  exportDocx,
  exportHtml,
  exportMarkdown,
  exportPptx,
  validateWordTemplateMapping,
  validateWordTemplatePackage,
  type CorporateTemplateName,
  type WordTemplateMappingRequirement
} from "@sdoc/export";
import {
  applyDataGridRowMerge,
  createDataGridRowDiff,
  isLikelyZipContainer,
  normalizeDocument,
  packSdoc,
  stableStringify,
  unpackSdoc,
  type DataGridRowDiffEvent,
  type SDocContainer
} from "@sdoc/format";
import { validateDocument, type SDocDocument, type ValidationIssue } from "@sdoc/schema";

async function main(args: string[]): Promise<void> {
  const [command, ...rest] = args;

  switch (command) {
    case "data-grid":
      await runDataGrid(rest);
      break;
    case "diff":
      await runDiff(rest);
      break;
    case "export":
      await runExport(rest);
      break;
    case "pack":
      await runPack(rest);
      break;
    case "review":
      await runReview(rest);
      break;
    case "template":
      await runTemplate(rest);
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

async function runTemplate(args: string[]): Promise<void> {
  const [subcommand, templatePath, ...rest] = args;
  if (subcommand === "validate" && templatePath) {
    const result = await validateWordTemplatePackage(await readFile(templatePath), { fileName: path.basename(templatePath) });
    if (!result.ok) {
      throw new Error(`invalid Word template package ${templatePath}:\n${formatWordTemplateIssues(result.issues)}`);
    }

    process.stdout.write(`VALID_TEMPLATE ${templatePath} parts=${result.partCount}\n`);
    return;
  }

  if (subcommand === "validate-mapping" && templatePath) {
    const result = await validateWordTemplateMapping(await readFile(templatePath), {
      fileName: path.basename(templatePath),
      requiredStyles: parseTemplateStyleRequirements(getOptions(rest, "--style")),
      requiredPlaceholders: getOptions(rest, "--placeholder")
    });
    if (!result.ok) {
      throw new Error(`invalid Word template mapping ${templatePath}:\n${formatWordTemplateIssues(result.issues)}`);
    }

    process.stdout.write(
      `VALID_TEMPLATE_MAPPING ${templatePath} styles=${result.availableStyles.length} placeholders=${result.availablePlaceholders.length}\n`
    );
    return;
  }

  throw new Error(
    "usage: sdoc template <validate|validate-mapping> <template.docx|template.dotx> [--style nodeType=StyleId] [--placeholder tag]"
  );
}

async function runDataGrid(args: string[]): Promise<void> {
  const [subcommand, ...rest] = args;
  switch (subcommand) {
    case "diff":
      await runDataGridDiff(rest);
      break;
    case "apply":
      await runDataGridApply(rest);
      break;
    default:
      throw new Error("usage: sdoc data-grid <diff|apply> ...");
  }
}

async function runDataGridDiff(args: string[]): Promise<void> {
  const positionals = getPositionals(args, new Set(["--format", "--grid", "--asset", "--key"]));
  const [oldSourcePath, newSourcePath] = positionals;
  const format = parseDataGridFormat(getOption(args, "--format"));
  if (!oldSourcePath || !newSourcePath) {
    throw new Error("usage: sdoc data-grid diff <old.csv|json> <new.csv|json> --format <csv|json> [--grid id] [--asset assetId] [--key col[,col]]");
  }

  const diff = createDataGridRowDiff({
    gridId: getOption(args, "--grid") ?? "dataGrid",
    sourceAssetId: getOption(args, "--asset") ?? path.basename(newSourcePath),
    format,
    oldSource: await readText(oldSourcePath),
    newSource: await readText(newSourcePath),
    keyColumns: parseKeyColumns(getOption(args, "--key"))
  });

  process.stdout.write(renderDataGridRowDiff(diff.events));
}

async function runDataGridApply(args: string[]): Promise<void> {
  const positionals = getPositionals(args, new Set(["--format", "--grid", "--asset", "--key", "--event", "-o"]));
  const [baselineSourcePath, proposedSourcePath, currentSourcePath] = positionals;
  const format = parseDataGridFormat(getOption(args, "--format"));
  const eventIndex = parseEventIndex(getOption(args, "--event"));
  const output = getOption(args, "-o");
  if (!baselineSourcePath || !proposedSourcePath || !currentSourcePath || eventIndex === undefined) {
    throw new Error(
      "usage: sdoc data-grid apply <baseline.csv|json> <proposed.csv|json> <current.csv|json> --format <csv|json> --event <index> [--grid id] [--asset assetId] [--key col[,col]] [-o output]"
    );
  }

  const baselineSource = await readText(baselineSourcePath);
  const proposedSource = await readText(proposedSourcePath);
  const currentSource = await readText(currentSourcePath);
  const diff = createDataGridRowDiff({
    gridId: getOption(args, "--grid") ?? "dataGrid",
    sourceAssetId: getOption(args, "--asset") ?? path.basename(proposedSourcePath),
    format,
    oldSource: baselineSource,
    newSource: proposedSource,
    keyColumns: parseKeyColumns(getOption(args, "--key"))
  });
  const event = diff.events[eventIndex];
  if (!event) {
    throw new Error(`data-grid event not found: ${eventIndex}`);
  }

  const result = applyDataGridRowMerge({
    gridId: diff.gridId,
    sourceAssetId: diff.sourceAssetId,
    format,
    baselineSource,
    proposedSource,
    currentSource,
    event,
    keyColumns: diff.keyColumns
  });
  if (!result.ok) {
    throw new Error(result.message);
  }

  if (output) {
    await writeFile(output, result.source, "utf8");
  } else {
    process.stdout.write(result.source);
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

async function runReview(args: string[]): Promise<void> {
  const [actionValue, baselinePath, currentPath, ...rest] = args;
  const action = parseReviewAction(actionValue);
  const eventId = getOption(rest, "--event");
  const eventKind = getOption(rest, "--kind") as SDocDiffEvent["kind"] | undefined;
  const output = getOption(rest, "-o");
  if (!action || !baselinePath || !currentPath || !eventId) {
    throw new Error("usage: sdoc review <accept|reject> <baseline.sdoc|document.json> <current.sdoc|document.json> --event <id> [--kind added|deleted|modified|moved] [-o output.document.json]");
  }

  const baseline = await loadDocument(baselinePath);
  const current = await loadDocument(currentPath);
  const event = selectReviewEvent(diffDocuments(baseline, current), eventId, eventKind);
  const result = applyDiffEventAction(baseline, current, event, action);
  if (!result.ok) {
    throw new Error(result.message);
  }

  const text = stableStringify(result.document);
  if (output) {
    await writeFile(output, text, "utf8");
  } else {
    process.stdout.write(text);
  }
}

async function runExport(args: string[]): Promise<void> {
  const [inputPath, ...rest] = args;
  if (!inputPath) {
      throw new Error("usage: sdoc export <input.sdoc|document.json> --format <markdown|html|pdf|pptx|chunks|outline|references> [--template controlled] [--template-file file.dotx] [-o output]");
  }

  const positionals = getPositionals(rest, new Set(["--format", "-o", "--template", "--template-file", "--template-style", "--template-placeholder"]));
  const format = getOption(rest, "--format") ?? positionals[0] ?? "markdown";
  const output = getOption(rest, "-o") ?? positionals[1];
  const template = parseCorporateTemplate(getOption(rest, "--template"));
  const templateFile = getOption(rest, "--template-file");
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

  if (format.toLowerCase() === "docx") {
    if (!output) {
      throw new Error("usage: sdoc export <input.sdoc|document.json> --format docx [-o output.docx]");
    }

    await writeDocxExport(await loadExportInput(inputPath), output, {
      template,
      templateFile,
      requiredStyles: parseTemplateStyleRequirements(getOptions(rest, "--template-style")),
      requiredPlaceholders: parseTemplatePlaceholders(getOptions(rest, "--template-placeholder"), templateFile)
    });
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

interface DocxCliExportOptions {
  template?: CorporateTemplateName;
  templateFile?: string;
  requiredStyles?: WordTemplateMappingRequirement[];
  requiredPlaceholders?: string[];
}

async function writeDocxExport(input: ExportInput, outputPath: string, options: DocxCliExportOptions = {}): Promise<void> {
  const bytes = await exportDocx(input.document, {
    title: typeof input.metadata.title === "string" ? input.metadata.title : undefined,
    metadata: input.metadata,
    template: options.template,
    externalTemplate: options.templateFile
      ? {
          bytes: await readFile(options.templateFile),
          fileName: path.basename(options.templateFile),
          requiredStyles: options.requiredStyles,
          requiredPlaceholders: options.requiredPlaceholders
        }
      : undefined
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
        template,
        dataGridSourceResolver: (assetId) => decodeTextAsset(input.assets[assetId])
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

function getOptions(args: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === name && args[index + 1]) {
      values.push(args[index + 1]);
      index += 1;
    }
  }

  return values;
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

function parseDataGridFormat(value: string | undefined): "csv" | "json" {
  if (value === "csv" || value === "json") {
    return value;
  }

  throw new Error("data-grid --format must be csv or json");
}

function parseKeyColumns(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const columns = value
    .split(",")
    .map((column) => column.trim())
    .filter((column) => column.length > 0);
  return columns.length > 0 ? columns : undefined;
}

function parseEventIndex(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const index = Number(value);
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`invalid data-grid event index: ${value}`);
  }

  return index;
}

function parseReviewAction(value: string | undefined): SDocReviewAction | undefined {
  if (value === "accept" || value === "reject") {
    return value;
  }

  return undefined;
}

function selectReviewEvent(events: SDocDiffEvent[], eventId: string, eventKind?: SDocDiffEvent["kind"]): SDocDiffEvent {
  const candidates = events.filter((event) => event.id === eventId && (!eventKind || event.kind === eventKind));
  if (candidates.length === 1) {
    return candidates[0];
  }

  if (candidates.length === 0) {
    throw new Error(`review event not found: ${eventKind ? `${eventKind} ` : ""}${eventId}`);
  }

  throw new Error(`review event is ambiguous for ${eventId}; pass --kind to select one event`);
}

function decodeTextAsset(asset: Uint8Array | undefined): string | undefined {
  return asset ? new TextDecoder().decode(asset).replace(/^\uFEFF/, "") : undefined;
}

function printHelp(): void {
  process.stdout.write(`sdoc phase0 cli

Commands:
  sdoc data-grid diff <old.csv|json> <new.csv|json> --format csv|json [--key col[,col]]
  sdoc data-grid apply <baseline.csv|json> <proposed.csv|json> <current.csv|json> --format csv|json --event <index> [--key col[,col]] [-o output]
  sdoc diff <old.sdoc|old.document.json> <new.sdoc|new.document.json>
  sdoc export <input.sdoc|document.json> <markdown|html|pdf|chunks|outline|references> [output]
  sdoc export <input.sdoc> --format html|pdf|docx --template controlled [-o output]
  sdoc export <input.sdoc> --format docx --template-file company.dotx [--template-style nodeType=StyleId] [--template-placeholder tag] [-o output.docx]
  sdoc pack <folder> <output.sdoc>
  sdoc review <accept|reject> <baseline.sdoc|document.json> <current.sdoc|document.json> --event <id> [--kind added|deleted|modified|moved] [-o output.document.json]
  sdoc template validate <template.docx|template.dotx>
  sdoc template validate-mapping <template.docx|template.dotx> [--style nodeType=StyleId] [--placeholder tag]
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
      template,
      dataGridSourceResolver: (assetId) => decodeTextAsset(input.assets[assetId])
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

function renderDataGridRowDiff(events: DataGridRowDiffEvent[]): string {
  if (events.length === 0) {
    return "NO_CHANGES\n";
  }

  return `${events.map((event, index) => renderDataGridRowDiffEvent(event, index)).join("\n")}\n`;
}

function renderDataGridRowDiffEvent(event: DataGridRowDiffEvent, index: number): string {
  const parts = [
    String(index),
    event.kind.toUpperCase().replace(/-/g, "_"),
    event.rowKey ? `row=${event.rowKey}` : undefined,
    event.column ? `column=${event.column}` : undefined,
    event.oldValue !== undefined ? `old=${JSON.stringify(event.oldValue)}` : undefined,
    event.newValue !== undefined ? `new=${JSON.stringify(event.newValue)}` : undefined,
    event.severity !== "info" ? `severity=${event.severity}` : undefined
  ].filter((part): part is string => Boolean(part));

  return `${parts.join(" ")} ${event.message}`;
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

function formatWordTemplateIssues(issues: Array<{ path: string; message: string }>): string {
  return issues.length > 0 ? issues.map((issue) => `- ${issue.path}: ${issue.message}`).join("\n") : "- template package validation failed";
}

function parseTemplateStyleRequirements(values: string[]): WordTemplateMappingRequirement[] {
  return values.map((value) => {
    const separator = value.indexOf("=");
    if (separator <= 0 || separator === value.length - 1) {
      throw new Error(`invalid --style requirement "${value}"; expected nodeType=StyleId`);
    }

    return {
      nodeType: value.slice(0, separator).trim(),
      styleId: value.slice(separator + 1).trim()
    };
  });
}

function parseTemplatePlaceholders(values: string[], templateFile: string | undefined): string[] | undefined {
  if (values.length > 0) {
    return values;
  }

  return templateFile ? ["sdoc-body"] : undefined;
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

main(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
