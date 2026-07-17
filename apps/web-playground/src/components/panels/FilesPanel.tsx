import { FilePlus, FileText, FolderOpen, RefreshCw, Save } from "lucide-react";
import type { WindowSdocWorkspaceEntry } from "../../documentNativeBridge";
import { formatRecentFileTime } from "../editor-shell/DesktopStartScreen";
import type { RecentFileEntry } from "../editor-shell/types";

export interface FilesPanelProps {
  currentFile: string;
  sdocFilename: string;
  savedLabel: string;
  recentFiles: RecentFileEntry[];
  isDesktopRuntime: boolean;
  workspaceDirectory: string | null;
  workspaceEntries: WindowSdocWorkspaceEntry[];
  isWorkspaceLoading: boolean;
  onNewDocument: () => void;
  onOpenDocument: () => void;
  onSaveSdoc: () => void;
  sdocSaveLabel: string;
  onSelectRecentFile: (entry: RecentFileEntry) => void;
  onChooseWorkspaceDirectory: () => void;
  onRefreshWorkspace: () => void;
  onOpenWorkspaceEntry: (entry: WindowSdocWorkspaceEntry) => void;
  onCopyDeveloperCommand: (command: string) => void;
}

export function FilesPanel({
  currentFile,
  sdocFilename,
  savedLabel,
  recentFiles,
  isDesktopRuntime,
  workspaceDirectory,
  workspaceEntries,
  isWorkspaceLoading,
  onNewDocument,
  onOpenDocument,
  onSaveSdoc,
  sdocSaveLabel,
  onSelectRecentFile,
  onChooseWorkspaceDirectory,
  onRefreshWorkspace,
  onOpenWorkspaceEntry,
  onCopyDeveloperCommand
}: FilesPanelProps) {
  const unpackCommand = `npm run sdoc -- unpack ${quoteCliPath(sdocFilename)} ${quoteCliPath(`${sdocFilename}.d`)}`;
  const packCommand = `npm run sdoc -- pack ${quoteCliPath(`${sdocFilename}.d`)} ${quoteCliPath(sdocFilename)}`;
  const isCurrentUnsaved = savedLabel.toLowerCase().includes("unsaved") || savedLabel === "Not saved";
  const currentWorkspaceEntries = workspaceEntries.filter((entry) => entry.name === currentFile || entry.path === currentFile);

  return (
    <div className="side-panel-section files-panel explorer-panel">
      <section className="explorer-current" aria-label="Current file">
        <span className={isCurrentUnsaved ? "file-state-dot unsaved" : "file-state-dot"} aria-hidden="true" />
        <div>
          <strong title={currentFile}>{currentFile}</strong>
          <span>{savedLabel}</span>
        </div>
      </section>

      <div className="explorer-actions" aria-label="File actions">
        <button type="button" onClick={onNewDocument}>
          <FilePlus size={15} />
          <span>New</span>
        </button>
        <button type="button" onClick={onOpenDocument}>
          <FolderOpen size={15} />
          <span>Open</span>
        </button>
        <button type="button" onClick={onSaveSdoc}>
          <Save size={15} />
          <span>{sdocSaveLabel}</span>
        </button>
      </div>

      <section className="workspace-files explorer-section" aria-label="Workspace files">
        <div className="explorer-section-header">
          <h3>Explorer</h3>
          {isDesktopRuntime && (
            <button type="button" onClick={onRefreshWorkspace} disabled={!workspaceDirectory || isWorkspaceLoading} title="Refresh workspace">
              <RefreshCw size={14} />
            </button>
          )}
        </div>
        {isDesktopRuntime ? (
          <>
            <div className="explorer-root">
              <FolderOpen size={15} />
              <strong title={workspaceDirectory ?? "No workspace folder selected"}>{workspaceDirectory ? basenameFromPath(workspaceDirectory) : "No folder selected"}</strong>
              {workspaceDirectory && <span title={workspaceDirectory}>{workspaceDirectory}</span>}
            </div>
            <div className="explorer-folder-actions" aria-label="Workspace actions">
              <button type="button" onClick={onChooseWorkspaceDirectory}>
                {workspaceDirectory ? "Change folder" : "Open folder"}
              </button>
            </div>
            {workspaceEntries.length === 0 ? (
              <p className="explorer-empty">{isWorkspaceLoading ? "Loading workspace files" : "No .sdoc files in this folder"}</p>
            ) : (
              <ul className="explorer-tree">
                {workspaceEntries.map((entry) => (
                  <li key={entry.path} className={isCurrentWorkspaceEntry(entry, currentFile, currentWorkspaceEntries) ? "active" : undefined}>
                    <button type="button" onClick={() => onOpenWorkspaceEntry(entry)} disabled={entry.kind !== "sdoc-file"} title={entry.path}>
                      <FileText size={15} />
                      <span>{entry.name}</span>
                      <small>{formatWorkspaceEntryMeta(entry)}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="workspace-boundary browser-boundary">
            <strong>Desktop-only browsing</strong>
            <span>Folder exploration is available through the Tauri app. Browser mode only opens files selected by the user.</span>
          </div>
        )}
      </section>

      <section className="recent-files explorer-section" aria-label="Recent files">
        <h3>Recent documents</h3>
        {recentFiles.length === 0 ? (
          <p>No recent browser activity</p>
        ) : (
          <ul>
            {recentFiles.map((entry) => (
              <li key={entry.id}>
                <button type="button" onClick={() => onSelectRecentFile(entry)}>
                  <FileText size={15} />
                  <strong>{entry.name}</strong>
                  <span>
                    {entry.action} {entry.title} - {formatRecentFileTime(entry.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="developer-workspace" aria-label="Unpacked folder workflow">
        <details>
          <summary>Developer workspace</summary>
          <div className="workspace-boundary">
            <strong>Single-file .sdoc is the authoring format</strong>
            <span>Unpacked folders and CLI commands are advanced review/debug workflows.</span>
          </div>
          <button type="button" onClick={() => onCopyDeveloperCommand(unpackCommand)}>
            Copy unpack command
          </button>
          <button type="button" onClick={() => onCopyDeveloperCommand(packCommand)}>
            Copy pack command
          </button>
        </details>
      </section>
    </div>
  );
}

function formatWorkspaceEntryMeta(entry: WindowSdocWorkspaceEntry): string {
  const parts = [entry.kind === "unpacked-sdoc-folder" ? "unpacked folder" : "single .sdoc"];
  if (typeof entry.sizeBytes === "number") {
    parts.push(formatByteSize(entry.sizeBytes));
  }
  if (typeof entry.modifiedAtMs === "number") {
    const modified = new Date(entry.modifiedAtMs);
    if (!Number.isNaN(modified.getTime())) {
      parts.push(modified.toLocaleString());
    }
  }
  return parts.join(" - ");
}

function basenameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean).pop() ?? path;
}

function isCurrentWorkspaceEntry(entry: WindowSdocWorkspaceEntry, currentFile: string, candidates: WindowSdocWorkspaceEntry[]): boolean {
  return entry.name === currentFile || entry.path === currentFile || candidates.some((candidate) => candidate.path === entry.path);
}

function formatByteSize(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  const kib = value / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1)} KB`;
  }

  return `${(kib / 1024).toFixed(1)} MB`;
}

function quoteCliPath(value: string): string {
  return `"${value.replaceAll('"', '\\"')}"`;
}
