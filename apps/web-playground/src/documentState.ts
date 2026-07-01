import { stableStringify, type SDocMetadata } from "@sdoc/format";

export function isMetadataDirty(current: SDocMetadata, baseline: SDocMetadata): boolean {
  return stableStringify(current) !== stableStringify(baseline);
}

export function getSavedLabel(savedAt: string, hasUnsavedChanges: boolean): string {
  return hasUnsavedChanges ? "Unsaved changes" : savedAt;
}

export function renderMetadataDiff(current: SDocMetadata, baseline: SDocMetadata): string[] {
  const keys = [...new Set([...Object.keys(baseline), ...Object.keys(current)])].sort((a, b) => a.localeCompare(b));
  const lines: string[] = [];

  for (const key of keys) {
    const oldValue = baseline[key];
    const newValue = current[key];
    if (fingerprintValue(oldValue) === fingerprintValue(newValue)) {
      continue;
    }

    if (oldValue === undefined) {
      lines.push(`Metadata ${key} added: ${formatMetadataValue(newValue)}`);
    } else if (newValue === undefined) {
      lines.push(`Metadata ${key} removed: ${formatMetadataValue(oldValue)}`);
    } else {
      lines.push(`Metadata ${key} changed: ${formatMetadataValue(oldValue)} -> ${formatMetadataValue(newValue)}`);
    }
  }

  return lines;
}

export function renderDiffPreview(documentLines: string[], metadataLines: string[]): string {
  if (documentLines.length === 0 && metadataLines.length === 0) {
    return "NO_CHANGES\n";
  }

  const sections: string[] = [];
  if (documentLines.length > 0) {
    sections.push(renderSection("Document changes", documentLines));
  }
  if (metadataLines.length > 0) {
    sections.push(renderSection("Metadata changes", metadataLines));
  }

  return `${sections.join("\n\n")}\n`;
}

function renderSection(title: string, lines: string[]): string {
  return [`${title} (${lines.length})`, ...lines.map((line) => `- ${line}`)].join("\n");
}

function fingerprintValue(value: unknown): string {
  return value === undefined ? "<undefined>" : stableStringify(value);
}

function formatMetadataValue(value: unknown): string {
  if (value === undefined) {
    return "unset";
  }

  if (typeof value === "string") {
    return `"${value.replaceAll('"', '\\"')}"`;
  }

  return JSON.stringify(value) ?? String(value);
}
