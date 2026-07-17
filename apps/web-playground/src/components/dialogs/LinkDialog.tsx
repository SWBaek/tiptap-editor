import { useEffect, useState } from "react";

export interface LinkDialogProps {
  initialHref: string;
  onApply: (href: string) => void;
  onRemove: () => void;
  onCancel: () => void;
}

export function LinkDialog({ initialHref, onApply, onRemove, onCancel }: LinkDialogProps) {
  const [href, setHref] = useState(initialHref || "https://");
  const validationMessage = validateLinkHref(href);

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
      <section className="author-dialog link-dialog" role="dialog" aria-modal="true" aria-labelledby="link-dialog-title">
        <header>
          <div>
            <h2 id="link-dialog-title">{initialHref ? "Edit link" : "Add link"}</h2>
            <p>External links are separate from stable-ID document references.</p>
          </div>
          <button type="button" aria-label="Close link dialog" onClick={onCancel}>×</button>
        </header>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (!validationMessage) {
            onApply(href.trim());
          }
        }}>
          <label>
            <span>URL</span>
            <input autoFocus value={href} aria-invalid={Boolean(validationMessage)} onChange={(event) => setHref(event.target.value)} />
          </label>
          <p className={validationMessage ? "dialog-validation error" : "dialog-validation ok"}>
            {validationMessage || "Valid http, https, or mailto link"}
          </p>
          <footer>
            {initialHref && <button className="danger" type="button" onClick={onRemove}>Remove link</button>}
            <span />
            <button type="button" onClick={onCancel}>Cancel</button>
            <button className="primary" type="submit" disabled={Boolean(validationMessage)}>Apply link</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function validateLinkHref(value: string): string | null {
  const href = value.trim();
  if (!href) {
    return "Enter a URL";
  }

  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(href)) {
    return null;
  }

  try {
    const parsed = new URL(href);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? null : "Use an http, https, or mailto URL";
  } catch {
    return "Enter a complete URL, including https://";
  }
}
