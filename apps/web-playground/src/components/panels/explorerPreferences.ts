import type { ExplorerSortMode } from "./explorerTreeModel";

export const EXPLORER_PREFERENCES_STORAGE_KEY = "sdoc-explorer-preferences";

export interface ExplorerPreferences {
  sortMode: ExplorerSortMode;
  autoReveal: boolean;
}

export const DEFAULT_EXPLORER_PREFERENCES: ExplorerPreferences = {
  sortMode: "name",
  autoReveal: true
};

export function loadExplorerPreferences(storage: Pick<Storage, "getItem"> | null | undefined): ExplorerPreferences {
  if (!storage) {
    return DEFAULT_EXPLORER_PREFERENCES;
  }
  try {
    const value = storage.getItem(EXPLORER_PREFERENCES_STORAGE_KEY);
    if (!value) {
      return DEFAULT_EXPLORER_PREFERENCES;
    }
    const parsed = JSON.parse(value) as Partial<ExplorerPreferences>;
    return {
      sortMode: parsed.sortMode === "modified" ? "modified" : "name",
      autoReveal: parsed.autoReveal !== false
    };
  } catch {
    return DEFAULT_EXPLORER_PREFERENCES;
  }
}

export function storeExplorerPreferences(
  storage: Pick<Storage, "setItem"> | null | undefined,
  preferences: ExplorerPreferences
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(EXPLORER_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Explorer preferences remain session-local when storage is restricted.
  }
}
