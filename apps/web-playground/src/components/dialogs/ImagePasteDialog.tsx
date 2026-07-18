import { useEffect, useState } from "react";

export interface PastedImageDetails {
  filename: string;
  caption: string;
}

export interface ImagePasteDialogProps {
  initialFilename: string;
  initialCaption: string;
  mimeType: string;
  onApply: (details: PastedImageDetails) => void;
  onCancel: () => void;
}

export function ImagePasteDialog({ initialFilename, initialCaption, mimeType, onApply, onCancel }: ImagePasteDialogProps) {
  const [filename, setFilename] = useState(initialFilename);
  const [caption, setCaption] = useState(initialCaption);
  const validationMessage = validatePastedImageDetails(filename, caption);

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
      <section className="author-dialog image-paste-dialog" role="dialog" aria-modal="true" aria-labelledby="image-paste-dialog-title">
        <header>
          <div>
            <h2 id="image-paste-dialog-title">Insert pasted image</h2>
            <p>Name the clipboard image and add an accessible caption before storing it in the SDoc assets.</p>
          </div>
          <button type="button" aria-label="Close pasted image dialog" onClick={onCancel}>×</button>
        </header>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (!validationMessage) {
            onApply({ filename: filename.trim(), caption: caption.trim() });
          }
        }}>
          <label>
            <span>Image name</span>
            <input autoFocus value={filename} aria-invalid={Boolean(validatePastedImageFilename(filename))} onChange={(event) => setFilename(event.target.value)} />
          </label>
          <label>
            <span>Caption and alt text</span>
            <input value={caption} aria-invalid={caption.trim().length === 0} onChange={(event) => setCaption(event.target.value)} />
          </label>
          <p className={validationMessage ? "dialog-validation error" : "dialog-validation ok"}>
            {validationMessage || `${mimeType || "Image"} will be stored under assets/`}
          </p>
          <footer>
            <span />
            <button type="button" onClick={onCancel}>Cancel</button>
            <button className="primary" type="submit" disabled={Boolean(validationMessage)}>Insert image</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function validatePastedImageFilename(value: string): string | null {
  const filename = value.trim();
  if (!filename) {
    return "Enter an image name";
  }
  if (filename === "." || filename === ".." || /[\\/]/.test(filename)) {
    return "Use a file name without folders";
  }
  return filename.length <= 120 ? null : "Keep the image name under 120 characters";
}

export function validatePastedImageDetails(filename: string, caption: string): string | null {
  return validatePastedImageFilename(filename) ?? (caption.trim() ? null : "Enter a caption and alt text");
}
