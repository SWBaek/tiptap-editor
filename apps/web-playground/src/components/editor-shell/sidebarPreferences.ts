export const SIDEBAR_WIDTH_STORAGE_KEY = "sdoc-sidebar-width";
export const DEFAULT_SIDEBAR_WIDTH = 260;
export const MIN_SIDEBAR_WIDTH = 220;
export const MAX_SIDEBAR_WIDTH = 420;

export function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return DEFAULT_SIDEBAR_WIDTH;
  }
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(width)));
}

export function loadStoredSidebarWidth(storage: Pick<Storage, "getItem"> | null | undefined): number {
  if (!storage) {
    return DEFAULT_SIDEBAR_WIDTH;
  }
  try {
    const stored = storage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    return stored === null ? DEFAULT_SIDEBAR_WIDTH : clampSidebarWidth(Number(stored));
  } catch {
    return DEFAULT_SIDEBAR_WIDTH;
  }
}

export function storeSidebarWidth(storage: Pick<Storage, "setItem"> | null | undefined, width: number): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clampSidebarWidth(width)));
  } catch {
    // Restricted browser contexts may reject storage; resizing remains session-local.
  }
}
