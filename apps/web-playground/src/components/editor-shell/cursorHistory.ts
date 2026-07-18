export interface CursorLocation {
  from: number;
  to: number;
}

export interface CursorHistoryState {
  entries: CursorLocation[];
  index: number;
}

export type CursorHistoryDirection = "back" | "forward";

export function createCursorHistory(initial: CursorLocation = { from: 1, to: 1 }): CursorHistoryState {
  return { entries: [normalizeCursorLocation(initial)], index: 0 };
}

export function recordCursorLocation(state: CursorHistoryState, location: CursorLocation, limit = 50): CursorHistoryState {
  const normalized = normalizeCursorLocation(location);
  const current = state.entries[state.index];
  if (current && current.from === normalized.from && current.to === normalized.to) {
    return state;
  }

  const entries = [...state.entries.slice(0, state.index + 1), normalized];
  const boundedEntries = entries.slice(Math.max(0, entries.length - Math.max(2, limit)));
  return { entries: boundedEntries, index: boundedEntries.length - 1 };
}

export function navigateCursorHistory(
  state: CursorHistoryState,
  direction: CursorHistoryDirection,
  maxPosition: number
): { state: CursorHistoryState; location: CursorLocation | null } {
  const nextIndex = state.index + (direction === "back" ? -1 : 1);
  if (nextIndex < 0 || nextIndex >= state.entries.length) {
    return { state, location: null };
  }

  const location = clampCursorLocation(state.entries[nextIndex], maxPosition);
  const entries = state.entries.map((entry, index) => index === nextIndex ? location : entry);
  return { state: { entries, index: nextIndex }, location };
}

export function canNavigateCursorHistory(state: CursorHistoryState, direction: CursorHistoryDirection): boolean {
  return direction === "back" ? state.index > 0 : state.index < state.entries.length - 1;
}

export function clampCursorLocation(location: CursorLocation, maxPosition: number): CursorLocation {
  const max = Math.max(1, Math.floor(maxPosition));
  const from = Math.min(max, Math.max(1, Math.floor(location.from)));
  const to = Math.min(max, Math.max(from, Math.floor(location.to)));
  return { from, to };
}

function normalizeCursorLocation(location: CursorLocation): CursorLocation {
  const from = Math.max(1, Math.floor(Math.min(location.from, location.to)));
  const to = Math.max(from, Math.floor(Math.max(location.from, location.to)));
  return { from, to };
}
