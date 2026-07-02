import { stableStringify, type SDocMetadata } from "@sdoc/format";
import type { SDocDocument, ValidationResult } from "@sdoc/schema";

export interface ChangeReviewSection {
  title: string;
  lines: string[];
}

export interface ChangeReviewModel {
  total: number;
  documentCount: number;
  metadataCount: number;
  label: string;
  sections: ChangeReviewSection[];
}

export interface LocalHistoryEntry {
  id: string;
  createdAt: string;
  title: string;
  document: SDocDocument;
  metadata: SDocMetadata;
}

export function isMetadataDirty(current: SDocMetadata, baseline: SDocMetadata): boolean {
  return stableStringify(current) !== stableStringify(baseline);
}

export function getSavedLabel(savedAt: string, hasUnsavedChanges: boolean): string {
  return hasUnsavedChanges ? "Unsaved changes" : savedAt;
}

export function getFileLabel(filename: string | null, metadata: SDocMetadata): string {
  return filename ?? `${metadata.title.trim() || "Untitled"}.sdoc`;
}

export function getValidationFailureMessage(validation: ValidationResult, action: string): string | null {
  if (validation.ok) {
    return null;
  }

  const issue = validation.issues[0];
  const detail = issue ? `${issue.path}: ${issue.message}` : "schema validation failed";
  return `Cannot ${action}: ${detail}`;
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

export function createChangeReview(documentLines: string[], metadataLines: string[]): ChangeReviewModel {
  const total = documentLines.length + metadataLines.length;
  const sections: ChangeReviewSection[] = [];

  if (documentLines.length > 0) {
    sections.push({ title: "Document changes", lines: documentLines });
  }
  if (metadataLines.length > 0) {
    sections.push({ title: "Metadata changes", lines: metadataLines });
  }

  return {
    total,
    documentCount: documentLines.length,
    metadataCount: metadataLines.length,
    label: total === 0 ? "No changes" : `${total} change${total === 1 ? "" : "s"}`,
    sections
  };
}

export function createLocalHistoryEntry(
  document: SDocDocument,
  metadata: SDocMetadata,
  now = new Date(),
  id = createLocalHistoryId(now)
): LocalHistoryEntry {
  const title = typeof metadata.title === "string" && metadata.title.trim().length > 0 ? metadata.title.trim() : "Untitled";
  return {
    id,
    createdAt: now.toISOString(),
    title,
    document,
    metadata
  };
}

export function addLocalHistoryEntry(entries: LocalHistoryEntry[], entry: LocalHistoryEntry, limit = 12): LocalHistoryEntry[] {
  return [entry, ...entries.filter((current) => current.id !== entry.id)].slice(0, limit);
}

export function serializeLocalHistory(entries: LocalHistoryEntry[]): string {
  return JSON.stringify(entries);
}

export function parseLocalHistory(value: string | null): LocalHistoryEntry[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isLocalHistoryEntry);
  } catch {
    return [];
  }
}

function renderSection(title: string, lines: string[]): string {
  return [`${title} (${lines.length})`, ...lines.map((line) => `- ${line}`)].join("\n");
}

function createLocalHistoryId(now: Date): string {
  return `hist_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isLocalHistoryEntry(value: unknown): value is LocalHistoryEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<LocalHistoryEntry>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.title === "string" &&
    isSdocDocument(candidate.document) &&
    !!candidate.metadata &&
    typeof candidate.metadata === "object"
  );
}

function isSdocDocument(value: unknown): value is SDocDocument {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SDocDocument>;
  return candidate.schemaVersion === 1 && candidate.type === "doc" && !!candidate.attrs && typeof candidate.attrs.id === "string";
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
