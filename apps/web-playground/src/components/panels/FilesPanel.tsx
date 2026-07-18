import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MutableRefObject } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
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
import {
  normalizeWorkspaceEntryName,
  validateWorkspaceEntryName,
  type WorkspaceCreateKind
} from "../dialogs/WorkspaceCreateDialog";
import {
  findWorkspaceAncestorFolders,
  findWorkspaceEntry,
  flattenVisibleWorkspaceEntries,
  isWorkspaceFolder,
  sortWorkspaceEntries,
  workspacePathsEqual,
  type VisibleWorkspaceEntry
} from "./explorerTreeModel";

export interface FilesPanelProps {
  currentFilePath: string | null;
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
  onCreateWorkspaceEntry: (parent: WindowSdocWorkspaceEntry | null, kind: WorkspaceCreateKind, name: string) => Promise<boolean>;
  onRenameWorkspaceEntry: (entry: WindowSdocWorkspaceEntry, name: string) => Promise<boolean>;
  onTrashWorkspaceEntry: (entry: WindowSdocWorkspaceEntry) => void;
  onReloadExternalChange: () => void;
  onKeepExternalChange: () => void;
  onCompareExternalChange: () => void;
}

type InlineEditState =
  | { mode: "create"; parentPath: string | null; kind: WorkspaceCreateKind; value: string }
  | { mode: "rename"; entry: WindowSdocWorkspaceEntry; kind: WorkspaceCreateKind; value: string };

export function FilesPanel({
  currentFilePath,
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
  onRenameWorkspaceEntry,
  onTrashWorkspaceEntry,
  onReloadExternalChange,
  onKeepExternalChange,
  onCompareExternalChange
}: FilesPanelProps) {
  const [expandedWorkspacePaths, setExpandedWorkspacePaths] = useState<Set<string>>(() => new Set());
  const [selectedWorkspacePath, setSelectedWorkspacePath] = useState<string | null>(null);
  const [focusedWorkspacePath, setFocusedWorkspacePath] = useState<string | null>(null);
  const [openWorkspaceActionsPath, setOpenWorkspaceActionsPath] = useState<string | null>(null);
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null);
  const treeItemRefs = useRef(new Map<string, HTMLDivElement>());
  const lastRevealedCurrentPath = useRef<string | null>(null);

  const visibleEntries = useMemo(
    () => flattenVisibleWorkspaceEntries(workspaceEntries, expandedWorkspacePaths),
    [expandedWorkspacePaths, workspaceEntries]
  );
  const visiblePaths = useMemo(() => new Set(visibleEntries.map(({ entry }) => entry.path)), [visibleEntries]);
  const effectiveFocusedPath = focusedWorkspacePath && visiblePaths.has(focusedWorkspacePath)
    ? focusedWorkspacePath
    : selectedWorkspacePath && visiblePaths.has(selectedWorkspacePath)
      ? selectedWorkspacePath
      : visibleEntries[0]?.entry.path ?? null;
  const selectedWorkspaceEntry = selectedWorkspacePath
    ? findWorkspaceEntry(workspaceEntries, selectedWorkspacePath)
    : null;
  const selectedWorkspaceFolder = selectedWorkspaceEntry && selectedWorkspaceEntry.kind === "folder"
    ? selectedWorkspaceEntry
    : null;

  useEffect(() => {
    setExpandedWorkspacePaths(new Set());
    setSelectedWorkspacePath(null);
    setFocusedWorkspacePath(null);
    setOpenWorkspaceActionsPath(null);
    setInlineEdit(null);
    lastRevealedCurrentPath.current = null;
  }, [workspaceDirectory]);

  useEffect(() => {
    if (!currentFilePath || workspacePathsEqual(lastRevealedCurrentPath.current, currentFilePath)) {
      return;
    }
    const currentEntry = findWorkspaceEntry(workspaceEntries, currentFilePath);
    if (!currentEntry) {
      return;
    }
    const ancestors = findWorkspaceAncestorFolders(workspaceEntries, currentFilePath);
    if (!ancestors) {
      return;
    }
    setExpandedWorkspacePaths((current) => new Set([...current, ...ancestors]));
    setSelectedWorkspacePath(currentEntry.path);
    setFocusedWorkspacePath(currentEntry.path);
    lastRevealedCurrentPath.current = currentEntry.path;
    requestAnimationFrame(() => treeItemRefs.current.get(currentEntry.path)?.scrollIntoView({ block: "nearest" }));
  }, [currentFilePath, workspaceEntries]);

  useEffect(() => {
    if (focusedWorkspacePath && !visiblePaths.has(focusedWorkspacePath)) {
      setFocusedWorkspacePath(effectiveFocusedPath);
    }
  }, [effectiveFocusedPath, focusedWorkspacePath, visiblePaths]);

  const focusEntry = useCallback((path: string, select = true) => {
    setFocusedWorkspacePath(path);
    if (select) {
      setSelectedWorkspacePath(path);
    }
    requestAnimationFrame(() => treeItemRefs.current.get(path)?.focus());
  }, []);

  function toggleFolder(entry: WindowSdocWorkspaceEntry, force?: boolean) {
    if (!isWorkspaceFolder(entry)) {
      return;
    }
    setExpandedWorkspacePaths((current) => {
      const next = new Set(current);
      const shouldExpand = force ?? !next.has(entry.path);
      if (shouldExpand) {
        next.add(entry.path);
      } else {
        next.delete(entry.path);
      }
      return next;
    });
  }

  function startCreate(parent: WindowSdocWorkspaceEntry | null, kind: WorkspaceCreateKind) {
    if (parent) {
      toggleFolder(parent, true);
    }
    setOpenWorkspaceActionsPath(null);
    setInlineEdit({ mode: "create", parentPath: parent?.path ?? null, kind, value: "" });
  }

  function startRename(entry: WindowSdocWorkspaceEntry) {
    if (entry.kind === "unpacked-sdoc-folder") {
      return;
    }
    setOpenWorkspaceActionsPath(null);
    setSelectedWorkspacePath(entry.path);
    setInlineEdit({
      mode: "rename",
      entry,
      kind: entry.kind === "sdoc-file" ? "sdoc-file" : "folder",
      value: entry.name
    });
  }

  function closeActions(path?: string) {
    setOpenWorkspaceActionsPath(null);
    if (path) {
      focusEntry(path, false);
    }
  }

  function handleTreeKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, item: VisibleWorkspaceEntry) {
    if (event.target !== event.currentTarget) {
      return;
    }
    const { entry, parentPath } = item;
    const currentIndex = visibleEntries.findIndex((candidate) => candidate.entry.path === entry.path);
    const isFolder = isWorkspaceFolder(entry);

    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
          ? visibleEntries.length - 1
          : Math.max(0, Math.min(visibleEntries.length - 1, currentIndex + (event.key === "ArrowDown" ? 1 : -1)));
      const nextPath = visibleEntries[nextIndex]?.entry.path;
      if (nextPath) {
        focusEntry(nextPath);
      }
      return;
    }

    if (event.key === "ArrowRight" && isFolder) {
      event.preventDefault();
      if (!expandedWorkspacePaths.has(entry.path)) {
        toggleFolder(entry, true);
      } else {
        const firstChild = sortWorkspaceEntries(entry.children ?? [])[0];
        if (firstChild) {
          focusEntry(firstChild.path);
        }
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (isFolder && expandedWorkspacePaths.has(entry.path)) {
        toggleFolder(entry, false);
      } else if (parentPath) {
        focusEntry(parentPath);
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (isFolder) {
        toggleFolder(entry);
      } else {
        onOpenWorkspaceEntry(entry);
      }
      return;
    }

    if (event.key === "F2") {
      event.preventDefault();
      startRename(entry);
      return;
    }

    if (event.key === "Delete" && entry.kind !== "unpacked-sdoc-folder") {
      event.preventDefault();
      onTrashWorkspaceEntry(entry);
      return;
    }

    if ((event.key === "F10" && event.shiftKey) || event.key === "ContextMenu") {
      event.preventDefault();
      setSelectedWorkspacePath(entry.path);
      setOpenWorkspaceActionsPath(entry.path);
      return;
    }

    if (event.key === "Escape") {
      setOpenWorkspaceActionsPath(null);
      setInlineEdit(null);
    }
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
                onClick={() => startCreate(selectedWorkspaceFolder, "sdoc-file")}
                disabled={!workspaceDirectory}
                title="New document"
                aria-label="Create SDoc document"
              >
                <FilePlus size={15} />
              </button>
              <button
                type="button"
                onClick={() => startCreate(selectedWorkspaceFolder, "folder")}
                disabled={!workspaceDirectory}
                title="New folder"
                aria-label="Create folder"
              >
                <FolderPlus size={15} />
              </button>
              <button
                type="button"
                onClick={() => setExpandedWorkspacePaths(new Set())}
                disabled={!workspaceDirectory || expandedWorkspacePaths.size === 0}
                title="Collapse All"
                aria-label="Collapse All"
              >
                <ChevronUp size={15} />
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
              {workspaceDirectory && workspaceEntries.length === 0 && !inlineEdit ? (
                <p className="explorer-empty">{isWorkspaceLoading ? "Loading workspace files" : "No folders or .sdoc files in this workspace"}</p>
              ) : workspaceDirectory ? (
                <div className="explorer-tree" role="tree" aria-label="Workspace folders and documents">
                  <WorkspaceTreeGroup
                    entries={workspaceEntries}
                    parentPath={null}
                    level={1}
                    currentFilePath={currentFilePath}
                    isCurrentFileUnsaved={isCurrentFileUnsaved}
                    expandedPaths={expandedWorkspacePaths}
                    selectedPath={selectedWorkspacePath}
                    focusedPath={effectiveFocusedPath}
                    openActionsPath={openWorkspaceActionsPath}
                    inlineEdit={inlineEdit}
                    treeItemRefs={treeItemRefs}
                    onSelect={focusEntry}
                    onToggleFolder={toggleFolder}
                    onOpenEntry={onOpenWorkspaceEntry}
                    onKeyDown={handleTreeKeyDown}
                    onOpenActions={(entry) => {
                      setSelectedWorkspacePath(entry.path);
                      setOpenWorkspaceActionsPath(entry.path);
                    }}
                    onCloseActions={closeActions}
                    onStartCreate={startCreate}
                    onStartRename={startRename}
                    onTrash={onTrashWorkspaceEntry}
                    onInlineChange={(value) => setInlineEdit((current) => current ? { ...current, value } : null)}
                    onInlineCancel={() => setInlineEdit(null)}
                    onInlineSubmit={async () => {
                      if (!inlineEdit) {
                        return false;
                      }
                      const name = normalizeWorkspaceEntryName(inlineEdit.kind, inlineEdit.value);
                      const success = inlineEdit.mode === "create"
                        ? await onCreateWorkspaceEntry(
                          inlineEdit.parentPath ? findWorkspaceEntry(workspaceEntries, inlineEdit.parentPath) : null,
                          inlineEdit.kind,
                          name
                        )
                        : await onRenameWorkspaceEntry(inlineEdit.entry, name);
                      if (success) {
                        setInlineEdit(null);
                      }
                      return success;
                    }}
                  />
                </div>
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

interface WorkspaceTreeGroupProps {
  entries: WindowSdocWorkspaceEntry[];
  parentPath: string | null;
  level: number;
  currentFilePath: string | null;
  isCurrentFileUnsaved: boolean;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  focusedPath: string | null;
  openActionsPath: string | null;
  inlineEdit: InlineEditState | null;
  treeItemRefs: MutableRefObject<Map<string, HTMLDivElement>>;
  onSelect: (path: string) => void;
  onToggleFolder: (entry: WindowSdocWorkspaceEntry, force?: boolean) => void;
  onOpenEntry: (entry: WindowSdocWorkspaceEntry) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>, item: VisibleWorkspaceEntry) => void;
  onOpenActions: (entry: WindowSdocWorkspaceEntry) => void;
  onCloseActions: (path?: string) => void;
  onStartCreate: (parent: WindowSdocWorkspaceEntry | null, kind: WorkspaceCreateKind) => void;
  onStartRename: (entry: WindowSdocWorkspaceEntry) => void;
  onTrash: (entry: WindowSdocWorkspaceEntry) => void;
  onInlineChange: (value: string) => void;
  onInlineCancel: () => void;
  onInlineSubmit: () => Promise<boolean>;
}

function WorkspaceTreeGroup(props: WorkspaceTreeGroupProps) {
  const {
    entries,
    parentPath,
    level,
    currentFilePath,
    isCurrentFileUnsaved,
    expandedPaths,
    selectedPath,
    focusedPath,
    openActionsPath,
    inlineEdit,
    treeItemRefs,
    onSelect,
    onToggleFolder,
    onOpenEntry,
    onKeyDown,
    onOpenActions,
    onCloseActions,
    onStartCreate,
    onStartRename,
    onTrash,
    onInlineChange,
    onInlineCancel,
    onInlineSubmit
  } = props;
  const isNested = parentPath !== null;

  return (
    <div role={isNested ? "group" : undefined} className={isNested ? "explorer-tree-group" : undefined}>
      {inlineEdit?.mode === "create" && inlineEdit.parentPath === parentPath && (
        <InlineTreeEditor
          level={level}
          kind={inlineEdit.kind}
          value={inlineEdit.value}
          mode="create"
          onChange={onInlineChange}
          onCancel={onInlineCancel}
          onSubmit={onInlineSubmit}
        />
      )}
      {sortWorkspaceEntries(entries).map((entry) => {
        const isFolder = isWorkspaceFolder(entry);
        const isExpanded = isFolder && expandedPaths.has(entry.path);
        const isCurrent = workspacePathsEqual(entry.path, currentFilePath);
        const isSelected = workspacePathsEqual(entry.path, selectedPath);
        const isRenaming = inlineEdit?.mode === "rename" && workspacePathsEqual(inlineEdit.entry.path, entry.path);
        const item: VisibleWorkspaceEntry = { entry, level, parentPath };
        const style = { "--explorer-level": level } as CSSProperties;

        return (
          <div key={entry.path}>
            {isRenaming ? (
              <InlineTreeEditor
                level={level}
                kind={inlineEdit.kind}
                value={inlineEdit.value}
                originalName={entry.name}
                mode="rename"
                onChange={onInlineChange}
                onCancel={onInlineCancel}
                onSubmit={onInlineSubmit}
              />
            ) : (
              <div
                ref={(node) => {
                  if (node) {
                    treeItemRefs.current.set(entry.path, node);
                  } else {
                    treeItemRefs.current.delete(entry.path);
                  }
                }}
                className={`explorer-entry-row${isCurrent ? " active" : ""}${isSelected ? " selected" : ""}`}
                style={style}
                role="treeitem"
                tabIndex={workspacePathsEqual(focusedPath, entry.path) ? 0 : -1}
                aria-level={level}
                aria-expanded={isFolder ? isExpanded : undefined}
                aria-selected={isSelected}
                aria-current={isCurrent ? "page" : undefined}
                aria-disabled={entry.kind === "unpacked-sdoc-folder" || undefined}
                aria-label={entry.name}
                title={entry.path}
                onFocus={(event) => {
                  if (event.target === event.currentTarget) {
                    onSelect(entry.path);
                  }
                }}
                onKeyDown={(event) => onKeyDown(event, item)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  if (entry.kind !== "unpacked-sdoc-folder") {
                    onOpenActions(entry);
                  }
                }}
              >
                {isFolder ? (
                  <button
                    className="explorer-chevron-button"
                    type="button"
                    tabIndex={-1}
                    aria-label={`${isExpanded ? "Collapse" : "Expand"} folder ${entry.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(entry.path);
                      onToggleFolder(entry);
                    }}
                  >
                    {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>
                ) : <span className="explorer-chevron-placeholder" aria-hidden="true" />}
                <button
                  className="explorer-entry-main"
                  type="button"
                  tabIndex={-1}
                  aria-label={entry.name}
                  onClick={() => onSelect(entry.path)}
                  onDoubleClick={() => {
                    if (!isFolder) {
                      onOpenEntry(entry);
                    }
                  }}
                >
                  {isFolder
                    ? isExpanded ? <FolderOpen size={15} /> : <Folder size={15} />
                    : <FileText size={15} />}
                  <span className="explorer-entry-name">{entry.name}</span>
                  {isCurrent && isCurrentFileUnsaved && (
                    <span className="explorer-dirty-indicator" title="Unsaved changes" aria-label="Unsaved changes" />
                  )}
                </button>
                {entry.kind !== "unpacked-sdoc-folder" && (
                  <button
                    className="explorer-entry-actions-toggle"
                    type="button"
                    tabIndex={-1}
                    aria-label={`Actions for ${entry.name}`}
                    aria-expanded={openActionsPath === entry.path}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (openActionsPath === entry.path) {
                        onCloseActions(entry.path);
                      } else {
                        onOpenActions(entry);
                      }
                    }}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                )}
                {openActionsPath === entry.path && (
                  <WorkspaceEntryMenu
                    entry={entry}
                    onClose={() => onCloseActions(entry.path)}
                    onCreate={(kind) => onStartCreate(entry.kind === "folder" ? entry : null, kind)}
                    onRename={() => onStartRename(entry)}
                    onTrash={() => {
                      onCloseActions();
                      onTrash(entry);
                    }}
                  />
                )}
              </div>
            )}
            {isExpanded && entry.children && (
              <WorkspaceTreeGroup
                {...props}
                entries={entry.children}
                parentPath={entry.path}
                level={level + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface InlineTreeEditorProps {
  level: number;
  kind: WorkspaceCreateKind;
  value: string;
  originalName?: string;
  mode: "create" | "rename";
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => Promise<boolean>;
}

function InlineTreeEditor({ level, kind, value, originalName, mode, onChange, onCancel, onSubmit }: InlineTreeEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const normalizedName = normalizeWorkspaceEntryName(kind, value);
  const validationMessage = validateWorkspaceEntryName(kind, value) ?? (
    mode === "rename" && normalizedName === originalName ? "Enter a different name" : null
  );

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    input.focus();
    const selectionEnd = kind === "sdoc-file" && value.toLowerCase().endsWith(".sdoc")
      ? value.length - ".sdoc".length
      : value.length;
    input.setSelectionRange(0, selectionEnd);
  }, [kind, mode]);

  async function submit() {
    if (validationMessage) {
      setShowValidation(true);
      return;
    }
    setIsSubmitting(true);
    const success = await onSubmit();
    if (!success) {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="explorer-inline-editor"
      role="treeitem"
      aria-level={level}
      style={{ "--explorer-level": level } as CSSProperties}
    >
      <span className="explorer-chevron-placeholder" aria-hidden="true" />
      {kind === "folder" ? <Folder size={15} /> : <FileText size={15} />}
      <input
        ref={inputRef}
        value={value}
        disabled={isSubmitting}
        aria-label={mode === "create" ? `New ${kind === "folder" ? "folder" : "document"} name` : `Rename ${originalName}`}
        aria-invalid={Boolean(validationMessage)}
        title={showValidation && validationMessage ? validationMessage : undefined}
        onChange={(event) => {
          setShowValidation(false);
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void submit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
      />
      {showValidation && validationMessage && <span className="explorer-inline-error" role="alert">{validationMessage}</span>}
    </div>
  );
}

function WorkspaceEntryMenu({
  entry,
  onClose,
  onCreate,
  onRename,
  onTrash
}: {
  entry: WindowSdocWorkspaceEntry;
  onClose: () => void;
  onCreate: (kind: WorkspaceCreateKind) => void;
  onRename: () => void;
  onTrash: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, []);

  return (
    <div
      ref={menuRef}
      className="explorer-entry-menu"
      role="menu"
      aria-label={`Workspace actions for ${entry.name}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      {entry.kind === "folder" && (
        <>
          <button type="button" role="menuitem" onClick={() => onCreate("sdoc-file")}>
            <FilePlus size={13} /> New document
          </button>
          <button type="button" role="menuitem" onClick={() => onCreate("folder")}>
            <FolderPlus size={13} /> New folder
          </button>
        </>
      )}
      <button type="button" role="menuitem" onClick={onRename}>
        <Pencil size={13} /> Rename
      </button>
      <button className="danger" type="button" role="menuitem" onClick={onTrash}>
        <Trash2 size={13} /> Move to Trash
      </button>
    </div>
  );
}

function basenameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean).pop() ?? path;
}
