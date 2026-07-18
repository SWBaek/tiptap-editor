import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2
} from "lucide-react";
import type { WindowSdocWorkspaceEntry } from "../../documentNativeBridge";
import type { WorkspaceCreateKind } from "../dialogs/WorkspaceCreateDialog";
import type { WorkspaceEntryAction } from "../dialogs/WorkspaceEntryActionDialog";

export interface FilesPanelProps {
  currentFile: string;
  isCurrentFileUnsaved: boolean;
  isDesktopRuntime: boolean;
  workspaceDirectory: string | null;
  workspaceEntries: WindowSdocWorkspaceEntry[];
  isWorkspaceLoading: boolean;
  saveFailureMessage: string | null;
  externalChangeMessage: string | null;
  onRetrySave: () => void;
  onSaveAs: () => void;
  onChooseWorkspaceDirectory: () => void;
  onRefreshWorkspace: () => void;
  onOpenWorkspaceEntry: (entry: WindowSdocWorkspaceEntry) => void;
  onCreateWorkspaceEntry: (parent: WindowSdocWorkspaceEntry | null, kind: WorkspaceCreateKind) => void;
  onManageWorkspaceEntry: (entry: WindowSdocWorkspaceEntry, action: WorkspaceEntryAction) => void;
  onReloadExternalChange: () => void;
  onKeepExternalChange: () => void;
  onCompareExternalChange: () => void;
}

export function FilesPanel({
  currentFile,
  isCurrentFileUnsaved,
  isDesktopRuntime,
  workspaceDirectory,
  workspaceEntries,
  isWorkspaceLoading,
  saveFailureMessage,
  externalChangeMessage,
  onRetrySave,
  onSaveAs,
  onChooseWorkspaceDirectory,
  onRefreshWorkspace,
  onOpenWorkspaceEntry,
  onCreateWorkspaceEntry,
  onManageWorkspaceEntry,
  onReloadExternalChange,
  onKeepExternalChange,
  onCompareExternalChange
}: FilesPanelProps) {
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
      <section className="workspace-files" aria-label="Workspace files">
        <header className="explorer-header">
          <h2>Explorer</h2>
          {isDesktopRuntime && (
            <div className="explorer-header-actions" aria-label="Explorer actions">
              <button
                type="button"
                onClick={() => onCreateWorkspaceEntry(selectedWorkspaceFolder, "sdoc-file")}
                disabled={!workspaceDirectory}
                title="New document"
                aria-label="Create SDoc document"
              >
                <FilePlus size={15} />
              </button>
              <button
                type="button"
                onClick={() => onCreateWorkspaceEntry(selectedWorkspaceFolder, "folder")}
                disabled={!workspaceDirectory}
                title="New folder"
                aria-label="Create folder"
              >
                <FolderPlus size={15} />
              </button>
              <button
                type="button"
                onClick={onRefreshWorkspace}
                disabled={!workspaceDirectory || isWorkspaceLoading}
                title="Refresh workspace"
                aria-label="Refresh workspace"
              >
                <RefreshCw size={14} />
              </button>
              <details className="explorer-more-menu">
                <summary title="More Explorer actions" aria-label="More Explorer actions">
                  <MoreHorizontal size={15} />
                </summary>
                <div role="menu" aria-label="More Explorer actions">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(event) => {
                      event.currentTarget.closest("details")?.removeAttribute("open");
                      onChooseWorkspaceDirectory();
                    }}
                  >
                    <FolderOpen size={14} /> {workspaceDirectory ? "Change folder" : "Open folder"}
                  </button>
                </div>
              </details>
            </div>
          )}
        </header>

        {saveFailureMessage && (
          <section className="save-recovery-alert explorer-notice" role="alert" aria-label="Save failed">
            <strong>Save failed</strong>
            <span>{saveFailureMessage}</span>
            <div>
              <button type="button" onClick={onRetrySave}>Retry</button>
              {isDesktopRuntime && <button type="button" onClick={onSaveAs}>Save As</button>}
            </div>
          </section>
        )}

        <div className="explorer-tree-scroll">
          {isDesktopRuntime ? (
            <>
              {workspaceDirectory ? (
                <div className="explorer-root" title={workspaceDirectory}>
                  <FolderOpen size={15} />
                  <strong>{basenameFromPath(workspaceDirectory)}</strong>
                </div>
              ) : (
                <div className="explorer-empty-state">
                  <span>No workspace folder is open.</span>
                  <button type="button" onClick={onChooseWorkspaceDirectory}>Open folder</button>
                </div>
              )}
              {externalChangeMessage && (
                <div className="workspace-external-change explorer-notice" role="alert">
                  <strong>External change detected</strong>
                  <span>{externalChangeMessage}</span>
                  <div className="workspace-external-change-actions">
                    <button type="button" onClick={onReloadExternalChange}>Reload from disk</button>
                    <button type="button" onClick={onKeepExternalChange}>Keep current</button>
                    <button type="button" onClick={onCompareExternalChange}>Compare</button>
                  </div>
                </div>
              )}
              {workspaceDirectory && workspaceEntries.length === 0 ? (
                <p className="explorer-empty">{isWorkspaceLoading ? "Loading workspace files" : "No folders or .sdoc files in this workspace"}</p>
              ) : workspaceDirectory ? (
                <WorkspaceTree
                  entries={workspaceEntries}
                  currentFile={currentFile}
                  isCurrentFileUnsaved={isCurrentFileUnsaved}
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
              ) : null}
            </>
          ) : (
            <div className="workspace-boundary browser-boundary">
              <strong>Desktop-only browsing</strong>
              <span>Folder exploration is available through the Tauri app. Browser mode only opens files selected by the user.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

interface WorkspaceTreeProps {
  entries: WindowSdocWorkspaceEntry[];
  currentFile: string;
  isCurrentFileUnsaved: boolean;
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
  isCurrentFileUnsaved,
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
        const isCurrent = isCurrentWorkspaceEntry(entry, currentFile);
        return (
          <li
            key={entry.path}
            className={isCurrent ? "active" : isFolder && selectedFolderPath === entry.path ? "selected-folder" : undefined}
          >
            <div className="explorer-entry-row">
              <button
                className="explorer-entry-main"
                type="button"
                onClick={() => isFolder ? onToggleFolder(entry.path) : onOpenEntry(entry)}
                disabled={entry.kind === "unpacked-sdoc-folder"}
                title={entry.path}
                aria-expanded={isFolder ? isExpanded : undefined}
                aria-label={isFolder ? `${isExpanded ? "Collapse" : "Expand"} folder ${entry.name}` : entry.name}
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
                <span className="explorer-entry-name">{entry.name}</span>
                {isCurrent && isCurrentFileUnsaved && <span className="explorer-dirty-indicator" title="Unsaved changes" aria-label="Unsaved changes" />}
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
                isCurrentFileUnsaved={isCurrentFileUnsaved}
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

function basenameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean).pop() ?? path;
}

function isCurrentWorkspaceEntry(entry: WindowSdocWorkspaceEntry, currentFile: string): boolean {
  return entry.name === currentFile || entry.path === currentFile;
}
