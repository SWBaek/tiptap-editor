import { Braces, Download, FilePlus, FileText, FolderOpen } from "lucide-react";

export interface DocumentCommandBarProps {
  title: string;
  author: string;
  version: string;
  fileLabel: string;
  savedLabel: string;
  isValid: boolean;
  statusMessage: string;
  saveLabel: string;
  isPreviewOpen: boolean;
  onTitleChange: (title: string) => void;
  onAuthorChange: (author: string) => void;
  onVersionChange: (version: string) => void;
  onNewDocument: () => void;
  onOpenDocument: () => void;
  onSaveDocument: () => void;
  onOpenExport: () => void;
  onTogglePreview: () => void;
}

export function DocumentCommandBar({
  title,
  author,
  version,
  fileLabel,
  savedLabel,
  isValid,
  statusMessage,
  saveLabel,
  isPreviewOpen,
  onTitleChange,
  onAuthorChange,
  onVersionChange,
  onNewDocument,
  onOpenDocument,
  onSaveDocument,
  onOpenExport,
  onTogglePreview
}: DocumentCommandBarProps) {
  return (
    <div className="document-command-bar" role="region" aria-label="Document workflow">
      <div className="document-command-main">
        <div className="document-identity-fields" aria-label="Document identity">
          <label className="document-title-field">
            <span>Title</span>
            <input value={title} onChange={(event) => onTitleChange(event.target.value)} />
          </label>
          <label className="document-core-field">
            <span>Author</span>
            <input value={author} placeholder="Add author" onChange={(event) => onAuthorChange(event.target.value)} />
          </label>
          <label className="document-core-field document-version-field">
            <span>Version</span>
            <input value={version} placeholder="0.1" onChange={(event) => onVersionChange(event.target.value)} />
          </label>
        </div>
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
