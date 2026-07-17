import { FilePlus, FileText, FolderOpen } from "lucide-react";
import type { RecentFileEntry } from "./types";

export interface DesktopStartScreenProps {
  recentFiles: RecentFileEntry[];
  isWorkspaceLoading: boolean;
  onNewDocument: () => void;
  onOpenDocument: () => void;
  onChooseWorkspaceDirectory: () => void;
  onOpenRecentFile: (entry: RecentFileEntry) => void;
}

export function DesktopStartScreen({
  recentFiles,
  isWorkspaceLoading,
  onNewDocument,
  onOpenDocument,
  onChooseWorkspaceDirectory,
  onOpenRecentFile
}: DesktopStartScreenProps) {
  return (
    <div className="desktop-start-screen" aria-label="Desktop start screen">
      <section className="desktop-start-main">
        <div className="desktop-start-heading">
          <FileText size={28} />
          <div>
            <h1>SDoc Editor</h1>
            <p>Open a workspace or create a technical document.</p>
          </div>
        </div>

        <div className="desktop-start-actions" aria-label="Start actions">
          <button type="button" onClick={onChooseWorkspaceDirectory} disabled={isWorkspaceLoading}>
            <FolderOpen size={18} />
            <span>{isWorkspaceLoading ? "Opening folder..." : "Open Folder"}</span>
          </button>
          <button type="button" onClick={onOpenDocument}>
            <FileText size={18} />
            <span>Open .sdoc</span>
          </button>
          <button type="button" onClick={onNewDocument}>
            <FilePlus size={18} />
            <span>New .sdoc</span>
          </button>
        </div>
      </section>

      <section className="desktop-start-recent" aria-label="Recent Documents">
        <h2>Recent Documents</h2>
        {recentFiles.length === 0 ? (
          <p>No recent documents yet.</p>
        ) : (
          <ul>
            {recentFiles.map((entry) => (
              <li key={entry.id}>
                <button type="button" onClick={() => onOpenRecentFile(entry)}>
                  <strong>{entry.name}</strong>
                  <span>
                    {entry.action} {entry.title} - {formatRecentFileTime(entry.updatedAt)}
                  </span>
                  {entry.nativePath && <small title={entry.nativePath}>{entry.nativePath}</small>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function formatRecentFileTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}
