import { describe, expect, it } from "vitest";
import {
  canNavigateCursorHistory,
  clampCursorLocation,
  createCursorHistory,
  navigateCursorHistory,
  recordCursorLocation
} from "./cursorHistory";

describe("cursor history", () => {
  it("records branches and navigates backward and forward", () => {
    let state = createCursorHistory({ from: 2, to: 2 });
    state = recordCursorLocation(state, { from: 12, to: 12 });
    state = recordCursorLocation(state, { from: 24, to: 24 });
    expect(canNavigateCursorHistory(state, "back")).toBe(true);

    const back = navigateCursorHistory(state, "back", 30);
    expect(back.location).toEqual({ from: 12, to: 12 });
    const branched = recordCursorLocation(back.state, { from: 18, to: 18 });
    expect(canNavigateCursorHistory(branched, "forward")).toBe(false);
    expect(branched.entries).toEqual([{ from: 2, to: 2 }, { from: 12, to: 12 }, { from: 18, to: 18 }]);
  });

  it("clamps stale positions after edits and bounds retained entries", () => {
    expect(clampCursorLocation({ from: 40, to: 45 }, 10)).toEqual({ from: 10, to: 10 });
    let state = createCursorHistory();
    for (let position = 2; position <= 8; position += 1) {
      state = recordCursorLocation(state, { from: position, to: position }, 4);
    }
    expect(state.entries).toHaveLength(4);
    expect(state.entries[0]).toEqual({ from: 5, to: 5 });
  });
});
