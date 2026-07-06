import { stableStringify, normalizeDocument } from "@sdoc/format";
import { getNodeId, getPlainText, isBlockNode, validateDocument, type SDocDocument, type SDocNode, type ValidationIssue } from "@sdoc/schema";

export type SDocDiffEvent =
  | {
      kind: "added";
      id: string;
      nodeType: string;
      path: string;
      label: string;
    }
  | {
      kind: "deleted";
      id: string;
      nodeType: string;
      path: string;
      label: string;
    }
  | {
      kind: "moved";
      id: string;
      nodeType: string;
      fromPath: string;
      toPath: string;
      label: string;
    }
  | {
      kind: "modified";
      id: string;
      nodeType: string;
      path: string;
      label: string;
      changes: string[];
    }
  | {
      kind: "reference-broken";
      id: string;
      nodeType: "crossReference";
      path: string;
      label: string;
      targetId: string;
    };

export type SDocReviewAction = "accept" | "reject";

export type SDocReviewActionStatus =
  | "accepted-current"
  | "accepted-added"
  | "accepted-deleted"
  | "accepted-modified"
  | "accepted-moved"
  | "rejected-added"
  | "rejected-deleted"
  | "rejected-modified"
  | "rejected-moved";

export type SDocReviewActionFailureReason = "stale-event" | "unsupported-event" | "validation-failed";

export type SDocReviewActionResult =
  | {
      ok: true;
      status: SDocReviewActionStatus;
      changed: boolean;
      document: SDocDocument;
    }
  | {
      ok: false;
      reason: SDocReviewActionFailureReason;
      message: string;
      issues?: ValidationIssue[];
    };

export interface SDocReviewBatchItem {
  id: string;
  kind: SDocDiffEvent["kind"];
}

export interface SDocReviewBatchFailure {
  id: string;
  kind: SDocDiffEvent["kind"];
  reason: SDocReviewActionFailureReason;
  message: string;
}

export interface SDocReviewBatchResult {
  document: SDocDocument;
  appliedCount: number;
  skippedCount: number;
  failures: SDocReviewBatchFailure[];
}

interface BlockInfo {
  id: string;
  node: SDocNode;
  path: string;
  parentId: string;
  index: number;
  ancestorIds: string[];
  label: string;
  fingerprint: string;
}

interface TableCellSnapshot {
  type: string;
  text: string;
  align: string;
}

interface MutableBlockLocation {
  node: SDocNode;
  parent: SDocDocument | SDocNode;
  index: number;
}

export function diffDocuments(oldDocument: SDocDocument, newDocument: SDocDocument): SDocDiffEvent[] {
  const oldBlocks = flattenBlocks(normalizeDocument(oldDocument));
  const newBlocks = flattenBlocks(normalizeDocument(newDocument));
  const events: SDocDiffEvent[] = [];

  for (const oldBlock of oldBlocks.values()) {
    if (!newBlocks.has(oldBlock.id)) {
      if (hasMissingAncestor(oldBlock, newBlocks)) {
        continue;
      }

      events.push({
        kind: "deleted",
        id: oldBlock.id,
        nodeType: oldBlock.node.type,
        path: oldBlock.path,
        label: oldBlock.label
      });
    }
  }

  for (const newBlock of newBlocks.values()) {
    const oldBlock = oldBlocks.get(newBlock.id);
    if (!oldBlock) {
      if (hasMissingAncestor(newBlock, oldBlocks)) {
        continue;
      }

      events.push({
        kind: "added",
        id: newBlock.id,
        nodeType: newBlock.node.type,
        path: newBlock.path,
        label: newBlock.label
      });
      continue;
    }

    if (oldBlock.parentId !== newBlock.parentId) {
      events.push({
        kind: "moved",
        id: newBlock.id,
        nodeType: newBlock.node.type,
        fromPath: oldBlock.path,
        toPath: newBlock.path,
        label: newBlock.label
      });
    }

    if (oldBlock.fingerprint !== newBlock.fingerprint) {
      events.push({
        kind: "modified",
        id: newBlock.id,
        nodeType: newBlock.node.type,
        path: newBlock.path,
        label: newBlock.label,
        changes: summarizeChanges(oldBlock.node, newBlock.node)
      });
    }
  }

  for (const movedId of findSiblingReorders(oldBlocks, newBlocks)) {
    const oldBlock = oldBlocks.get(movedId);
    const newBlock = newBlocks.get(movedId);
    if (!oldBlock || !newBlock || oldBlock.parentId !== newBlock.parentId) {
      continue;
    }

    events.push({
      kind: "moved",
      id: newBlock.id,
      nodeType: newBlock.node.type,
      fromPath: oldBlock.path,
      toPath: newBlock.path,
      label: newBlock.label
    });
  }

  for (const brokenRef of findBrokenReferences(newDocument, newBlocks)) {
    events.push(brokenRef);
  }

  return sortEvents(events);
}

export function renderDiffEvents(events: SDocDiffEvent[]): string[] {
  return events.map((event) => {
    switch (event.kind) {
      case "added":
        return `ADDED ${event.nodeType} ${event.id} at ${event.path}: ${event.label}`;
      case "deleted":
        return `DELETED ${event.nodeType} ${event.id} at ${event.path}: ${event.label}`;
      case "moved":
        return `MOVED ${event.nodeType} ${event.id} from ${event.fromPath} to ${event.toPath}: ${event.label}`;
      case "modified":
        return `MODIFIED ${event.nodeType} ${event.id} at ${event.path}: ${event.changes.join("; ")}`;
      case "reference-broken":
        return `BROKEN_REF ${event.nodeType} ${event.id} at ${event.path}: missing ${event.targetId}`;
    }
  });
}

export function renderReadableDiffEvents(events: SDocDiffEvent[]): string[] {
  return events.map((event) => {
    switch (event.kind) {
      case "added":
        return `Added ${formatReadableSubject(event)} at ${event.path}`;
      case "deleted":
        return `Deleted ${formatReadableSubject(event)} from ${event.path}`;
      case "moved":
        return `Moved ${formatReadableSubject(event)} from ${event.fromPath} to ${event.toPath}`;
      case "modified":
        return `Modified ${formatReadableSubject(event)} at ${event.path}: ${event.changes.join("; ")}`;
      case "reference-broken":
        return `Broken ${humanizeNodeType(event.nodeType)} ${event.label} (${event.id}) at ${event.path}: missing ${event.targetId}`;
    }
  });
}

export function applyDiffEventAction(
  baselineDocument: SDocDocument,
  currentDocument: SDocDocument,
  event: SDocDiffEvent,
  action: SDocReviewAction
): SDocReviewActionResult {
  const baseline = normalizeDocument(baselineDocument);
  const current = normalizeDocument(currentDocument);

  if (!hasCurrentEvent(baseline, current, event)) {
    return {
      ok: false,
      reason: "stale-event",
      message: `Cannot ${action} ${event.kind} ${event.id}: review event is stale. Recompute the diff before applying.`
    };
  }

  if (event.kind === "reference-broken") {
    return {
      ok: false,
      reason: "unsupported-event",
      message: "Broken references require explicit retarget or remove actions from the References repair workflow."
    };
  }

  if (action === "accept") {
    return { ok: true, status: "accepted-current", changed: false, document: current };
  }

  const rejected = rejectDiffEvent(baseline, current, event);
  if (!rejected.ok) {
    return rejected;
  }

  const normalized = normalizeDocument(rejected.document);
  const validation = validateDocument(normalized);
  if (!validation.ok) {
    return {
      ok: false,
      reason: "validation-failed",
      message: `Rejecting ${event.kind} ${event.id} produced an invalid SDoc document.`,
      issues: validation.issues
    };
  }

  return {
    ok: true,
    status: rejected.status,
    changed: stableStringify(normalized) !== stableStringify(current),
    document: normalized
  };
}

export function applyDiffEventAcceptanceToBaseline(
  baselineDocument: SDocDocument,
  currentDocument: SDocDocument,
  event: SDocDiffEvent
): SDocReviewActionResult {
  const baseline = normalizeDocument(baselineDocument);
  const current = normalizeDocument(currentDocument);

  if (!hasCurrentEvent(baseline, current, event)) {
    return {
      ok: false,
      reason: "stale-event",
      message: `Cannot accept ${event.kind} ${event.id}: review event is stale. Recompute the diff before applying.`
    };
  }

  if (event.kind === "reference-broken") {
    return {
      ok: false,
      reason: "unsupported-event",
      message: "Broken references require explicit retarget or remove actions from the References repair workflow."
    };
  }

  const accepted = acceptDiffEventIntoBaseline(baseline, current, event);
  if (!accepted.ok) {
    return accepted;
  }

  const normalized = normalizeDocument(accepted.document);
  const validation = validateDocument(normalized);
  if (!validation.ok) {
    return {
      ok: false,
      reason: "validation-failed",
      message: `Accepting ${event.kind} ${event.id} produced an invalid SDoc baseline.`,
      issues: validation.issues
    };
  }

  return {
    ok: true,
    status: accepted.status,
    changed: stableStringify(normalized) !== stableStringify(baseline),
    document: normalized
  };
}

export function applyDiffEventBatchAction(
  baselineDocument: SDocDocument,
  currentDocument: SDocDocument,
  items: SDocReviewBatchItem[],
  action: SDocReviewAction
): SDocReviewBatchResult {
  if (action === "accept") {
    return applyDiffEventBatchAcceptanceToBaseline(baselineDocument, currentDocument, items);
  }

  let current = normalizeDocument(currentDocument);
  const baseline = normalizeDocument(baselineDocument);
  const failures: SDocReviewBatchFailure[] = [];
  let appliedCount = 0;

  for (const item of items) {
    const event = findCurrentBatchEvent(baseline, current, item);
    if (!event) {
      failures.push({
        ...item,
        reason: "stale-event",
        message: `Cannot reject ${item.kind} ${item.id}: review event is stale or already resolved.`
      });
      continue;
    }

    const result = applyDiffEventAction(baseline, current, event, "reject");
    if (!result.ok) {
      failures.push({ ...item, reason: result.reason, message: result.message });
      continue;
    }

    current = result.document;
    appliedCount += 1;
  }

  return {
    document: current,
    appliedCount,
    skippedCount: failures.length,
    failures
  };
}

export function applyDiffEventBatchAcceptanceToBaseline(
  baselineDocument: SDocDocument,
  currentDocument: SDocDocument,
  items: SDocReviewBatchItem[]
): SDocReviewBatchResult {
  let baseline = normalizeDocument(baselineDocument);
  const current = normalizeDocument(currentDocument);
  const failures: SDocReviewBatchFailure[] = [];
  let appliedCount = 0;

  for (const item of items) {
    const event = findCurrentBatchEvent(baseline, current, item);
    if (!event) {
      failures.push({
        ...item,
        reason: "stale-event",
        message: `Cannot accept ${item.kind} ${item.id}: review event is stale or already resolved.`
      });
      continue;
    }

    const result = applyDiffEventAcceptanceToBaseline(baseline, current, event);
    if (!result.ok) {
      failures.push({ ...item, reason: result.reason, message: result.message });
      continue;
    }

    baseline = result.document;
    appliedCount += 1;
  }

  return {
    document: baseline,
    appliedCount,
    skippedCount: failures.length,
    failures
  };
}

function findCurrentBatchEvent(baseline: SDocDocument, current: SDocDocument, item: SDocReviewBatchItem): SDocDiffEvent | undefined {
  return diffDocuments(baseline, current).find((event) => event.id === item.id && event.kind === item.kind);
}

function acceptDiffEventIntoBaseline(
  baseline: SDocDocument,
  current: SDocDocument,
  event: Exclude<SDocDiffEvent, { kind: "reference-broken" }>
): Extract<SDocReviewActionResult, { ok: true }> | Extract<SDocReviewActionResult, { ok: false }> {
  switch (event.kind) {
    case "added": {
      const currentLocation = findBlockLocation(current, event.id);
      if (!currentLocation) {
        return staleMutationFailure(event, "added block is no longer present in the current document");
      }

      const document = cloneDocument(baseline);
      const targetParent = findMatchingParent(document, current, currentLocation.parent);
      if (!targetParent) {
        return staleMutationFailure(event, "current parent is not available in the baseline document");
      }

      insertBlock(targetParent, currentLocation.index, cloneNode(currentLocation.node));
      return { ok: true, status: "accepted-added", changed: true, document };
    }
    case "deleted": {
      const document = cloneDocument(baseline);
      if (!removeBlockById(document, event.id)) {
        return staleMutationFailure(event, "deleted block is no longer present in the baseline document");
      }

      return { ok: true, status: "accepted-deleted", changed: true, document };
    }
    case "modified": {
      const currentLocation = findBlockLocation(current, event.id);
      if (!currentLocation) {
        return staleMutationFailure(event, "current block is no longer available");
      }

      const document = cloneDocument(baseline);
      const baselineLocation = findBlockLocation(document, event.id);
      if (!baselineLocation) {
        return staleMutationFailure(event, "baseline block is no longer available");
      }

      baselineLocation.parent.content![baselineLocation.index] = cloneNode(currentLocation.node);
      return { ok: true, status: "accepted-modified", changed: true, document };
    }
    case "moved": {
      const currentLocation = findBlockLocation(current, event.id);
      if (!currentLocation) {
        return staleMutationFailure(event, "moved block is no longer present in the current document");
      }

      const document = cloneDocument(baseline);
      const movedNode = removeBlockById(document, event.id);
      if (!movedNode) {
        return staleMutationFailure(event, "moved block is no longer present in the baseline document");
      }

      const targetParent = findMatchingParent(document, current, currentLocation.parent);
      if (!targetParent) {
        return staleMutationFailure(event, "current parent is not available in the baseline document");
      }

      insertBlock(targetParent, currentLocation.index, movedNode);
      return { ok: true, status: "accepted-moved", changed: true, document };
    }
  }
}

function rejectDiffEvent(
  baseline: SDocDocument,
  current: SDocDocument,
  event: Exclude<SDocDiffEvent, { kind: "reference-broken" }>
): Extract<SDocReviewActionResult, { ok: true }> | Extract<SDocReviewActionResult, { ok: false }> {
  switch (event.kind) {
    case "added": {
      const document = cloneDocument(current);
      if (!removeBlockById(document, event.id)) {
        return staleMutationFailure(event, "added block is no longer present in the current document");
      }

      return { ok: true, status: "rejected-added", changed: true, document };
    }
    case "deleted": {
      const baselineLocation = findBlockLocation(baseline, event.id);
      if (!baselineLocation) {
        return staleMutationFailure(event, "deleted block is no longer present in the baseline document");
      }

      const document = cloneDocument(current);
      const targetParent = findMatchingParent(document, baseline, baselineLocation.parent);
      if (!targetParent) {
        return staleMutationFailure(event, "baseline parent is not available in the current document");
      }

      insertBlock(targetParent, baselineLocation.index, cloneNode(baselineLocation.node));
      return { ok: true, status: "rejected-deleted", changed: true, document };
    }
    case "modified": {
      const baselineLocation = findBlockLocation(baseline, event.id);
      if (!baselineLocation) {
        return staleMutationFailure(event, "baseline block is no longer available");
      }

      const document = cloneDocument(current);
      const currentLocation = findBlockLocation(document, event.id);
      if (!currentLocation) {
        return staleMutationFailure(event, "current block is no longer available");
      }

      currentLocation.parent.content![currentLocation.index] = cloneNode(baselineLocation.node);
      return { ok: true, status: "rejected-modified", changed: true, document };
    }
    case "moved": {
      const baselineLocation = findBlockLocation(baseline, event.id);
      if (!baselineLocation) {
        return staleMutationFailure(event, "baseline block position is no longer available");
      }

      const document = cloneDocument(current);
      const movedNode = removeBlockById(document, event.id);
      if (!movedNode) {
        return staleMutationFailure(event, "moved block is no longer present in the current document");
      }

      const targetParent = findMatchingParent(document, baseline, baselineLocation.parent);
      if (!targetParent) {
        return staleMutationFailure(event, "baseline parent is not available in the current document");
      }

      insertBlock(targetParent, baselineLocation.index, movedNode);
      return { ok: true, status: "rejected-moved", changed: true, document };
    }
  }
}

function hasCurrentEvent(baseline: SDocDocument, current: SDocDocument, event: SDocDiffEvent): boolean {
  const expected = stableStringify(event);
  return diffDocuments(baseline, current).some((currentEvent) => stableStringify(currentEvent) === expected);
}

function findBlockLocation(document: SDocDocument, id: string): MutableBlockLocation | null {
  return findBlockLocationInParent(document, id);
}

function findBlockLocationInParent(parent: SDocDocument | SDocNode, id: string): MutableBlockLocation | null {
  const content = parent.content ?? [];
  for (let index = 0; index < content.length; index += 1) {
    const node = content[index];
    if (isBlockNode(node) && getNodeId(node) === id) {
      return { node, parent, index };
    }

    const nested = findBlockLocationInParent(node, id);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function findMatchingParent(document: SDocDocument, baseline: SDocDocument, baselineParent: SDocDocument | SDocNode): SDocDocument | SDocNode | null {
  if (baselineParent === baseline) {
    return document;
  }

  const parentId = getNodeId(baselineParent);
  if (!parentId) {
    return null;
  }

  return findBlockLocation(document, parentId)?.node ?? null;
}

function removeBlockById(document: SDocDocument, id: string): SDocNode | null {
  return removeBlockFromParent(document, id);
}

function removeBlockFromParent(parent: SDocDocument | SDocNode, id: string): SDocNode | null {
  const content = parent.content ?? [];
  for (let index = 0; index < content.length; index += 1) {
    const node = content[index];
    if (isBlockNode(node) && getNodeId(node) === id) {
      const [removed] = content.splice(index, 1);
      return removed ?? null;
    }

    const nested = removeBlockFromParent(node, id);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function insertBlock(parent: SDocDocument | SDocNode, index: number, node: SDocNode): void {
  parent.content ??= [];
  parent.content.splice(Math.min(index, parent.content.length), 0, node);
}

function cloneDocument(document: SDocDocument): SDocDocument {
  return JSON.parse(JSON.stringify(document)) as SDocDocument;
}

function cloneNode(node: SDocNode): SDocNode {
  return JSON.parse(JSON.stringify(node)) as SDocNode;
}

function staleMutationFailure(event: SDocDiffEvent, detail: string): Extract<SDocReviewActionResult, { ok: false }> {
  return {
    ok: false,
    reason: "stale-event",
    message: `Cannot reject ${event.kind} ${event.id}: ${detail}. Recompute the diff before applying.`
  };
}

function flattenBlocks(document: SDocDocument): Map<string, BlockInfo> {
  const blocks = new Map<string, BlockInfo>();
  const rootId = document.attrs.id;

  function visit(node: SDocNode, parentId: string, index: number, ancestorIds: string[]): void {
    if (isBlockNode(node)) {
      const id = getNodeId(node);
      if (id) {
        blocks.set(id, {
          id,
          node,
          path: `${parentId}[${index}]/${id}`,
          parentId,
          index,
          ancestorIds,
          label: getBlockLabel(node),
          fingerprint: fingerprintBlock(node)
        });
      }

      if (node.type === "table") {
        return;
      }

      const nextParentId = id ?? parentId;
      const nextAncestorIds = id ? [...ancestorIds, id] : ancestorIds;
      let childBlockIndex = 0;
      node.content?.forEach((child) => {
        if (isBlockNode(child)) {
          visit(child, nextParentId, childBlockIndex, nextAncestorIds);
          childBlockIndex += 1;
        } else {
          visitInline(child);
        }
      });

      return;
    }

    visitInline(node);
  }

  function visitInline(node: SDocNode): void {
    node.content?.forEach(visitInline);
  }

  document.content.forEach((node, index) => visit(node, rootId, index, []));
  return blocks;
}

function hasMissingAncestor(block: BlockInfo, otherBlocks: Map<string, BlockInfo>): boolean {
  return block.ancestorIds.some((ancestorId) => !otherBlocks.has(ancestorId));
}

function findSiblingReorders(oldBlocks: Map<string, BlockInfo>, newBlocks: Map<string, BlockInfo>): Set<string> {
  const oldByParent = groupByParent(oldBlocks);
  const newByParent = groupByParent(newBlocks);
  const moved = new Set<string>();

  for (const [parentId, oldSequence] of oldByParent) {
    const newSequence = newByParent.get(parentId);
    if (!newSequence) {
      continue;
    }

    const oldCommon = oldSequence.filter((id) => newBlocks.has(id) && newBlocks.get(id)?.parentId === parentId);
    const newCommon = newSequence.filter((id) => oldBlocks.has(id) && oldBlocks.get(id)?.parentId === parentId);
    const stable = new Set(longestCommonSubsequence(oldCommon, newCommon));

    for (const id of oldCommon) {
      if (!stable.has(id)) {
        moved.add(id);
      }
    }
  }

  return moved;
}

function groupByParent(blocks: Map<string, BlockInfo>): Map<string, string[]> {
  const groups = new Map<string, BlockInfo[]>();
  for (const block of blocks.values()) {
    const group = groups.get(block.parentId) ?? [];
    group.push(block);
    groups.set(block.parentId, group);
  }

  const result = new Map<string, string[]>();
  for (const [parentId, group] of groups) {
    result.set(
      parentId,
      group.sort((a, b) => a.index - b.index).map((block) => block.id)
    );
  }

  return result;
}

function longestCommonSubsequence(left: string[], right: string[]): string[] {
  const lengths = Array.from({ length: left.length + 1 }, () => Array<number>(right.length + 1).fill(0));

  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      lengths[i][j] =
        left[i] === right[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }

  const sequence: string[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      sequence.push(left[i]);
      i += 1;
      j += 1;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }

  return sequence;
}

function fingerprintBlock(node: SDocNode): string {
  if (node.type === "table") {
    return stableStringify({
      type: node.type,
      attrs: omitId(node.attrs ?? {}),
      rows: getTableSnapshot(node)
    });
  }

  return stableStringify(stripNestedBlocks(node));
}

function stripNestedBlocks(node: SDocNode): SDocNode {
  const stripped: SDocNode = {
    type: node.type,
    attrs: node.attrs,
    text: node.text,
    marks: node.marks
  };

  const inlineContent = node.content?.filter((child) => !isBlockNode(child)).map(stripNestedBlocks);
  if (inlineContent && inlineContent.length > 0) {
    stripped.content = inlineContent;
  }

  return stripped;
}

function summarizeChanges(oldNode: SDocNode, newNode: SDocNode): string[] {
  const changes: string[] = [];

  if (oldNode.type !== newNode.type) {
    changes.push(`type changed ${oldNode.type} -> ${newNode.type}`);
  }

  changes.push(...summarizeHumanIdChange(oldNode, newNode));

  if (oldNode.type === "table" && newNode.type === "table") {
    changes.push(...summarizeTableChanges(oldNode, newNode));
    return changes.length > 0 ? changes : ["table changed"];
  }

  if (oldNode.type === "diagram" && newNode.type === "diagram") {
    changes.push(...summarizeDiagramChanges(oldNode, newNode));
    return changes.length > 0 ? changes : ["diagram changed"];
  }

  if (oldNode.type === "dataGrid" && newNode.type === "dataGrid") {
    changes.push(...summarizeDataGridChanges(oldNode, newNode));
    return changes.length > 0 ? changes : ["data grid changed"];
  }

  const oldText = getPlainText(oldNode);
  const newText = getPlainText(newNode);
  if (oldText !== newText) {
    changes.push(summarizeTextChange(oldText, newText));
  }

  const oldAttrs = stableStringify(omitDiffAttrs(oldNode));
  const newAttrs = stableStringify(omitDiffAttrs(newNode));
  if (oldAttrs !== newAttrs) {
    changes.push("attrs changed");
  }

  return changes.length > 0 ? changes : ["content changed"];
}

function summarizeHumanIdChange(oldNode: SDocNode, newNode: SDocNode): string[] {
  const oldHumanId = typeof oldNode.attrs?.humanId === "string" ? oldNode.attrs.humanId : "";
  const newHumanId = typeof newNode.attrs?.humanId === "string" ? newNode.attrs.humanId : "";
  return oldHumanId !== newHumanId ? [`humanId changed ${quote(oldHumanId)} -> ${quote(newHumanId)}`] : [];
}

function summarizeDiagramChanges(oldNode: SDocNode, newNode: SDocNode): string[] {
  const oldKind = typeof oldNode.attrs?.kind === "string" ? oldNode.attrs.kind : "mermaid";
  const newKind = typeof newNode.attrs?.kind === "string" ? newNode.attrs.kind : "mermaid";
  if (oldKind === "drawio" || newKind === "drawio") {
    const changes: string[] = [];
    if (oldKind !== newKind) {
      changes.push(`diagram kind changed ${oldKind} -> ${newKind}`);
    }

    const oldSourceAssetId = typeof oldNode.attrs?.sourceAssetId === "string" ? oldNode.attrs.sourceAssetId : "";
    const newSourceAssetId = typeof newNode.attrs?.sourceAssetId === "string" ? newNode.attrs.sourceAssetId : "";
    if (oldSourceAssetId !== newSourceAssetId) {
      changes.push(`source asset changed ${quote(oldSourceAssetId)} -> ${quote(newSourceAssetId)}`);
    }

    const oldPreviewAssetId = typeof oldNode.attrs?.previewAssetId === "string" ? oldNode.attrs.previewAssetId : "";
    const newPreviewAssetId = typeof newNode.attrs?.previewAssetId === "string" ? newNode.attrs.previewAssetId : "";
    if (oldPreviewAssetId !== newPreviewAssetId) {
      changes.push(`preview asset changed ${quote(oldPreviewAssetId)} -> ${quote(newPreviewAssetId)}`);
    }

    const oldAttrs = stableStringify(omitDrawioDiffAttrs(oldNode));
    const newAttrs = stableStringify(omitDrawioDiffAttrs(newNode));
    if (oldAttrs !== newAttrs) {
      changes.push("attrs changed");
    }

    return changes.length > 0 ? changes : ["diagram changed"];
  }

  const oldText = getPlainText(oldNode);
  const newText = getPlainText(newNode);
  const changes: string[] = [];
  if (oldText !== newText) {
    changes.push(summarizeTextChange(oldText, newText));
  }

  const oldAttrs = stableStringify(omitDiffAttrs(oldNode));
  const newAttrs = stableStringify(omitDiffAttrs(newNode));
  if (oldAttrs !== newAttrs) {
    changes.push("attrs changed");
  }

  return changes.length > 0 ? changes : ["content changed"];
}

function summarizeTableChanges(oldNode: SDocNode, newNode: SDocNode): string[] {
  const oldRows = getTableSnapshot(oldNode);
  const newRows = getTableSnapshot(newNode);
  const changes: string[] = [];
  const oldColumnCount = getMaxColumnCount(oldRows);
  const newColumnCount = getMaxColumnCount(newRows);
  const oldCaption = getStringAttr(oldNode, "caption");
  const newCaption = getStringAttr(newNode, "caption");

  if (oldCaption !== newCaption) {
    changes.push(`caption changed ${quote(oldCaption)} -> ${quote(newCaption)}`);
  }

  if (oldRows.length !== newRows.length) {
    changes.push(`rows changed ${oldRows.length} -> ${newRows.length}`);
  }

  if (oldColumnCount !== newColumnCount) {
    changes.push(`columns changed ${oldColumnCount} -> ${newColumnCount}`);
  }

  const rowCount = Math.max(oldRows.length, newRows.length);
  const columnCount = Math.max(oldColumnCount, newColumnCount);
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const oldValue = oldRows[rowIndex]?.[columnIndex] ?? "";
      const newValue = newRows[rowIndex]?.[columnIndex];
      if (!oldValue || !newValue) {
        continue;
      }

      if (oldValue.type !== newValue.type) {
        changes.push(`cell ${rowIndex + 1},${columnIndex + 1} role changed ${oldValue.type} -> ${newValue.type}`);
      }

      if (oldValue.align !== newValue.align) {
        changes.push(`cell ${rowIndex + 1},${columnIndex + 1} alignment changed ${quote(oldValue.align)} -> ${quote(newValue.align)}`);
      }

      if (oldValue.text !== newValue.text) {
        changes.push(`cell ${rowIndex + 1},${columnIndex + 1} changed ${quote(oldValue.text)} -> ${quote(newValue.text)}`);
      }
    }
  }

  return changes.length > 0 ? changes : ["table changed"];
}

function summarizeDataGridChanges(oldNode: SDocNode, newNode: SDocNode): string[] {
  const changes: string[] = [];
  const oldSourceAssetId = getStringAttr(oldNode, "sourceAssetId");
  const newSourceAssetId = getStringAttr(newNode, "sourceAssetId");
  if (oldSourceAssetId !== newSourceAssetId) {
    changes.push(`source asset changed ${quote(oldSourceAssetId)} -> ${quote(newSourceAssetId)}`);
  }

  const oldFormat = getStringAttr(oldNode, "format");
  const newFormat = getStringAttr(newNode, "format");
  if (oldFormat !== newFormat) {
    changes.push(`format changed ${quote(oldFormat)} -> ${quote(newFormat)}`);
  }

  const oldTitle = getStringAttr(oldNode, "title");
  const newTitle = getStringAttr(newNode, "title");
  if (oldTitle !== newTitle) {
    changes.push(`title changed ${quote(oldTitle)} -> ${quote(newTitle)}`);
  }

  const oldCaption = getStringAttr(oldNode, "caption");
  const newCaption = getStringAttr(newNode, "caption");
  if (oldCaption !== newCaption) {
    changes.push(`caption changed ${quote(oldCaption)} -> ${quote(newCaption)}`);
  }

  const oldAttrs = stableStringify(omitDataGridDiffAttrs(oldNode));
  const newAttrs = stableStringify(omitDataGridDiffAttrs(newNode));
  if (oldAttrs !== newAttrs) {
    changes.push("attrs changed");
  }

  return changes;
}

function getStringAttr(node: SDocNode, name: string): string {
  const value = node.attrs?.[name];
  return typeof value === "string" ? value : "";
}

function getTableRows(node: SDocNode): string[][] {
  return getTableSnapshot(node).map((row) => row.map((cell) => cell.text));
}

function getTableSnapshot(node: SDocNode): TableCellSnapshot[][] {
  return (node.content ?? [])
    .filter((row) => row.type === "tableRow")
    .map((row) =>
      (row.content ?? [])
        .filter((cell) => cell.type === "tableCell" || cell.type === "tableHeader")
        .map((cell) => ({
          type: cell.type,
          text: getPlainText(cell).trim(),
          align: getTableCellAlign(cell)
        }))
    );
}

function getTableCellAlign(node: SDocNode): string {
  const align = node.attrs?.align;
  return typeof align === "string" ? align : "";
}

function getMaxColumnCount(rows: unknown[][]): number {
  return Math.max(0, ...rows.map((row) => row.length));
}

type WordDiffKind = "same" | "added" | "deleted";

interface WordDiffSegment {
  kind: WordDiffKind;
  tokens: string[];
}

function summarizeTextChange(oldText: string, newText: string): string {
  const oldTokens = tokenizeWords(oldText);
  const newTokens = tokenizeWords(newText);
  const segments = diffWordTokens(oldTokens, newTokens);
  const hasWordChange = segments.some((segment) => segment.kind !== "same");
  if (!hasWordChange) {
    return `text changed ${quote(oldText)} -> ${quote(newText)}`;
  }

  return `text changed ${quote(formatWordDiff(segments))}`;
}

function tokenizeWords(value: string): string[] {
  return value.trim().length > 0 ? value.trim().split(/\s+/) : [];
}

function diffWordTokens(oldTokens: string[], newTokens: string[]): WordDiffSegment[] {
  const lengths = Array.from({ length: oldTokens.length + 1 }, () => Array<number>(newTokens.length + 1).fill(0));

  for (let i = oldTokens.length - 1; i >= 0; i -= 1) {
    for (let j = newTokens.length - 1; j >= 0; j -= 1) {
      lengths[i][j] =
        oldTokens[i] === newTokens[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }

  const segments: WordDiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < oldTokens.length && j < newTokens.length) {
    if (oldTokens[i] === newTokens[j]) {
      pushWordDiffSegment(segments, "same", oldTokens[i]);
      i += 1;
      j += 1;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      pushWordDiffSegment(segments, "deleted", oldTokens[i]);
      i += 1;
    } else {
      pushWordDiffSegment(segments, "added", newTokens[j]);
      j += 1;
    }
  }

  while (i < oldTokens.length) {
    pushWordDiffSegment(segments, "deleted", oldTokens[i]);
    i += 1;
  }

  while (j < newTokens.length) {
    pushWordDiffSegment(segments, "added", newTokens[j]);
    j += 1;
  }

  return segments;
}

function pushWordDiffSegment(segments: WordDiffSegment[], kind: WordDiffKind, token: string): void {
  const last = segments[segments.length - 1];
  if (last?.kind === kind) {
    last.tokens.push(token);
    return;
  }

  segments.push({ kind, tokens: [token] });
}

function formatWordDiff(segments: WordDiffSegment[]): string {
  return segments
    .map((segment) => {
      const text = segment.tokens.join(" ");
      switch (segment.kind) {
        case "same":
          return text;
        case "added":
          return `[+${text}+]`;
        case "deleted":
          return `[-${text}-]`;
      }
    })
    .join(" ")
    .trim();
}

function findBrokenReferences(document: SDocDocument, blocks: Map<string, BlockInfo>): SDocDiffEvent[] {
  const events: SDocDiffEvent[] = [];

  function visit(node: SDocNode, path: number[]): void {
    if (node.type === "crossReference") {
      const targetId = node.attrs?.targetId;
      const refId = node.attrs?.id;
      if (typeof targetId === "string" && !blocks.has(targetId)) {
        events.push({
          kind: "reference-broken",
          id: typeof refId === "string" ? refId : `ref@${path.join(".")}`,
          nodeType: "crossReference",
          path: path.join("."),
          label: getPlainText(node),
          targetId
        });
      }
    }

    node.content?.forEach((child, index) => visit(child, [...path, index]));
  }

  document.content.forEach((node, index) => visit(node, [index]));
  return events;
}

function getBlockLabel(node: SDocNode): string {
  if (node.type === "table") {
    const rows = getTableRows(node);
    return quote(`table ${rows.length}x${getMaxColumnCount(rows)}`);
  }

  if (node.type === "dataGrid") {
    const title = getStringAttr(node, "title");
    const sourceAssetId = getStringAttr(node, "sourceAssetId");
    return quote(title || `data grid ${sourceAssetId}`);
  }

  const text = getPlainText(node).trim();
  if (text.length > 0) {
    return quote(text.length > 80 ? `${text.slice(0, 77)}...` : text);
  }

  return quote(String(node.attrs?.anchor ?? node.attrs?.id ?? node.type));
}

function formatReadableSubject(event: Extract<SDocDiffEvent, { nodeType: string; label: string; id: string }>): string {
  return `${humanizeNodeType(event.nodeType)} ${event.label} (${event.id})`;
}

function humanizeNodeType(nodeType: string): string {
  return nodeType.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

function omitId(attrs: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, ...rest } = attrs;
  return rest;
}

function omitDiffAttrs(node: SDocNode): Record<string, unknown> {
  const attrs = omitId(node.attrs ?? {});
  const { humanId: _humanId, ...attrsWithoutHumanId } = attrs;
  if (node.type === "equationBlock" || node.type === "equation") {
    const { latex: _latex, ...rest } = attrsWithoutHumanId;
    return rest;
  }

  if (node.type === "diagram") {
    const { source: _source, ...rest } = attrsWithoutHumanId;
    return rest;
  }
  return attrsWithoutHumanId;
}

function omitDrawioDiffAttrs(node: SDocNode): Record<string, unknown> {
  const attrs = omitId(node.attrs ?? {});
  const { humanId: _humanId, sourceAssetId: _sourceAssetId, previewAssetId: _previewAssetId, ...rest } = attrs;
  return rest;
}

function omitDataGridDiffAttrs(node: SDocNode): Record<string, unknown> {
  const attrs = omitId(node.attrs ?? {});
  const {
    humanId: _humanId,
    sourceAssetId: _sourceAssetId,
    format: _format,
    title: _title,
    caption: _caption,
    ...rest
  } = attrs;
  return rest;
}

function quote(value: string): string {
  return `"${value.replaceAll('"', '\\"')}"`;
}

function sortEvents(events: SDocDiffEvent[]): SDocDiffEvent[] {
  const priority: Record<SDocDiffEvent["kind"], number> = {
    deleted: 0,
    added: 1,
    moved: 2,
    modified: 3,
    "reference-broken": 4
  };

  return [...events].sort((a, b) => {
    const priorityDiff = priority[a.kind] - priority[b.kind];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return "path" in a && "path" in b ? a.path.localeCompare(b.path) : a.id.localeCompare(b.id);
  });
}
