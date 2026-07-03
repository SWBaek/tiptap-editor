export type NativeWorkspaceEntryKind = "sdoc-file" | "unpacked-sdoc-folder";

export interface NativeWorkspaceEntry {
  name: string;
  path: string;
  kind: NativeWorkspaceEntryKind;
  sizeBytes?: number;
  modifiedAtMs?: number;
}

export function sortWorkspaceEntries(entries: NativeWorkspaceEntry[]): NativeWorkspaceEntry[] {
  return [...entries].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "sdoc-file" ? -1 : 1;
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
  return (
    typeof entry.name === "string" &&
    typeof entry.path === "string" &&
    (entry.kind === "sdoc-file" || entry.kind === "unpacked-sdoc-folder") &&
    (entry.sizeBytes === undefined || typeof entry.sizeBytes === "number") &&
    (entry.modifiedAtMs === undefined || typeof entry.modifiedAtMs === "number")
  );
}
