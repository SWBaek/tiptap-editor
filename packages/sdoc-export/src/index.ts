import JSZip from "jszip";
import { getNodeAnchor, getNodeHumanId, getNodeId, getPlainText, isBlockNode, type SDocDocument, type SDocMark, type SDocNode } from "@sdoc/schema";

export interface HtmlExportOptions {
  title?: string;
  assetResolver?: (assetId: string) => string | undefined;
  dataGridSourceResolver?: (assetId: string) => string | undefined;
  dataGridPreviewRows?: number;
  template?: CorporateTemplateName;
  metadata?: CorporateTemplateMetadata;
  styleProfile?: PublishingStyleProfileName;
  customStyle?: HtmlCustomStyleOptions;
}

export type PublishingStyleProfileName = "modern" | "ieee" | "iso" | "korean";

export interface HtmlCustomStyleOptions {
  css?: string;
  logoDataUrl?: string;
  logoAlt?: string;
  headerText?: string;
  footerText?: string;
  typography?: {
    bodyFont?: string;
    headingFont?: string;
    baseFontSize?: string;
  };
}

export interface DataGridPreviewOptions {
  maxRows?: number;
  maxColumns?: number;
}

export interface DataGridPreview {
  columns: string[];
  rows: string[][];
  totalRows: number;
  truncatedRows: boolean;
  truncatedColumns: boolean;
}

export type CorporateTemplateName = "controlled";

export interface CorporateTemplateMetadata {
  title?: unknown;
  author?: unknown;
  version?: unknown;
  documentNumber?: unknown;
  classification?: unknown;
  approvalStatus?: unknown;
  effectiveDate?: unknown;
}

export interface PptxExportOptions {
  title?: string;
  assetResolver?: (assetId: string) => Uint8Array | undefined;
}

export interface DocxExportOptions {
  title?: string;
  template?: CorporateTemplateName;
  metadata?: CorporateTemplateMetadata;
  externalTemplate?: ExternalWordTemplateOptions;
}

export interface ExternalWordTemplateOptions extends WordTemplateMappingOptions {
  bytes: Uint8Array;
}

interface DocxRenderContext {
  styleMap: Map<string, string>;
}

export type WordTemplatePackageIssueCode =
  | "invalid-extension"
  | "invalid-zip"
  | "missing-required-part"
  | "macro-enabled-template"
  | "blocked-package-part"
  | "external-relationship"
  | "blocked-relationship";

export interface WordTemplatePackageIssue {
  code: WordTemplatePackageIssueCode;
  path: string;
  message: string;
}

export interface WordTemplatePackageValidation {
  ok: boolean;
  issues: WordTemplatePackageIssue[];
  partCount: number;
}

export type WordTemplateMappingIssueCode = "package-invalid" | "missing-style" | "missing-placeholder";

export interface WordTemplateMappingIssue {
  code: WordTemplateMappingIssueCode;
  path: string;
  message: string;
}

export interface WordTemplateMappingRequirement {
  nodeType: string;
  styleId: string;
}

export interface WordTemplateMappingOptions {
  fileName?: string;
  requiredStyles?: WordTemplateMappingRequirement[];
  requiredPlaceholders?: string[];
}

export interface WordTemplateMappingValidation {
  ok: boolean;
  issues: WordTemplateMappingIssue[];
  availableStyles: string[];
  availablePlaceholders: string[];
  packageValidation: WordTemplatePackageValidation;
}

export interface DerivedOutputs extends Record<string, string> {
  "plain.md": string;
  "outline.json": string;
  "references.json": string;
  "chunks.jsonl": string;
}

interface ReferenceTarget {
  id: string;
  type: string;
  anchor?: string;
  humanId?: string;
  label: string;
}

export interface PptxSlideModel {
  title: string;
  sectionTitle?: string;
  sourceIds: string[];
  blocks: SDocNode[];
}

interface PptxConstructor {
  new (): PptxPresentation;
}

interface PptxPresentation {
  layout: string;
  author: string;
  company: string;
  subject: string;
  title: string;
  theme: Record<string, string>;
  addSection(props: { title: string }): void;
  addSlide(props?: { sectionTitle?: string }): PptxSlide;
  write(props?: { outputType?: "uint8array"; compression?: boolean }): Promise<string | ArrayBuffer | Blob | Uint8Array>;
}

interface PptxSlide {
  background: { color: string };
  addText(text: string, options?: Record<string, unknown>): PptxSlide;
  addShape(shapeName: string, options?: Record<string, unknown>): PptxSlide;
  addTable(tableRows: Array<Array<Record<string, unknown>>>, options?: Record<string, unknown>): PptxSlide;
  addImage(options: Record<string, unknown>): PptxSlide;
  addNotes(notes: string): PptxSlide;
}

export function exportMarkdown(document: SDocDocument): string {
  const references = collectReferenceTargets(document);
  const blocks = document.content.map((node) => renderBlock(node, references)).filter(Boolean);
  return `${blocks.join("\n\n")}\n`;
}

export function exportHtml(document: SDocDocument, options: HtmlExportOptions = {}): string {
  const references = collectReferenceTargets(document);
  const title = options.title?.trim() || getDocumentTitle(document) || "SDoc Document";
  const blocks = document.content.map((node) => renderHtmlBlock(node, references, options)).filter(Boolean);
  const corporateTemplate = normalizeCorporateTemplate(options.template);
  const styleProfile = normalizePublishingStyleProfile(options.styleProfile);
  const bodyClasses = [
    `sdoc-profile-${styleProfile}`,
    corporateTemplate ? "sdoc-corporate-template sdoc-corporate-template-controlled" : ""
  ].filter(Boolean);
  const bodyClass = ` class="${bodyClasses.join(" ")}"`;
  const corporateHeader = corporateTemplate
    ? `${renderCorporateHeader(document, title, options.metadata)}
  <div class="sdoc-corporate-watermark">${escapeHtml(getCorporateMetadataValue(options.metadata, "classification", "CONTROLLED"))}</div>
`
    : "";
  const profileChrome = renderHtmlProfileChrome(options.customStyle);
  const corporateFooter = corporateTemplate ? `\n${renderCorporateFooter(document, options.metadata)}` : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
${PUBLISH_HTML_CSS}
${PUBLISH_HTML_PROFILE_CSS[styleProfile]}
${renderCustomStyleCss(options.customStyle)}
  </style>
</head>
<body${bodyClass}>
${corporateHeader}${profileChrome.header}  <main class="sdoc-document">
${blocks.map((block) => indentHtml(block, 4)).join("\n\n")}
  </main>
${profileChrome.footer}${corporateFooter}
</body>
</html>
`;
}

export function exportDerivedOutputs(document: SDocDocument): DerivedOutputs {
  return {
    "plain.md": exportMarkdown(document),
    "outline.json": `${JSON.stringify(exportOutline(document), null, 2)}\n`,
    "references.json": `${JSON.stringify([...collectReferenceTargets(document).values()], null, 2)}\n`,
    "chunks.jsonl": exportChunks(document)
  };
}

function normalizeCorporateTemplate(template: HtmlExportOptions["template"]): CorporateTemplateName | undefined {
  return template === "controlled" ? template : undefined;
}

export function normalizePublishingStyleProfile(profile: unknown): PublishingStyleProfileName {
  return profile === "ieee" || profile === "iso" || profile === "korean" || profile === "modern" ? profile : "modern";
}

function renderHtmlProfileChrome(style: HtmlCustomStyleOptions | undefined): { header: string; footer: string } {
  if (!style?.logoDataUrl && !style?.headerText && !style?.footerText) {
    return { header: "", footer: "" };
  }

  const logo = style.logoDataUrl
    ? `<img src="${escapeHtmlAttribute(style.logoDataUrl)}" alt="${escapeHtmlAttribute(style.logoAlt ?? "Document logo")}">`
    : "";
  const headerText = style.headerText ? `<strong>${escapeHtml(style.headerText)}</strong>` : "";
  const header = logo || headerText ? `  <header class="sdoc-profile-header">${logo}${headerText}</header>\n` : "";
  const footer = style.footerText ? `\n  <footer class="sdoc-profile-footer">${escapeHtml(style.footerText)}</footer>` : "";
  return { header, footer };
}

function renderCustomStyleCss(style: HtmlCustomStyleOptions | undefined): string {
  const rules: string[] = [];
  const typographyRules: string[] = [];
  if (style?.typography?.bodyFont) {
    typographyRules.push(`--sdoc-body-font: ${style.typography.bodyFont};`);
  }
  if (style?.typography?.headingFont) {
    typographyRules.push(`--sdoc-heading-font: ${style.typography.headingFont};`);
  }
  if (style?.typography?.baseFontSize) {
    typographyRules.push(`--sdoc-base-font-size: ${style.typography.baseFontSize};`);
  }
  if (typographyRules.length > 0) {
    rules.push(`    :root {\n      ${typographyRules.join("\n      ")}\n    }`);
  }
  if (style?.css?.trim()) {
    rules.push(`    /* Custom local export CSS */\n${style.css}`);
  }
  return rules.length > 0 ? `\n${rules.join("\n\n")}` : "";
}

function renderCorporateHeader(document: SDocDocument, title: string, metadata: CorporateTemplateMetadata | undefined): string {
  const documentNumber = getCorporateMetadataValue(metadata, "documentNumber", document.attrs.id);
  const version = getCorporateMetadataValue(metadata, "version", "Draft");
  const owner = getCorporateMetadataValue(metadata, "author", "Unassigned");
  const classification = getCorporateMetadataValue(metadata, "classification", "CONTROLLED");
  const approvalStatus = getCorporateMetadataValue(metadata, "approvalStatus", "Review required");
  const effectiveDate = getCorporateMetadataValue(metadata, "effectiveDate", "Not assigned");

  return `  <header class="sdoc-corporate-header" aria-label="Corporate document control">
    <div>
      <span class="sdoc-corporate-kicker">${escapeHtml(classification)}</span>
      <strong>${escapeHtml(title)}</strong>
    </div>
    <table class="sdoc-document-control">
      <tbody>
        <tr><th>Document No.</th><td>${escapeHtml(documentNumber)}</td><th>Revision</th><td>${escapeHtml(version)}</td></tr>
        <tr><th>Owner</th><td>${escapeHtml(owner)}</td><th>Status</th><td>${escapeHtml(approvalStatus)}</td></tr>
        <tr><th>Effective Date</th><td>${escapeHtml(effectiveDate)}</td><th>Source</th><td>${escapeHtml(document.attrs.id)}</td></tr>
      </tbody>
    </table>
  </header>`;
}

function renderCorporateFooter(document: SDocDocument, metadata: CorporateTemplateMetadata | undefined): string {
  const documentNumber = getCorporateMetadataValue(metadata, "documentNumber", document.attrs.id);
  const classification = getCorporateMetadataValue(metadata, "classification", "CONTROLLED");
  return `  <footer class="sdoc-corporate-footer" aria-label="Corporate footer">
    <span>${escapeHtml(documentNumber)}</span>
    <span>${escapeHtml(classification)}</span>
    <span>Page <span class="sdoc-page-number"></span></span>
  </footer>`;
}

function getCorporateMetadataValue(
  metadata: CorporateTemplateMetadata | undefined,
  key: keyof CorporateTemplateMetadata,
  fallback: string
): string {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

export async function exportPptx(document: SDocDocument, options: PptxExportOptions = {}): Promise<Uint8Array> {
  const pptx = await createPptxPresentation();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "SDoc";
  pptx.subject = "Generated from canonical SDoc document.json";
  pptx.title = options.title?.trim() || getDocumentTitle(document) || "SDoc Deck";
  pptx.company = "SDoc";
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
    lang: "en-US"
  };

  const slides = createPptxSlideModel(document);
  const sectionTitles = [...new Set(slides.flatMap((slide) => (slide.sectionTitle ? [slide.sectionTitle] : [])))];
  sectionTitles.forEach((title) => pptx.addSection({ title }));
  for (const model of slides) {
    renderPptxSlide(pptx, model, options);
  }

  const bytes = await pptx.write({ outputType: "uint8array", compression: true });
  if (bytes instanceof Uint8Array) {
    return bytes;
  }
  if (bytes instanceof ArrayBuffer) {
    return new Uint8Array(bytes);
  }
  if (typeof bytes === "string") {
    return new TextEncoder().encode(bytes);
  }

  return new Uint8Array(await bytes.arrayBuffer());
}

export async function exportDocx(document: SDocDocument, options: DocxExportOptions = {}): Promise<Uint8Array> {
  const externalTemplate = options.externalTemplate ? await prepareExternalWordTemplate(options.externalTemplate) : undefined;
  const renderContext: DocxRenderContext = { styleMap: createWordTemplateStyleMap(options.externalTemplate?.requiredStyles) };
  const title = options.title?.trim() || getDocumentTitle(document) || "SDoc Document";
  const body = [
    ...renderDocxCorporateTemplate(document, title, options, renderContext),
    ...document.content.flatMap((node) => renderDocxBlock(node, renderContext))
  ].join("");

  if (externalTemplate) {
    return exportDocxWithExternalTemplate(document, body, title, options.metadata, externalTemplate);
  }

  const zip = new JSZip();
  zip.file("[Content_Types].xml", DOCX_CONTENT_TYPES);
  zip.folder("_rels")?.file(".rels", DOCX_ROOT_RELS);
  zip.folder("docProps")?.file("core.xml", renderDocxCoreProperties(title, options.metadata));
  zip.folder("word")?.file("document.xml", renderDocxDocument(`${body}${DOCX_SECTION_PROPERTIES}`));
  zip.folder("word")?.file("styles.xml", DOCX_STYLES);
  zip.folder("word/_rels")?.file("document.xml.rels", DOCX_DOCUMENT_RELS);

  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

async function prepareExternalWordTemplate(options: ExternalWordTemplateOptions): Promise<{ fileName?: string; zip: JSZip }> {
  const validation = await validateWordTemplateMapping(options.bytes, {
    fileName: options.fileName,
    requiredStyles: options.requiredStyles,
    requiredPlaceholders: options.requiredPlaceholders
  });
  if (!validation.ok) {
    throw new Error(`invalid external Word template:\n${formatWordTemplateMappingIssues(validation.issues)}`);
  }

  return {
    fileName: options.fileName?.trim() || undefined,
    zip: await JSZip.loadAsync(options.bytes)
  };
}

async function exportDocxWithExternalTemplate(
  document: SDocDocument,
  body: string,
  title: string,
  metadata: CorporateTemplateMetadata | undefined,
  template: { fileName?: string; zip: JSZip }
): Promise<Uint8Array> {
  const templateDocumentXml = await template.zip.file("word/document.xml")?.async("string");
  if (!templateDocumentXml) {
    throw new Error("invalid external Word template: missing word/document.xml");
  }

  let injectedDocumentXml = injectRequiredWordContentControlBody(templateDocumentXml, "sdoc-body", body);
  injectedDocumentXml = injectOptionalWordContentControlBody(
    injectedDocumentXml,
    "sdoc-approval-table",
    renderDocxApprovalTable(document, metadata)
  );
  injectedDocumentXml = injectOptionalWordContentControlBody(
    injectedDocumentXml,
    "sdoc-revision-history",
    renderDocxRevisionHistory(document, metadata)
  );
  template.zip.file("word/document.xml", injectedDocumentXml);
  template.zip.folder("docProps")?.file("core.xml", renderDocxCoreProperties(title, metadata, template.fileName));

  const contentTypesXml = await template.zip.file("[Content_Types].xml")?.async("string");
  if (contentTypesXml) {
    template.zip.file("[Content_Types].xml", ensureDocxCorePropertiesContentType(contentTypesXml));
  }

  const rootRelsXml = await template.zip.file("_rels/.rels")?.async("string");
  if (rootRelsXml) {
    template.zip.folder("_rels")?.file(".rels", ensureDocxCorePropertiesRelationship(rootRelsXml));
  }

  return template.zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

export async function validateWordTemplatePackage(
  bytes: Uint8Array,
  options: { fileName?: string } = {}
): Promise<WordTemplatePackageValidation> {
  const issues: WordTemplatePackageIssue[] = [];
  const fileName = options.fileName?.trim() || undefined;
  const extension = fileName?.split(".").pop()?.toLowerCase();
  if (extension && extension !== "docx" && extension !== "dotx") {
    issues.push({
      code: "invalid-extension",
      path: fileName ?? "<input>",
      message: "Word template input must be a .docx or .dotx package."
    });
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch (error) {
    return {
      ok: false,
      issues: [
        ...issues,
        {
          code: "invalid-zip",
          path: fileName ?? "<input>",
          message: `Template package is not a readable ZIP archive: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      partCount: 0
    };
  }

  const partNames = Object.keys(zip.files).filter((name) => !zip.files[name].dir).sort();
  for (const requiredPart of ["[Content_Types].xml", "_rels/.rels", "word/document.xml"]) {
    if (!zip.file(requiredPart)) {
      issues.push({
        code: "missing-required-part",
        path: requiredPart,
        message: `Template package is missing required OOXML part: ${requiredPart}`
      });
    }
  }

  for (const partName of partNames) {
    const normalizedPartName = partName.replace(/\\/g, "/");
    const lowerPartName = normalizedPartName.toLowerCase();
    const blockedReason = getBlockedWordTemplatePartReason(lowerPartName);
    if (blockedReason) {
      issues.push({
        code: blockedReason === "macro" ? "macro-enabled-template" : "blocked-package-part",
        path: normalizedPartName,
        message:
          blockedReason === "macro"
            ? "Macro-enabled Office package parts are not allowed for headless template export."
            : "This Office package part is outside the allowed template validation subset."
      });
    }

    if (lowerPartName.endsWith(".rels")) {
      const relsText = await zip.file(partName)?.async("string");
      issues.push(...validateWordTemplateRelationships(relsText ?? "", normalizedPartName));
    }
  }

  const contentTypes = await zip.file("[Content_Types].xml")?.async("string");
  if (contentTypes && hasBlockedWordContentType(contentTypes)) {
    issues.push({
      code: "macro-enabled-template",
      path: "[Content_Types].xml",
      message: "Macro-enabled Word content types are not allowed for headless template export."
    });
  }

  return {
    ok: issues.length === 0,
    issues,
    partCount: partNames.length
  };
}

export async function validateWordTemplateMapping(
  bytes: Uint8Array,
  options: WordTemplateMappingOptions = {}
): Promise<WordTemplateMappingValidation> {
  const packageValidation = await validateWordTemplatePackage(bytes, { fileName: options.fileName });
  const issues: WordTemplateMappingIssue[] = packageValidation.ok
    ? []
    : packageValidation.issues.map((issue) => ({
        code: "package-invalid",
        path: issue.path,
        message: issue.message
      }));

  if (!packageValidation.ok) {
    return {
      ok: false,
      issues,
      availableStyles: [],
      availablePlaceholders: [],
      packageValidation
    };
  }

  const zip = await JSZip.loadAsync(bytes);
  const availableStyles = extractWordStyleIds((await zip.file("word/styles.xml")?.async("string")) ?? "");
  const availablePlaceholders = extractWordContentControlTags(
    (
      await Promise.all(
        Object.keys(zip.files)
          .filter((name) => !zip.files[name].dir && /^word\/(?:document|header\d+|footer\d+)\.xml$/i.test(name))
          .sort()
          .map((name) => zip.file(name)?.async("string") ?? "")
      )
    ).join("\n")
  );

  const styleSet = new Set(availableStyles);
  for (const requirement of options.requiredStyles ?? []) {
    if (!styleSet.has(requirement.styleId)) {
      issues.push({
        code: "missing-style",
        path: "word/styles.xml",
        message: `Template is missing required style "${requirement.styleId}" for SDoc node type "${requirement.nodeType}".`
      });
    }
  }

  const placeholderSet = new Set(availablePlaceholders);
  for (const placeholder of options.requiredPlaceholders ?? []) {
    if (!placeholderSet.has(placeholder)) {
      issues.push({
        code: "missing-placeholder",
        path: "word/document.xml",
        message: `Template is missing required content-control placeholder "${placeholder}".`
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    availableStyles,
    availablePlaceholders,
    packageValidation
  };
}

function renderDocxCorporateTemplate(document: SDocDocument, title: string, options: DocxExportOptions, context: DocxRenderContext): string[] {
  if (normalizeCorporateTemplate(options.template) !== "controlled") {
    return [];
  }

  const metadata = options.metadata;
  const rows = [
    ["Document No.", getCorporateMetadataValue(metadata, "documentNumber", document.attrs.id), "Revision", getCorporateMetadataValue(metadata, "version", "Draft")],
    ["Owner", getCorporateMetadataValue(metadata, "author", "Unassigned"), "Status", getCorporateMetadataValue(metadata, "approvalStatus", "Review required")],
    ["Effective Date", getCorporateMetadataValue(metadata, "effectiveDate", "Not assigned"), "Classification", getCorporateMetadataValue(metadata, "classification", "CONTROLLED")]
  ];

  return [
    renderDocxParagraph(getCorporateMetadataValue(metadata, "classification", "CONTROLLED"), getMappedDocxStyle(context, "subtitle", "Subtitle")),
    renderDocxParagraph(title, getMappedDocxStyle(context, "title", "Title")),
    renderDocxTable(rows, true)
  ];
}

function renderDocxApprovalTable(document: SDocDocument, metadata: CorporateTemplateMetadata | undefined): string {
  return renderDocxTable(
    [
      ["Document No.", getCorporateMetadataValue(metadata, "documentNumber", document.attrs.id), "Revision", getCorporateMetadataValue(metadata, "version", "Draft")],
      ["Owner", getCorporateMetadataValue(metadata, "author", "Unassigned"), "Status", getCorporateMetadataValue(metadata, "approvalStatus", "Review required")],
      ["Effective Date", getCorporateMetadataValue(metadata, "effectiveDate", "Not assigned"), "Classification", getCorporateMetadataValue(metadata, "classification", "CONTROLLED")]
    ],
    true
  );
}

function renderDocxRevisionHistory(document: SDocDocument, metadata: CorporateTemplateMetadata | undefined): string {
  return renderDocxTable(
    [
      ["Version", "Date", "Author", "Status"],
      [
        getCorporateMetadataValue(metadata, "version", "Draft"),
        getCorporateMetadataValue(metadata, "effectiveDate", "Not assigned"),
        getCorporateMetadataValue(metadata, "author", "Unassigned"),
        getCorporateMetadataValue(metadata, "approvalStatus", `Generated from ${document.attrs.id}`)
      ]
    ],
    false
  );
}

function renderDocxBlock(node: SDocNode, context: DocxRenderContext): string[] {
  switch (node.type) {
    case "heading": {
      const level = typeof node.attrs?.level === "number" ? Math.min(Math.max(node.attrs.level, 1), 6) : 1;
      return [renderDocxParagraph(getPlainText(node), getMappedDocxStyle(context, `heading${level}`, getMappedDocxStyle(context, "heading", `Heading${level}`)))];
    }
    case "paragraph":
      return [renderDocxParagraph(getPlainText(node), getMappedDocxStyle(context, "paragraph"))];
    case "blockquote":
      return [renderDocxParagraph(getPlainText(node), getMappedDocxStyle(context, "blockquote", "Quote"))];
    case "callout":
      return [renderDocxParagraph(`[${String(node.attrs?.kind ?? "note").toUpperCase()}] ${getPlainText(node)}`, getMappedDocxStyle(context, "callout"))];
    case "codeBlock":
      return [renderDocxParagraph(getPlainText(node), getMappedDocxStyle(context, "codeBlock", "Code"))];
    case "bulletList":
    case "orderedList":
      return (node.content ?? []).map((child, index) => {
        const prefix = node.type === "orderedList" ? `${index + 1}. ` : "- ";
        return renderDocxParagraph(`${prefix}${getPlainText(child)}`, getMappedDocxStyle(context, node.type));
      });
    case "taskList":
      return (node.content ?? []).map((child) => {
        const prefix = child.attrs?.checked === true ? "[x] " : "[ ] ";
        return renderDocxParagraph(`${prefix}${getPlainText(child)}`, getMappedDocxStyle(context, "taskList"));
      });
    case "table":
      return [...renderDocxTableCaption(node, context), renderDocxTable(extractTableRows(node), false)];
    case "figure":
      return [renderDocxParagraph(`Figure: ${getPlainText(node).trim() || String(node.attrs?.assetId ?? "")}`, getMappedDocxStyle(context, "figure"))];
    case "diagram":
      return [renderDocxParagraph(formatDiagramDocxText(node), getMappedDocxStyle(context, "diagram"))];
    case "equationBlock":
      return [renderDocxParagraph(`Equation: ${typeof node.attrs?.latex === "string" ? node.attrs.latex : ""}`, getMappedDocxStyle(context, "equationBlock"))];
    case "dataGrid":
      return [renderDocxParagraph(formatDataGridLabel(node), getMappedDocxStyle(context, "dataGrid"))];
    default: {
      const text = getPlainText(node).trim();
      return text ? [renderDocxParagraph(text, getMappedDocxStyle(context, node.type))] : [];
    }
  }
}

function createWordTemplateStyleMap(requirements: WordTemplateMappingRequirement[] | undefined): Map<string, string> {
  const styleMap = new Map<string, string>();
  for (const requirement of requirements ?? []) {
    const nodeType = requirement.nodeType.trim();
    const styleId = requirement.styleId.trim();
    if (nodeType && styleId) {
      styleMap.set(nodeType, styleId);
    }
  }

  return styleMap;
}

function getMappedDocxStyle(context: DocxRenderContext, nodeType: string, fallback?: string): string | undefined {
  return context.styleMap.get(nodeType) ?? fallback;
}

function extractTableRows(node: SDocNode): string[][] {
  return (node.content ?? [])
    .filter((row) => row.type === "tableRow")
    .map((row) =>
      (row.content ?? [])
        .filter((cell) => cell.type === "tableCell" || cell.type === "tableHeader")
        .map((cell) => getPlainText(cell).trim())
    )
    .filter((row) => row.length > 0);
}

function renderDocxTableCaption(node: SDocNode, context: DocxRenderContext): string[] {
  const caption = getTableCaption(node);
  return caption ? [renderDocxParagraph(`Table: ${caption}`, getMappedDocxStyle(context, "tableCaption", "Caption"))] : [];
}

function renderDocxDocument(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>${body}</w:body>
</w:document>`;
}

function injectRequiredWordContentControlBody(documentXml: string, placeholder: string, body: string): string {
  const result = injectWordContentControlBody(documentXml, placeholder, body);
  if (!result.found) {
    throw new Error(`invalid external Word template: content-control placeholder "${placeholder}" was not found`);
  }

  return result.xml;
}

function injectOptionalWordContentControlBody(documentXml: string, placeholder: string, body: string): string {
  return injectWordContentControlBody(documentXml, placeholder, body).xml;
}

function injectWordContentControlBody(documentXml: string, placeholder: string, body: string): { xml: string; found: boolean } {
  const sdtPattern = /<w:sdt\b[\s\S]*?<\/w:sdt>/g;
  let found = false;
  const injected = documentXml.replace(sdtPattern, (sdtXml) => {
    if (found || !wordContentControlHasTag(sdtXml, placeholder)) {
      return sdtXml;
    }

    found = true;
    return sdtXml.replace(/<w:sdtContent\b[^>]*>[\s\S]*?<\/w:sdtContent>/, `<w:sdtContent>${body}</w:sdtContent>`);
  });

  return { xml: injected, found };
}

function wordContentControlHasTag(sdtXml: string, placeholder: string): boolean {
  const escaped = escapeRegExp(placeholder);
  return new RegExp(`<w:(?:tag|alias)\\b[^>]*\\bw:val="${escaped}"`, "i").test(sdtXml);
}

function ensureDocxCorePropertiesContentType(contentTypesXml: string): string {
  if (contentTypesXml.includes('PartName="/docProps/core.xml"')) {
    return contentTypesXml;
  }

  return contentTypesXml.replace(
    "</Types>",
    '  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>\n</Types>'
  );
}

function ensureDocxCorePropertiesRelationship(rootRelsXml: string): string {
  if (rootRelsXml.includes("metadata/core-properties") || rootRelsXml.includes('Target="docProps/core.xml"')) {
    return rootRelsXml;
  }

  const existingIds = [...rootRelsXml.matchAll(/\bId="rId(\d+)"/g)].map((match) => Number(match[1])).filter(Number.isFinite);
  const nextId = `rId${Math.max(0, ...existingIds) + 1}`;
  return rootRelsXml.replace(
    "</Relationships>",
    `  <Relationship Id="${nextId}" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>\n</Relationships>`
  );
}

function renderDocxCoreProperties(title: string, metadata: CorporateTemplateMetadata | undefined, externalTemplateFileName?: string): string {
  const creator = getCorporateMetadataValue(metadata, "author", "SDoc");
  const description = externalTemplateFileName
    ? `<dc:description>External Word template validated: ${escapeXml(externalTemplateFileName)}</dc:description>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(title)}</dc:title>
  <dc:creator>${escapeXml(creator)}</dc:creator>
  ${description}
  <cp:lastModifiedBy>SDoc</cp:lastModifiedBy>
</cp:coreProperties>`;
}

function renderDocxParagraph(text: string, style?: string): string {
  const styleXml = style ? `<w:pPr><w:pStyle w:val="${escapeXmlAttribute(style)}"/></w:pPr>` : "";
  const runs = text.split("\n").map((line, index) => `${index > 0 ? "<w:br/>" : ""}<w:t xml:space="preserve">${escapeXml(line)}</w:t>`).join("");
  return `<w:p>${styleXml}<w:r>${runs}</w:r></w:p>`;
}

function renderDocxTable(rows: string[][], firstColumnBold: boolean): string {
  if (rows.length === 0) {
    return "";
  }

  const rowXml = rows
    .map((row) => `<w:tr>${row.map((cell, index) => renderDocxTableCell(cell, firstColumnBold && index % 2 === 0)).join("")}</w:tr>`)
    .join("");
  return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/></w:tblPr>${rowXml}</w:tbl>`;
}

function renderDocxTableCell(text: string, bold: boolean): string {
  const boldStart = bold ? "<w:b/>" : "";
  return `<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr>${boldStart}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p></w:tc>`;
}

function formatDiagramDocxText(node: SDocNode): string {
  if (node.attrs?.kind === "drawio") {
    return `Draw.io source: ${typeof node.attrs.sourceAssetId === "string" ? node.attrs.sourceAssetId : ""}`;
  }

  return `${String(node.attrs?.kind ?? "diagram")} diagram source: ${typeof node.attrs?.source === "string" ? node.attrs.source : ""}`;
}

function getBlockedWordTemplatePartReason(lowerPartName: string): "macro" | "blocked" | undefined {
  if (
    lowerPartName.endsWith("vbaproject.bin") ||
    lowerPartName === "word/vbadata.xml" ||
    lowerPartName.includes("/vba") ||
    lowerPartName.includes("macrosheets/")
  ) {
    return "macro";
  }

  if (
    lowerPartName.startsWith("word/activex/") ||
    lowerPartName.startsWith("word/embeddings/") ||
    lowerPartName.startsWith("word/oleobjects/") ||
    lowerPartName.startsWith("customxml/") ||
    lowerPartName.endsWith(".bin")
  ) {
    return "blocked";
  }

  return undefined;
}

function validateWordTemplateRelationships(relationshipsXml: string, path: string): WordTemplatePackageIssue[] {
  const issues: WordTemplatePackageIssue[] = [];
  const relationshipPattern = /<Relationship\b[^>]*>/gi;
  const matches = relationshipsXml.match(relationshipPattern) ?? [];

  for (const relationship of matches) {
    const target = getXmlAttribute(relationship, "Target");
    const targetMode = getXmlAttribute(relationship, "TargetMode");
    const type = getXmlAttribute(relationship, "Type") ?? "";
    if (targetMode?.toLowerCase() === "external" || isRemoteRelationshipTarget(target)) {
      issues.push({
        code: "external-relationship",
        path,
        message: `External relationship targets are not allowed in Word templates: ${target ?? "<missing target>"}`
      });
    }

    if (isBlockedRelationshipType(type)) {
      issues.push({
        code: "blocked-relationship",
        path,
        message: `Blocked Office relationship type is not allowed in Word templates: ${type}`
      });
    }
  }

  return issues;
}

function getXmlAttribute(tag: string, name: string): string | undefined {
  const pattern = new RegExp(`\\b${name}="([^"]*)"`, "i");
  return tag.match(pattern)?.[1];
}

function isRemoteRelationshipTarget(target: string | undefined): boolean {
  return Boolean(target && /^(https?:|file:|ftp:|\\\\)/i.test(target.trim()));
}

function isBlockedRelationshipType(type: string): boolean {
  return /\/(vbaProject|oleObject|activeXControl|attachedTemplate|package)$/i.test(type);
}

function hasBlockedWordContentType(contentTypesXml: string): boolean {
  return /macroEnabled|vbaProject|ms-office\.activeX|oleObject/i.test(contentTypesXml);
}

function extractWordStyleIds(stylesXml: string): string[] {
  const styleIds = new Set<string>();
  const stylePattern = /<w:style\b[^>]*\bw:styleId="([^"]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = stylePattern.exec(stylesXml))) {
    styleIds.add(match[1]);
  }

  return [...styleIds].sort();
}

function extractWordContentControlTags(documentXml: string): string[] {
  const tags = new Set<string>();
  const tagPattern = /<w:(?:tag|alias)\b[^>]*\bw:val="([^"]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(documentXml))) {
    tags.add(match[1]);
  }

  return [...tags].sort();
}

function formatWordTemplateMappingIssues(issues: WordTemplateMappingIssue[]): string {
  return issues.length > 0 ? issues.map((issue) => `- ${issue.path}: ${issue.message}`).join("\n") : "- template mapping validation failed";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeXmlAttribute(value: string): string {
  return escapeXml(value).replaceAll('"', "&quot;");
}

async function createPptxPresentation(): Promise<PptxPresentation> {
  const module = await import("pptxgenjs");
  const PptxGenJS = module.default as unknown as PptxConstructor;
  return new PptxGenJS();
}

export function createPptxSlideModel(document: SDocDocument): PptxSlideModel[] {
  const slides: PptxSlideModel[] = [];
  let currentSection: string | undefined;
  let currentSlide: PptxSlideModel | null = null;

  function ensureSlide(title = "Overview"): PptxSlideModel {
    if (!currentSlide) {
      currentSlide = { title, sectionTitle: currentSection, sourceIds: [], blocks: [] };
      slides.push(currentSlide);
    }
    return currentSlide;
  }

  for (const node of document.content) {
    if (node.type === "heading") {
      const level = typeof node.attrs?.level === "number" ? node.attrs.level : 1;
      const title = getPlainText(node).trim() || getNodeId(node) || "Untitled";
      if (level === 1) {
        currentSection = title;
        currentSlide = { title, sectionTitle: currentSection, sourceIds: collectNodeIds(node), blocks: [] };
        slides.push(currentSlide);
        continue;
      }

      if (level === 2) {
        currentSlide = { title, sectionTitle: currentSection, sourceIds: collectNodeIds(node), blocks: [] };
        slides.push(currentSlide);
        continue;
      }
    }

    const slide = ensureSlide();
    slide.blocks.push(node);
    slide.sourceIds.push(...collectNodeIds(node));
  }

  if (slides.length === 0) {
    slides.push({ title: getDocumentTitle(document) || "Untitled", sourceIds: [], blocks: [] });
  }

  return slides;
}

export function exportOutline(document: SDocDocument): Array<{ id: string; level: number; title: string; anchor?: string }> {
  const outline: Array<{ id: string; level: number; title: string; anchor?: string }> = [];
  visitBlocks(document, (node) => {
    if (node.type !== "heading") {
      return;
    }

    const id = getNodeId(node);
    const level = node.attrs?.level;
    if (!id || typeof level !== "number") {
      return;
    }

    outline.push({
      id,
      level,
      title: getPlainText(node).trim(),
      anchor: getNodeAnchor(node)
    });
  });

  return outline;
}

export function exportChunks(document: SDocDocument): string {
  const chunks: Array<Record<string, string>> = [];
  let currentHeading = "";

  visitBlocks(document, (node) => {
    if (node.type === "heading") {
      currentHeading = getPlainText(node).trim();
      return;
    }

    const text = getPlainText(node).trim();
    const id = getNodeId(node);
    if (!id || text.length === 0) {
      return;
    }

    const humanId = getNodeHumanId(node);
    chunks.push({
      id,
      type: node.type,
      heading: currentHeading,
      ...(humanId ? { humanId } : {}),
      text
    });
  });

  return chunks.map((chunk) => JSON.stringify(chunk)).join("\n") + (chunks.length > 0 ? "\n" : "");
}

function renderPptxSlide(pptx: PptxPresentation, model: PptxSlideModel, options: PptxExportOptions): void {
  const slide = pptx.addSlide(model.sectionTitle ? { sectionTitle: model.sectionTitle } : undefined);
  slide.background = { color: "FFFFFF" };

  slide.addText(model.title, {
    x: 0.55,
    y: 0.35,
    w: 12.2,
    h: 0.42,
    margin: 0,
    fontFace: "Aptos Display",
    fontSize: 24,
    bold: true,
    color: "17212B",
    breakLine: false,
    fit: "shrink"
  });

  if (model.sectionTitle && model.sectionTitle !== model.title) {
    slide.addText(model.sectionTitle, {
      x: 0.58,
      y: 0.82,
      w: 12,
      h: 0.22,
      margin: 0,
      fontFace: "Aptos",
      fontSize: 8,
      color: "687887",
      fit: "shrink"
    });
  }

  let y = 1.12;
  for (const block of model.blocks) {
    if (y > 6.8) {
      y = renderOverflowNotice(slide, y);
      break;
    }

    y = renderPptxBlock(slide, block, options, y);
  }

  if (model.sourceIds.length > 0) {
    slide.addNotes(`SDoc source block ids: ${[...new Set(model.sourceIds)].join(", ")}`);
  }
}

function renderPptxBlock(slide: PptxSlide, node: SDocNode, options: PptxExportOptions, y: number): number {
  switch (node.type) {
    case "paragraph":
    case "blockquote":
    case "callout": {
      const text = getPlainText(node).trim();
      if (!text) {
        return y;
      }
      const isCallout = node.type === "callout";
      const isWarning = node.attrs?.kind === "warning";
      const boxHeight = Math.min(Math.max(0.38, estimateTextHeight(text, isCallout ? 52 : 76)), 1.18);
      if (node.type === "blockquote" || isCallout) {
        slide.addShape("rect", {
          x: 0.65,
          y,
          w: 11.95,
          h: boxHeight,
          fill: { color: isWarning ? "FFF7E8" : isCallout ? "EEF8F0" : "F4F7FA" },
          line: { color: isWarning ? "EFCD84" : "CBD6DE", width: 0.75 }
        });
      }
      slide.addText(text, {
        x: node.type === "paragraph" ? 0.65 : 0.82,
        y: y + 0.06,
        w: node.type === "paragraph" ? 11.95 : 11.55,
        h: Math.max(0.28, boxHeight - 0.12),
        margin: 0,
        fontFace: "Aptos",
        fontSize: 12,
        color: "25313B",
        fit: "shrink",
        breakLine: false
      });
      return y + boxHeight + 0.18;
    }

    case "bulletList":
    case "orderedList":
    case "taskList": {
      const items = (node.content ?? []).map((child, index) => {
        const marker = node.type === "orderedList" ? `${index + 1}.` : node.type === "taskList" ? (child.attrs?.checked === true ? "[x]" : "[ ]") : "-";
        return `${marker} ${getPlainText(child).trim()}`;
      });
      const text = items.filter(Boolean).join("\n");
      if (!text) {
        return y;
      }
      const boxHeight = Math.min(Math.max(0.48, estimateTextHeight(text, 64)), 1.35);
      slide.addText(text, {
        x: 0.78,
        y,
        w: 11.7,
        h: boxHeight,
        margin: 0,
        fontFace: "Aptos",
        fontSize: 12,
        color: "25313B",
        breakLine: false,
        fit: "shrink"
      });
      return y + boxHeight + 0.14;
    }

    case "codeBlock": {
      const text = getPlainText(node);
      const boxHeight = Math.min(Math.max(0.52, estimateTextHeight(text, 68)), 1.45);
      slide.addShape("rect", {
        x: 0.65,
        y,
        w: 11.95,
        h: boxHeight,
        fill: { color: "15202B" },
        line: { color: "15202B", width: 0.75 }
      });
      slide.addText(text, {
        x: 0.82,
        y: y + 0.08,
        w: 11.6,
        h: Math.max(0.35, boxHeight - 0.16),
        margin: 0,
        fontFace: "Cascadia Mono",
        fontSize: 8.5,
        color: "F4F7FA",
        fit: "shrink"
      });
      return y + boxHeight + 0.2;
    }

    case "table":
      return renderPptxTable(slide, node, y);

    case "dataGrid":
      return renderPptxPlaceholder(slide, formatDataGridLabel(node), y);

    case "figure": {
      const assetId = typeof node.attrs?.assetId === "string" ? node.attrs.assetId : "";
      const caption = getPlainText(node).trim();
      return renderPptxAssetBlock(slide, options, assetId, caption || "Figure", y);
    }

    case "diagram": {
      const kind = typeof node.attrs?.kind === "string" ? node.attrs.kind : "mermaid";
      if (kind === "drawio") {
        const previewAssetId = typeof node.attrs?.previewAssetId === "string" ? node.attrs.previewAssetId : "";
        const sourceAssetId = typeof node.attrs?.sourceAssetId === "string" ? node.attrs.sourceAssetId : "";
        return previewAssetId
          ? renderPptxAssetBlock(slide, options, previewAssetId, `Draw.io source: ${sourceAssetId}`, y)
          : renderPptxPlaceholder(slide, `Draw.io source: ${sourceAssetId}`, y);
      }

      return renderPptxPlaceholder(slide, `${kind} diagram source:\n${typeof node.attrs?.source === "string" ? node.attrs.source : ""}`, y);
    }

    case "equationBlock":
      return renderPptxPlaceholder(slide, `Equation: ${typeof node.attrs?.latex === "string" ? node.attrs.latex : ""}`, y);

    case "heading":
      return y;

    default: {
      const text = getPlainText(node).trim();
      return text ? renderPptxPlaceholder(slide, text, y) : y;
    }
  }
}

function renderPptxTable(slide: PptxSlide, node: SDocNode, y: number): number {
  const caption = getTableCaption(node);
  if (caption) {
    slide.addText(`Table: ${caption}`, {
      x: 0.65,
      y,
      w: 11.95,
      h: 0.24,
      fontFace: "Aptos",
      fontSize: 9,
      color: "526273",
      italic: true
    });
    y += 0.32;
  }

  const rows = (node.content ?? []).filter((child) => child.type === "tableRow");
  const tableRows = rows.map((row) =>
    (row.content ?? [])
      .filter((cell) => cell.type === "tableCell" || cell.type === "tableHeader")
      .map((cell) => ({
        text: getPlainText(cell).trim(),
        options: {
          bold: cell.type === "tableHeader",
          fill: { color: cell.type === "tableHeader" ? "EEF3F6" : "FFFFFF" },
          color: "17212B",
          fontFace: "Aptos",
          fontSize: 9,
          align: getTableCellAlign(cell) ?? "left",
          margin: 0.04,
          border: { type: "solid", color: "CFD8E1", pt: 0.5 }
        }
      }))
  );
  const columnCount = Math.max(1, ...tableRows.map((row) => row.length));
  const height = Math.min(Math.max(0.42, tableRows.length * 0.32), 1.8);
  slide.addTable(tableRows, {
    x: 0.65,
    y,
    w: 11.95,
    h: height,
    colW: Array.from({ length: columnCount }, () => 11.95 / columnCount),
    fontFace: "Aptos",
    fontSize: 9,
    color: "17212B"
  });
  return y + height + 0.2;
}

function renderPptxAssetBlock(slide: PptxSlide, options: PptxExportOptions, assetId: string, caption: string, y: number): number {
  const asset = assetId ? options.assetResolver?.(assetId) : undefined;
  if (!asset) {
    return renderPptxPlaceholder(slide, `${caption}: missing asset ${assetId}`, y);
  }

  slide.addImage({
    data: `data:${getAssetMimeType(assetId)};base64,${uint8ArrayToBase64(asset)}`,
    x: 0.65,
    y,
    w: 4.2,
    h: 2.0,
    sizingCrop: true
  });
  slide.addText(caption, {
    x: 5.05,
    y,
    w: 7.55,
    h: 0.55,
    margin: 0,
    fontFace: "Aptos",
    fontSize: 10,
    color: "4E5D6B",
    fit: "shrink"
  });
  return y + 2.2;
}

function renderPptxPlaceholder(slide: PptxSlide, text: string, y: number): number {
  const height = Math.min(Math.max(0.45, estimateTextHeight(text, 70)), 1.2);
  slide.addShape("rect", {
    x: 0.65,
    y,
    w: 11.95,
    h: height,
    fill: { color: "F8FAFB" },
    line: { color: "92A4B4", width: 0.75, dash: "dash" }
  });
  slide.addText(text, {
    x: 0.82,
    y: y + 0.08,
    w: 11.6,
    h: Math.max(0.28, height - 0.16),
    margin: 0,
    fontFace: "Aptos",
    fontSize: 10,
    color: "4E5D6B",
    fit: "shrink"
  });
  return y + height + 0.18;
}

function renderOverflowNotice(slide: PptxSlide, y: number): number {
  slide.addText("Additional content omitted from this v1 slide projection.", {
    x: 0.65,
    y,
    w: 11.95,
    h: 0.25,
    margin: 0,
    fontFace: "Aptos",
    fontSize: 8,
    color: "A33A32"
  });
  return y + 0.3;
}

function collectNodeIds(node: SDocNode): string[] {
  const ids: string[] = [];
  function visit(current: SDocNode): void {
    const id = getNodeId(current);
    if (id) {
      ids.push(id);
    }
    current.content?.forEach(visit);
  }

  visit(node);
  return ids;
}

function estimateTextHeight(text: string, charactersPerLine: number): number {
  const lineCount = text
    .split("\n")
    .map((line) => Math.max(1, Math.ceil(line.length / charactersPerLine)))
    .reduce((sum, count) => sum + count, 0);
  return lineCount * 0.22 + 0.16;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function getAssetMimeType(assetId: string): string {
  const lower = assetId.toLowerCase();
  if (lower.endsWith(".svg")) {
    return "image/svg+xml";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".gif")) {
    return "image/gif";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/png";
}

function renderBlock(node: SDocNode, references: Map<string, ReferenceTarget>, depth = 0): string {
  switch (node.type) {
    case "heading": {
      const level = typeof node.attrs?.level === "number" ? Math.min(Math.max(node.attrs.level, 1), 6) : 1;
      const anchor = getNodeAnchor(node) ?? getNodeId(node);
      const suffix = anchor ? ` {#${anchor}}` : "";
      return `${"#".repeat(level)} ${renderInlineChildren(node, references)}${suffix}`;
    }

    case "paragraph":
      return renderInlineChildren(node, references);

    case "blockquote":
      return renderInlineChildren(node, references)
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");

    case "codeBlock": {
      const language = typeof node.attrs?.language === "string" ? node.attrs.language : "";
      return `\`\`\`${language}\n${getPlainText(node)}\n\`\`\``;
    }

    case "callout": {
      const kind = typeof node.attrs?.kind === "string" ? node.attrs.kind : "note";
      const body = renderInlineChildren(node, references);
      return `> [!${kind.toUpperCase()}]\n${body
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")}`;
    }

    case "figure": {
      const assetId = typeof node.attrs?.assetId === "string" ? node.attrs.assetId : "";
      const caption = renderInlineChildren(node, references).trim();
      const alt = typeof node.attrs?.alt === "string" && node.attrs.alt.length > 0 ? node.attrs.alt : caption;
      return `![${escapeMarkdownAlt(alt)}](assets/${encodeURI(assetId)})\n\n_Figure: ${caption}_`;
    }

    case "equationBlock": {
      const latex = typeof node.attrs?.latex === "string" ? node.attrs.latex : "";
      return `$$\n${latex}\n$$`;
    }

    case "diagram": {
      const kind = typeof node.attrs?.kind === "string" ? node.attrs.kind : "mermaid";
      if (kind === "drawio") {
        const sourceAssetId = typeof node.attrs?.sourceAssetId === "string" ? node.attrs.sourceAssetId : "";
        const previewAssetId = typeof node.attrs?.previewAssetId === "string" ? node.attrs.previewAssetId : "";
        if (previewAssetId.length > 0) {
          return `![Draw.io diagram](assets/${encodeURI(previewAssetId)})\n\n_Draw.io source: assets/${encodeURI(sourceAssetId)}_`;
        }

        return `> Draw.io diagram: source asset \`${sourceAssetId}\``;
      }

      const source = typeof node.attrs?.source === "string" ? node.attrs.source : "";
      return `\`\`\`${kind}\n${source}\n\`\`\``;
    }

    case "table":
      return renderMarkdownTable(node, references);

    case "dataGrid":
      return renderMarkdownDataGrid(node);

    case "bulletList":
      return (node.content ?? []).map((child) => renderListItem(child, references, "-", depth)).join("\n");

    case "orderedList":
      return (node.content ?? []).map((child, index) => renderListItem(child, references, `${index + 1}.`, depth)).join("\n");

    case "taskList":
      return (node.content ?? []).map((child) => renderTaskItem(child, references, depth)).join("\n");

    case "listItem":
      return renderInlineChildren(node, references);

    case "taskItem":
      return renderTaskItem(node, references, depth);

    default:
      return renderInlineChildren(node, references);
  }
}

function renderListItem(node: SDocNode, references: Map<string, ReferenceTarget>, marker: string, depth: number): string {
  const indent = "  ".repeat(depth);
  const text = renderInlineChildren(node, references).replace(/\n/g, `\n${indent}  `);
  return `${indent}${marker} ${text}`;
}

function renderTaskItem(node: SDocNode, references: Map<string, ReferenceTarget>, depth: number): string {
  const indent = "  ".repeat(depth);
  const checked = node.attrs?.checked === true ? "x" : " ";
  const text = (node.content ?? [])
    .filter((child) => child.type === "paragraph")
    .map((child) => renderInlineChildren(child, references))
    .join(" ");
  const nested = (node.content ?? [])
    .filter((child) => child.type === "taskList")
    .map((child) => renderBlock(child, references, depth + 1))
    .join("\n");
  return `${indent}- [${checked}] ${text}${nested ? `\n${nested}` : ""}`;
}

function renderInlineChildren(node: SDocNode, references: Map<string, ReferenceTarget>): string {
  return (node.content ?? []).map((child) => renderInline(child, references)).join("");
}

function renderInline(node: SDocNode, references: Map<string, ReferenceTarget>): string {
  if (isBlockNode(node)) {
    return renderInlineChildren(node, references);
  }

  if (node.type === "text") {
    return applyMarks(node.text ?? "", node.marks ?? []);
  }

  if (node.type === "hardBreak") {
    return "\n";
  }

  if (node.type === "equation") {
    const latex = typeof node.attrs?.latex === "string" ? node.attrs.latex : "";
    return `$${latex}$`;
  }

  if (node.type === "crossReference") {
    const targetId = node.attrs?.targetId;
    if (typeof targetId !== "string") {
      return "@missing-reference";
    }

    const target = references.get(targetId);
    if (!target) {
      return `@missing:${targetId}`;
    }

    const label = getPlainText(node).trim() || target.label;
    return `[${label}](#${target.anchor ?? target.id})`;
  }

  return renderInlineChildren(node, references);
}

function applyMarks(text: string, marks: SDocMark[]): string {
  return marks.reduce((current, mark) => {
    switch (mark.type) {
      case "bold":
        return `**${current}**`;
      case "italic":
        return `_${current}_`;
      case "code":
        return `\`${current}\``;
      case "strike":
        return `~~${current}~~`;
      case "subscript":
        return `<sub>${current}</sub>`;
      case "superscript":
        return `<sup>${current}</sup>`;
      case "link": {
        const href = mark.attrs?.href;
        return typeof href === "string" ? `[${current}](${href})` : current;
      }
      default:
        return current;
    }
  }, text);
}

function escapeMarkdownAlt(value: string): string {
  return value.replaceAll("[", "\\[").replaceAll("]", "\\]");
}

function renderHtmlBlock(node: SDocNode, references: Map<string, ReferenceTarget>, options: HtmlExportOptions, depth = 0): string {
  switch (node.type) {
    case "heading": {
      const level = typeof node.attrs?.level === "number" ? Math.min(Math.max(node.attrs.level, 1), 6) : 1;
      const anchor = getNodeAnchor(node) ?? getNodeId(node);
      const idAttribute = anchor ? ` id="${escapeHtmlAttribute(anchor)}"` : "";
      return `<h${level}${idAttribute}${renderTextAlignAttribute(node)}>${renderHtmlInlineChildren(node, references, options)}</h${level}>`;
    }

    case "paragraph":
      return `<p${renderTextAlignAttribute(node)}>${renderHtmlInlineChildren(node, references, options)}</p>`;

    case "blockquote":
      return `<blockquote>${renderHtmlChildrenAsBlocks(node, references, options, depth)}</blockquote>`;

    case "codeBlock": {
      const language = typeof node.attrs?.language === "string" && node.attrs.language ? ` language-${node.attrs.language}` : "";
      return `<pre><code class="${escapeHtmlAttribute(language.trim())}">${escapeHtml(getPlainText(node))}</code></pre>`;
    }

    case "callout": {
      const kind = typeof node.attrs?.kind === "string" ? node.attrs.kind : "note";
      return `<aside class="sdoc-callout sdoc-callout-${escapeHtmlAttribute(kind)}" data-kind="${escapeHtmlAttribute(kind)}">
${indentHtml(renderHtmlChildrenAsBlocks(node, references, options, depth), 2)}
</aside>`;
    }

    case "figure": {
      const assetId = typeof node.attrs?.assetId === "string" ? node.attrs.assetId : "";
      const caption = renderHtmlInlineChildren(node, references, options).trim();
      const alt = typeof node.attrs?.alt === "string" && node.attrs.alt.length > 0 ? node.attrs.alt : getPlainText(node).trim();
      const align = node.attrs?.align === "left" || node.attrs?.align === "right" ? node.attrs.align : "center";
      const src = options.assetResolver?.(assetId) ?? `assets/${encodeURI(assetId)}`;
      return `<figure id="${escapeHtmlAttribute(getNodeId(node) ?? "")}" data-align="${align}">
  <img src="${escapeHtmlAttribute(src)}" alt="${escapeHtmlAttribute(alt)}">
  <figcaption>${caption}</figcaption>
</figure>`;
    }

    case "equationBlock": {
      const latex = typeof node.attrs?.latex === "string" ? node.attrs.latex : "";
      return `<div class="sdoc-equation-block" data-latex="${escapeHtmlAttribute(latex)}">\\[${escapeHtml(latex)}\\]</div>`;
    }

    case "diagram": {
      const kind = typeof node.attrs?.kind === "string" ? node.attrs.kind : "mermaid";
      if (kind === "drawio") {
        const id = getNodeId(node) ?? "";
        const sourceAssetId = typeof node.attrs?.sourceAssetId === "string" ? node.attrs.sourceAssetId : "";
        const previewAssetId = typeof node.attrs?.previewAssetId === "string" ? node.attrs.previewAssetId : "";
        if (previewAssetId.length > 0) {
          const src = options.assetResolver?.(previewAssetId) ?? `assets/${encodeURI(previewAssetId)}`;
          return `<figure id="${escapeHtmlAttribute(id)}" class="sdoc-diagram-figure" data-kind="drawio" data-source-asset-id="${escapeHtmlAttribute(sourceAssetId)}">
  <img src="${escapeHtmlAttribute(src)}" alt="Draw.io diagram">
  <figcaption>Draw.io source: ${escapeHtml(sourceAssetId)}</figcaption>
</figure>`;
        }

        return `<div id="${escapeHtmlAttribute(id)}" class="sdoc-diagram sdoc-diagram-placeholder" data-kind="drawio" data-source-asset-id="${escapeHtmlAttribute(sourceAssetId)}">Draw.io diagram source: ${escapeHtml(sourceAssetId)}</div>`;
      }

      const source = typeof node.attrs?.source === "string" ? node.attrs.source : "";
      return `<pre class="sdoc-diagram" data-kind="${escapeHtmlAttribute(kind)}"><code>${escapeHtml(source)}</code></pre>`;
    }

    case "table":
      return renderHtmlTable(node, references, options);

    case "dataGrid":
      return renderHtmlDataGrid(node, options);

    case "bulletList":
      return `<ul>${renderHtmlListItems(node, references, options, depth)}</ul>`;

    case "orderedList":
      return `<ol>${renderHtmlListItems(node, references, options, depth)}</ol>`;

    case "taskList":
      return `<ul class="sdoc-task-list">${renderHtmlListItems(node, references, options, depth)}</ul>`;

    case "listItem":
      return `<li>${renderHtmlChildrenAsBlocks(node, references, options, depth + 1)}</li>`;

    case "taskItem": {
      const checked = node.attrs?.checked === true;
      const checkedAttribute = checked ? " checked" : "";
      const id = getNodeId(node);
      const idAttribute = id ? ` id="${escapeHtmlAttribute(id)}"` : "";
      return `<li${idAttribute} data-checked="${checked}"><input type="checkbox" disabled${checkedAttribute}><div>${renderHtmlChildrenAsBlocks(node, references, options, depth + 1)}</div></li>`;
    }

    default:
      return renderHtmlInlineChildren(node, references, options);
  }
}

function renderTextAlignAttribute(node: SDocNode): string {
  const textAlign = node.attrs?.textAlign;
  return textAlign === "center" || textAlign === "right" ? ` style="text-align: ${textAlign}"` : "";
}

function renderHtmlChildrenAsBlocks(node: SDocNode, references: Map<string, ReferenceTarget>, options: HtmlExportOptions, depth: number): string {
  const blocks = (node.content ?? []).map((child) => renderHtmlBlock(child, references, options, depth)).filter(Boolean);
  return blocks.length > 0 ? blocks.join("\n") : renderHtmlInlineChildren(node, references, options);
}

function renderHtmlListItems(node: SDocNode, references: Map<string, ReferenceTarget>, options: HtmlExportOptions, depth: number): string {
  return (node.content ?? [])
    .map((child) => indentHtml(renderHtmlBlock(child, references, options, depth + 1), 2))
    .join("\n");
}

function renderHtmlInlineChildren(node: SDocNode, references: Map<string, ReferenceTarget>, options: HtmlExportOptions): string {
  return (node.content ?? []).map((child) => renderHtmlInline(child, references, options)).join("");
}

function renderHtmlInline(node: SDocNode, references: Map<string, ReferenceTarget>, options: HtmlExportOptions): string {
  if (isBlockNode(node)) {
    return renderHtmlInlineChildren(node, references, options);
  }

  if (node.type === "text") {
    return applyHtmlMarks(escapeHtml(node.text ?? ""), node.marks ?? []);
  }

  if (node.type === "hardBreak") {
    return "<br>";
  }

  if (node.type === "equation") {
    const latex = typeof node.attrs?.latex === "string" ? node.attrs.latex : "";
    return `<span class="sdoc-inline-equation" data-latex="${escapeHtmlAttribute(latex)}">\\(${escapeHtml(latex)}\\)</span>`;
  }

  if (node.type === "crossReference") {
    const targetId = node.attrs?.targetId;
    if (typeof targetId !== "string") {
      return '<span class="sdoc-missing-reference">@missing-reference</span>';
    }

    const target = references.get(targetId);
    const label = getPlainText(node).trim() || target?.label || targetId;
    if (!target) {
      return `<span class="sdoc-missing-reference">${escapeHtml(label)}</span>`;
    }

    return `<a href="#${escapeHtmlAttribute(target.anchor ?? target.id)}">${escapeHtml(label)}</a>`;
  }

  return renderHtmlInlineChildren(node, references, options);
}

function applyHtmlMarks(html: string, marks: SDocMark[]): string {
  return marks.reduce((current, mark) => {
    switch (mark.type) {
      case "bold":
        return `<strong>${current}</strong>`;
      case "italic":
        return `<em>${current}</em>`;
      case "code":
        return `<code>${current}</code>`;
      case "strike":
        return `<s>${current}</s>`;
      case "subscript":
        return `<sub>${current}</sub>`;
      case "superscript":
        return `<sup>${current}</sup>`;
      case "link": {
        const href = sanitizeHref(mark.attrs?.href);
        return href ? `<a href="${escapeHtmlAttribute(href)}">${current}</a>` : current;
      }
      default:
        return current;
    }
  }, html);
}

function renderHtmlTable(node: SDocNode, references: Map<string, ReferenceTarget>, options: HtmlExportOptions): string {
  const rows = (node.content ?? []).filter((child) => child.type === "tableRow");
  const htmlRows = rows
    .map((row) => {
      const cells = (row.content ?? []).filter((child) => child.type === "tableCell" || child.type === "tableHeader");
      const htmlCells = cells
        .map((cell) => {
          const tag = cell.type === "tableHeader" ? "th" : "td";
          const align = getTableCellAlign(cell);
          const alignAttribute = align ? ` style="text-align: ${align}"` : "";
          return `<${tag}${alignAttribute}>${renderHtmlChildrenAsBlocks(cell, references, options, 0)}</${tag}>`;
        })
        .join("");
      return `  <tr>${htmlCells}</tr>`;
    })
    .join("\n");

  const caption = getTableCaption(node);
  const captionHtml = caption ? `<caption>${escapeHtml(caption)}</caption>\n` : "";

  return `<table>
${captionHtml}<tbody>
${htmlRows}
</tbody>
</table>`;
}

function renderMarkdownTable(node: SDocNode, references: Map<string, ReferenceTarget>): string {
  const rows = (node.content ?? []).filter((child) => child.type === "tableRow");
  const tableCells = rows.map((row) =>
    (row.content ?? []).filter((child) => child.type === "tableCell" || child.type === "tableHeader")
  );
  const cells = tableCells.map((row) =>
    row.map((cell) => escapeMarkdownTableCell(renderInlineChildren(cell, references).trim()))
  );
  const columnCount = Math.max(0, ...cells.map((row) => row.length));
  if (cells.length === 0 || columnCount === 0) {
    return "";
  }

  const normalizedRows = cells.map((row) => [...row, ...Array<string>(columnCount - row.length).fill("")]);
  const [header, ...body] = normalizedRows;
  const separator = Array.from({ length: columnCount }, (_value, columnIndex) =>
    markdownAlignmentSeparator(getColumnAlign(tableCells, columnIndex))
  );
  const tableMarkdown = [header, separator, ...body].map((row) => `| ${row.join(" | ")} |`).join("\n");
  const caption = getTableCaption(node);
  return caption ? `${tableMarkdown}\n\n_Table: ${caption}_` : tableMarkdown;
}

function getTableCaption(node: SDocNode): string {
  return typeof node.attrs?.caption === "string" ? node.attrs.caption.trim() : "";
}

function renderMarkdownDataGrid(node: SDocNode): string {
  const title = getDataGridTitle(node);
  const caption = getDataGridCaption(node);
  const sourceAssetId = getDataGridSourceAssetId(node);
  const format = getDataGridFormat(node);
  const keyColumns = getDataGridKeyColumns(node);
  const lines = [`> Data grid: ${title}`, `> Source: assets/${sourceAssetId}`, `> Format: ${format}`];
  if (keyColumns.length > 0) {
    lines.push(`> Key columns: ${keyColumns.join(", ")}`);
  }
  if (caption) {
    lines.push(`> Caption: ${caption}`);
  }
  return lines.join("\n");
}

function renderHtmlDataGrid(node: SDocNode, options: HtmlExportOptions): string {
  const id = getNodeId(node) ?? "";
  const title = getDataGridTitle(node);
  const caption = getDataGridCaption(node);
  const sourceAssetId = getDataGridSourceAssetId(node);
  const format = getDataGridFormat(node);
  const keyColumns = getDataGridKeyColumns(node);
  const source = sourceAssetId ? options.dataGridSourceResolver?.(sourceAssetId) : undefined;
  const preview = source ? createDataGridPreview(source, format, { maxRows: options.dataGridPreviewRows }) : undefined;
  const previewHtml = preview ? `\n${indentHtml(renderHtmlDataGridPreview(preview), 2)}` : "";
  const captionHtml = caption ? `\n  <figcaption>${escapeHtml(caption)}</figcaption>` : "";
  const keyColumnsAttribute = keyColumns.length > 0 ? ` data-key-columns="${escapeHtmlAttribute(keyColumns.join(","))}"` : "";
  const keyColumnsHtml =
    keyColumns.length > 0 ? `\n  <div class="sdoc-data-grid-keys">Key columns: ${escapeHtml(keyColumns.join(", "))}</div>` : "";
  return `<figure id="${escapeHtmlAttribute(id)}" class="sdoc-data-grid" data-source-asset-id="${escapeHtmlAttribute(sourceAssetId)}" data-format="${escapeHtmlAttribute(format)}"${keyColumnsAttribute}>
  <div class="sdoc-data-grid-title">${escapeHtml(title)}</div>
  <div class="sdoc-data-grid-source">Source: assets/${escapeHtml(sourceAssetId)}</div>${keyColumnsHtml}${previewHtml}${captionHtml}
</figure>`;
}

function renderHtmlDataGridPreview(preview: DataGridPreview): string {
  const header = preview.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const body = preview.rows
    .map((row) => `    <tr>${preview.columns.map((_column, index) => `<td>${escapeHtml(row[index] ?? "")}</td>`).join("")}</tr>`)
    .join("\n");
  const truncation = preview.truncatedRows || preview.truncatedColumns
    ? `\n  <div class="sdoc-data-grid-note">Preview limited to ${preview.rows.length} of ${preview.totalRows} rows${preview.truncatedColumns ? " and visible columns" : ""}.</div>`
    : "";
  return `<div class="sdoc-data-grid-preview">
  <table>
    <thead><tr>${header}</tr></thead>
    <tbody>
${body}
    </tbody>
  </table>${truncation}
</div>`;
}

function formatDataGridLabel(node: SDocNode): string {
  const lines = [`Data grid: ${getDataGridTitle(node)}`, `Source: ${getDataGridSourceAssetId(node)}`, `Format: ${getDataGridFormat(node)}`];
  const keyColumns = getDataGridKeyColumns(node);
  if (keyColumns.length > 0) {
    lines.push(`Key columns: ${keyColumns.join(", ")}`);
  }
  const caption = getDataGridCaption(node);
  if (caption) {
    lines.push(caption);
  }
  return lines.join("\n");
}

function getDataGridTitle(node: SDocNode): string {
  return typeof node.attrs?.title === "string" && node.attrs.title.trim().length > 0 ? node.attrs.title.trim() : "Untitled data grid";
}

function getDataGridCaption(node: SDocNode): string {
  return typeof node.attrs?.caption === "string" ? node.attrs.caption.trim() : "";
}

function getDataGridSourceAssetId(node: SDocNode): string {
  return typeof node.attrs?.sourceAssetId === "string" ? node.attrs.sourceAssetId : "";
}

function getDataGridFormat(node: SDocNode): string {
  return node.attrs?.format === "json" ? "json" : "csv";
}

function getDataGridKeyColumns(node: SDocNode): string[] {
  const keyColumns = node.attrs?.keyColumns;
  return Array.isArray(keyColumns) ? keyColumns.filter((column): column is string => typeof column === "string" && column.trim().length > 0).map((column) => column.trim()) : [];
}

export function createDataGridPreview(source: string, format: string, options: DataGridPreviewOptions = {}): DataGridPreview | undefined {
  const maxRows = clampPositiveInteger(options.maxRows, 5);
  const maxColumns = clampPositiveInteger(options.maxColumns, 8);
  const normalizedFormat = format === "json" ? "json" : "csv";
  const parsed = normalizedFormat === "json" ? parseJsonGridRows(source) : parseCsvGridRows(source);
  if (!parsed || parsed.columns.length === 0) {
    return undefined;
  }

  const columns = parsed.columns.slice(0, maxColumns);
  const rows = parsed.rows.slice(0, maxRows).map((row) => columns.map((_column, index) => row[index] ?? ""));
  return {
    columns,
    rows,
    totalRows: parsed.rows.length,
    truncatedRows: parsed.rows.length > rows.length,
    truncatedColumns: parsed.columns.length > columns.length
  };
}

function parseCsvGridRows(source: string): { columns: string[]; rows: string[][] } | undefined {
  const records = parseCsvRecords(source).filter((row) => row.some((cell) => cell.trim().length > 0));
  if (records.length === 0) {
    return undefined;
  }

  const [header, ...body] = records;
  const columnCount = Math.max(header.length, ...body.map((row) => row.length));
  const columns = Array.from({ length: columnCount }, (_value, index) => header[index]?.trim() || `Column ${index + 1}`);
  const rows = body.map((row) => Array.from({ length: columnCount }, (_value, index) => row[index] ?? ""));
  return { columns, rows };
}

function parseCsvRecords(source: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      records.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  records.push(row);
  return records;
}

function parseJsonGridRows(source: string): { columns: string[]; rows: string[][] } | undefined {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return undefined;
  }

  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }

  if (value.every((row) => Array.isArray(row))) {
    const rows = value as unknown[][];
    const columnCount = Math.max(0, ...rows.map((row) => row.length));
    return {
      columns: Array.from({ length: columnCount }, (_value, index) => `Column ${index + 1}`),
      rows: rows.map((row) => Array.from({ length: columnCount }, (_value, index) => formatGridCell(row[index])))
    };
  }

  if (value.every((row) => isPlainObject(row))) {
    const objectRows = value as Array<Record<string, unknown>>;
    const columns = [...new Set(objectRows.flatMap((row) => Object.keys(row)))];
    return {
      columns,
      rows: objectRows.map((row) => columns.map((column) => formatGridCell(row[column])))
    };
  }

  return undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatGridCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function clampPositiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function escapeMarkdownTableCell(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("|", "\\|").replace(/\s*\n+\s*/g, "<br>");
}

function getColumnAlign(rows: SDocNode[][], columnIndex: number): "left" | "center" | "right" | undefined {
  for (const row of rows) {
    const align = getTableCellAlign(row[columnIndex]);
    if (align) {
      return align;
    }
  }

  return undefined;
}

function getTableCellAlign(node: SDocNode | undefined): "left" | "center" | "right" | undefined {
  const align = node?.attrs?.align;
  return align === "left" || align === "center" || align === "right" ? align : undefined;
}

function markdownAlignmentSeparator(align: "left" | "center" | "right" | undefined): string {
  switch (align) {
    case "left":
      return ":---";
    case "center":
      return ":---:";
    case "right":
      return "---:";
    default:
      return "---";
  }
}

function collectReferenceTargets(document: SDocDocument): Map<string, ReferenceTarget> {
  const references = new Map<string, ReferenceTarget>();
  visitBlocks(document, (node) => {
    const id = getNodeId(node);
    if (!id) {
      return;
    }

    references.set(id, {
      id,
      type: node.type,
      anchor: getNodeAnchor(node),
      humanId: getNodeHumanId(node),
      label: getPlainText(node).trim() || id
    });
  });

  return references;
}

function getDocumentTitle(document: SDocDocument): string {
  const heading = document.content.find((node) => node.type === "heading");
  return heading ? getPlainText(heading).trim() : "";
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

function sanitizeHref(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (/^(https?:|mailto:|#|\/|\.\/|\.\.\/)/i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function indentHtml(value: string, spaces: number): string {
  const padding = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => (line.length > 0 ? `${padding}${line}` : line))
    .join("\n");
}

function visitBlocks(document: SDocDocument, visitor: (node: SDocNode) => void): void {
  function visit(node: SDocNode): void {
    if (isBlockNode(node)) {
      visitor(node);
    }

    node.content?.forEach(visit);
  }

  document.content.forEach(visit);
}

const DOCX_CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

const DOCX_ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

const DOCX_DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

const DOCX_SECTION_PROPERTIES =
  '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>';

const DOCX_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:color w:val="6A3F00"/><w:b/><w:sz w:val="20"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="360"/></w:pPr><w:rPr><w:i/><w:color w:val="4E5D6B"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:rFonts w:ascii="Cascadia Mono" w:hAnsi="Cascadia Mono"/><w:sz w:val="18"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading5"><w:name w:val="heading 5"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="20"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading6"><w:name w:val="heading 6"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="18"/></w:rPr></w:style>
  <w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="CFD8E1"/><w:left w:val="single" w:sz="4" w:color="CFD8E1"/><w:bottom w:val="single" w:sz="4" w:color="CFD8E1"/><w:right w:val="single" w:sz="4" w:color="CFD8E1"/><w:insideH w:val="single" w:sz="4" w:color="CFD8E1"/><w:insideV w:val="single" w:sz="4" w:color="CFD8E1"/></w:tblBorders></w:tblPr></w:style>
</w:styles>`;

const PUBLISH_HTML_CSS = `    :root {
      --sdoc-body-font: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --sdoc-heading-font: var(--sdoc-body-font);
      --sdoc-base-font-size: 16px;
      --sdoc-page-background: #eef1f4;
      --sdoc-document-background: #ffffff;
      --sdoc-text-color: #182026;
      --sdoc-heading-color: #17212b;
      --sdoc-accent-color: #0c5f70;
      --sdoc-border-color: #dfe5ea;
      --sdoc-muted-color: #4e5d6b;
      --sdoc-table-header-background: #eef3f6;
      --sdoc-caption-style: italic;
      color: var(--sdoc-text-color);
      background: var(--sdoc-page-background);
      font-family: var(--sdoc-body-font);
      font-size: var(--sdoc-base-font-size);
      line-height: 1.65;
    }

    body {
      margin: 0;
      padding: 32px 18px;
    }

    .sdoc-document {
      width: min(860px, 100%);
      margin: 0 auto;
      padding: 40px;
      background: var(--sdoc-document-background);
      border: 1px solid var(--sdoc-border-color);
      border-radius: 8px;
      box-shadow: 0 12px 30px rgba(17, 24, 39, 0.06);
    }

    .sdoc-profile-header,
    .sdoc-profile-footer {
      width: min(860px, 100%);
      margin: 0 auto 18px;
      color: var(--sdoc-muted-color);
      font-size: 0.9rem;
    }

    .sdoc-profile-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .sdoc-profile-header img {
      max-width: 160px;
      max-height: 48px;
      object-fit: contain;
    }

    .sdoc-profile-footer {
      margin-top: 18px;
      text-align: center;
    }

    .sdoc-corporate-template {
      padding-top: 24px;
    }

    .sdoc-corporate-template .sdoc-document {
      margin-top: 18px;
      border-radius: 0;
      box-shadow: none;
    }

    .sdoc-corporate-header,
    .sdoc-corporate-footer {
      width: min(860px, 100%);
      margin: 0 auto;
      color: #17212b;
      background: #ffffff;
      border: 1px solid #cfd8e1;
    }

    .sdoc-corporate-header {
      display: grid;
      gap: 12px;
      padding: 16px 18px;
    }

    .sdoc-corporate-kicker {
      display: block;
      color: #6a3f00;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    .sdoc-document-control {
      width: 100%;
      margin: 0;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 0.82rem;
    }

    .sdoc-document-control th,
    .sdoc-document-control td {
      padding: 6px 8px;
      border: 1px solid #cfd8e1;
    }

    .sdoc-document-control th {
      width: 18%;
      background: #eef3f6;
      text-align: left;
    }

    .sdoc-corporate-footer {
      display: flex;
      justify-content: space-between;
      margin-top: 18px;
      padding: 8px 12px;
      font-size: 0.78rem;
    }

    .sdoc-corporate-watermark {
      position: fixed;
      right: 18mm;
      bottom: 18mm;
      z-index: 0;
      color: rgba(114, 75, 11, 0.16);
      font-size: 3rem;
      font-weight: 800;
      pointer-events: none;
      transform: rotate(-24deg);
      transform-origin: center;
    }

    .sdoc-page-number::after {
      content: counter(page);
    }

    h1, h2, h3, h4, h5, h6 {
      margin: 1.4em 0 0.45em;
      color: var(--sdoc-heading-color);
      font-family: var(--sdoc-heading-font);
      line-height: 1.22;
    }

    h1:first-child, h2:first-child, h3:first-child {
      margin-top: 0;
    }

    a {
      color: var(--sdoc-accent-color);
      text-underline-offset: 2px;
    }

    blockquote {
      margin: 1em 0;
      padding-left: 16px;
      color: var(--sdoc-muted-color);
      border-left: 3px solid #92a4b4;
    }

    code {
      padding: 2px 5px;
      background: #eef3f6;
      border-radius: 4px;
    }

    pre {
      padding: 14px;
      overflow: auto;
      color: #f4f7fa;
      background: #15202b;
      border-radius: 6px;
    }

    pre code {
      padding: 0;
      background: transparent;
    }

    table {
      width: 100%;
      margin: 18px 0;
      border-collapse: collapse;
      table-layout: fixed;
    }

    th, td {
      padding: 8px 10px;
      vertical-align: top;
      border: 1px solid #cfd8e1;
    }

    th {
      background: var(--sdoc-table-header-background);
      text-align: left;
    }

    figure {
      display: grid;
      gap: 10px;
      margin: 20px 0;
      padding: 12px;
      background: #f8fafb;
      border: 1px solid #d8e0e6;
      border-radius: 6px;
    }

    figure img {
      display: block;
      max-width: 100%;
      max-height: 520px;
      margin: 0 auto;
      object-fit: contain;
    }

    figure[data-align="left"] img {
      margin-left: 0;
      margin-right: auto;
    }

    figure[data-align="right"] img {
      margin-left: auto;
      margin-right: 0;
    }

    figure[data-align="left"] figcaption { text-align: left; }
    figure[data-align="right"] figcaption { text-align: right; }

    figcaption {
      color: var(--sdoc-muted-color);
      font-size: 0.92rem;
      font-style: var(--sdoc-caption-style);
      text-align: center;
    }

    caption {
      caption-side: bottom;
      padding-top: 8px;
      color: var(--sdoc-muted-color);
      font-size: 0.92rem;
      font-style: var(--sdoc-caption-style);
      text-align: center;
    }

    .sdoc-data-grid-title {
      font-weight: 700;
    }

    .sdoc-data-grid-source {
      color: var(--sdoc-muted-color);
      font-size: 0.9rem;
    }

    .sdoc-data-grid-preview {
      overflow-x: auto;
    }

    .sdoc-data-grid-preview table {
      margin: 8px 0 0;
      font-size: 0.88rem;
    }

    .sdoc-data-grid-note {
      margin-top: 6px;
      color: #687887;
      font-size: 0.82rem;
    }

    .sdoc-callout {
      margin: 18px 0;
      padding: 12px 14px;
      background: #eef8f0;
      border: 1px solid #b9dfc0;
      border-left: 4px solid #35a65b;
      border-radius: 6px;
    }

    .sdoc-callout-warning {
      background: #fff7e8;
      border-color: #efcd84;
      border-left-color: #c98209;
    }

    .sdoc-equation-block,
    .sdoc-diagram,
    .sdoc-diagram-figure {
      margin: 18px 0;
      overflow-x: auto;
    }

    .sdoc-diagram-placeholder {
      padding: 14px 16px;
      color: #4e5d6b;
      background: #f8fafb;
      border: 1px dashed #92a4b4;
      border-radius: 6px;
    }

    .sdoc-equation-block {
      padding: 14px 16px;
      background: #f8fafb;
      border: 1px solid #d8e0e6;
      border-radius: 6px;
      text-align: center;
    }

    .sdoc-inline-equation {
      padding: 0 3px;
      background: #f7fafb;
      border: 1px solid #dce5ec;
      border-radius: 4px;
    }

    .sdoc-missing-reference {
      color: #a33a32;
    }

    @media print {
      :root {
        color: #000000;
        background: #ffffff;
        font-size: 11pt;
      }

      @page {
        margin: 18mm 16mm;
      }

      body {
        padding: 0;
        background: #ffffff;
      }

      .sdoc-document {
        width: auto;
        margin: 0;
        padding: 0;
        border: 0;
        border-radius: 0;
        box-shadow: none;
      }

      .sdoc-corporate-template {
        padding: 0;
      }

      .sdoc-corporate-template .sdoc-document {
        margin-top: 8mm;
      }

      .sdoc-corporate-header,
      .sdoc-corporate-footer {
        width: auto;
        border-color: #777777;
      }

      h1, h2, h3, h4, h5, h6 {
        break-after: avoid;
        page-break-after: avoid;
      }

      figure,
      table,
      pre,
      blockquote,
      .sdoc-callout,
      .sdoc-equation-block,
      .sdoc-diagram,
      .sdoc-diagram-figure,
      .sdoc-data-grid {
        break-inside: avoid;
        page-break-inside: avoid;
      }

      a[href^="http"]::after,
      a[href^="https"]::after {
        content: " (" attr(href) ")";
        font-size: 0.85em;
      }

      pre,
      code {
        white-space: pre-wrap;
      }
    }`;

const PUBLISH_HTML_PROFILE_CSS: Record<PublishingStyleProfileName, string> = {
  modern: `    .sdoc-profile-modern {
      --sdoc-accent-color: #0c5f70;
    }`,
  ieee: `    .sdoc-profile-ieee {
      --sdoc-body-font: "Times New Roman", Times, serif;
      --sdoc-heading-font: "Times New Roman", Times, serif;
      --sdoc-base-font-size: 15px;
      --sdoc-page-background: #ffffff;
      --sdoc-border-color: #b8c0c7;
      --sdoc-accent-color: #1f4e79;
      --sdoc-caption-style: normal;
    }

    .sdoc-profile-ieee .sdoc-document {
      max-width: 760px;
      border-radius: 0;
      box-shadow: none;
    }

    .sdoc-profile-ieee h1 {
      text-align: center;
      text-transform: uppercase;
    }

    .sdoc-profile-ieee h2,
    .sdoc-profile-ieee h3 {
      text-transform: uppercase;
    }`,
  iso: `    .sdoc-profile-iso {
      --sdoc-page-background: #f3f4f2;
      --sdoc-heading-color: #1f2933;
      --sdoc-accent-color: #7a4f14;
      --sdoc-border-color: #a9b4bd;
      --sdoc-table-header-background: #e7ecef;
      --sdoc-caption-style: normal;
    }

    .sdoc-profile-iso .sdoc-document {
      border-radius: 0;
      box-shadow: none;
      border-top: 4px solid var(--sdoc-accent-color);
    }

    .sdoc-profile-iso h1,
    .sdoc-profile-iso h2 {
      border-bottom: 1px solid var(--sdoc-border-color);
      padding-bottom: 0.22em;
    }`,
  korean: `    .sdoc-profile-korean {
      --sdoc-body-font: "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif;
      --sdoc-heading-font: "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif;
      --sdoc-base-font-size: 16px;
      --sdoc-page-background: #f4f5f7;
      --sdoc-heading-color: #202735;
      --sdoc-accent-color: #245b8f;
      --sdoc-caption-style: normal;
    }

    .sdoc-profile-korean .sdoc-document {
      max-width: 900px;
    }

    .sdoc-profile-korean p,
    .sdoc-profile-korean li {
      word-break: keep-all;
    }`
};
