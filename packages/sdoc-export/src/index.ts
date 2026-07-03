import { getNodeAnchor, getNodeHumanId, getNodeId, getPlainText, isBlockNode, type SDocDocument, type SDocMark, type SDocNode } from "@sdoc/schema";

export interface HtmlExportOptions {
  title?: string;
  assetResolver?: (assetId: string) => string | undefined;
  template?: CorporateTemplateName;
  metadata?: CorporateTemplateMetadata;
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
  const bodyClass = corporateTemplate ? ' class="sdoc-corporate-template sdoc-corporate-template-controlled"' : "";
  const corporateHeader = corporateTemplate
    ? `${renderCorporateHeader(document, title, options.metadata)}
  <div class="sdoc-corporate-watermark">${escapeHtml(getCorporateMetadataValue(options.metadata, "classification", "CONTROLLED"))}</div>
`
    : "";
  const corporateFooter = corporateTemplate ? `\n${renderCorporateFooter(document, options.metadata)}` : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
${PUBLISH_HTML_CSS}
  </style>
</head>
<body${bodyClass}>
${corporateHeader}  <main class="sdoc-document">
${blocks.map((block) => indentHtml(block, 4)).join("\n\n")}
  </main>
${corporateFooter}
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
    case "orderedList": {
      const items = (node.content ?? []).map((child, index) => {
        const marker = node.type === "orderedList" ? `${index + 1}.` : "-";
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

    case "listItem":
      return renderInlineChildren(node, references);

    default:
      return renderInlineChildren(node, references);
  }
}

function renderListItem(node: SDocNode, references: Map<string, ReferenceTarget>, marker: string, depth: number): string {
  const indent = "  ".repeat(depth);
  const text = renderInlineChildren(node, references).replace(/\n/g, `\n${indent}  `);
  return `${indent}${marker} ${text}`;
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
      return `<h${level}${idAttribute}>${renderHtmlInlineChildren(node, references, options)}</h${level}>`;
    }

    case "paragraph":
      return `<p>${renderHtmlInlineChildren(node, references, options)}</p>`;

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
      const src = options.assetResolver?.(assetId) ?? `assets/${encodeURI(assetId)}`;
      return `<figure id="${escapeHtmlAttribute(getNodeId(node) ?? "")}">
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
      return renderHtmlDataGrid(node);

    case "bulletList":
      return `<ul>${renderHtmlListItems(node, references, options, depth)}</ul>`;

    case "orderedList":
      return `<ol>${renderHtmlListItems(node, references, options, depth)}</ol>`;

    case "listItem":
      return `<li>${renderHtmlChildrenAsBlocks(node, references, options, depth + 1)}</li>`;

    default:
      return renderHtmlInlineChildren(node, references, options);
  }
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

  return `<table>
<tbody>
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
  return [header, separator, ...body].map((row) => `| ${row.join(" | ")} |`).join("\n");
}

function renderMarkdownDataGrid(node: SDocNode): string {
  const title = getDataGridTitle(node);
  const caption = getDataGridCaption(node);
  const sourceAssetId = getDataGridSourceAssetId(node);
  const format = getDataGridFormat(node);
  const lines = [`> Data grid: ${title}`, `> Source: assets/${sourceAssetId}`, `> Format: ${format}`];
  if (caption) {
    lines.push(`> Caption: ${caption}`);
  }
  return lines.join("\n");
}

function renderHtmlDataGrid(node: SDocNode): string {
  const id = getNodeId(node) ?? "";
  const title = getDataGridTitle(node);
  const caption = getDataGridCaption(node);
  const sourceAssetId = getDataGridSourceAssetId(node);
  const format = getDataGridFormat(node);
  const captionHtml = caption ? `\n  <figcaption>${escapeHtml(caption)}</figcaption>` : "";
  return `<figure id="${escapeHtmlAttribute(id)}" class="sdoc-data-grid" data-source-asset-id="${escapeHtmlAttribute(sourceAssetId)}" data-format="${escapeHtmlAttribute(format)}">
  <div class="sdoc-data-grid-title">${escapeHtml(title)}</div>
  <div class="sdoc-data-grid-source">Source: assets/${escapeHtml(sourceAssetId)}</div>${captionHtml}
</figure>`;
}

function formatDataGridLabel(node: SDocNode): string {
  const lines = [`Data grid: ${getDataGridTitle(node)}`, `Source: ${getDataGridSourceAssetId(node)}`, `Format: ${getDataGridFormat(node)}`];
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

const PUBLISH_HTML_CSS = `    :root {
      color: #182026;
      background: #eef1f4;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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
      background: #ffffff;
      border: 1px solid #dfe5ea;
      border-radius: 8px;
      box-shadow: 0 12px 30px rgba(17, 24, 39, 0.06);
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
      color: #17212b;
      line-height: 1.22;
    }

    h1:first-child, h2:first-child, h3:first-child {
      margin-top: 0;
    }

    a {
      color: #0c5f70;
      text-underline-offset: 2px;
    }

    blockquote {
      margin: 1em 0;
      padding-left: 16px;
      color: #4e5d6b;
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
      background: #eef3f6;
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

    figcaption {
      color: #4e5d6b;
      font-size: 0.92rem;
      text-align: center;
    }

    .sdoc-data-grid-title {
      font-weight: 700;
    }

    .sdoc-data-grid-source {
      color: #586875;
      font-size: 0.9rem;
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
