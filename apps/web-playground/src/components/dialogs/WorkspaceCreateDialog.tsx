import { useEffect, useState } from "react";

export type WorkspaceCreateKind = "sdoc-file" | "folder";

export interface WorkspaceCreateValues {
  kind: WorkspaceCreateKind;
  name: string;
}

export interface WorkspaceCreateDialogProps {
  parentLabel: string;
  initialKind: WorkspaceCreateKind;
  onApply: (values: WorkspaceCreateValues) => void;
  onCancel: () => void;
}

export function WorkspaceCreateDialog({ parentLabel, initialKind, onApply, onCancel }: WorkspaceCreateDialogProps) {
  const [values, setValues] = useState<WorkspaceCreateValues>({ kind: initialKind, name: "" });
  const validationMessage = validateWorkspaceEntryName(values.kind, values.name);

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
      <section className="author-dialog" role="dialog" aria-modal="true" aria-labelledby="workspace-create-dialog-title">
        <header>
          <div>
            <h2 id="workspace-create-dialog-title">Create workspace entry</h2>
            <p>Location: {parentLabel}</p>
          </div>
          <button type="button" aria-label="Close create workspace entry dialog" onClick={onCancel}>×</button>
        </header>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (!validationMessage) {
            onApply({ ...values, name: normalizeWorkspaceEntryName(values.kind, values.name) });
          }
        }}>
          <label>
            <span>Entry type</span>
            <select value={values.kind} onChange={(event) => setValues({ ...values, kind: event.target.value as WorkspaceCreateKind })}>
              <option value="sdoc-file">SDoc document</option>
              <option value="folder">Folder</option>
            </select>
          </label>
          <label>
            <span>Name</span>
            <input
              autoFocus
              value={values.name}
              placeholder={values.kind === "sdoc-file" ? "Design specification.sdoc" : "Specifications"}
              aria-invalid={Boolean(validationMessage)}
              onChange={(event) => setValues({ ...values, name: event.target.value })}
            />
          </label>
          <p className={validationMessage ? "dialog-validation error" : "dialog-validation ok"}>
            {validationMessage || `Will create ${normalizeWorkspaceEntryName(values.kind, values.name)}`}
          </p>
          <footer>
            <span />
            <button type="button" onClick={onCancel}>Cancel</button>
            <button className="primary" type="submit" disabled={Boolean(validationMessage)}>Create</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function normalizeWorkspaceEntryName(kind: WorkspaceCreateKind, name: string): string {
  const trimmed = name.trim();
  return kind === "sdoc-file" && trimmed && !trimmed.toLowerCase().endsWith(".sdoc") ? `${trimmed}.sdoc` : trimmed;
}

export function validateWorkspaceEntryName(kind: WorkspaceCreateKind, name: string): string | null {
  const normalized = normalizeWorkspaceEntryName(kind, name);
  if (!normalized) {
    return "Enter a name";
  }
  if (normalized.length > 128) {
    return "Use 128 characters or fewer";
  }
  if (/[<>:"/\\|?*\u0000-\u001f]/.test(normalized)) {
    return "Do not use path separators or reserved filename characters";
  }
  if (normalized === "." || normalized === ".." || normalized.endsWith(".") || normalized.endsWith(" ")) {
    return "Use a name that does not end with a dot or space";
  }
  const stem = normalized.replace(/\.sdoc$/i, "");
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem)) {
    return "This name is reserved by the operating system";
  }
  return null;
}
