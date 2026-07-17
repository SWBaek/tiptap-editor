import { Braces, Download, FilePlus, FileText, FolderOpen } from "lucide-react";

export interface DocumentCommandBarProps {
  title: string;
  fileLabel: string;
  savedLabel: string;
  isValid: boolean;
  statusMessage: string;
  saveLabel: string;
  isPreviewOpen: boolean;
  onTitleChange: (title: string) => void;
  onNewDocument: () => void;
  onOpenDocument: () => void;
  onSaveDocument: () => void;
  onOpenExport: () => void;
  onTogglePreview: () => void;
}

export function DocumentCommandBar({
  title,
  fileLabel,
  savedLabel,
  isValid,
  statusMessage,
  saveLabel,
  isPreviewOpen,
  onTitleChange,
  onNewDocument,
  onOpenDocument,
  onSaveDocument,
  onOpenExport,
  onTogglePreview
}: DocumentCommandBarProps) {
  return (
    <div className="document-command-bar" role="region" aria-label="Document workflow">
      <div className="document-command-main">
        <label className="document-title-field">
          <span>Title</span>
          <input value={title} onChange={(event) => onTitleChange(event.target.value)} />
        </label>
        <div className="document-command-meta">
          <strong title={fileLabel}>{fileLabel}</strong>
          <span>{savedLabel}</span>
          <span className={isValid ? "validation-badge ok" : "validation-badge error"}>{isValid ? "Valid" : "Invalid"}</span>
        </div>
        <div className="status-note" aria-label="Current status">
          {statusMessage}
        </div>
      </div>
      <div className="document-command-actions">
        <button type="button" onClick={onNewDocument}>
          <FilePlus size={16} />
          <span>New</span>
        </button>
        <button type="button" onClick={onOpenDocument}>
          <FolderOpen size={16} />
          <span>Open .sdoc</span>
        </button>
        <button type="button" onClick={onSaveDocument}>
          <Download size={16} />
          <span>{saveLabel}</span>
        </button>
        <button type="button" onClick={onOpenExport}>
          <FileText size={16} />
          <span>Export</span>
        </button>
        <button type="button" onClick={onTogglePreview}>
          <Braces size={16} />
          <span>{isPreviewOpen ? "Hide preview" : "Preview"}</span>
        </button>
      </div>
    </div>
  );
}
