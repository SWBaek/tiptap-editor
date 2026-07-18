import type { WindowSdocWorkspaceEntry } from "../../documentNativeBridge";

export interface VisibleWorkspaceEntry {
  entry: WindowSdocWorkspaceEntry;
  level: number;
  parentPath: string | null;
}

export function isWorkspaceFolder(entry: WindowSdocWorkspaceEntry): boolean {
  return entry.kind !== "sdoc-file";
}

export function sortWorkspaceEntries(entries: WindowSdocWorkspaceEntry[]): WindowSdocWorkspaceEntry[] {
  return [...entries].sort((left, right) => {
    const leftFolder = isWorkspaceFolder(left);
    const rightFolder = isWorkspaceFolder(right);
    if (leftFolder !== rightFolder) {
      return leftFolder ? -1 : 1;
    }
    return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" });
  });
}

export function flattenVisibleWorkspaceEntries(
  entries: WindowSdocWorkspaceEntry[],
  expandedPaths: ReadonlySet<string>,
  level = 1,
  parentPath: string | null = null
): VisibleWorkspaceEntry[] {
  const visible: VisibleWorkspaceEntry[] = [];
  for (const entry of sortWorkspaceEntries(entries)) {
    visible.push({ entry, level, parentPath });
    if (isWorkspaceFolder(entry) && expandedPaths.has(entry.path) && entry.children?.length) {
      visible.push(...flattenVisibleWorkspaceEntries(entry.children, expandedPaths, level + 1, entry.path));
    }
  }
  return visible;
}

export function findWorkspaceEntry(
  entries: WindowSdocWorkspaceEntry[],
  path: string
): WindowSdocWorkspaceEntry | null {
  for (const entry of entries) {
    if (workspacePathsEqual(entry.path, path)) {
      return entry;
    }
    const nested = entry.children ? findWorkspaceEntry(entry.children, path) : null;
    if (nested) {
      return nested;
    }
  }
  return null;
}

export function findWorkspaceAncestorFolders(
  entries: WindowSdocWorkspaceEntry[],
  targetPath: string,
  ancestors: string[] = []
): string[] | null {
  for (const entry of entries) {
    if (workspacePathsEqual(entry.path, targetPath)) {
      return ancestors;
    }
    if (entry.children) {
      const nested = findWorkspaceAncestorFolders(
        entry.children,
        targetPath,
        isWorkspaceFolder(entry) ? [...ancestors, entry.path] : ancestors
      );
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

export function workspacePathsEqual(left: string | null, right: string | null): boolean {
  if (!left || !right) {
    return false;
  }
  return normalizeWorkspaceIdentityPath(left) === normalizeWorkspaceIdentityPath(right);
}

function normalizeWorkspaceIdentityPath(path: string): string {
  const normalized = path.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  return /^[a-z]:\//i.test(normalized) ? normalized.toLocaleLowerCase() : normalized;
}
