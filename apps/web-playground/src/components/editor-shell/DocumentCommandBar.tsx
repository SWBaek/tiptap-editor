import {
  Braces,
  ChevronDown,
  FileOutput,
  FilePlus,
  FileText,
  FolderOpen,
  Save,
  SaveAll,
  Settings2
} from "lucide-react";
import type { ReactNode } from "react";

export interface DocumentCommandBarProps {
  fileLabel: string;
  saveLabel: string;
  isPreviewOpen: boolean;
  onNewDocument: () => void;
  onOpenDocument: () => void;
  onSaveDocument: () => void;
  onSaveAsDocument: () => void;
  onOpenExport: () => void;
  onOpenProperties: () => void;
  onTogglePreview: () => void;
}

export function DocumentCommandBar({
  fileLabel,
  saveLabel,
  isPreviewOpen,
  onNewDocument,
  onOpenDocument,
  onSaveDocument,
  onSaveAsDocument,
  onOpenExport,
  onOpenProperties,
  onTogglePreview
}: DocumentCommandBarProps) {
  return (
    <div className="document-command-bar" role="region" aria-label="Document workflow">
      <div className="document-command-identity">
        <FileText size={15} aria-hidden="true" />
        <strong title={fileLabel}>{fileLabel}</strong>
      </div>
      <div className="document-command-actions">
        <button className="primary" type="button" onClick={onSaveDocument}>
          <Save size={15} />
          <span>{saveLabel}</span>
        </button>
        <button type="button" onClick={onOpenExport}>
          <FileOutput size={15} />
          <span>Export</span>
        </button>
        <details
          className="document-more-menu"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.removeAttribute("open");
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary aria-label="More document actions" title="More document actions">
            <span>More</span>
            <ChevronDown size={14} />
          </summary>
          <div role="menu" aria-label="Document actions">
            <DocumentMenuButton icon={<FilePlus size={14} />} label="New document" onClick={onNewDocument} />
            <DocumentMenuButton icon={<FolderOpen size={14} />} label="Open document" onClick={onOpenDocument} />
            <DocumentMenuButton icon={<SaveAll size={14} />} label="Save As" onClick={onSaveAsDocument} />
            <DocumentMenuButton
              icon={<Braces size={14} />}
              label={isPreviewOpen ? "Hide preview" : "Show preview"}
              onClick={onTogglePreview}
            />
            <DocumentMenuButton icon={<Settings2 size={14} />} label="Document Properties" onClick={onOpenProperties} />
          </div>
        </details>
      </div>
    </div>
  );
}

function DocumentMenuButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(event) => {
        event.currentTarget.closest("details")?.removeAttribute("open");
        onClick();
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
