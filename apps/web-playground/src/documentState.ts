import { stableStringify, type SDocMetadata } from "@sdoc/format";
import {
  getNodeAnchor,
  getNodeHumanId,
  getNodeId,
  getPlainText,
  isBlockNode,
  type SDocDocument,
  type SDocNode,
  type ValidationResult
} from "@sdoc/schema";
import type { SDocDiffEvent, SDocReviewBatchFailure, SDocReviewBatchResult } from "@sdoc/diff";

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

export interface SideBySideDiffRow {
  id: string;
  kind: VisualDiffOverlayItem["kind"];
  label: string;
  nodeType: string;
  baselineText: string;
  currentText: string;
  detail: string;
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
  humanId?: string;
}

export interface ReferenceRepairCandidate {
  targetId: string;
  label: string;
  detail: string;
  score: number;
}

export interface BrokenReference {
  id: string;
  targetId: string;
  label: string;
  path: string;
  repairCandidates: ReferenceRepairCandidate[];
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

export interface SectionFoldRange {
  headingId: string;
  headingLevel: number;
  title: string;
  hiddenBlockIds: string[];
}

export interface RequirementTraceItem {
  id: string;
  humanId: string;
  type: string;
  label: string;
  path: string;
}

export interface RequirementCoverageGap {
  id: string;
  type: "heading";
  label: string;
  path: string;
}

export interface RequirementHumanIdIssue {
  humanId: string;
  severity: "warning";
  message: string;
  blocks: RequirementTraceItem[];
}

export interface RequirementTraceabilityModel {
  taggedCount: number;
  duplicateCount: number;
  formatIssueCount: number;
  coverageGapCount: number;
  label: string;
  taggedBlocks: RequirementTraceItem[];
  duplicateHumanIds: RequirementHumanIdIssue[];
  formatIssues: RequirementHumanIdIssue[];
  coverageGaps: RequirementCoverageGap[];
}

export interface VisualDiffOverlayItem {
  id: string;
  kind: "added" | "deleted" | "modified" | "moved" | "reference-broken";
  label: string;
  nodeType: string;
  summary: string;
  detail: string;
  anchorable: boolean;
}

export type VisualDiffFilterKind = "all" | VisualDiffOverlayItem["kind"];

export interface VisualDiffFilterCounts {
  total: number;
  added: number;
  deleted: number;
  modified: number;
  moved: number;
  "reference-broken": number;
}

export type ReviewActionKind = "accept" | "reject";

export type ReviewActionAvailability = "available" | "current-state" | "manual-repair" | "unsupported";

export interface ReviewActionOption {
  kind: ReviewActionKind;
  availability: ReviewActionAvailability;
  label: string;
  description: string;
}

export interface ReviewActionPlanItem extends VisualDiffOverlayItem {
  actions: ReviewActionOption[];
}

export interface ReviewActionPlan {
  total: number;
  actionableCount: number;
  manualCount: number;
  unsupportedCount: number;
  items: ReviewActionPlanItem[];
}

export interface ReviewBatchConflictItem {
  id: string;
  kind: SDocDiffEvent["kind"];
  reason: string;
  message: string;
}

export interface ReviewBatchConflictSummary {
  action: ReviewActionKind;
  status: "complete" | "partial" | "no-op";
  title: string;
  detail: string;
  appliedCount: number;
  skippedCount: number;
  failures: ReviewBatchConflictItem[];
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

export function createSideBySideDiffRows(events: SDocDiffEvent[], baseline: SDocDocument, current: SDocDocument): SideBySideDiffRow[] {
  const baselineBlocks = createBlockPreviewMap(baseline);
  const currentBlocks = createBlockPreviewMap(current);

  return events.map((event) => {
    const baselineBlock = baselineBlocks.get(event.id);
    const currentBlock = currentBlocks.get(event.id);
    return {
      id: event.id,
      kind: event.kind,
      label: getVisualDiffLabel(event.kind),
      nodeType: event.nodeType,
      baselineText: getBaselineDiffText(event, baselineBlock),
      currentText: getCurrentDiffText(event, currentBlock),
      detail: getVisualDiffDetail(event)
    };
  });
}

export function createVisualDiffOverlayItems(events: SDocDiffEvent[]): VisualDiffOverlayItem[] {
  return events.map((event) => {
    const label = getVisualDiffLabel(event.kind);
    return {
      id: event.id,
      kind: event.kind,
      label,
      nodeType: event.nodeType,
      summary: getVisualDiffSummary(event),
      detail: getVisualDiffDetail(event),
      anchorable: event.kind !== "deleted"
    };
  });
}

export function filterVisualDiffOverlayItems(items: VisualDiffOverlayItem[], filter: VisualDiffFilterKind): VisualDiffOverlayItem[] {
  return filter === "all" ? items : items.filter((item) => item.kind === filter);
}

export function createVisualDiffFilterCounts(items: VisualDiffOverlayItem[]): VisualDiffFilterCounts {
  const counts: VisualDiffFilterCounts = {
    total: items.length,
    added: 0,
    deleted: 0,
    modified: 0,
    moved: 0,
    "reference-broken": 0
  };

  for (const item of items) {
    counts[item.kind] += 1;
  }

  return counts;
}

export function createReviewActionPlan(items: VisualDiffOverlayItem[]): ReviewActionPlan {
  const planItems = items.map((item): ReviewActionPlanItem => ({ ...item, actions: getReviewActionOptions(item) }));

  return {
    total: planItems.length,
    actionableCount: planItems.filter((item) => item.actions.some((action) => action.availability === "available")).length,
    manualCount: planItems.filter(
      (item) => item.actions.some((action) => action.availability === "manual-repair") && item.actions.every((action) => action.availability !== "available")
    ).length,
    unsupportedCount: planItems.filter((item) => item.actions.every((action) => action.availability === "unsupported")).length,
    items: planItems
  };
}

export function createReviewBatchConflictSummary(
  action: ReviewActionKind,
  result: SDocReviewBatchResult
): ReviewBatchConflictSummary {
  const actionLabel = action === "accept" ? "accept" : "reject";
  const status = getReviewBatchStatus(result);
  const skippedDetail = result.skippedCount > 0 ? `, skipped ${result.skippedCount}` : "";
  return {
    action,
    status,
    title: getReviewBatchTitle(action, status),
    detail: `${capitalize(actionLabel)}ed ${result.appliedCount} review event${result.appliedCount === 1 ? "" : "s"}${skippedDetail}.`,
    appliedCount: result.appliedCount,
    skippedCount: result.skippedCount,
    failures: result.failures.map(createReviewBatchConflictItem)
  };
}

export function renderVisualDiffRuntimeCss(items: VisualDiffOverlayItem[], selectedId: string | null = null): string {
  const anchorableItems = items.filter((item) => item.anchorable);
  if (anchorableItems.length === 0) {
    return "";
  }

  return anchorableItems
    .map((item) => {
      const selector = `.editor-surface [data-id="${escapeCssAttribute(item.id)}"]`;
      const isSelected = item.id === selectedId;
      return `${selector} {
  position: relative;
  outline: ${isSelected ? 3 : 2}px solid ${getVisualDiffColor(item.kind)};
  outline-offset: ${isSelected ? 4 : 3}px;
  ${isSelected ? `box-shadow: 0 0 0 4px ${getVisualDiffBackground(item.kind)};` : ""}
}
${selector}::before {
  position: absolute;
  top: -18px;
  right: 0;
  z-index: 2;
  padding: 2px 6px;
  color: #17212b;
  background: ${getVisualDiffBackground(item.kind)};
  border: 1px solid ${getVisualDiffColor(item.kind)};
  border-radius: 4px;
  content: "${escapeCssContent(item.label)}";
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
  pointer-events: none;
}`;
    })
    .join("\n");
}

export function renderBrokenReferenceRuntimeCss(references: BrokenReference[]): string {
  if (references.length === 0) {
    return "";
  }

  return references
    .map((reference) => {
      const selector = `.editor-surface .sdoc-cross-reference[data-id="${escapeCssAttribute(reference.id)}"]`;
      return `${selector} {
  color: #8a2f24;
  background: #fff1ed;
  box-shadow: inset 0 -2px 0 #c4493d;
}
${selector}::after {
  margin-left: 4px;
  color: #8a2f24;
  content: "missing ${escapeCssContent(reference.targetId)}";
  font-size: 10px;
  font-weight: 700;
}`;
    })
    .join("\n");
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
          anchor: getNodeAnchor(node),
          humanId: getNodeHumanId(node)
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
        path,
        repairCandidates: []
      });
    }

    node.content?.forEach((child, index) => visit(child, `${path}.${index}`));
  }

  document.content.forEach((node, index) => visit(node, `${index}`));

  const brokenReferences = references
    .filter((reference) => !targetById.has(reference.targetId))
    .map((reference) => ({
      ...reference,
      repairCandidates: createReferenceRepairCandidates(reference, targets)
    }));
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

export function createRequirementTraceability(document: SDocDocument): RequirementTraceabilityModel {
  const taggedBlocks: RequirementTraceItem[] = [];
  const coverageGaps: RequirementCoverageGap[] = [];
  const byHumanId = new Map<string, RequirementTraceItem[]>();

  function visit(node: SDocNode, path: string): void {
    if (isBlockNode(node)) {
      const id = getNodeId(node);
      const label = getReferenceTargetLabel(node);
      const humanId = getNodeHumanId(node);
      if (id && humanId) {
        const item: RequirementTraceItem = {
          id,
          humanId,
          type: node.type,
          label,
          path
        };
        taggedBlocks.push(item);
        byHumanId.set(humanId, [...(byHumanId.get(humanId) ?? []), item]);
      } else if (id && node.type === "heading") {
        coverageGaps.push({
          id,
          type: "heading",
          label,
          path
        });
      }
    }

    node.content?.forEach((child, index) => visit(child, `${path}.${index}`));
  }

  document.content.forEach((node, index) => visit(node, `${index}`));

  const duplicateHumanIds: RequirementHumanIdIssue[] = [...byHumanId.entries()]
    .filter(([, blocks]) => blocks.length > 1)
    .map(([humanId, blocks]) => ({
      humanId,
      severity: "warning",
      message: `${humanId} appears on ${blocks.length} blocks`,
      blocks
    }));
  const formatIssues: RequirementHumanIdIssue[] = [...byHumanId.entries()]
    .filter(([humanId]) => !isRecommendedHumanId(humanId))
    .map(([humanId, blocks]) => ({
      humanId,
      severity: "warning",
      message: `${humanId} does not match the recommended tag pattern`,
      blocks
    }));
  const issueCount = duplicateHumanIds.length + formatIssues.length + coverageGaps.length;

  return {
    taggedCount: taggedBlocks.length,
    duplicateCount: duplicateHumanIds.length,
    formatIssueCount: formatIssues.length,
    coverageGapCount: coverageGaps.length,
    label: issueCount === 0 ? `${taggedBlocks.length} tagged` : `${issueCount} trace ${issueCount === 1 ? "issue" : "issues"}`,
    taggedBlocks,
    duplicateHumanIds,
    formatIssues,
    coverageGaps
  };
}

export function createSectionFoldRanges(document: SDocDocument): SectionFoldRange[] {
  const ranges: SectionFoldRange[] = [];

  for (let index = 0; index < document.content.length; index += 1) {
    const node = document.content[index];
    if (node.type !== "heading") {
      continue;
    }

    const headingId = getNodeId(node);
    const headingLevel = typeof node.attrs?.level === "number" ? node.attrs.level : null;
    if (!headingId || headingLevel === null) {
      continue;
    }

    const hiddenBlockIds: string[] = [];
    for (let childIndex = index + 1; childIndex < document.content.length; childIndex += 1) {
      const candidate = document.content[childIndex];
      if (candidate.type === "heading") {
        const candidateLevel = typeof candidate.attrs?.level === "number" ? candidate.attrs.level : null;
        if (candidateLevel !== null && candidateLevel <= headingLevel) {
          break;
        }
      }

      const blockId = getNodeId(candidate);
      if (blockId) {
        hiddenBlockIds.push(blockId);
      }
    }

    if (hiddenBlockIds.length > 0) {
      ranges.push({
        headingId,
        headingLevel,
        title: getPlainText(node).trim() || headingId,
        hiddenBlockIds
      });
    }
  }

  return ranges;
}

export function pruneCollapsedHeadingIds(collapsedHeadingIds: Set<string>, ranges: SectionFoldRange[]): Set<string> {
  const foldableIds = new Set(ranges.map((range) => range.headingId));
  const nextIds = new Set([...collapsedHeadingIds].filter((id) => foldableIds.has(id)));
  if (nextIds.size === collapsedHeadingIds.size && [...nextIds].every((id) => collapsedHeadingIds.has(id))) {
    return collapsedHeadingIds;
  }

  return nextIds;
}

export function updateCrossReferenceLabel(document: SDocDocument, referenceId: string, label: string): SDocDocument {
  const nextContent = document.content.map((node) => updateCrossReferenceLabelInNode(node, referenceId, label));
  return { ...document, content: nextContent };
}

export function retargetCrossReference(document: SDocDocument, referenceId: string, target: ReferenceTargetSummary): SDocDocument {
  const nextContent = document.content.map((node) => retargetCrossReferenceInNode(node, referenceId, target));
  return { ...document, content: nextContent };
}

export function removeCrossReference(document: SDocDocument, referenceId: string): SDocDocument {
  const nextContent = document.content.map((node) => removeCrossReferenceInNode(node, referenceId));
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

function createReferenceRepairCandidates(reference: BrokenReference, targets: ReferenceTargetSummary[]): ReferenceRepairCandidate[] {
  return targets
    .map((target) => ({
      targetId: target.id,
      label: target.label,
      detail: formatReferenceTargetDetail(target),
      score: scoreReferenceRepairCandidate(reference, target)
    }))
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label) || left.targetId.localeCompare(right.targetId))
    .slice(0, 3);
}

function scoreReferenceRepairCandidate(reference: BrokenReference, target: ReferenceTargetSummary): number {
  const referenceText = normalizeCandidateText(reference.label);
  const targetLabel = normalizeCandidateText(target.label);
  const targetAnchor = normalizeCandidateText(target.anchor ?? "");
  const targetHumanId = normalizeCandidateText(target.humanId ?? "");
  const targetId = normalizeCandidateText(target.id);
  let score = 0;

  if (referenceText.length > 0) {
    if (referenceText === targetLabel) {
      score += 80;
    } else if (targetLabel.includes(referenceText) || referenceText.includes(targetLabel)) {
      score += 45;
    }
    if (referenceText === targetHumanId) {
      score += 90;
    }
    if (referenceText === targetAnchor) {
      score += 70;
    }
  }

  const missingTarget = normalizeCandidateText(reference.targetId);
  if (missingTarget === targetId) {
    score += 100;
  }
  if (targetHumanId.length > 0 && missingTarget === targetHumanId) {
    score += 75;
  }
  if (targetAnchor.length > 0 && missingTarget === targetAnchor) {
    score += 60;
  }

  const referenceTokens = new Set(referenceText.split(/\s+/).filter(Boolean));
  for (const token of targetLabel.split(/\s+/).filter(Boolean)) {
    if (referenceTokens.has(token)) {
      score += 10;
    }
  }

  return score;
}

function formatReferenceTargetDetail(target: ReferenceTargetSummary): string {
  const parts = [target.humanId, target.anchor ? `#${target.anchor}` : "", target.id].filter((value): value is string => !!value);
  return parts.join(" / ");
}

function normalizeCandidateText(value: string): string {
  return value.trim().toLowerCase();
}

function isRecommendedHumanId(value: string): boolean {
  return /^[A-Z0-9][A-Z0-9._-]*$/.test(value);
}

function getVisualDiffLabel(kind: SDocDiffEvent["kind"]): string {
  switch (kind) {
    case "added":
      return "Added";
    case "deleted":
      return "Deleted";
    case "modified":
      return "Modified";
    case "moved":
      return "Moved";
    case "reference-broken":
      return "Broken ref";
  }
}

function getVisualDiffSummary(event: SDocDiffEvent): string {
  switch (event.kind) {
    case "added":
      return `Added ${event.nodeType} ${event.label}`;
    case "deleted":
      return `Deleted ${event.nodeType} ${event.label}`;
    case "modified":
      return `Modified ${event.nodeType} ${event.label}`;
    case "moved":
      return `Moved ${event.nodeType} ${event.label}`;
    case "reference-broken":
      return `Broken reference ${event.label}`;
  }
}

function getVisualDiffDetail(event: SDocDiffEvent): string {
  switch (event.kind) {
    case "added":
      return `Current path: ${event.path}`;
    case "deleted":
      return `Previous path: ${event.path}`;
    case "modified":
      return `${event.changes.join("; ")} at ${event.path}`;
    case "moved":
      return `${event.fromPath} -> ${event.toPath}`;
    case "reference-broken":
      return `Missing target ${event.targetId} at ${event.path}`;
  }
}

interface BlockPreview {
  text: string;
}

function createBlockPreviewMap(document: SDocDocument): Map<string, BlockPreview> {
  const blocks = new Map<string, BlockPreview>();

  function visit(node: SDocNode): void {
    if (isBlockNode(node)) {
      const id = getNodeId(node);
      if (id) {
        blocks.set(id, { text: getReadableBlockText(node) });
      }
    }

    node.content?.forEach(visit);
  }

  document.content.forEach(visit);
  return blocks;
}

function getReadableBlockText(node: SDocNode): string {
  const text = getPlainText(node).replace(/\s+/g, " ").trim();
  if (text.length > 0) {
    return text;
  }

  return `${node.type} ${getNodeId(node) ?? ""}`.trim();
}

function getBaselineDiffText(event: SDocDiffEvent, block: BlockPreview | undefined): string {
  if (event.kind === "added" || event.kind === "reference-broken") {
    return "Not present";
  }

  return block?.text ?? "Not available";
}

function getCurrentDiffText(event: SDocDiffEvent, block: BlockPreview | undefined): string {
  if (event.kind === "deleted") {
    return "Not present";
  }

  if (event.kind === "reference-broken") {
    return `Missing target ${event.targetId}`;
  }

  return block?.text ?? "Not available";
}

function getReviewActionOptions(item: VisualDiffOverlayItem): ReviewActionOption[] {
  switch (item.kind) {
    case "added":
      return [
        {
          kind: "accept",
          availability: "current-state",
          label: "Keep added block",
          description: "Accepting keeps the current document unchanged."
        },
        {
          kind: "reject",
          availability: "available",
          label: "Remove added block",
          description: "Rejecting will remove this current block in a future apply step."
        }
      ];
    case "deleted":
      return [
        {
          kind: "accept",
          availability: "current-state",
          label: "Keep deletion",
          description: "Accepting keeps the current document unchanged."
        },
        {
          kind: "reject",
          availability: "available",
          label: "Restore deleted block",
          description: "Rejecting will restore the baseline block in a future apply step."
        }
      ];
    case "modified":
      return [
        {
          kind: "accept",
          availability: "current-state",
          label: "Keep current version",
          description: "Accepting keeps the current document unchanged."
        },
        {
          kind: "reject",
          availability: "available",
          label: "Restore baseline version",
          description: "Rejecting will restore the baseline block content and attrs in a future apply step."
        }
      ];
    case "moved":
      return [
        {
          kind: "accept",
          availability: "current-state",
          label: "Keep new position",
          description: "Accepting keeps the current document order unchanged."
        },
        {
          kind: "reject",
          availability: "available",
          label: "Restore baseline position",
          description: "Rejecting will restore the baseline parent and order in a future apply step."
        }
      ];
    case "reference-broken":
      return [
        {
          kind: "accept",
          availability: "manual-repair",
          label: "Use reference repair",
          description: "Broken references require explicit retarget or remove actions from the References panel."
        },
        {
          kind: "reject",
          availability: "manual-repair",
          label: "Use reference repair",
          description: "Broken references require explicit retarget or remove actions from the References panel."
        }
      ];
  }
}

function getReviewBatchStatus(result: SDocReviewBatchResult): ReviewBatchConflictSummary["status"] {
  if (result.appliedCount === 0) {
    return result.skippedCount > 0 ? "no-op" : "complete";
  }

  return result.skippedCount > 0 ? "partial" : "complete";
}

function getReviewBatchTitle(action: ReviewActionKind, status: ReviewBatchConflictSummary["status"]): string {
  const label = action === "accept" ? "accept" : "reject";
  switch (status) {
    case "complete":
      return `Batch ${label} complete`;
    case "partial":
      return `Partial batch ${label}`;
    case "no-op":
      return `No batch ${label} applied`;
  }
}

function createReviewBatchConflictItem(failure: SDocReviewBatchFailure): ReviewBatchConflictItem {
  return {
    id: failure.id,
    kind: failure.kind,
    reason: failure.reason,
    message: failure.message
  };
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function getVisualDiffColor(kind: VisualDiffOverlayItem["kind"]): string {
  switch (kind) {
    case "added":
      return "#4f8f5f";
    case "deleted":
      return "#a3473f";
    case "modified":
      return "#b07a2a";
    case "moved":
      return "#4c78a8";
    case "reference-broken":
      return "#c4493d";
  }
}

function getVisualDiffBackground(kind: VisualDiffOverlayItem["kind"]): string {
  switch (kind) {
    case "added":
      return "#eaf6ee";
    case "deleted":
      return "#f8e8e5";
    case "modified":
      return "#fff4dc";
    case "moved":
      return "#e9f0f8";
    case "reference-broken":
      return "#fff1ed";
  }
}

function escapeCssAttribute(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function escapeCssContent(value: string): string {
  return escapeCssAttribute(value).replaceAll("\n", "\\a ");
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

function retargetCrossReferenceInNode(node: SDocNode, referenceId: string, target: ReferenceTargetSummary): SDocNode {
  const content = node.content?.map((child) => retargetCrossReferenceInNode(child, referenceId, target));
  if (node.type === "crossReference" && node.attrs?.id === referenceId) {
    return {
      ...node,
      attrs: {
        ...(node.attrs ?? {}),
        targetId: target.id
      },
      content: [{ type: "text", text: target.label }]
    };
  }

  return content ? { ...node, content } : node;
}

function removeCrossReferenceInNode(node: SDocNode, referenceId: string): SDocNode {
  const content = node.content?.flatMap((child) => {
    if (child.type === "crossReference" && child.attrs?.id === referenceId) {
      return [];
    }

    return [removeCrossReferenceInNode(child, referenceId)];
  });
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
