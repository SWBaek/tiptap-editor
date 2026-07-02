import { stableStringify, type SDocMetadata } from "@sdoc/format";
import { getNodeAnchor, getNodeId, getPlainText, isBlockNode, type SDocDocument, type SDocNode, type ValidationResult } from "@sdoc/schema";

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

export interface ReferenceTargetSummary {
  id: string;
  type: string;
  label: string;
  anchor?: string;
}

export interface BrokenReference {
  id: string;
  targetId: string;
  label: string;
  path: string;
}

export interface StaleReferenceLabel extends BrokenReference {
  targetLabel: string;
}

export interface ReferenceDiagnosticsModel {
  targetCount: number;
  referenceCount: number;
  brokenCount: number;
  staleCount: number;
  label: string;
  targets: ReferenceTargetSummary[];
  brokenReferences: BrokenReference[];
  staleReferences: StaleReferenceLabel[];
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

export function createReferenceDiagnostics(document: SDocDocument): ReferenceDiagnosticsModel {
  const targets: ReferenceTargetSummary[] = [];
  const targetById = new Map<string, ReferenceTargetSummary>();
  const references: BrokenReference[] = [];

  function visit(node: SDocNode, path: string): void {
    if (isBlockNode(node)) {
      const id = getNodeId(node);
      if (id) {
        const target = {
          id,
          type: node.type,
          label: getReferenceTargetLabel(node),
          anchor: getNodeAnchor(node)
        };
        targetById.set(id, target);
        targets.push(target);
      }
    }

    if (node.type === "crossReference") {
      const targetId = typeof node.attrs?.targetId === "string" ? node.attrs.targetId : "";
      references.push({
        id: typeof node.attrs?.id === "string" && node.attrs.id.length > 0 ? node.attrs.id : `${path}.crossReference`,
        targetId,
        label: getPlainText(node).trim() || targetId || "Untitled reference",
        path
      });
    }

    node.content?.forEach((child, index) => visit(child, `${path}.${index}`));
  }

  document.content.forEach((node, index) => visit(node, `${index}`));

  const brokenReferences = references.filter((reference) => !targetById.has(reference.targetId));
  const staleReferences = references.flatMap((reference) => {
    const target = targetById.get(reference.targetId);
    if (!target || reference.label === target.label) {
      return [];
    }

    return [{ ...reference, targetLabel: target.label }];
  });
  return {
    targetCount: targets.length,
    referenceCount: references.length,
    brokenCount: brokenReferences.length,
    staleCount: staleReferences.length,
    label: formatReferenceDiagnosticsLabel(brokenReferences.length, staleReferences.length),
    targets,
    brokenReferences,
    staleReferences
  };
}

export function updateCrossReferenceLabel(document: SDocDocument, referenceId: string, label: string): SDocDocument {
  const nextContent = document.content.map((node) => updateCrossReferenceLabelInNode(node, referenceId, label));
  return { ...document, content: nextContent };
}

export function createLocalHistoryEntry(
  document: SDocDocument,
  metadata: SDocMetadata,
  now = new Date(),
  id = createLocalHistoryId(now)
): LocalHistoryEntry {
  const title = normalizeLocalHistoryTitle(typeof metadata.title === "string" ? metadata.title : "");
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

export function removeLocalHistoryEntry(entries: LocalHistoryEntry[], entryId: string): LocalHistoryEntry[] {
  return entries.filter((entry) => entry.id !== entryId);
}

export function renameLocalHistoryEntry(entries: LocalHistoryEntry[], entryId: string, title: string): LocalHistoryEntry[] {
  const nextTitle = normalizeLocalHistoryTitle(title);
  return entries.map((entry) => (entry.id === entryId ? { ...entry, title: nextTitle } : entry));
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

function normalizeLocalHistoryTitle(title: string): string {
  return title.trim() || "Untitled";
}

function getReferenceTargetLabel(node: SDocNode): string {
  const text = getPlainText(node).trim();
  if (text.length > 0) {
    return text;
  }

  return getNodeAnchor(node) ?? getNodeId(node) ?? node.type;
}

function formatReferenceDiagnosticsLabel(brokenCount: number, staleCount: number): string {
  if (brokenCount === 0 && staleCount === 0) {
    return "References OK";
  }

  return [
    brokenCount > 0 ? `${brokenCount} broken` : "",
    staleCount > 0 ? `${staleCount} stale` : ""
  ]
    .filter(Boolean)
    .join(", ");
}

function updateCrossReferenceLabelInNode(node: SDocNode, referenceId: string, label: string): SDocNode {
  const content = node.content?.map((child) => updateCrossReferenceLabelInNode(child, referenceId, label));
  if (node.type === "crossReference" && node.attrs?.id === referenceId) {
    return {
      ...node,
      content: [{ type: "text", text: label }]
    };
  }

  return content ? { ...node, content } : node;
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
