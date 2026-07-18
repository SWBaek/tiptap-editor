export type NativeWorkspaceEntryKind = "folder" | "sdoc-file" | "unpacked-sdoc-folder";

export interface NativeWorkspaceEntry {
  name: string;
  path: string;
  kind: NativeWorkspaceEntryKind;
  children?: NativeWorkspaceEntry[];
  sizeBytes?: number;
  modifiedAtMs?: number;
}

export interface NativeWorkspaceMutationResult {
  status: "created" | "renamed" | "trashed";
  path: string;
  relativePath: string;
  kind: "folder" | "sdoc-file";
  message: string;
}

export type NativeWorkspaceWatchEventKind = "created" | "modified" | "removed" | "renamed" | "accessed" | "other" | "error";

export interface NativeWorkspaceWatchStartResult {
  watchId: string;
  rootPath: string;
}

export interface NativeWorkspaceWatchEvent {
  watchId: string;
  kind: NativeWorkspaceWatchEventKind;
  path: string;
  isSdoc: boolean;
  occurredAtMs: number;
  message?: string;
}

export function sortWorkspaceEntries(entries: NativeWorkspaceEntry[]): NativeWorkspaceEntry[] {
  return entries
    .map((entry) => entry.kind === "folder" ? { ...entry, children: sortWorkspaceEntries(entry.children ?? []) } : { ...entry })
    .sort((left, right) => {
      const kindDifference = getWorkspaceEntryKindOrder(left.kind) - getWorkspaceEntryKindOrder(right.kind);
      if (kindDifference !== 0) {
        return kindDifference;
      }

      return left.name.localeCompare(right.name, undefined, { sensitivity: "base", numeric: true });
    });
}

export function getWorkspaceEntryLabel(entry: NativeWorkspaceEntry): string {
  return entry.kind === "unpacked-sdoc-folder" ? `${entry.name} (unpacked)` : entry.name;
}

export function isWorkspaceEntry(value: unknown): value is NativeWorkspaceEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Record<string, unknown>;
  const hasValidChildren = entry.children === undefined || (Array.isArray(entry.children) && entry.children.every(isWorkspaceEntry));
  return (
    typeof entry.name === "string" &&
    typeof entry.path === "string" &&
    (entry.kind === "folder" || entry.kind === "sdoc-file" || entry.kind === "unpacked-sdoc-folder") &&
    hasValidChildren &&
    (entry.kind !== "folder" || Array.isArray(entry.children)) &&
    (entry.kind === "folder" || entry.children === undefined) &&
    (entry.sizeBytes === undefined || typeof entry.sizeBytes === "number") &&
    (entry.modifiedAtMs === undefined || typeof entry.modifiedAtMs === "number")
  );
}

export function isWorkspaceMutationResult(value: unknown): value is NativeWorkspaceMutationResult {
  if (!value || typeof value !== "object") {
    return false;
  }
  const result = value as Record<string, unknown>;
  return (
    (result.status === "created" || result.status === "renamed" || result.status === "trashed") &&
    typeof result.path === "string" &&
    typeof result.relativePath === "string" &&
    (result.kind === "folder" || result.kind === "sdoc-file") &&
    typeof result.message === "string"
  );
}

export function isWorkspaceWatchStartResult(value: unknown): value is NativeWorkspaceWatchStartResult {
  if (!value || typeof value !== "object") {
    return false;
  }
  const result = value as Record<string, unknown>;
  return typeof result.watchId === "string" && typeof result.rootPath === "string";
}

export function isWorkspaceWatchEvent(value: unknown): value is NativeWorkspaceWatchEvent {
  if (!value || typeof value !== "object") {
    return false;
  }
  const event = value as Record<string, unknown>;
  return (
    typeof event.watchId === "string" &&
    isWorkspaceWatchEventKind(event.kind) &&
    typeof event.path === "string" &&
    typeof event.isSdoc === "boolean" &&
    typeof event.occurredAtMs === "number" &&
    (event.message === undefined || typeof event.message === "string")
  );
}

function isWorkspaceWatchEventKind(value: unknown): value is NativeWorkspaceWatchEventKind {
  return value === "created" || value === "modified" || value === "removed" || value === "renamed" ||
    value === "accessed" || value === "other" || value === "error";
}

function getWorkspaceEntryKindOrder(kind: NativeWorkspaceEntryKind): number {
  if (kind === "folder") {
    return 0;
  }
  return kind === "sdoc-file" ? 1 : 2;
}
