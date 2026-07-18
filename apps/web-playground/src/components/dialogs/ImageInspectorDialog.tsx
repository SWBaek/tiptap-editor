import { useEffect, useState } from "react";

export type FigureAlignment = "left" | "center" | "right";

export interface ImageInspectorValues {
  alt: string;
  caption: string;
  alignment: FigureAlignment;
  replacementFile: File | null;
}

export interface ImageInspectorDialogProps {
  assetId: string;
  initialSrc: string;
  initialValues: Omit<ImageInspectorValues, "replacementFile">;
  onApply: (values: ImageInspectorValues) => void;
  onDelete: () => void;
  onCancel: () => void;
}

const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]);

export function ImageInspectorDialog({ assetId, initialSrc, initialValues, onApply, onDelete, onCancel }: ImageInspectorDialogProps) {
  const [values, setValues] = useState<ImageInspectorValues>({ ...initialValues, replacementFile: null });
  const [replacementPreview, setReplacementPreview] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const validationMessage = validateImageInspectorValues(values);

  useEffect(() => {
    if (!values.replacementFile || !isSupportedImageFile(values.replacementFile)) {
      setReplacementPreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(values.replacementFile);
    setReplacementPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [values.replacementFile]);

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
      <section className="author-dialog image-inspector-dialog" role="dialog" aria-modal="true" aria-labelledby="image-inspector-title">
        <header>
          <div>
            <h2 id="image-inspector-title">Edit image</h2>
            <p>Keep the figure accessible, replace its source asset, or adjust authored alignment.</p>
          </div>
          <button type="button" aria-label="Close image dialog" onClick={onCancel}>×</button>
        </header>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (!validationMessage) {
            onApply({
              ...values,
              alt: values.alt.trim(),
              caption: values.caption.trim()
            });
          }
        }}>
          <div className="image-inspector-preview" aria-label="Image preview">
            <img src={replacementPreview || initialSrc} alt={values.alt.trim() || "Image preview"} />
          </div>
          <small className="image-inspector-asset">Current asset: {assetId}</small>
          <label>
            <span>Alt text</span>
            <input autoFocus value={values.alt} aria-invalid={!values.alt.trim()} onChange={(event) => setValues({ ...values, alt: event.target.value })} />
          </label>
          <label>
            <span>Caption</span>
            <input value={values.caption} aria-invalid={!values.caption.trim()} onChange={(event) => setValues({ ...values, caption: event.target.value })} />
          </label>
          <label>
            <span>Alignment</span>
            <select value={values.alignment} onChange={(event) => setValues({ ...values, alignment: event.target.value as FigureAlignment })}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
          <label>
            <span>Replace image file <small>optional</small></span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              aria-invalid={Boolean(values.replacementFile && !isSupportedImageFile(values.replacementFile))}
              onChange={(event) => setValues({ ...values, replacementFile: event.target.files?.[0] ?? null })}
            />
          </label>
          <p className={validationMessage ? "dialog-validation error" : "dialog-validation ok"}>
            {validationMessage || (values.replacementFile ? `Ready to replace with ${values.replacementFile.name}` : "Image details ready")}
          </p>
          <footer>
            <span className="image-delete-actions">
              {confirmingDelete ? (
                <>
                  <button type="button" onClick={() => setConfirmingDelete(false)}>Keep image</button>
                  <button className="danger" type="button" onClick={onDelete}>Confirm delete</button>
                </>
              ) : (
                <button className="danger" type="button" onClick={() => setConfirmingDelete(true)}>Delete image</button>
              )}
            </span>
            <button type="button" onClick={onCancel}>Cancel</button>
            <button className="primary" type="submit" disabled={Boolean(validationMessage)}>Update image</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function validateImageInspectorValues(values: ImageInspectorValues): string | null {
  if (!values.alt.trim()) {
    return "Enter alt text";
  }
  if (!values.caption.trim()) {
    return "Enter a caption";
  }
  if (values.replacementFile && !isSupportedImageFile(values.replacementFile)) {
    return "Choose a PNG, JPEG, GIF, WebP, or SVG image";
  }
  return null;
}

export function isSupportedImageFile(file: Pick<File, "type">): boolean {
  return SUPPORTED_IMAGE_TYPES.has(file.type);
}
