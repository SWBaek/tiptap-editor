import { getNodeAnchor, getNodeId, getPlainText, isBlockNode, type SDocDocument, type SDocMark, type SDocNode } from "@sdoc/schema";

export interface HtmlExportOptions {
  title?: string;
  assetResolver?: (assetId: string) => string | undefined;
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
  label: string;
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
<body>
  <main class="sdoc-document">
${blocks.map((block) => indentHtml(block, 4)).join("\n\n")}
  </main>
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

    chunks.push({
      id,
      type: node.type,
      heading: currentHeading,
      text
    });
  });

  return chunks.map((chunk) => JSON.stringify(chunk)).join("\n") + (chunks.length > 0 ? "\n" : "");
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
      const source = typeof node.attrs?.source === "string" ? node.attrs.source : "";
      return `\`\`\`${kind}\n${source}\n\`\`\``;
    }

    case "table":
      return renderMarkdownTable(node, references);

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
      const source = typeof node.attrs?.source === "string" ? node.attrs.source : "";
      return `<pre class="sdoc-diagram" data-kind="${escapeHtmlAttribute(kind)}"><code>${escapeHtml(source)}</code></pre>`;
    }

    case "table":
      return renderHtmlTable(node, references, options);

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
          return `<${tag}>${renderHtmlChildrenAsBlocks(cell, references, options, 0)}</${tag}>`;
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
  const cells = rows.map((row) =>
    (row.content ?? [])
      .filter((child) => child.type === "tableCell" || child.type === "tableHeader")
      .map((cell) => escapeMarkdownTableCell(renderInlineChildren(cell, references).trim()))
  );
  const columnCount = Math.max(0, ...cells.map((row) => row.length));
  if (cells.length === 0 || columnCount === 0) {
    return "";
  }

  const normalizedRows = cells.map((row) => [...row, ...Array<string>(columnCount - row.length).fill("")]);
  const [header, ...body] = normalizedRows;
  const separator = Array<string>(columnCount).fill("---");
  return [header, separator, ...body].map((row) => `| ${row.join(" | ")} |`).join("\n");
}

function escapeMarkdownTableCell(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("|", "\\|").replace(/\s*\n+\s*/g, "<br>");
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
    .sdoc-diagram {
      margin: 18px 0;
      overflow-x: auto;
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
      .sdoc-diagram {
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
