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
  status: "created";
  path: string;
  relativePath: string;
  kind: "folder" | "sdoc-file";
  message: string;
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
    result.status === "created" &&
    typeof result.path === "string" &&
    typeof result.relativePath === "string" &&
    (result.kind === "folder" || result.kind === "sdoc-file") &&
    typeof result.message === "string"
  );
}

function getWorkspaceEntryKindOrder(kind: NativeWorkspaceEntryKind): number {
  if (kind === "folder") {
    return 0;
  }
  return kind === "sdoc-file" ? 1 : 2;
}
