import { getNodeAnchor, getNodeId, getPlainText, isBlockNode, type SDocDocument, type SDocMark, type SDocNode } from "@sdoc/schema";

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

function visitBlocks(document: SDocDocument, visitor: (node: SDocNode) => void): void {
  function visit(node: SDocNode): void {
    if (isBlockNode(node)) {
      visitor(node);
    }

    node.content?.forEach(visit);
  }

  document.content.forEach(visit);
}
