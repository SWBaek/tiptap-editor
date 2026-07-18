import { useEffect, useState } from "react";
import type { TableCellAlignment } from "@sdoc/editor-tiptap";

export type TableDialogMode = "insert" | "edit";
export type TableDialogAlignment = "unchanged" | TableCellAlignment;

export interface TableDialogValues {
  caption: string;
  rows: number;
  columns: number;
  withHeaderRow: boolean;
  alignment: TableDialogAlignment;
}

export interface TableDialogProps {
  mode: TableDialogMode;
  initialValues: TableDialogValues;
  onApply: (values: TableDialogValues) => void;
  onCancel: () => void;
}

export function TableDialog({ mode, initialValues, onApply, onCancel }: TableDialogProps) {
  const [values, setValues] = useState(initialValues);
  const validationMessage = validateTableDialogValues(values, mode);
  const title = mode === "insert" ? "Insert table" : "Edit table";

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onCancel]);

  return (
    <div className="author-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        onCancel();
      }
    }}>
      <section className="author-dialog table-dialog" role="dialog" aria-modal="true" aria-labelledby="table-dialog-title">
        <header>
          <div>
            <h2 id="table-dialog-title">{title}</h2>
            <p>{mode === "insert" ? "Choose a useful starting structure before inserting the table." : "Edit authored table details and selected-cell presentation."}</p>
          </div>
          <button type="button" aria-label="Close table dialog" onClick={onCancel}>×</button>
        </header>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (!validationMessage) {
            onApply({ ...values, caption: values.caption.trim() });
          }
        }}>
          {mode === "insert" && (
            <div className="table-dialog-dimensions">
              <label>
                <span>Rows</span>
                <input
                  autoFocus
                  type="number"
                  min={2}
                  max={20}
                  value={values.rows}
                  aria-invalid={values.rows < 2 || values.rows > 20 || !Number.isInteger(values.rows)}
                  onChange={(event) => setValues({ ...values, rows: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>Columns</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={values.columns}
                  aria-invalid={values.columns < 1 || values.columns > 10 || !Number.isInteger(values.columns)}
                  onChange={(event) => setValues({ ...values, columns: Number(event.target.value) })}
                />
              </label>
            </div>
          )}
          <label>
            <span>Caption <small>optional</small></span>
            <input
              autoFocus={mode === "edit"}
              value={values.caption}
              placeholder="API readiness matrix"
              onChange={(event) => setValues({ ...values, caption: event.target.value })}
            />
          </label>
          <label className="table-dialog-checkbox">
            <input
              type="checkbox"
              checked={values.withHeaderRow}
              onChange={(event) => setValues({ ...values, withHeaderRow: event.target.checked })}
            />
            <span>Use first row as header</span>
          </label>
          {mode === "edit" && (
            <label>
              <span>Selected cell alignment</span>
              <select value={values.alignment} onChange={(event) => setValues({ ...values, alignment: event.target.value as TableDialogAlignment })}>
                <option value="unchanged">Keep current alignment</option>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
          )}
          <p className={validationMessage ? "dialog-validation error" : "dialog-validation ok"}>
            {validationMessage || (mode === "insert" ? "Valid table structure" : "Table settings ready")}
          </p>
          <footer>
            <span />
            <button type="button" onClick={onCancel}>Cancel</button>
            <button className="primary" type="submit" disabled={Boolean(validationMessage)}>{mode === "insert" ? "Insert table" : "Update table"}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function validateTableDialogValues(values: TableDialogValues, mode: TableDialogMode): string | null {
  if (mode === "insert" && (!Number.isInteger(values.rows) || values.rows < 2 || values.rows > 20)) {
    return "Rows must be a whole number from 2 to 20";
  }
  if (mode === "insert" && (!Number.isInteger(values.columns) || values.columns < 1 || values.columns > 10)) {
    return "Columns must be a whole number from 1 to 10";
  }
  return null;
}
