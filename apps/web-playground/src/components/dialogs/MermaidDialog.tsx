import { useEffect, useState } from "react";

export type MermaidDialogMode = "insert" | "edit";

export interface MermaidDialogProps {
  mode: MermaidDialogMode;
  initialSource: string;
  onApply: (source: string) => void;
  onCancel: () => void;
}

let mermaidInitialized = false;
let mermaidRenderSequence = 0;

export function MermaidDialog({ mode, initialSource, onApply, onCancel }: MermaidDialogProps) {
  const [source, setSource] = useState(initialSource);
  const [previewSvg, setPreviewSvg] = useState("");
  const [validationMessage, setValidationMessage] = useState("Rendering preview…");
  const [isValid, setIsValid] = useState(false);
  const title = mode === "edit" ? "Edit Mermaid diagram" : "Insert Mermaid diagram";

  useEffect(() => {
    let canceled = false;
    const normalizedSource = normalizeMermaidSource(source);
    setPreviewSvg("");
    setIsValid(false);

    if (!normalizedSource) {
      setValidationMessage("Enter Mermaid source");
      return () => {
        canceled = true;
      };
    }

    setValidationMessage("Rendering preview…");
    const renderTimeout = window.setTimeout(() => {
      void renderMermaidPreview(normalizedSource).then((result) => {
        if (canceled) {
          return;
        }
        setPreviewSvg(result.svg);
        setIsValid(result.error === null);
        setValidationMessage(result.error || "Valid Mermaid source");
      });
    }, 180);

    return () => {
      canceled = true;
      window.clearTimeout(renderTimeout);
    };
  }, [source]);

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
      <section className="author-dialog mermaid-dialog" role="dialog" aria-modal="true" aria-labelledby="mermaid-dialog-title">
        <header>
          <div>
            <h2 id="mermaid-dialog-title">{title}</h2>
            <p>Edit Mermaid source and verify the diagram preview before applying it.</p>
          </div>
          <button type="button" aria-label="Close Mermaid dialog" onClick={onCancel}>×</button>
        </header>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (isValid) {
            onApply(normalizeMermaidSource(source));
          }
        }}>
          <label>
            <span>Mermaid source</span>
            <textarea autoFocus rows={8} value={source} aria-invalid={!isValid} onChange={(event) => setSource(event.target.value)} />
          </label>
          <div className="mermaid-dialog-preview" aria-label="Mermaid preview">
            {previewSvg ? <div dangerouslySetInnerHTML={{ __html: previewSvg }} /> : <span>Preview appears here</span>}
          </div>
          <p className={isValid ? "dialog-validation ok" : "dialog-validation error"} aria-live="polite">
            {validationMessage}
          </p>
          <footer>
            <span />
            <button type="button" onClick={onCancel}>Cancel</button>
            <button className="primary" type="submit" disabled={!isValid}>{mode === "edit" ? "Update diagram" : "Insert diagram"}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function normalizeMermaidSource(value: string): string {
  return value.trim();
}

export async function renderMermaidPreview(source: string): Promise<{ svg: string; error: string | null }> {
  const normalizedSource = normalizeMermaidSource(source);
  if (!normalizedSource) {
    return { svg: "", error: "Enter Mermaid source" };
  }

  try {
    const { default: mermaid } = await import("mermaid");
    if (!mermaidInitialized) {
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "default" });
      mermaidInitialized = true;
    }
    const renderId = `sdoc-mermaid-dialog-${++mermaidRenderSequence}`;
    const result = await mermaid.render(renderId, normalizedSource);
    return { svg: result.svg, error: null };
  } catch (error) {
    return { svg: "", error: getMermaidErrorMessage(error) };
  }
}

function getMermaidErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return "Invalid Mermaid source";
}
