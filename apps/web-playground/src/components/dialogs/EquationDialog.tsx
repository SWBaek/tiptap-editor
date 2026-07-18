import { useEffect, useMemo, useState } from "react";
import katex from "katex";

export type EquationDialogMode = "inline" | "block" | "edit";

export interface EquationDialogProps {
  mode: EquationDialogMode;
  initialLatex: string;
  displayMode: boolean;
  onApply: (latex: string) => void;
  onCancel: () => void;
}

export function EquationDialog({ mode, initialLatex, displayMode, onApply, onCancel }: EquationDialogProps) {
  const [latex, setLatex] = useState(initialLatex);
  const preview = useMemo(() => renderEquationPreview(latex, displayMode), [displayMode, latex]);
  const title = mode === "edit" ? "Edit equation" : displayMode ? "Insert block equation" : "Insert inline equation";

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
      <section className="author-dialog equation-dialog" role="dialog" aria-modal="true" aria-labelledby="equation-dialog-title">
        <header>
          <div>
            <h2 id="equation-dialog-title">{title}</h2>
            <p>Enter LaTeX source and verify the rendered equation before applying it.</p>
          </div>
          <button type="button" aria-label="Close equation dialog" onClick={onCancel}>×</button>
        </header>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (!preview.error) {
            onApply(latex.trim());
          }
        }}>
          <label>
            <span>LaTeX source</span>
            <textarea autoFocus rows={4} value={latex} aria-invalid={Boolean(preview.error)} onChange={(event) => setLatex(event.target.value)} />
          </label>
          <div className="equation-dialog-preview" aria-label="Equation preview">
            {preview.html ? <div dangerouslySetInnerHTML={{ __html: preview.html }} /> : <span>Preview appears here</span>}
          </div>
          <p className={preview.error ? "dialog-validation error" : "dialog-validation ok"}>
            {preview.error || "Valid LaTeX source"}
          </p>
          <footer>
            <span />
            <button type="button" onClick={onCancel}>Cancel</button>
            <button className="primary" type="submit" disabled={Boolean(preview.error)}>{mode === "edit" ? "Update equation" : "Insert equation"}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function renderEquationPreview(value: string, displayMode: boolean): { html: string; error: string | null } {
  const latex = value.trim();
  if (!latex) {
    return { html: "", error: "Enter LaTeX source" };
  }

  try {
    return {
      html: katex.renderToString(latex, { displayMode, throwOnError: true, output: "html" }),
      error: null
    };
  } catch (error) {
    return { html: "", error: error instanceof Error ? error.message : "Invalid LaTeX source" };
  }
}
