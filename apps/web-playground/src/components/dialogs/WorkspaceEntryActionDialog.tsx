import { useEffect, useState } from "react";
import type { WindowSdocWorkspaceEntry } from "../../documentNativeBridge";
import { normalizeWorkspaceEntryName, validateWorkspaceEntryName } from "./WorkspaceCreateDialog";

export type WorkspaceEntryAction = "rename" | "trash";

export interface WorkspaceEntryActionDialogProps {
  action: WorkspaceEntryAction;
  entry: WindowSdocWorkspaceEntry;
  onRename: (name: string) => void;
  onTrash: () => void;
  onCancel: () => void;
}

export function WorkspaceEntryActionDialog({ action, entry, onRename, onTrash, onCancel }: WorkspaceEntryActionDialogProps) {
  const kind = entry.kind === "sdoc-file" ? "sdoc-file" : "folder";
  const [name, setName] = useState(entry.name);
  const normalizedName = normalizeWorkspaceEntryName(kind, name);
  const validationMessage = action === "rename" ? validateWorkspaceEntryName(kind, name) : null;
  const unchanged = normalizedName === entry.name;

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
      <section className="author-dialog" role="dialog" aria-modal="true" aria-labelledby="workspace-entry-action-title">
        <header>
          <div>
            <h2 id="workspace-entry-action-title">{action === "rename" ? "Rename workspace entry" : "Move workspace entry to Trash"}</h2>
            <p title={entry.path}>{entry.name}</p>
          </div>
          <button type="button" aria-label="Close workspace entry action dialog" onClick={onCancel}>×</button>
        </header>
        {action === "rename" ? (
          <form onSubmit={(event) => {
            event.preventDefault();
            if (!validationMessage && !unchanged) {
              onRename(normalizedName);
            }
          }}>
            <label>
              <span>New name</span>
              <input
                autoFocus
                value={name}
                aria-invalid={Boolean(validationMessage)}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <p className={validationMessage || unchanged ? "dialog-validation error" : "dialog-validation ok"}>
              {validationMessage || (unchanged ? "Enter a different name" : `Will rename to ${normalizedName}`)}
            </p>
            <footer>
              <span />
              <button type="button" onClick={onCancel}>Cancel</button>
              <button className="primary" type="submit" disabled={Boolean(validationMessage) || unchanged}>Rename</button>
            </footer>
          </form>
        ) : (
          <div className="author-dialog-body workspace-trash-confirmation">
            <p>This moves the entry and any nested contents to the operating-system Trash/Recycle Bin.</p>
            <p>Recovery is available from the operating system; this editor does not provide an in-app undo.</p>
            <footer>
              <span />
              <button type="button" onClick={onCancel}>Cancel</button>
              <button className="danger" type="button" autoFocus onClick={onTrash}>Move to Trash</button>
            </footer>
          </div>
        )}
      </section>
    </div>
  );
}
