import { describe, expect, it } from "vitest";
import { validateTableDialogValues, type TableDialogValues } from "./TableDialog";

const validValues: TableDialogValues = {
  caption: "API readiness matrix",
  rows: 3,
  columns: 2,
  withHeaderRow: true,
  alignment: "unchanged"
};

describe("validateTableDialogValues", () => {
  it("bounds inserted table dimensions while allowing optional captions", () => {
    expect(validateTableDialogValues(validValues, "insert")).toBeNull();
    expect(validateTableDialogValues({ ...validValues, caption: "" }, "insert")).toBeNull();
    expect(validateTableDialogValues({ ...validValues, rows: 1 }, "insert")).toContain("Rows");
    expect(validateTableDialogValues({ ...validValues, columns: 11 }, "insert")).toContain("Columns");
  });

  it("does not apply insertion-only dimensions to selected-table edits", () => {
    expect(validateTableDialogValues({ ...validValues, rows: 0, columns: 0 }, "edit")).toBeNull();
  });
});
