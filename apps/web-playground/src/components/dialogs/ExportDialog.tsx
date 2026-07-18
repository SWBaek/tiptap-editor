import { useLayoutEffect, useRef, useState } from "react";
import type { PublishingStyleProfileName } from "@sdoc/export";
import type { ExportFilenames } from "../panels/ExportPanel";

type DeliverableFormat = "markdown" | "html" | "pdf" | "docx" | "pptx";

export interface ExportDialogProps {
  filenames: ExportFilenames;
  styleProfile: PublishingStyleProfileName;
  isDesktopRuntime: boolean;
  onStyleProfileChange: (profile: PublishingStyleProfileName) => void;
  onExportMarkdown: () => void;
  onExportHtml: () => void;
  onClose: () => void;
}

const formats: Array<{ value: DeliverableFormat; label: string; description: string; supported: boolean }> = [
  { value: "markdown", label: "Markdown", description: "Readable text with stable section anchors.", supported: true },
  { value: "html", label: "HTML", description: "A styled single-file document for reading or publishing.", supported: true },
  { value: "pdf", label: "PDF", description: "Print-ready fixed-layout document.", supported: false },
  { value: "docx", label: "DOCX", description: "Editable Microsoft Word handoff.", supported: false },
  { value: "pptx", label: "PPTX", description: "Editable presentation deck.", supported: false }
];

export function ExportDialog({
  filenames,
  styleProfile,
  isDesktopRuntime,
  onStyleProfileChange,
  onExportMarkdown,
  onExportHtml,
  onClose
}: ExportDialogProps) {
  const [format, setFormat] = useState<DeliverableFormat>("markdown");
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(
    window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null
  );
  const option = formats.find((candidate) => candidate.value === format) ?? formats[0];
  const filename = format === "docx" ? filenames.sdoc.replace(/\.sdoc$/i, ".docx") : filenames[format];

  useLayoutEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    return () => previousFocusRef.current?.focus();
  }, []);

  function runExport() {
    if (format === "markdown") onExportMarkdown();
    if (format === "html") onExportHtml();
    if (format === "markdown" || format === "html") onClose();
  }

  return (
    <div className="author-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        ref={dialogRef}
        className="author-dialog export-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Export document"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
            return;
          }
          if (event.key !== "Tab") return;
          const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          ) ?? []).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (!first || !last) return;
          if (event.shiftKey && (window.document.activeElement === first || !dialogRef.current?.contains(window.document.activeElement))) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && window.document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <header>
          <div>
            <h2>Export document</h2>
            <p>Create a deliverable copy without changing the SDoc source.</p>
          </div>
          <button type="button" aria-label="Close export" data-initial-focus onClick={onClose}>×</button>
        </header>
        <div className="author-dialog-body export-dialog-body">
          <fieldset className="export-format-options">
            <legend>Format</legend>
            {formats.map((candidate) => (
              <label className={candidate.value === format ? "selected" : ""} key={candidate.value}>
                <input
                  type="radio"
                  name="export-format"
                  value={candidate.value}
                  checked={candidate.value === format}
                  onChange={() => setFormat(candidate.value)}
                />
                <span><strong>{candidate.label}</strong><small>{candidate.description}</small></span>
                {!candidate.supported && <em>Unavailable</em>}
              </label>
            ))}
          </fieldset>

          {(format === "html" || format === "pdf") && (
            <label className="dialog-field">
              <span>Publishing profile</span>
              <select value={styleProfile} onChange={(event) => onStyleProfileChange(event.target.value as PublishingStyleProfileName)}>
                <option value="modern">Modern</option>
                <option value="ieee">IEEE</option>
                <option value="iso">ISO/IEC</option>
                <option value="korean">Korean</option>
              </select>
            </label>
          )}

          <div className="export-destination" aria-label="Export destination">
            <span>Filename</span><strong>{filename}</strong>
            <span>Destination</span><strong>{isDesktopRuntime ? "Downloads" : "Browser downloads"}</strong>
          </div>

          {!option.supported && (
            <div className="workspace-boundary export-availability" role="status">
              <strong>{option.label} export is not available in this app build</strong>
              <span>Export HTML now, then use the operating system print workflow when a fixed-layout copy is required.</span>
            </div>
          )}
        </div>
        <footer>
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary" type="button" disabled={!option.supported} onClick={runExport}>Export {option.label}</button>
        </footer>
      </section>
    </div>
  );
}
