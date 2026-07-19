import type { WindowSdocWorkspaceEntry } from "../../documentNativeBridge";

export interface VisibleWorkspaceEntry {
  entry: WindowSdocWorkspaceEntry;
  level: number;
  parentPath: string | null;
}

export type ExplorerSortMode = "name" | "modified";

export function isWorkspaceFolder(entry: WindowSdocWorkspaceEntry): boolean {
  return entry.kind !== "sdoc-file";
}

export function sortWorkspaceEntries(
  entries: WindowSdocWorkspaceEntry[],
  sortMode: ExplorerSortMode = "name"
): WindowSdocWorkspaceEntry[] {
  return [...entries].sort((left, right) => {
    const leftFolder = isWorkspaceFolder(left);
    const rightFolder = isWorkspaceFolder(right);
    if (leftFolder !== rightFolder) {
      return leftFolder ? -1 : 1;
    }
    if (sortMode === "modified") {
      const modifiedDifference = (right.modifiedAtMs ?? -1) - (left.modifiedAtMs ?? -1);
      if (modifiedDifference !== 0) {
        return modifiedDifference;
      }
    }
    return compareWorkspaceNames(left.name, right.name);
  });
}

export function flattenVisibleWorkspaceEntries(
  entries: WindowSdocWorkspaceEntry[],
  expandedPaths: ReadonlySet<string>,
  level = 1,
  parentPath: string | null = null,
  sortMode: ExplorerSortMode = "name"
): VisibleWorkspaceEntry[] {
  const visible: VisibleWorkspaceEntry[] = [];
  for (const entry of sortWorkspaceEntries(entries, sortMode)) {
    visible.push({ entry, level, parentPath });
    if (isWorkspaceFolder(entry) && expandedPaths.has(entry.path) && entry.children?.length) {
      visible.push(...flattenVisibleWorkspaceEntries(entry.children, expandedPaths, level + 1, entry.path, sortMode));
    }
  }
  return visible;
}

export function filterWorkspaceEntries(
  entries: WindowSdocWorkspaceEntry[],
  query: string
): WindowSdocWorkspaceEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return entries;
  }
  const filtered: WindowSdocWorkspaceEntry[] = [];
  for (const entry of entries) {
    const matches = entry.name.toLocaleLowerCase().includes(normalizedQuery);
    if (isWorkspaceFolder(entry)) {
      const children = matches ? entry.children ?? [] : filterWorkspaceEntries(entry.children ?? [], query);
      if (matches || children.length > 0) {
        filtered.push({ ...entry, children });
      }
    } else if (matches) {
      filtered.push(entry);
    }
  }
  return filtered;
}

export function collectWorkspaceFolderPaths(entries: WindowSdocWorkspaceEntry[]): Set<string> {
  const paths = new Set<string>();
  for (const entry of entries) {
    if (!isWorkspaceFolder(entry)) {
      continue;
    }
    paths.add(entry.path);
    for (const path of collectWorkspaceFolderPaths(entry.children ?? [])) {
      paths.add(path);
    }
  }
  return paths;
}

export function flattenWorkspaceDocuments(entries: WindowSdocWorkspaceEntry[]): WindowSdocWorkspaceEntry[] {
  const documents: WindowSdocWorkspaceEntry[] = [];
  for (const entry of entries) {
    if (entry.kind === "sdoc-file") {
      documents.push(entry);
    } else if (entry.children) {
      documents.push(...flattenWorkspaceDocuments(entry.children));
    }
  }
  return documents;
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

function compareWorkspaceNames(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}
