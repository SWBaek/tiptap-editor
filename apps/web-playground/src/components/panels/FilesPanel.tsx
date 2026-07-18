import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FilePlus, FileText, Folder, FolderOpen, FolderPlus, MoreHorizontal, Pencil, RefreshCw, Save, Trash2 } from "lucide-react";
import type { WindowSdocWorkspaceEntry } from "../../documentNativeBridge";
import type { WorkspaceCreateKind } from "../dialogs/WorkspaceCreateDialog";
import type { WorkspaceEntryAction } from "../dialogs/WorkspaceEntryActionDialog";
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
  saveFailureMessage: string | null;
  externalChangeMessage: string | null;
  onNewDocument: () => void;
  onOpenDocument: () => void;
  onSaveSdoc: () => void;
  onRetrySave: () => void;
  onSaveAs: () => void;
  sdocSaveLabel: string;
  onSelectRecentFile: (entry: RecentFileEntry) => void;
  onChooseWorkspaceDirectory: () => void;
  onRefreshWorkspace: () => void;
  onOpenWorkspaceEntry: (entry: WindowSdocWorkspaceEntry) => void;
  onCreateWorkspaceEntry: (parent: WindowSdocWorkspaceEntry | null, kind: WorkspaceCreateKind) => void;
  onManageWorkspaceEntry: (entry: WindowSdocWorkspaceEntry, action: WorkspaceEntryAction) => void;
  onDismissExternalChange: () => void;
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
  saveFailureMessage,
  externalChangeMessage,
  onNewDocument,
  onOpenDocument,
  onSaveSdoc,
  onRetrySave,
  onSaveAs,
  sdocSaveLabel,
  onSelectRecentFile,
  onChooseWorkspaceDirectory,
  onRefreshWorkspace,
  onOpenWorkspaceEntry,
  onCreateWorkspaceEntry,
  onManageWorkspaceEntry,
  onDismissExternalChange,
  onCopyDeveloperCommand
}: FilesPanelProps) {
  const unpackCommand = `npm run sdoc -- unpack ${quoteCliPath(sdocFilename)} ${quoteCliPath(`${sdocFilename}.d`)}`;
  const packCommand = `npm run sdoc -- pack ${quoteCliPath(`${sdocFilename}.d`)} ${quoteCliPath(sdocFilename)}`;
  const isCurrentUnsaved = savedLabel.toLowerCase().includes("unsaved") || savedLabel === "Not saved";
  const [expandedWorkspacePaths, setExpandedWorkspacePaths] = useState<Set<string>>(() => new Set());
  const [selectedWorkspaceFolderPath, setSelectedWorkspaceFolderPath] = useState<string | null>(null);
  const [openWorkspaceActionsPath, setOpenWorkspaceActionsPath] = useState<string | null>(null);
  const selectedWorkspaceFolder = selectedWorkspaceFolderPath ? findWorkspaceFolder(workspaceEntries, selectedWorkspaceFolderPath) : null;

  useEffect(() => {
    setExpandedWorkspacePaths(new Set());
    setSelectedWorkspaceFolderPath(null);
    setOpenWorkspaceActionsPath(null);
  }, [workspaceDirectory]);

  function selectAndToggleWorkspaceFolder(path: string) {
    setSelectedWorkspaceFolderPath(path);
    setExpandedWorkspacePaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  return (
    <div className="side-panel-section files-panel explorer-panel">
      <section className="explorer-current" aria-label="Current file">
        <span className={isCurrentUnsaved ? "file-state-dot unsaved" : "file-state-dot"} aria-hidden="true" />
        <div>
          <strong title={currentFile}>{currentFile}</strong>
          <span>{savedLabel}</span>
        </div>
      </section>

      {saveFailureMessage && (
        <section className="save-recovery-alert" role="alert" aria-label="Save failed">
          <strong>Save failed</strong>
          <span>{saveFailureMessage}</span>
          <div>
            <button type="button" onClick={onRetrySave}>Retry</button>
            {isDesktopRuntime && <button type="button" onClick={onSaveAs}>Save As</button>}
          </div>
        </section>
      )}

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
            {externalChangeMessage && (
              <div className="workspace-external-change" role="alert">
                <strong>External change detected</strong>
                <span>{externalChangeMessage}</span>
                <button type="button" onClick={onDismissExternalChange}>Keep current editor state</button>
              </div>
            )}
            <div className="explorer-folder-actions" aria-label="Workspace actions">
              <button type="button" onClick={onChooseWorkspaceDirectory}>
                {workspaceDirectory ? "Change folder" : "Open folder"}
              </button>
              {workspaceDirectory && (
                <>
                  <button type="button" onClick={() => onCreateWorkspaceEntry(selectedWorkspaceFolder, "sdoc-file")} title="Create SDoc document" aria-label="Create SDoc document">
                    <FilePlus size={13} /> New document
                  </button>
                  <button type="button" onClick={() => onCreateWorkspaceEntry(selectedWorkspaceFolder, "folder")} title="Create folder" aria-label="Create folder">
                    <FolderPlus size={13} /> New folder
                  </button>
                </>
              )}
            </div>
            {workspaceDirectory && (
              <p className="explorer-create-target">New entries: {selectedWorkspaceFolder?.name ?? basenameFromPath(workspaceDirectory)}</p>
            )}
            {workspaceEntries.length === 0 ? (
              <p className="explorer-empty">{isWorkspaceLoading ? "Loading workspace files" : "No folders or .sdoc files in this workspace"}</p>
            ) : (
              <WorkspaceTree
                entries={workspaceEntries}
                currentFile={currentFile}
                expandedPaths={expandedWorkspacePaths}
                selectedFolderPath={selectedWorkspaceFolderPath}
                onToggleFolder={selectAndToggleWorkspaceFolder}
                onOpenEntry={onOpenWorkspaceEntry}
                openActionsPath={openWorkspaceActionsPath}
                onToggleActions={(path) => setOpenWorkspaceActionsPath((current) => current === path ? null : path)}
                onManageEntry={(entry, action) => {
                  setOpenWorkspaceActionsPath(null);
                  onManageWorkspaceEntry(entry, action);
                }}
              />
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

interface WorkspaceTreeProps {
  entries: WindowSdocWorkspaceEntry[];
  currentFile: string;
  expandedPaths: Set<string>;
  selectedFolderPath: string | null;
  onToggleFolder: (path: string) => void;
  onOpenEntry: (entry: WindowSdocWorkspaceEntry) => void;
  openActionsPath: string | null;
  onToggleActions: (path: string) => void;
  onManageEntry: (entry: WindowSdocWorkspaceEntry, action: WorkspaceEntryAction) => void;
}

function WorkspaceTree({
  entries,
  currentFile,
  expandedPaths,
  selectedFolderPath,
  onToggleFolder,
  onOpenEntry,
  openActionsPath,
  onToggleActions,
  onManageEntry
}: WorkspaceTreeProps) {
  return (
    <ul className="explorer-tree">
      {entries.map((entry) => {
        const isFolder = entry.kind === "folder";
        const isExpanded = isFolder && expandedPaths.has(entry.path);
        return (
          <li
            key={entry.path}
            className={isCurrentWorkspaceEntry(entry, currentFile) ? "active" : isFolder && selectedFolderPath === entry.path ? "selected-folder" : undefined}
          >
            <div className="explorer-entry-row">
              <button
                className="explorer-entry-main"
                type="button"
                onClick={() => isFolder ? onToggleFolder(entry.path) : onOpenEntry(entry)}
                disabled={entry.kind === "unpacked-sdoc-folder"}
                title={entry.path}
                aria-expanded={isFolder ? isExpanded : undefined}
                aria-label={isFolder ? `${isExpanded ? "Collapse" : "Expand"} folder ${entry.name}` : undefined}
              >
                {isFolder ? (
                  <>
                    {isExpanded ? <ChevronDown className="explorer-chevron" size={13} /> : <ChevronRight className="explorer-chevron" size={13} />}
                    {isExpanded ? <FolderOpen size={15} /> : <Folder size={15} />}
                  </>
                ) : (
                  <>
                    <span className="explorer-chevron-placeholder" aria-hidden="true" />
                    <FileText size={15} />
                  </>
                )}
                <span>{entry.name}</span>
                <small>{formatWorkspaceEntryMeta(entry)}</small>
              </button>
              {entry.kind !== "unpacked-sdoc-folder" && (
                <button
                  className="explorer-entry-actions-toggle"
                  type="button"
                  aria-label={`Actions for ${entry.name}`}
                  aria-expanded={openActionsPath === entry.path}
                  onClick={() => onToggleActions(entry.path)}
                >
                  <MoreHorizontal size={14} />
                </button>
              )}
              {openActionsPath === entry.path && (
                <div className="explorer-entry-menu" role="menu" aria-label={`Workspace actions for ${entry.name}`}>
                  <button type="button" role="menuitem" onClick={() => onManageEntry(entry, "rename")}>
                    <Pencil size={13} /> Rename
                  </button>
                  <button className="danger" type="button" role="menuitem" onClick={() => onManageEntry(entry, "trash")}>
                    <Trash2 size={13} /> Move to Trash
                  </button>
                </div>
              )}
            </div>
            {isExpanded && entry.children && entry.children.length > 0 && (
              <WorkspaceTree
                entries={entry.children}
                currentFile={currentFile}
                expandedPaths={expandedPaths}
                selectedFolderPath={selectedFolderPath}
                onToggleFolder={onToggleFolder}
                onOpenEntry={onOpenEntry}
                openActionsPath={openActionsPath}
                onToggleActions={onToggleActions}
                onManageEntry={onManageEntry}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function findWorkspaceFolder(entries: WindowSdocWorkspaceEntry[], path: string): WindowSdocWorkspaceEntry | null {
  for (const entry of entries) {
    if (entry.kind === "folder" && entry.path === path) {
      return entry;
    }
    const nested = entry.children ? findWorkspaceFolder(entry.children, path) : null;
    if (nested) {
      return nested;
    }
  }
  return null;
}

function formatWorkspaceEntryMeta(entry: WindowSdocWorkspaceEntry): string {
  const parts = [entry.kind === "folder" ? "folder" : entry.kind === "unpacked-sdoc-folder" ? "unpacked folder" : "single .sdoc"];
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

function isCurrentWorkspaceEntry(entry: WindowSdocWorkspaceEntry, currentFile: string): boolean {
  return entry.name === currentFile || entry.path === currentFile;
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
