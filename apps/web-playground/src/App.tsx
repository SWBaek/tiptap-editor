import { useEffect, useMemo, useRef, useState } from "react";
import type { AnyExtension, Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import {
  AlertTriangle,
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  ChevronDown,
  ChevronRight,
  Braces,
  Code2,
  Columns3,
  Download,
  ExternalLink,
  FileJson,
  FilePlus,
  FileText,
  FolderOpen,
  Heading1,
  Heading2,
  History as HistoryIcon,
  Image as ImageIcon,
  Info,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  RefreshCw,
  Rows3,
  Save,
  Search,
  Settings,
  Sigma,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Workflow
} from "lucide-react";
import {
  applyDiffEventAcceptanceToBaseline,
  applyDiffEventAction,
  applyDiffEventBatchAction,
  diffDocuments,
  renderReadableDiffEvents,
  type SDocDiffEvent,
  type SDocReviewBatchItem
} from "@sdoc/diff";
import { exportDerivedOutputs, exportMarkdown } from "@sdoc/export";
import {
  applyDataGridAssetRevision,
  applyDataGridRowMerge,
  createDataGridDiagnostics,
  createDataGridRowDiff,
  stableStringify,
  type DataGridAssetRevisionPolicy,
  type DataGridDiagnostics,
  type DataGridRowDiffEvent,
  type SDocMetadata
} from "@sdoc/format";
import { createAssetId, createBlockId, createEmptyDocument, type SDocDocument, type ValidationResult, validateDocument } from "@sdoc/schema";
import {
  BlockIdExtension,
  CalloutNode,
  CrossReferenceNode,
  DataGridNode,
  DiagramNode,
  EquationBlockNode,
  FigureNode,
  fromSdocDocument,
  insertCrossReference,
  InlineEquationNode,
  initialContent,
  insertEquationBlock,
  insertDataGrid,
  insertDrawioDiagram,
  getSelectedBlockHumanIdTarget,
  insertInlineEquation,
  insertMermaidDiagram,
  insertSimpleTable,
  moveSelectedTopLevelBlock,
  repairEditorBlockIds,
  runAdvancedTableCommand,
  setSelectedBlockHumanId,
  setSelectedTableCellsAlignment,
  TableExtensions,
  toSdocDocument,
  type AdvancedTableCommand,
  type BlockMoveDirection,
  type TableCellAlignment
} from "@sdoc/editor-tiptap";
import { createHtmlPayload, createMarkdownPayload, createSdocPayload, openDocumentInput, safeFilename, type SDocAssets } from "./documentIo";
import { runSdocSaveAction } from "./documentFileActions";
import { detectDocumentFileRuntime, resolveSdocSaveRoute } from "./documentFileRuntime";
import {
  getWindowSdocNativeOpenAdapter,
  getWindowSdocNativeSaveAdapter,
  getWindowDrawioExternalEditorAdapter,
  getWindowSdocWorkspaceAdapter,
  type WindowDrawioBridgeSession,
  type WindowSdocWorkspaceEntry
} from "./documentNativeBridge";
import {
  addLocalHistoryEntry,
  areAssetsDirty,
  createChangeReview,
  createDataGridRowPayloadPreview,
  createDataGridRowReviewModel,
  createReviewActionPlan,
  createReviewBatchConflictSummary,
  createSideBySideDiffRows,
  createVisualDiffFilterCounts,
  createLocalHistoryEntry,
  createReferenceDiagnostics,
  createRequirementTraceability,
  createSectionFoldRanges,
  createVisualDiffOverlayItems,
  filterVisualDiffOverlayItems,
  findDataGridRowRejectionEvent,
  getFileLabel,
  getSavedLabel,
  getValidationFailureMessage,
  isMetadataDirty,
  parseLocalHistory,
  pruneCollapsedHeadingIds,
  removeCrossReference,
  renderBrokenReferenceRuntimeCss,
  renderDiffPreview,
  renderMetadataDiff,
  renderVisualDiffRuntimeCss,
  retargetCrossReference,
  removeLocalHistoryEntry,
  renameLocalHistoryEntry,
  serializeLocalHistory,
  updateDataGridSourceAssetId,
  updateDrawioSourceAssetId,
  updateCrossReferenceLabel,
  type LocalHistoryEntry,
  type ChangeReviewModel,
  type DataGridRowReviewModel,
  type DataGridRowReviewItem,
  type ReferenceDiagnosticsModel,
  type ReferenceTargetSummary,
  type RequirementTraceabilityModel,
  type SectionFoldRange,
  type ReviewActionKind,
  type ReviewActionPlanItem,
  type ReviewBatchConflictSummary,
  type SideBySideDiffRow,
  type VisualDiffFilterCounts,
  type VisualDiffFilterKind,
  type VisualDiffOverlayItem
} from "./documentState";

type PreviewTab = "json" | "markdown" | "diff";
type ActivityPanel = "files" | "review" | "references" | "traceability" | "history" | "export" | "settings";
type CalloutKind = "note" | "warning";
type RecentFileAction = "opened" | "saved";
type DerivedOutputName = "plain.md" | "chunks.jsonl" | "outline.json" | "references.json";
interface RecentFileEntry {
  id: string;
  name: string;
  title: string;
  action: RecentFileAction;
  updatedAt: string;
  nativePath?: string;
}
interface EditorHighlightOverlay {
  nodeId: string;
  top: number;
  left: number;
  width: number;
  height: number;
}
interface DrawioExternalEditConflict {
  blockId: string;
  sourceAssetId: string;
  sourceBytes: Uint8Array;
  sourceHash?: string;
  message: string;
}

const LOCAL_HISTORY_STORAGE_KEY = "sdoc.localHistory.v1";
const RECENT_FILES_STORAGE_KEY = "sdoc.recentFiles.v1";
const DRAWIO_EXECUTABLE_PATH_STORAGE_KEY = "sdoc.drawioExecutablePath.v1";
const RECENT_FILES_LIMIT = 6;
const DERIVED_OUTPUT_NAMES: DerivedOutputName[] = ["plain.md", "chunks.jsonl", "outline.json", "references.json"];

const initialDocument = toSdocDocument(initialContent);
const initialMetadata: SDocMetadata = {
  title: "Playground Document",
  author: "",
  version: "0.1"
};

const sdocExtensions = [
  CrossReferenceNode,
  InlineEquationNode,
  EquationBlockNode,
  DiagramNode,
  DataGridNode,
  ...TableExtensions,
  FigureNode,
  CalloutNode,
  BlockIdExtension
] as unknown as AnyExtension[];

export function App() {
  const [activeTab, setActiveTab] = useState<PreviewTab>("markdown");
  const [activePanel, setActivePanel] = useState<ActivityPanel>("files");
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<string>("Not saved");
  const [statusMessage, setStatusMessage] = useState<string>("Ready");
  const [documentId, setDocumentId] = useState<string>(initialDocument.attrs.id);
  const [metadata, setMetadata] = useState<SDocMetadata>(initialMetadata);
  const [baselineDocument, setBaselineDocument] = useState<SDocDocument>(initialDocument);
  const [baselineMetadata, setBaselineMetadata] = useState<SDocMetadata>(initialMetadata);
  const [baselineAssets, setBaselineAssets] = useState<SDocAssets>({});
  const [assets, setAssets] = useState<SDocAssets>({});
  const [currentFilename, setCurrentFilename] = useState<string | null>(null);
  const [currentNativePath, setCurrentNativePath] = useState<string | null>(null);
  const [isDesktopStartScreenOpen, setIsDesktopStartScreenOpen] = useState(() => detectDocumentFileRuntime().kind === "desktop");
  const [recentFiles, setRecentFiles] = useState<RecentFileEntry[]>(loadStoredRecentFiles);
  const [workspaceDirectory, setWorkspaceDirectory] = useState<string | null>(null);
  const [workspaceEntries, setWorkspaceEntries] = useState<WindowSdocWorkspaceEntry[]>([]);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<LocalHistoryEntry[]>(loadStoredHistory);
  const [drawioExecutablePath, setDrawioExecutablePath] = useState<string>(loadStoredDrawioExecutablePath);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [highlightOverlay, setHighlightOverlay] = useState<EditorHighlightOverlay | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const [collapsedHeadingIds, setCollapsedHeadingIds] = useState<Set<string>>(() => new Set());
  const [isDiffOverlayEnabled, setIsDiffOverlayEnabled] = useState(false);
  const [visualDiffFilter, setVisualDiffFilter] = useState<VisualDiffFilterKind>("all");
  const [selectedVisualDiffId, setSelectedVisualDiffId] = useState<string | null>(null);
  const [lastReviewBatchSummary, setLastReviewBatchSummary] = useState<ReviewBatchConflictSummary | null>(null);
  const [drawioBridgeSession, setDrawioBridgeSession] = useState<WindowDrawioBridgeSession | null>(null);
  const [drawioBridgeTargetId, setDrawioBridgeTargetId] = useState<string | null>(null);
  const [drawioExternalEditConflict, setDrawioExternalEditConflict] = useState<DrawioExternalEditConflict | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const dataGridInputRef = useRef<HTMLInputElement>(null);
  const drawioInputRef = useRef<HTMLInputElement>(null);
  const editorPaneRef = useRef<HTMLElement>(null);
  const highlightTimeoutRef = useRef<number | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: {
          HTMLAttributes: {
            class: "sdoc-code-block"
          }
        }
      }),
      Underline,
      Placeholder.configure({ placeholder: "Write the technical document..." }),
      ...sdocExtensions
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: "editor-surface"
      }
    },
    onUpdate: () => setEditorRevision((revision) => revision + 1)
  });

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const document = useMemo(() => {
    return editor ? toSdocDocument(editor.getJSON(), documentId) : initialDocument;
  }, [documentId, editor, editorRevision]);
  const sectionFoldRanges = useMemo(() => createSectionFoldRanges(document), [document]);
  const hiddenByFoldNodeIds = useMemo(() => collectHiddenFoldNodeIds(sectionFoldRanges, collapsedHeadingIds), [collapsedHeadingIds, sectionFoldRanges]);
  const foldRuntimeCss = useMemo(() => renderFoldRuntimeCss(hiddenByFoldNodeIds, collapsedHeadingIds), [collapsedHeadingIds, hiddenByFoldNodeIds]);

  useEffect(() => {
    setCollapsedHeadingIds((current) => pruneCollapsedHeadingIds(current, sectionFoldRanges));
  }, [sectionFoldRanges]);

  const validation = validateDocument(document);
  const json = stableStringify(document);
  const markdown = exportMarkdown(document);
  const derivedOutputs = useMemo(() => exportDerivedOutputs(document), [document]);
  const selectedHistoryEntry = historyEntries.find((entry) => entry.id === selectedHistoryId) ?? null;
  const reviewBaseDocument = selectedHistoryEntry?.document ?? baselineDocument;
  const reviewBaseMetadata = selectedHistoryEntry?.metadata ?? baselineMetadata;
  const reviewBaseLabel = selectedHistoryEntry ? `History: ${selectedHistoryEntry.title}` : "Saved baseline";
  const documentDiffEvents = diffDocuments(reviewBaseDocument, document);
  const documentDiffLines = renderReadableDiffEvents(documentDiffEvents);
  const metadataDiffLines = renderMetadataDiff(metadata, reviewBaseMetadata);
  const diffPreview = renderDiffPreview(documentDiffLines, metadataDiffLines);
  const changeReview = createChangeReview(documentDiffLines, metadataDiffLines);
  const sideBySideDiffRows = useMemo(
    () => createSideBySideDiffRows(documentDiffEvents, reviewBaseDocument, document),
    [document, documentDiffEvents, reviewBaseDocument]
  );
  const referenceDiagnostics = createReferenceDiagnostics(document);
  const requirementTraceability = useMemo(() => createRequirementTraceability(document), [document]);
  const dataGridDiagnostics = useMemo(() => createDataGridDiagnostics(document, assets), [assets, document]);
  const dataGridRowReview = useMemo(
    () => createDataGridRowReviewModel(baselineDocument, document, baselineAssets, assets),
    [assets, baselineAssets, baselineDocument, document]
  );
  const visualDiffOverlayItems = useMemo(() => createVisualDiffOverlayItems(documentDiffEvents), [documentDiffEvents]);
  const visualDiffFilterCounts = useMemo(() => createVisualDiffFilterCounts(visualDiffOverlayItems), [visualDiffOverlayItems]);
  const visibleVisualDiffItems = useMemo(
    () => filterVisualDiffOverlayItems(visualDiffOverlayItems, visualDiffFilter),
    [visualDiffFilter, visualDiffOverlayItems]
  );
  const visibleReviewActionItems = useMemo(() => createReviewActionPlan(visibleVisualDiffItems).items, [visibleVisualDiffItems]);
  const visibleBatchReviewItems = useMemo(() => createReviewBatchItems(visibleReviewActionItems), [visibleReviewActionItems]);
  const visualDiffRuntimeCss = useMemo(
    () => (isDiffOverlayEnabled ? renderVisualDiffRuntimeCss(visibleVisualDiffItems, selectedVisualDiffId) : ""),
    [isDiffOverlayEnabled, selectedVisualDiffId, visibleVisualDiffItems]
  );
  const brokenReferenceRuntimeCss = useMemo(
    () => renderBrokenReferenceRuntimeCss(referenceDiagnostics.brokenReferences),
    [referenceDiagnostics.brokenReferences]
  );
  const hasDocumentChanges = diffDocuments(baselineDocument, document).length > 0;
  const hasMetadataChanges = isMetadataDirty(metadata, baselineMetadata);
  const hasAssetChanges = areAssetsDirty(assets, baselineAssets);
  const hasUnsavedChanges = hasDocumentChanges || hasMetadataChanges || hasAssetChanges;
  const fileLabel = getFileLabel(currentFilename, metadata);
  const savedLabel = getSavedLabel(savedAt, hasUnsavedChanges);
  const documentFileRuntime = useMemo(() => detectDocumentFileRuntime(), []);
  const nativeSdocSaveAdapter = useMemo(() => getWindowSdocNativeSaveAdapter(), []);
  const nativeSdocOpenAdapter = useMemo(() => getWindowSdocNativeOpenAdapter(), []);
  const nativeSdocWorkspaceAdapter = useMemo(() => getWindowSdocWorkspaceAdapter(), []);
  const nativeDrawioExternalEditorAdapter = useMemo(() => getWindowDrawioExternalEditorAdapter(), []);
  const sdocSaveRoute = useMemo(() => resolveSdocSaveRoute(documentFileRuntime, currentNativePath), [currentNativePath, documentFileRuntime]);
  const exportBaseName = safeFilename(metadata.title || "document");
  const exportFilenames = {
    sdoc: `${exportBaseName}.sdoc`,
    json: "document.json",
    markdown: `${exportBaseName}.md`,
    html: `${exportBaseName}.html`,
    pdf: `${exportBaseName}.pdf`,
    pptx: `${exportBaseName}.pptx`
  };
  const preview = activeTab === "json" ? json : markdown;

  useEffect(() => {
    if (selectedVisualDiffId && !visibleVisualDiffItems.some((item) => item.id === selectedVisualDiffId)) {
      setSelectedVisualDiffId(null);
    }
  }, [selectedVisualDiffId, visibleVisualDiffItems]);

  async function downloadSdoc() {
    if (!requireValidDocument("save .sdoc")) {
      return;
    }

    try {
      const payload = await createSdocPayload(document, metadata, new Date(), assets);
      const saveResult = await runSdocSaveAction(sdocSaveRoute, payload, {
        browser: {
          download(nextPayload) {
            const blobPart = nextPayload.bytes.buffer.slice(
              nextPayload.bytes.byteOffset,
              nextPayload.bytes.byteOffset + nextPayload.bytes.byteLength
            ) as ArrayBuffer;
            downloadBlob(new Blob([blobPart], { type: "application/vnd.sdoc" }), nextPayload.filename);
          }
        },
        native: nativeSdocSaveAdapter
      });
      if (saveResult.status !== "downloaded" && saveResult.status !== "saved-native") {
        setStatusMessage(saveResult.message);
        return;
      }

      setBaselineDocument(document);
      setBaselineMetadata(metadata);
      setBaselineAssets(assets);
      setSelectedHistoryId(null);
      setCurrentFilename(payload.filename);
      setCurrentNativePath(saveResult.path);
      addRecentFile(payload.filename, metadata.title || payload.filename, "saved", saveResult.path);
      markSaved(saveResult.message);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function downloadJson() {
    if (!requireValidDocument("export document.json")) {
      return;
    }

    downloadBlob(new Blob([json], { type: "application/json" }), "document.json");
    setBaselineDocument(document);
    setSelectedHistoryId(null);
    markSaved("Saved document.json");
  }

  function downloadMarkdown() {
    if (!requireValidDocument("export Markdown")) {
      return;
    }

    const payload = createMarkdownPayload(document, metadata);
    downloadBlob(new Blob([payload.text], { type: "text/markdown" }), payload.filename);
    setStatusMessage("Exported Markdown");
  }

  function downloadHtml() {
    if (!requireValidDocument("export HTML")) {
      return;
    }

    const payload = createHtmlPayload(document, metadata, assets);
    downloadBlob(new Blob([payload.text], { type: "text/html" }), payload.filename);
    setStatusMessage("Exported HTML");
  }

  function downloadDerivedOutput(name: DerivedOutputName) {
    if (!requireValidDocument(`export ${name}`)) {
      return;
    }

    downloadBlob(new Blob([derivedOutputs[name]], { type: getDerivedOutputMimeType(name) }), name);
    setStatusMessage(`Exported ${name}`);
  }

  async function openDocumentBytes(name: string, data: ArrayBuffer | Uint8Array, nativePath: string | null) {
    const loaded = await openDocumentInput({
      name,
      data,
      fallbackMetadata: metadata
    });

    const validationResult = validateDocument(loaded.document);
    if (!validationResult.ok) {
      setStatusMessage(`Invalid document: ${validationResult.issues[0]?.message ?? "schema validation failed"}`);
      return;
    }

    editor.commands.setContent(fromSdocDocument(loaded.document, createAssetSourceMap(loaded.assets)), { emitUpdate: true });
    repairEditorBlockIds(editor);
    setAssets(loaded.assets);
    setDocumentId(loaded.document.attrs.id);
    const appliedDocument = toSdocDocument(editor.getJSON(), loaded.document.attrs.id);
    const nextMetadata = {
      ...metadata,
      ...loaded.metadata,
      title: loaded.metadata.title || metadata.title
    };
    setMetadata(nextMetadata);
    setBaselineDocument(appliedDocument);
    setBaselineMetadata(nextMetadata);
    setBaselineAssets(loaded.assets);
    setSelectedHistoryId(null);
    setCollapsedHeadingIds(new Set());
    setDrawioBridgeSession(null);
    setDrawioBridgeTargetId(null);
    setDrawioExternalEditConflict(null);
    setCurrentFilename(name);
    setCurrentNativePath(nativePath);
    addRecentFile(name, nextMetadata.title || name, "opened", nativePath);
    setActiveTab("markdown");
    setIsPreviewOpen(false);
    setIsDesktopStartScreenOpen(false);
    markSaved(loaded.statusMessage);
  }

  async function openFile(file: File) {
    try {
      await openDocumentBytes(file.name, await file.arrayBuffer(), null);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function openDocumentAction() {
    if (documentFileRuntime.kind === "desktop") {
      if (!nativeSdocOpenAdapter) {
        setStatusMessage("Native open adapter is not available.");
        return;
      }

      try {
        const opened = await nativeSdocOpenAdapter.open();
        if (!opened) {
          setStatusMessage("Open cancelled.");
          return;
        }

        await openDocumentBytes(filenameFromNativePath(opened.path), opened.bytes, opened.path);
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : String(error));
      }
      return;
    }

    fileInputRef.current?.click();
  }

  function markSaved(message: string) {
    setSavedAt(new Date().toLocaleTimeString());
    setStatusMessage(message);
  }

  function markCurrentAsBaseline() {
    if (!requireValidDocument("mark saved")) {
      return;
    }

    setBaselineDocument(document);
    setBaselineMetadata(metadata);
    setBaselineAssets(assets);
    setSelectedHistoryId(null);
    markSaved("Marked current state as saved");
  }

  function addRecentFile(name: string, title: string, action: RecentFileAction, nativePath: string | null = null) {
    const entry: RecentFileEntry = {
      id: nativePath ?? name,
      name,
      title,
      action,
      updatedAt: new Date().toISOString()
    };
    if (nativePath) {
      entry.nativePath = nativePath;
    }
    const nextEntries = upsertRecentFile(recentFiles, entry);
    setRecentFiles(nextEntries);
    storeRecentFiles(nextEntries);
  }

  async function openRecentFile(entry: RecentFileEntry) {
    if (documentFileRuntime.kind === "desktop" && nativeSdocWorkspaceAdapter && entry.nativePath) {
      try {
        const opened = await nativeSdocWorkspaceAdapter.openFile(entry.nativePath);
        await openDocumentBytes(filenameFromNativePath(opened.path), opened.bytes, opened.path);
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : String(error));
      }
      return;
    }

    setStatusMessage(`Recent file metadata only: reopen ${entry.name} from disk to load it in the browser`);
  }

  async function chooseWorkspaceDirectoryAction() {
    if (documentFileRuntime.kind !== "desktop" || !nativeSdocWorkspaceAdapter) {
      setStatusMessage("Native workspace browsing is available in the desktop app.");
      return;
    }

    try {
      const directoryPath = await nativeSdocWorkspaceAdapter.chooseDirectory();
      if (!directoryPath) {
        setStatusMessage("Workspace folder selection cancelled.");
        return;
      }

      await refreshWorkspaceEntries(directoryPath);
      setIsDesktopStartScreenOpen(false);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function refreshWorkspaceEntries(directoryPath = workspaceDirectory) {
    if (!directoryPath) {
      setStatusMessage("Choose a workspace folder first.");
      return;
    }

    if (!nativeSdocWorkspaceAdapter) {
      setStatusMessage("Native workspace adapter is not available.");
      return;
    }

    setIsWorkspaceLoading(true);
    try {
      const entries = await nativeSdocWorkspaceAdapter.list(directoryPath);
      setWorkspaceDirectory(directoryPath);
      setWorkspaceEntries(entries);
      setStatusMessage(`Loaded ${entries.length} .sdoc workspace entr${entries.length === 1 ? "y" : "ies"}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorkspaceLoading(false);
    }
  }

  async function openWorkspaceEntry(entry: WindowSdocWorkspaceEntry) {
    if (entry.kind !== "sdoc-file") {
      setStatusMessage("Unpacked .sdoc folders are a developer/reviewer workflow and are not opened from this panel yet.");
      return;
    }

    if (!nativeSdocWorkspaceAdapter) {
      setStatusMessage("Native workspace adapter is not available.");
      return;
    }

    try {
      const opened = await nativeSdocWorkspaceAdapter.openFile(entry.path);
      await openDocumentBytes(filenameFromNativePath(opened.path), opened.bytes, opened.path);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function showDeveloperCommand(command: string) {
    void navigator.clipboard?.writeText(command).catch(() => undefined);
    setStatusMessage(`CLI command: ${command}`);
  }

  function saveHistorySnapshot() {
    if (!requireValidDocument("save history snapshot")) {
      return;
    }

    const entry = createLocalHistoryEntry(document, metadata);
    const nextEntries = addLocalHistoryEntry(historyEntries, entry);
    persistHistory(nextEntries);
    setSelectedHistoryId(entry.id);
    openActivityPanel("history");
    setStatusMessage(`Saved history snapshot: ${entry.title}`);
  }

  function compareHistorySnapshot(entryId: string) {
    const entry = historyEntries.find((current) => current.id === entryId);
    if (!entry) {
      setStatusMessage("History snapshot is no longer available");
      return;
    }

    setSelectedHistoryId(entry.id);
    showPreview("diff");
    setStatusMessage(`Comparing with history snapshot: ${entry.title}`);
  }

  function compareSavedBaseline() {
    setSelectedHistoryId(null);
    showPreview("diff");
    setStatusMessage("Comparing with saved baseline");
  }

  function deleteHistorySnapshot(entryId: string) {
    const entry = historyEntries.find((current) => current.id === entryId);
    if (!entry) {
      setStatusMessage("History snapshot is no longer available");
      return;
    }

    const nextEntries = removeLocalHistoryEntry(historyEntries, entryId);
    persistHistory(nextEntries);
    if (selectedHistoryId === entryId) {
      setSelectedHistoryId(null);
    }
    setStatusMessage(`Deleted history snapshot: ${entry.title}`);
  }

  function renameHistorySnapshot(entryId: string, title: string) {
    if (!historyEntries.some((entry) => entry.id === entryId)) {
      setStatusMessage("History snapshot is no longer available");
      return;
    }

    const nextEntries = renameLocalHistoryEntry(historyEntries, entryId, title);
    const nextEntry = nextEntries.find((entry) => entry.id === entryId);
    persistHistory(nextEntries);
    setStatusMessage(`Renamed history snapshot: ${nextEntry?.title ?? "Untitled"}`);
  }

  function persistHistory(entries: LocalHistoryEntry[]) {
    setHistoryEntries(entries);
    storeHistory(entries);
  }

  function selectActivityPanel(panel: ActivityPanel) {
    if (panel === activePanel) {
      setIsSidePanelOpen((open) => !open);
      return;
    }

    setActivePanel(panel);
    setIsSidePanelOpen(true);
  }

  function openActivityPanel(panel: ActivityPanel) {
    setActivePanel(panel);
    setIsSidePanelOpen(true);
  }

  function showPreview(tab: PreviewTab = activeTab) {
    setActiveTab(tab);
    setIsPreviewOpen(true);
  }

  function requireValidDocument(action: string): boolean {
    const message = getValidationFailureMessage(validation, action);
    if (message) {
      setStatusMessage(message);
      return false;
    }

    return true;
  }

  function createNewDocument() {
    const nextDocument = createEmptyDocument();
    const nextMetadata: SDocMetadata = {
      ...initialMetadata,
      author: metadata.author,
      title: "Untitled"
    };
    editor.commands.setContent(fromSdocDocument(nextDocument), { emitUpdate: true });
    repairEditorBlockIds(editor);
    const appliedDocument = toSdocDocument(editor.getJSON(), nextDocument.attrs.id);
    setDocumentId(nextDocument.attrs.id);
    setMetadata(nextMetadata);
    setBaselineDocument(appliedDocument);
    setBaselineMetadata(nextMetadata);
    setBaselineAssets({});
    setAssets({});
    setSelectedHistoryId(null);
    setCollapsedHeadingIds(new Set());
    setDrawioBridgeSession(null);
    setDrawioBridgeTargetId(null);
    setDrawioExternalEditConflict(null);
    setCurrentFilename(null);
    setCurrentNativePath(null);
    setActiveTab("markdown");
    setIsPreviewOpen(false);
    setIsDesktopStartScreenOpen(false);
    setSavedAt("Not saved");
    setStatusMessage("Created new document");
  }

  function moveBlock(direction: BlockMoveDirection) {
    const moved = moveSelectedTopLevelBlock(editor, direction);
    setStatusMessage(moved ? `Moved block ${direction}` : `Cannot move block ${direction}`);
    if (moved) {
      setActiveTab("diff");
    }
  }

  function applyCallout(kind: CalloutKind) {
    const applied = editor.isActive("callout")
      ? editor.chain().focus().updateAttributes("callout", { kind }).run()
      : editor.chain().focus().wrapIn("callout", { kind }).run();
    setStatusMessage(applied ? `Applied ${kind} callout` : `Cannot apply ${kind} callout`);
  }

  function insertTable() {
    const inserted = insertSimpleTable(editor);
    setActiveTab("json");
    setStatusMessage(inserted ? "Inserted table" : "Cannot insert table");
  }

  async function insertDataGridFile(file: File) {
    try {
      const format = getDataGridFormatFromFile(file);
      if (!format) {
        setStatusMessage(`Unsupported data grid type: ${file.type || file.name}`);
        return;
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const assetId = createDataGridAssetId(file.name, file.type);
      const title = titleFromFilename(file.name);
      const inserted = insertDataGrid(editor, assetId, format, title, `${file.name} source asset`);
      if (!inserted) {
        setStatusMessage(`Cannot insert data grid: ${file.name}`);
        return;
      }

      setAssets((current) => ({ ...current, [assetId]: bytes }));
      setActiveTab("json");
      setStatusMessage(`Inserted data grid ${file.name}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      if (dataGridInputRef.current) {
        dataGridInputRef.current.value = "";
      }
    }
  }

  async function insertDrawioFile(file: File) {
    try {
      if (!isDrawioFile(file)) {
        setStatusMessage(`Unsupported Draw.io source type: ${file.type || file.name}`);
        return;
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!isUsableDrawioSource(bytes)) {
        setStatusMessage(`Invalid Draw.io source: ${file.name}`);
        return;
      }

      const assetId = createDrawioAssetId(file.name);
      const inserted = insertDrawioDiagram(editor, assetId);
      if (!inserted) {
        setStatusMessage(`Cannot insert Draw.io diagram: ${file.name}`);
        return;
      }

      setAssets((current) => ({ ...current, [assetId]: bytes }));
      setActiveTab("json");
      setStatusMessage(`Inserted Draw.io diagram ${file.name}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      if (drawioInputRef.current) {
        drawioInputRef.current.value = "";
      }
    }
  }

  async function openSelectedDrawioExternalEditor() {
    if (!nativeDrawioExternalEditorAdapter) {
      setStatusMessage("Draw.io external editing is available in the desktop app.");
      return;
    }

    const reference = getSelectedDrawioDiagramReference(editor);
    if (!reference) {
      setStatusMessage("Select a Draw.io diagram before opening an external editor.");
      return;
    }

    const sourceBytes = assets[reference.sourceAssetId];
    if (!sourceBytes) {
      setStatusMessage(`Missing Draw.io source asset ${reference.sourceAssetId}.`);
      return;
    }

    try {
      const session = await nativeDrawioExternalEditorAdapter.checkoutSource(reference.sourceAssetId, sourceBytes);
      const opened = await nativeDrawioExternalEditorAdapter.openExternalEditor(session.sessionId, drawioExecutablePath);
      if (opened.status === "launch-failed") {
        await nativeDrawioExternalEditorAdapter.closeSession(session.sessionId).catch(() => undefined);
        setStatusMessage(opened.message ?? "Cannot launch Draw.io external editor.");
        return;
      }

      setDrawioBridgeSession(session);
      setDrawioBridgeTargetId(reference.blockId);
      setDrawioExternalEditConflict(null);
      setStatusMessage(`Opened Draw.io source ${reference.sourceAssetId}. Save in the external editor, then read the edit back.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function readDrawioExternalEdit() {
    if (!nativeDrawioExternalEditorAdapter) {
      setStatusMessage("Draw.io external editing is available in the desktop app.");
      return;
    }

    if (!drawioBridgeSession) {
      setStatusMessage("Open a Draw.io external editing session first.");
      return;
    }

    const latestSourceBytes = assets[drawioBridgeSession.sourceAssetId];
    if (!latestSourceBytes) {
      setStatusMessage(`Missing Draw.io source asset ${drawioBridgeSession.sourceAssetId}.`);
      return;
    }

    try {
      const result = await nativeDrawioExternalEditorAdapter.readEditedSource(drawioBridgeSession, latestSourceBytes);
      if (result.status === "saved" && result.sourceBytes) {
        setAssets((current) => ({ ...current, [drawioBridgeSession.sourceAssetId]: result.sourceBytes as Uint8Array }));
        await nativeDrawioExternalEditorAdapter.closeSession(drawioBridgeSession.sessionId).catch(() => undefined);
        setDrawioBridgeSession(null);
        setDrawioBridgeTargetId(null);
        setDrawioExternalEditConflict(null);
        setStatusMessage(`Read Draw.io edit back into asset ${drawioBridgeSession.sourceAssetId}.`);
        return;
      }

      if (result.status === "conflict") {
        if (result.sourceBytes) {
          const blockId = drawioBridgeTargetId ?? getDrawioDiagramBlockIdBySourceAssetId(document, drawioBridgeSession.sourceAssetId);
          if (blockId) {
            setDrawioExternalEditConflict({
              blockId,
              sourceAssetId: drawioBridgeSession.sourceAssetId,
              sourceBytes: result.sourceBytes,
              sourceHash: result.sourceHash,
              message: result.message ?? `Draw.io source asset ${drawioBridgeSession.sourceAssetId} changed during external editing.`
            });
          }
        }
        setStatusMessage(result.message ?? `Draw.io source asset ${drawioBridgeSession.sourceAssetId} changed during external editing.`);
        return;
      }

      if (result.status === "invalid-source") {
        setStatusMessage(result.message ?? "External editor saved invalid Draw.io XML.");
        return;
      }

      setStatusMessage(result.message ?? `Draw.io external edit status: ${result.status}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function closeDrawioExternalEdit() {
    if (!nativeDrawioExternalEditorAdapter || !drawioBridgeSession) {
      setDrawioBridgeSession(null);
      setDrawioBridgeTargetId(null);
      setDrawioExternalEditConflict(null);
      setStatusMessage("No Draw.io external editing session is open.");
      return;
    }

    try {
      await nativeDrawioExternalEditorAdapter.closeSession(drawioBridgeSession.sessionId);
      setDrawioBridgeSession(null);
      setDrawioBridgeTargetId(null);
      setDrawioExternalEditConflict(null);
      setStatusMessage(`Closed Draw.io external editing session for ${drawioBridgeSession.sourceAssetId}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function keepCurrentDrawioSource() {
    if (!drawioExternalEditConflict) {
      setStatusMessage("No Draw.io external edit conflict is pending.");
      return;
    }

    setDrawioExternalEditConflict(null);
    setStatusMessage(`Kept current Draw.io source asset ${drawioExternalEditConflict.sourceAssetId}.`);
  }

  function replaceCurrentDrawioSource() {
    if (!drawioExternalEditConflict) {
      setStatusMessage("No Draw.io external edit conflict is pending.");
      return;
    }

    if (!window.confirm(`Replace current Draw.io source asset ${drawioExternalEditConflict.sourceAssetId} with the external edit?`)) {
      setStatusMessage(`Canceled Draw.io replace for ${drawioExternalEditConflict.sourceAssetId}.`);
      return;
    }

    setAssets((current) => ({ ...current, [drawioExternalEditConflict.sourceAssetId]: drawioExternalEditConflict.sourceBytes }));
    setDrawioExternalEditConflict(null);
    setStatusMessage(`Replaced Draw.io source asset ${drawioExternalEditConflict.sourceAssetId}.`);
  }

  function saveDrawioExternalEditAsRevision() {
    if (!drawioExternalEditConflict) {
      setStatusMessage("No Draw.io external edit conflict is pending.");
      return;
    }

    const revisionAssetId = createDrawioRevisionAssetId(drawioExternalEditConflict.sourceAssetId, assets);
    if (!window.confirm(`Save external Draw.io edit as ${revisionAssetId}?`)) {
      setStatusMessage(`Canceled Draw.io revision save for ${drawioExternalEditConflict.sourceAssetId}.`);
      return;
    }

    const nextAssets = { ...assets, [revisionAssetId]: drawioExternalEditConflict.sourceBytes };
    const nextDocument = updateDrawioSourceAssetId(document, drawioExternalEditConflict.blockId, revisionAssetId);
    editor.commands.setContent(fromSdocDocument(nextDocument, createAssetSourceMap(nextAssets)), { emitUpdate: true });
    repairEditorBlockIds(editor);
    setDocumentId(nextDocument.attrs.id);
    setAssets(nextAssets);
    setDrawioExternalEditConflict(null);
    setActiveTab("diff");
    setStatusMessage(`Saved Draw.io external edit as ${revisionAssetId}.`);
  }

  function runTableCommand(command: AdvancedTableCommand, successMessage: string) {
    const applied = runAdvancedTableCommand(editor, command);
    setActiveTab("json");
    setStatusMessage(applied ? successMessage : `Cannot ${successMessage.toLowerCase()}`);
  }

  function alignTableCells(align: TableCellAlignment) {
    const applied = setSelectedTableCellsAlignment(editor, align);
    setActiveTab("json");
    setStatusMessage(applied ? `Aligned table cell ${align}` : `Cannot align table cell ${align}`);
  }

  function foldSelectedSection() {
    const range = getSelectedSectionFoldRange(editor, sectionFoldRanges);
    if (!range) {
      setStatusMessage("Select a heading with content to fold");
      return;
    }

    const nextHeadingIds = new Set(collapsedHeadingIds).add(range.headingId);
    setCollapsedHeadingIds(nextHeadingIds);
    setStatusMessage(`Folded section: ${range.title}`);
  }

  function unfoldSelectedSection() {
    const headingId = getSelectedHeadingId(editor);
    if (!headingId) {
      setStatusMessage("Select a folded heading to unfold");
      return;
    }

    const nextHeadingIds = new Set(collapsedHeadingIds);
    nextHeadingIds.delete(headingId);
    setCollapsedHeadingIds(nextHeadingIds);
    setStatusMessage("Unfolded section");
  }

  function unfoldAllSections() {
    const nextHeadingIds = new Set<string>();
    setCollapsedHeadingIds(nextHeadingIds);
    setStatusMessage("Unfolded all sections");
  }

  function openReferencePicker() {
    openActivityPanel("references");
    setStatusMessage("Choose a reference target");
  }

  function insertCrossReferenceToTarget(targetId: string) {
    const target = referenceDiagnostics.targets.find((current) => current.id === targetId);
    if (!target) {
      setStatusMessage(`Reference target is no longer available: ${targetId}`);
      return;
    }

    const inserted = insertCrossReference(editor, target.id, undefined, target.label);
    openActivityPanel("references");
    setStatusMessage(inserted ? `Inserted reference to ${target.label}` : `Cannot insert reference to ${target.label}`);
  }

  function updateReferenceLabel(referenceId: string) {
    const reference = referenceDiagnostics.staleReferences.find((current) => current.id === referenceId);
    if (!reference) {
      setStatusMessage(`Reference label is already current: ${referenceId}`);
      return;
    }

    const nextDocument = updateCrossReferenceLabel(document, reference.id, reference.targetLabel);
    editor.commands.setContent(fromSdocDocument(nextDocument, createAssetSourceMap(assets)), { emitUpdate: true });
    repairEditorBlockIds(editor);
    openActivityPanel("references");
    setStatusMessage(`Updated reference label: ${reference.targetLabel}`);
  }

  function retargetBrokenReference(referenceId: string, targetId: string) {
    const target = referenceDiagnostics.targets.find((current) => current.id === targetId);
    if (!target) {
      setStatusMessage(`Reference target is no longer available: ${targetId}`);
      return;
    }

    const nextDocument = retargetCrossReference(document, referenceId, target);
    editor.commands.setContent(fromSdocDocument(nextDocument, createAssetSourceMap(assets)), { emitUpdate: true });
    repairEditorBlockIds(editor);
    openActivityPanel("references");
    setStatusMessage(`Retargeted reference to ${target.label}`);
  }

  function removeBrokenReference(referenceId: string) {
    const reference = referenceDiagnostics.brokenReferences.find((current) => current.id === referenceId);
    if (!reference) {
      setStatusMessage(`Reference is already resolved: ${referenceId}`);
      return;
    }

    const nextDocument = removeCrossReference(document, reference.id);
    editor.commands.setContent(fromSdocDocument(nextDocument, createAssetSourceMap(assets)), { emitUpdate: true });
    repairEditorBlockIds(editor);
    openActivityPanel("references");
    setStatusMessage(`Removed broken reference: ${reference.label}`);
  }

  function tagSelectedBlock() {
    const target = getSelectedBlockHumanIdTarget(editor);
    if (!target) {
      setStatusMessage("Select a block before setting a requirement ID");
      return;
    }

    const value = window.prompt("Requirement ID", target.humanId ?? "REQ-OBC-001");
    if (value === null) {
      setStatusMessage("Canceled requirement ID update");
      return;
    }

    const normalized = value.trim();
    if (normalized.length === 0) {
      setStatusMessage("Requirement ID cannot be empty");
      return;
    }

    const updated = setSelectedBlockHumanId(editor, normalized);
    openActivityPanel("traceability");
    setStatusMessage(updated ? `Set requirement ID ${normalized} on ${target.id}` : `Cannot set requirement ID on ${target.id}`);
  }

  function clearSelectedBlockTag() {
    const target = getSelectedBlockHumanIdTarget(editor);
    if (!target) {
      setStatusMessage("Select a block before clearing a requirement ID");
      return;
    }

    const updated = setSelectedBlockHumanId(editor, null);
    openActivityPanel("traceability");
    setStatusMessage(updated ? `Cleared requirement ID on ${target.id}` : `Cannot clear requirement ID on ${target.id}`);
  }

  function revealEditorNode(nodeId: string, label: string) {
    const element = findEditorElementByDataId(nodeId);
    if (!element) {
      setStatusMessage(`Cannot find editor node: ${nodeId}`);
      return;
    }

    editor.commands.focus();
    setHighlightedNodeId(nodeId);
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
    window.requestAnimationFrame(() => {
      const currentElement = findEditorElementByDataId(nodeId);
      if (!currentElement) {
        return;
      }

      currentElement.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
      window.requestAnimationFrame(() => {
        const overlay = measureEditorHighlightOverlay(currentElement, editorPaneRef.current);
        if (overlay) {
          setHighlightOverlay({ ...overlay, nodeId });
        }
      });
    });
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightOverlay((current) => (current?.nodeId === nodeId ? null : current));
      setHighlightedNodeId((current) => (current === nodeId ? null : current));
      highlightTimeoutRef.current = null;
    }, 2200);
    setStatusMessage(`Focused ${label}`);
  }

  function selectVisualDiffItem(item: VisualDiffOverlayItem) {
    setSelectedVisualDiffId(item.id);
    setIsDiffOverlayEnabled(true);
    if (!item.anchorable) {
      setStatusMessage(`Review only: ${item.summary}`);
      return;
    }

    revealEditorNode(item.id, item.summary);
  }

  function applyReviewAction(item: ReviewActionPlanItem, action: ReviewActionKind) {
    if (selectedHistoryEntry) {
      setStatusMessage("Use saved baseline before applying review actions");
      return;
    }

    const event = findDiffEventForReviewItem(documentDiffEvents, item);
    if (!event) {
      setStatusMessage(`Review event is stale: ${item.id}`);
      return;
    }

    const actionLabel = action === "accept" ? "accept" : "reject";
    if (!window.confirm(`${actionLabel === "accept" ? "Accept" : "Reject"} ${item.summary}?`)) {
      setStatusMessage(`Canceled ${actionLabel}: ${item.summary}`);
      return;
    }

    if (action === "accept") {
      const result = applyDiffEventAcceptanceToBaseline(baselineDocument, document, event);
      if (!result.ok) {
        setStatusMessage(result.message);
        return;
      }

      setBaselineDocument(result.document);
      setSelectedVisualDiffId(null);
      setLastReviewBatchSummary(null);
      setActiveTab("diff");
      setStatusMessage(`Accepted ${item.kind} ${item.id}`);
      return;
    }

    const result = applyDiffEventAction(baselineDocument, document, event, "reject");
    if (!result.ok) {
      setStatusMessage(result.message);
      return;
    }

    editor.commands.setContent(fromSdocDocument(result.document, createAssetSourceMap(assets)), { emitUpdate: true });
    repairEditorBlockIds(editor);
    setDocumentId(result.document.attrs.id);
    setSelectedVisualDiffId(null);
    setLastReviewBatchSummary(null);
    setActiveTab("diff");
    setStatusMessage(`Rejected ${item.kind} ${item.id}`);
  }

  function applyVisibleReviewBatch(action: ReviewActionKind) {
    if (selectedHistoryEntry) {
      setStatusMessage("Use saved baseline before applying review actions");
      return;
    }

    if (visibleBatchReviewItems.length === 0) {
      setStatusMessage("No visible review events can be applied");
      return;
    }

    const label = action === "accept" ? "Accept" : "Reject";
    if (!window.confirm(`${label} ${visibleBatchReviewItems.length} visible document event${visibleBatchReviewItems.length === 1 ? "" : "s"}?`)) {
      setStatusMessage(`Canceled batch ${action}`);
      return;
    }

    const result = applyDiffEventBatchAction(baselineDocument, document, visibleBatchReviewItems, action);
    const summary = createReviewBatchConflictSummary(action, result);
    if (action === "accept") {
      setBaselineDocument(result.document);
    } else {
      editor.commands.setContent(fromSdocDocument(result.document, createAssetSourceMap(assets)), { emitUpdate: true });
      repairEditorBlockIds(editor);
      setDocumentId(result.document.attrs.id);
    }

    setSelectedVisualDiffId(null);
    setLastReviewBatchSummary(summary);
    setActiveTab("diff");
    setStatusMessage(summary.detail);
  }

  function rejectDataGridRowEvent(item: DataGridRowReviewItem, event: DataGridRowDiffEvent, assetPolicy: DataGridAssetRevisionPolicy = "update") {
    if (selectedHistoryEntry) {
      setStatusMessage("Use saved baseline before applying data grid row review actions");
      return;
    }

    const actionLabel = assetPolicy === "revision" ? "Reject row change as a new asset revision" : "Reject row change";
    if (!window.confirm(`${actionLabel} in ${item.title}: ${event.message}?`)) {
      setStatusMessage(`Canceled row ${assetPolicy === "revision" ? "revision reject" : "reject"}: ${item.title}`);
      return;
    }

    const baselineAsset = baselineAssets[item.sourceAssetId];
    const currentAsset = assets[item.sourceAssetId];
    if (!baselineAsset || !currentAsset) {
      setStatusMessage(`Cannot reject row change: missing asset ${item.sourceAssetId}`);
      return;
    }

    const baselineSource = decodeTextAsset(baselineAsset);
    const currentSource = decodeTextAsset(currentAsset);
    const reverseDiff = createDataGridRowDiff({
      gridId: item.gridId,
      sourceAssetId: item.sourceAssetId,
      format: item.format,
      oldSource: currentSource,
      newSource: baselineSource,
      keyColumns: item.keyColumns
    });
    const reverseEvent = findDataGridRowRejectionEvent(reverseDiff.events, event);
    if (!reverseEvent) {
      setStatusMessage(`Cannot reject stale row event: ${event.message}`);
      return;
    }

    const mergeResult = applyDataGridRowMerge({
      gridId: item.gridId,
      sourceAssetId: item.sourceAssetId,
      format: item.format,
      baselineSource: currentSource,
      proposedSource: baselineSource,
      currentSource,
      event: reverseEvent,
      keyColumns: item.keyColumns
    });
    if (!mergeResult.ok) {
      setStatusMessage(mergeResult.message);
      return;
    }

    const assetResult = applyDataGridAssetRevision({
      sourceAssetId: item.sourceAssetId,
      source: mergeResult.source,
      format: item.format,
      policy: assetPolicy,
      assets
    });
    if (!assetResult.ok) {
      setStatusMessage(assetResult.message);
      return;
    }

    if (assetPolicy === "revision") {
      const nextDocument = updateDataGridSourceAssetId(document, item.gridId, assetResult.sourceAssetId);
      editor.commands.setContent(fromSdocDocument(nextDocument, createAssetSourceMap(assetResult.assets)), { emitUpdate: true });
      repairEditorBlockIds(editor);
      setDocumentId(nextDocument.attrs.id);
      setAssets(assetResult.assets);
      setActiveTab("diff");
      setStatusMessage(`Rejected row change in ${item.title} as ${assetResult.sourceAssetId}`);
      return;
    }

    setAssets(assetResult.assets);
    setStatusMessage(`Rejected row change in ${item.title}`);
  }

  function acceptDataGridRowEvent(item: DataGridRowReviewItem, event: DataGridRowDiffEvent) {
    if (selectedHistoryEntry) {
      setStatusMessage("Use saved baseline before applying data grid row review actions");
      return;
    }

    if (!window.confirm(`Accept row change in ${item.title}: ${event.message}?`)) {
      setStatusMessage(`Canceled row accept: ${item.title}`);
      return;
    }

    const baselineAsset = baselineAssets[item.sourceAssetId];
    const currentAsset = assets[item.sourceAssetId];
    if (!baselineAsset || !currentAsset) {
      setStatusMessage(`Cannot accept row change: missing asset ${item.sourceAssetId}`);
      return;
    }

    const baselineSource = decodeTextAsset(baselineAsset);
    const currentSource = decodeTextAsset(currentAsset);
    const mergeResult = applyDataGridRowMerge({
      gridId: item.gridId,
      sourceAssetId: item.sourceAssetId,
      format: item.format,
      baselineSource,
      proposedSource: currentSource,
      currentSource: baselineSource,
      event,
      keyColumns: item.keyColumns
    });
    if (!mergeResult.ok) {
      setStatusMessage(mergeResult.message);
      return;
    }

    const assetResult = applyDataGridAssetRevision({
      sourceAssetId: item.sourceAssetId,
      source: mergeResult.source,
      format: item.format,
      policy: "update",
      assets: baselineAssets
    });
    if (!assetResult.ok) {
      setStatusMessage(assetResult.message);
      return;
    }

    setBaselineAssets(assetResult.assets);
    setStatusMessage(`Accepted row change in ${item.title}`);
  }

  function insertInlineEquationFromPrompt() {
    const latex = window.prompt("Inline equation", "E=mc^2")?.trim();
    if (!latex) {
      setStatusMessage("Canceled inline equation");
      return;
    }

    const inserted = insertInlineEquation(editor, latex);
    setActiveTab("json");
    setStatusMessage(inserted ? "Inserted inline equation" : "Cannot insert inline equation");
  }

  function insertEquationBlockFromPrompt() {
    const latex = window.prompt("Block equation", "a^2+b^2=c^2")?.trim();
    if (!latex) {
      setStatusMessage("Canceled equation block");
      return;
    }

    const inserted = insertEquationBlock(editor, latex);
    setActiveTab("json");
    setStatusMessage(inserted ? "Inserted equation block" : "Cannot insert equation block");
  }

  function insertMermaidDiagramFromPrompt() {
    const source = window.prompt("Mermaid diagram", "flowchart TD\nA[Start] --> B[Done]")?.trim();
    if (!source) {
      setStatusMessage("Canceled Mermaid diagram");
      return;
    }

    const inserted = insertMermaidDiagram(editor, source);
    setActiveTab("json");
    setStatusMessage(inserted ? "Inserted Mermaid diagram" : "Cannot insert Mermaid diagram");
  }

  async function insertImageFile(file: File) {
    try {
      if (file.type && !file.type.startsWith("image/")) {
        setStatusMessage(`Unsupported image type: ${file.type}`);
        return;
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const assetId = createImageAssetId(file.name, file.type);
      const caption = captionFromFilename(file.name);
      const src = await readFileAsDataUrl(file);

      const inserted = editor
        .chain()
        .focus()
        .insertContent({
          type: "figure",
          attrs: {
            id: createBlockId(),
            assetId,
            alt: caption,
            src
          },
          content: [
            {
              type: "paragraph",
              attrs: { id: createBlockId() },
              content: [{ type: "text", text: caption }]
            }
          ]
        })
        .run();

      if (!inserted) {
        setStatusMessage(`Cannot insert image: ${file.name}`);
        return;
      }

      setAssets((current) => ({ ...current, [assetId]: bytes }));
      setActiveTab("json");
      setStatusMessage(`Inserted image ${file.name}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  }

  if (!editor) {
    return null;
  }

  const activePanelLabel = getActivityPanelLabel(activePanel);
  const showDesktopStartScreen = documentFileRuntime.kind === "desktop" && isDesktopStartScreenOpen && !currentFilename && !workspaceDirectory;

  return (
    <main className={isSidePanelOpen ? "app-shell" : "app-shell side-panel-collapsed"}>
      <ActivityBar activePanel={activePanel} isOpen={isSidePanelOpen} onSelect={selectActivityPanel} />

      {isSidePanelOpen && (
        <aside className="sidebar side-panel" aria-label={`${activePanelLabel} side panel`}>
          <div className="brand">
            <FileJson size={22} />
            <div>
              <strong>SDoc</strong>
              <span>Phase 3 Playground</span>
            </div>
          </div>

          <div className="side-panel-title">
            <span>{activePanelLabel}</span>
          </div>

          <div className="side-status-note">{statusMessage}</div>
          {drawioExternalEditConflict && (
            <section className="workspace-boundary" aria-label="Draw.io external edit conflict">
              <strong>Draw.io external edit conflict</strong>
              <span>
                External edit is available for <code>{drawioExternalEditConflict.sourceAssetId}</code>. Choose how to resolve it; this runtime
                choice is not stored in document.json.
              </span>
              <div className="workspace-actions">
                <button type="button" onClick={keepCurrentDrawioSource}>
                  Keep current
                </button>
                <button type="button" onClick={replaceCurrentDrawioSource}>
                  Replace source
                </button>
                <button type="button" onClick={saveDrawioExternalEditAsRevision}>
                  Save as revision
                </button>
              </div>
            </section>
          )}

          {activePanel === "settings" && (
            <SettingsPanel
              metadata={metadata}
              validation={validation}
              document={document}
              assetCount={Object.keys(assets).length}
              drawioExecutablePath={drawioExecutablePath}
              onMetadataChange={setMetadata}
              onDrawioExecutablePathChange={(path) => {
                setDrawioExecutablePath(path);
                storeDrawioExecutablePath(path);
              }}
            />
          )}

          {activePanel === "files" && (
            <FilesPanel
              currentFile={fileLabel}
              sdocFilename={exportFilenames.sdoc}
              savedLabel={savedLabel}
              recentFiles={recentFiles}
              isDesktopRuntime={documentFileRuntime.kind === "desktop"}
              workspaceDirectory={workspaceDirectory}
              workspaceEntries={workspaceEntries}
              isWorkspaceLoading={isWorkspaceLoading}
              onNewDocument={createNewDocument}
              onOpenDocument={openDocumentAction}
              onSaveSdoc={downloadSdoc}
              sdocSaveLabel={sdocSaveRoute.label}
              onSelectRecentFile={(entry) => void openRecentFile(entry)}
              onChooseWorkspaceDirectory={chooseWorkspaceDirectoryAction}
              onRefreshWorkspace={() => void refreshWorkspaceEntries()}
              onOpenWorkspaceEntry={openWorkspaceEntry}
              onCopyDeveloperCommand={showDeveloperCommand}
            />
          )}

          {activePanel === "review" && (
            <ReviewPanel
              review={changeReview}
              baseLabel={reviewBaseLabel}
              savedLabel={savedLabel}
              hasUnsavedChanges={hasUnsavedChanges}
              isDiffOverlayEnabled={isDiffOverlayEnabled}
              visualDiffItems={visibleReviewActionItems}
              visualDiffCounts={visualDiffFilterCounts}
              visualDiffFilter={visualDiffFilter}
              selectedVisualDiffId={selectedVisualDiffId}
              batchSummary={lastReviewBatchSummary}
              onShowDiff={() => showPreview("diff")}
              onCompareSavedBaseline={compareSavedBaseline}
              onApplyReviewAction={applyReviewAction}
              onApplyReviewBatch={applyVisibleReviewBatch}
              onMarkSaved={markCurrentAsBaseline}
              onSelectVisualDiff={selectVisualDiffItem}
              onSetVisualDiffFilter={setVisualDiffFilter}
              onToggleDiffOverlay={() => setIsDiffOverlayEnabled((current) => !current)}
              onCopyDeveloperCommand={showDeveloperCommand}
            />
          )}

          {activePanel === "references" && (
            <ReferencePanel
              diagnostics={referenceDiagnostics}
              highlightedNodeId={highlightedNodeId}
              onInsertReference={insertCrossReferenceToTarget}
              onRevealNode={revealEditorNode}
              onRetargetReference={retargetBrokenReference}
              onRemoveReference={removeBrokenReference}
              onUpdateReferenceLabel={updateReferenceLabel}
            />
          )}

          {activePanel === "traceability" && (
            <TraceabilityPanel
              traceability={requirementTraceability}
              highlightedNodeId={highlightedNodeId}
              onSetSelectedTag={tagSelectedBlock}
              onClearSelectedTag={clearSelectedBlockTag}
              onRevealNode={revealEditorNode}
            />
          )}

          {activePanel === "history" && (
            <HistoryPanel
              entries={historyEntries}
              selectedId={selectedHistoryId}
              onSaveSnapshot={saveHistorySnapshot}
              onCompareSnapshot={compareHistorySnapshot}
              onDeleteSnapshot={deleteHistorySnapshot}
              onRenameSnapshot={renameHistorySnapshot}
              onCompareSavedBaseline={compareSavedBaseline}
            />
          )}

          {activePanel === "export" && (
            <ExportPanel
              filenames={exportFilenames}
              derivedOutputs={derivedOutputs}
              dataGridDiagnostics={dataGridDiagnostics}
              dataGridRowReview={dataGridRowReview}
              onAcceptDataGridRowEvent={acceptDataGridRowEvent}
              onRejectDataGridRowEvent={(item, event) => rejectDataGridRowEvent(item, event)}
              onRejectDataGridRowEventAsRevision={(item, event) => rejectDataGridRowEvent(item, event, "revision")}
              onExportSdoc={downloadSdoc}
              onExportJson={downloadJson}
              onExportMarkdown={downloadMarkdown}
              onExportHtml={downloadHtml}
              onExportDerived={downloadDerivedOutput}
              onCopyDeveloperCommand={showDeveloperCommand}
            />
          )}
        </aside>
      )}

      <section className="workspace">
        {showDesktopStartScreen ? (
          <DesktopStartScreen
            recentFiles={recentFiles}
            isWorkspaceLoading={isWorkspaceLoading}
            onNewDocument={createNewDocument}
            onOpenDocument={() => void openDocumentAction()}
            onChooseWorkspaceDirectory={() => void chooseWorkspaceDirectoryAction()}
            onOpenRecentFile={(entry) => void openRecentFile(entry)}
          />
        ) : (
          <>
        <div className="document-command-bar" role="region" aria-label="Document workflow">
          <div className="document-command-main">
            <label className="document-title-field">
              <span>Title</span>
              <input value={metadata.title} onChange={(event) => setMetadata({ ...metadata, title: event.target.value })} />
            </label>
            <div className="document-command-meta">
              <strong title={fileLabel}>{fileLabel}</strong>
              <span>{savedLabel}</span>
              <span className={validation.ok ? "validation-badge ok" : "validation-badge error"}>{validation.ok ? "Valid" : "Invalid"}</span>
            </div>
            <div className="status-note" aria-label="Current status">
              {statusMessage}
            </div>
          </div>
          <div className="document-command-actions">
            <button type="button" onClick={createNewDocument}>
              <FilePlus size={16} />
              <span>New</span>
            </button>
            <button type="button" onClick={openDocumentAction}>
              <FolderOpen size={16} />
              <span>Open .sdoc</span>
            </button>
            <button type="button" onClick={downloadSdoc}>
              <Download size={16} />
              <span>{sdocSaveRoute.label}</span>
            </button>
            <button type="button" onClick={() => openActivityPanel("export")}>
              <FileText size={16} />
              <span>Export</span>
            </button>
            <button type="button" onClick={() => setIsPreviewOpen((open) => !open)}>
              <Braces size={16} />
              <span>{isPreviewOpen ? "Hide preview" : "Preview"}</span>
            </button>
          </div>
        </div>

        <div className="toolbar" aria-label="Editor toolbar">
          <div className="toolbar-group primary" aria-label="Basic writing tools">
          <ToolbarButton title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            <Heading1 size={18} />
          </ToolbarButton>
          <ToolbarButton title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 size={18} />
          </ToolbarButton>
          <ToolbarButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold size={18} />
          </ToolbarButton>
          <ToolbarButton title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic size={18} />
          </ToolbarButton>
          <ToolbarButton title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon size={18} />
          </ToolbarButton>
          <ToolbarButton title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List size={18} />
          </ToolbarButton>
          <ToolbarButton title="Ordered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered size={18} />
          </ToolbarButton>
          <ToolbarButton title="Blockquote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote size={18} />
          </ToolbarButton>
          <ToolbarButton title="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
            <Code2 size={18} />
          </ToolbarButton>
          <ToolbarButton title="Insert image" active={editor.isActive("figure")} onClick={() => imageInputRef.current?.click()}>
            <ImageIcon size={18} />
          </ToolbarButton>
          <ToolbarButton title="Insert reference" active={editor.isActive("crossReference")} onClick={openReferencePicker}>
            <Link2 size={18} />
          </ToolbarButton>
          <ToolbarButton title="Insert table" active={editor.isActive("table")} onClick={insertTable}>
            <TableIcon size={18} />
          </ToolbarButton>
          <ToolbarButton title="Note callout" active={editor.isActive("callout", { kind: "note" })} onClick={() => applyCallout("note")}>
            <Info size={18} />
          </ToolbarButton>
          <ToolbarButton title="Warning callout" active={editor.isActive("callout", { kind: "warning" })} onClick={() => applyCallout("warning")}>
            <AlertTriangle size={18} />
          </ToolbarButton>
          </div>

          <div className="toolbar-group advanced" aria-label="Advanced authoring tools">
          <ToolbarButton title="Fold section" onClick={foldSelectedSection}>
            <ChevronRight size={18} />
          </ToolbarButton>
          <ToolbarButton title="Unfold section" onClick={unfoldSelectedSection}>
            <ChevronDown size={18} />
          </ToolbarButton>
          <ToolbarButton title="Unfold all sections" active={collapsedHeadingIds.size > 0} onClick={unfoldAllSections}>
            <List size={18} />
          </ToolbarButton>
          <ToolbarButton title="Insert data grid" active={editor.isActive("dataGrid")} onClick={() => dataGridInputRef.current?.click()}>
            <FileJson size={18} />
          </ToolbarButton>
          <ToolbarButton title="Add row after" active={editor.isActive("table")} onClick={() => runTableCommand("addRowAfter", "Added table row")}>
            <Rows3 size={18} />
          </ToolbarButton>
          <ToolbarButton title="Add column after" active={editor.isActive("table")} onClick={() => runTableCommand("addColumnAfter", "Added table column")}>
            <Columns3 size={18} />
          </ToolbarButton>
          <ToolbarButton title="Delete row" active={editor.isActive("table")} onClick={() => runTableCommand("deleteRow", "Deleted table row")}>
            <Rows3 size={18} />
          </ToolbarButton>
          <ToolbarButton title="Delete column" active={editor.isActive("table")} onClick={() => runTableCommand("deleteColumn", "Deleted table column")}>
            <Columns3 size={18} />
          </ToolbarButton>
          <ToolbarButton title="Toggle header row" active={editor.isActive("table")} onClick={() => runTableCommand("toggleHeaderRow", "Toggled header row")}>
            <TableIcon size={18} />
          </ToolbarButton>
          <ToolbarButton title="Toggle header column" active={editor.isActive("table")} onClick={() => runTableCommand("toggleHeaderColumn", "Toggled header column")}>
            <TableIcon size={18} />
          </ToolbarButton>
          <ToolbarButton title="Align table cell left" active={editor.isActive("tableCell", { align: "left" }) || editor.isActive("tableHeader", { align: "left" })} onClick={() => alignTableCells("left")}>
            <AlignLeft size={18} />
          </ToolbarButton>
          <ToolbarButton title="Align table cell center" active={editor.isActive("tableCell", { align: "center" }) || editor.isActive("tableHeader", { align: "center" })} onClick={() => alignTableCells("center")}>
            <AlignCenter size={18} />
          </ToolbarButton>
          <ToolbarButton title="Align table cell right" active={editor.isActive("tableCell", { align: "right" }) || editor.isActive("tableHeader", { align: "right" })} onClick={() => alignTableCells("right")}>
            <AlignRight size={18} />
          </ToolbarButton>
          <ToolbarButton title="Insert inline equation" active={editor.isActive("equation")} onClick={insertInlineEquationFromPrompt}>
            <Sigma size={18} />
          </ToolbarButton>
          <ToolbarButton title="Insert equation block" active={editor.isActive("equationBlock")} onClick={insertEquationBlockFromPrompt}>
            <Sigma size={18} />
          </ToolbarButton>
          <ToolbarButton title="Insert Mermaid diagram" active={editor.isActive("diagram")} onClick={insertMermaidDiagramFromPrompt}>
            <Workflow size={18} />
          </ToolbarButton>
          <ToolbarButton title="Import Draw.io source" active={editor.isActive("diagram", { kind: "drawio" })} onClick={() => drawioInputRef.current?.click()}>
            <FileJson size={18} />
          </ToolbarButton>
          <ToolbarButton title="Open Draw.io external editor" active={drawioBridgeSession !== null} onClick={openSelectedDrawioExternalEditor}>
            <ExternalLink size={18} />
          </ToolbarButton>
          <ToolbarButton title="Read Draw.io external edit" active={drawioBridgeSession !== null} onClick={readDrawioExternalEdit}>
            <RefreshCw size={18} />
          </ToolbarButton>
          <ToolbarButton title="Close Draw.io external edit" active={drawioBridgeSession !== null} onClick={closeDrawioExternalEdit}>
            <Trash2 size={18} />
          </ToolbarButton>
          <ToolbarButton title="Move block up" onClick={() => moveBlock("up")}>
            <ArrowUp size={18} />
          </ToolbarButton>
          <ToolbarButton title="Move block down" onClick={() => moveBlock("down")}>
            <ArrowDown size={18} />
          </ToolbarButton>
          </div>
          <div className="toolbar-spacer" />
          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            aria-label="Open document file"
            accept=".sdoc,.json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void openFile(file);
              }
            }}
          />
          <input
            ref={imageInputRef}
            className="file-input"
            type="file"
            aria-label="Insert image file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void insertImageFile(file);
              }
            }}
          />
          <input
            ref={dataGridInputRef}
            className="file-input"
            type="file"
            aria-label="Insert data grid file"
            accept=".csv,.json,text/csv,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void insertDataGridFile(file);
              }
            }}
          />
          <input
            ref={drawioInputRef}
            className="file-input"
            type="file"
            aria-label="Import Draw.io source file"
            accept=".drawio,.drawio.xml,application/xml,text/xml"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void insertDrawioFile(file);
              }
            }}
          />
          <ToolbarButton title="New document" onClick={createNewDocument}>
            <FilePlus size={18} />
          </ToolbarButton>
          <ToolbarButton title="Open .sdoc or document.json" onClick={openDocumentAction}>
            <FolderOpen size={18} />
          </ToolbarButton>
          <ToolbarButton title="Download document.json" onClick={downloadJson}>
            <Braces size={18} />
          </ToolbarButton>
          <ToolbarButton title="Download Markdown" onClick={downloadMarkdown}>
            <FileText size={18} />
          </ToolbarButton>
          <ToolbarButton title="Save current .sdoc" onClick={downloadSdoc}>
            <Download size={18} />
          </ToolbarButton>
          <ToolbarButton title="Mark saved" onClick={markCurrentAsBaseline}>
            <Save size={18} />
          </ToolbarButton>
        </div>

        <div className={isPreviewOpen ? "editor-grid" : "editor-grid preview-collapsed"}>
          <section className="editor-pane" ref={editorPaneRef}>
            {foldRuntimeCss && <style data-sdoc-fold-runtime>{foldRuntimeCss}</style>}
            {brokenReferenceRuntimeCss && <style data-sdoc-broken-reference-runtime>{brokenReferenceRuntimeCss}</style>}
            {visualDiffRuntimeCss && <style data-sdoc-diff-overlay-runtime>{visualDiffRuntimeCss}</style>}
            <EditorContent editor={editor} />
            {highlightOverlay && (
              <div
                className="editor-node-highlight"
                data-highlighted-node-id={highlightOverlay.nodeId}
                style={{
                  top: highlightOverlay.top,
                  left: highlightOverlay.left,
                  width: highlightOverlay.width,
                  height: highlightOverlay.height
                }}
              />
            )}
          </section>

          {isPreviewOpen && (
          <section className="preview-pane" aria-label="Preview and debug output">
            <div className="tabs" role="tablist">
              <TabButton label="JSON" value="json" activeTab={activeTab} onSelect={setActiveTab} />
              <TabButton label="Markdown" value="markdown" activeTab={activeTab} onSelect={setActiveTab} />
              <TabButton label="Diff" value="diff" activeTab={activeTab} onSelect={setActiveTab} />
            </div>
            {activeTab === "diff" ? (
              <DiffReview
                review={changeReview}
                rawPreview={diffPreview}
                baseLabel={reviewBaseLabel}
                sideBySideRows={sideBySideDiffRows}
                onCompareSavedBaseline={compareSavedBaseline}
              />
            ) : (
              <pre className="preview-output">{preview}</pre>
            )}
          </section>
          )}
        </div>
          </>
        )}
      </section>
    </main>
  );
}

function DesktopStartScreen({
  recentFiles,
  isWorkspaceLoading,
  onNewDocument,
  onOpenDocument,
  onChooseWorkspaceDirectory,
  onOpenRecentFile
}: {
  recentFiles: RecentFileEntry[];
  isWorkspaceLoading: boolean;
  onNewDocument: () => void;
  onOpenDocument: () => void;
  onChooseWorkspaceDirectory: () => void;
  onOpenRecentFile: (entry: RecentFileEntry) => void;
}) {
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

function ActivityBar({
  activePanel,
  isOpen,
  onSelect
}: {
  activePanel: ActivityPanel;
  isOpen: boolean;
  onSelect: (panel: ActivityPanel) => void;
}) {
  return (
    <nav className="activity-bar" aria-label="Primary">
      <ActivityButton active={activePanel === "files" && isOpen} label="Files" onClick={() => onSelect("files")}>
        <FolderOpen size={20} />
      </ActivityButton>
      <ActivityButton active={activePanel === "review" && isOpen} label="Review" onClick={() => onSelect("review")}>
        <Workflow size={20} />
      </ActivityButton>
      <ActivityButton active={activePanel === "references" && isOpen} label="References" onClick={() => onSelect("references")}>
        <Link2 size={20} />
      </ActivityButton>
      <ActivityButton active={activePanel === "traceability" && isOpen} label="Traceability" onClick={() => onSelect("traceability")}>
        <Sigma size={20} />
      </ActivityButton>
      <ActivityButton active={activePanel === "history" && isOpen} label="History" onClick={() => onSelect("history")}>
        <HistoryIcon size={20} />
      </ActivityButton>
      <ActivityButton active={activePanel === "export" && isOpen} label="Export" onClick={() => onSelect("export")}>
        <Download size={20} />
      </ActivityButton>
      <div className="activity-spacer" />
      <ActivityButton active={activePanel === "settings" && isOpen} label="Settings" onClick={() => onSelect("settings")}>
        <Settings size={20} />
      </ActivityButton>
    </nav>
  );
}

function ActivityButton({
  active,
  label,
  onClick,
  children
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={active ? "activity-button active" : "activity-button"}
      type="button"
      aria-label={`${label} panel`}
      aria-pressed={active}
      title={`${label} panel`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SettingsPanel({
  metadata,
  validation,
  document,
  assetCount,
  drawioExecutablePath,
  onMetadataChange,
  onDrawioExecutablePathChange
}: {
  metadata: SDocMetadata;
  validation: ValidationResult;
  document: SDocDocument;
  assetCount: number;
  drawioExecutablePath: string;
  onMetadataChange: (metadata: SDocMetadata) => void;
  onDrawioExecutablePathChange: (path: string) => void;
}) {
  return (
    <div className="side-panel-section settings-panel">
      <section className="settings-section" aria-label="Document metadata">
        <h3>Metadata</h3>
        <label className="metadata-field">
          <span>Metadata title</span>
          <input value={metadata.title} onChange={(event) => onMetadataChange({ ...metadata, title: event.target.value })} />
        </label>
        <label className="metadata-field">
          <span>Metadata author</span>
          <input value={String(metadata.author ?? "")} onChange={(event) => onMetadataChange({ ...metadata, author: event.target.value })} />
        </label>
        <label className="metadata-field">
          <span>Metadata version</span>
          <input value={String(metadata.version ?? "")} onChange={(event) => onMetadataChange({ ...metadata, version: event.target.value })} />
        </label>
      </section>

      <section className="settings-section" aria-label="Native integration settings">
        <h3>Native Integrations</h3>
        <label className="metadata-field">
          <span>Draw.io executable</span>
          <input
            value={drawioExecutablePath}
            placeholder="Use OS default opener"
            onChange={(event) => onDrawioExecutablePathChange(event.target.value)}
          />
        </label>
        <div className="status-block">
          <span>Draw.io launch</span>
          <strong>{drawioExecutablePath.trim() ? "Explicit executable" : "OS default"}</strong>
        </div>
      </section>

      <section className="settings-section" aria-label="Schema status">
        <h3>Schema</h3>
        <div className="status-block">
          <span>Status</span>
          <strong className={validation.ok ? "ok" : "error"}>{validation.ok ? "Valid" : "Invalid"}</strong>
        </div>
        <div className="status-block">
          <span>Version</span>
          <strong>{document.schemaVersion}</strong>
        </div>
        <div className="status-block">
          <span>Document ID</span>
          <strong title={document.attrs.id}>{document.attrs.id}</strong>
        </div>
        <div className="status-block">
          <span>Top blocks</span>
          <strong>{document.content.length}</strong>
        </div>
        <div className="status-block">
          <span>Assets</span>
          <strong>{assetCount}</strong>
        </div>
        {!validation.ok && (
          <div className="issue-list">
            {validation.issues.slice(0, 5).map((issue) => (
              <div key={`${issue.path}-${issue.message}`}>
                <strong>{issue.path}</strong>
                <span>{issue.message}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FilesPanel({
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
}: {
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
}) {
  const unpackCommand = `npm run sdoc -- unpack ${quoteCliPath(sdocFilename)} ${quoteCliPath(`${sdocFilename}.d`)}`;
  const packCommand = `npm run sdoc -- pack ${quoteCliPath(`${sdocFilename}.d`)} ${quoteCliPath(sdocFilename)}`;

  return (
    <div className="side-panel-section files-panel">
      <div className="status-block">
        <span>Current file</span>
        <strong title={currentFile}>{currentFile}</strong>
      </div>
      <div className="status-block">
        <span>Saved</span>
        <strong>{savedLabel}</strong>
      </div>

      <div className="files-actions" aria-label="File actions">
        <button type="button" onClick={onNewDocument}>
          New document
        </button>
        <button type="button" onClick={onOpenDocument}>
          Open .sdoc or JSON
        </button>
        <button type="button" onClick={onSaveSdoc}>
          {sdocSaveLabel}
        </button>
      </div>

      <section className="recent-files" aria-label="Recent files">
        <h3>Recent files</h3>
        {recentFiles.length === 0 ? (
          <p>No recent browser activity</p>
        ) : (
          <ul>
            {recentFiles.map((entry) => (
              <li key={entry.id}>
                <button type="button" onClick={() => onSelectRecentFile(entry)}>
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

      <section className="workspace-files" aria-label="Workspace files">
        <h3>Workspace files</h3>
        {isDesktopRuntime ? (
          <>
            <div className="workspace-boundary">
              <strong title={workspaceDirectory ?? "No workspace folder selected"}>{workspaceDirectory ?? "No workspace folder selected"}</strong>
              <span>Lists immediate `.sdoc` files from a selected desktop folder. This state is not saved to document.json.</span>
            </div>
            <div className="files-actions" aria-label="Workspace actions">
              <button type="button" onClick={onChooseWorkspaceDirectory}>
                Choose folder
              </button>
              <button type="button" onClick={onRefreshWorkspace} disabled={!workspaceDirectory || isWorkspaceLoading}>
                {isWorkspaceLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            {workspaceEntries.length === 0 ? (
              <p>{isWorkspaceLoading ? "Loading workspace files" : "No workspace .sdoc files loaded"}</p>
            ) : (
              <ul>
                {workspaceEntries.map((entry) => (
                  <li key={entry.path}>
                    <button type="button" onClick={() => onOpenWorkspaceEntry(entry)} disabled={entry.kind !== "sdoc-file"}>
                      <strong>{entry.name}</strong>
                      <span>{formatWorkspaceEntryMeta(entry)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="workspace-boundary">
            <strong>Desktop-only browsing</strong>
            <span>Folder exploration is available through the Tauri app. Browser mode only opens files selected by the user.</span>
          </div>
        )}
      </section>

      <section className="developer-workspace" aria-label="Unpacked folder workflow">
        <h3>Developer workspace</h3>
        <div className="workspace-boundary">
          <strong>Single-file .sdoc is the browser format</strong>
          <span>Unpacked folders are CLI/Tauri-only because browsers cannot manage arbitrary project folders.</span>
        </div>
        <button type="button" onClick={() => onCopyDeveloperCommand(unpackCommand)}>
          Copy unpack command
        </button>
        <button type="button" onClick={() => onCopyDeveloperCommand(packCommand)}>
          Copy pack command
        </button>
      </section>
    </div>
  );
}

function ExportPanel({
  filenames,
  derivedOutputs,
  dataGridDiagnostics,
  dataGridRowReview,
  onAcceptDataGridRowEvent,
  onRejectDataGridRowEvent,
  onRejectDataGridRowEventAsRevision,
  onExportSdoc,
  onExportJson,
  onExportMarkdown,
  onExportHtml,
  onExportDerived,
  onCopyDeveloperCommand
}: {
  filenames: {
    sdoc: string;
    json: string;
    markdown: string;
    html: string;
    pdf: string;
    pptx: string;
  };
  derivedOutputs: Record<DerivedOutputName, string>;
  dataGridDiagnostics: DataGridDiagnostics;
  dataGridRowReview: DataGridRowReviewModel;
  onAcceptDataGridRowEvent: (item: DataGridRowReviewItem, event: DataGridRowDiffEvent) => void;
  onRejectDataGridRowEvent: (item: DataGridRowReviewItem, event: DataGridRowDiffEvent) => void;
  onRejectDataGridRowEventAsRevision: (item: DataGridRowReviewItem, event: DataGridRowDiffEvent) => void;
  onExportSdoc: () => void;
  onExportJson: () => void;
  onExportMarkdown: () => void;
  onExportHtml: () => void;
  onExportDerived: (name: DerivedOutputName) => void;
  onCopyDeveloperCommand: (command: string) => void;
}) {
  const pdfCommand = `npm run sdoc -- export ${quoteCliPath(filenames.sdoc)} --format pdf -o ${quoteCliPath(filenames.pdf)}`;
  const pptxCommand = `npm run sdoc -- export ${quoteCliPath(filenames.sdoc)} --format pptx -o ${quoteCliPath(filenames.pptx)}`;
  const [expandedRowReviewGrids, setExpandedRowReviewGrids] = useState<Set<string>>(new Set());
  const [rowReviewQuery, setRowReviewQuery] = useState("");
  const normalizedRowReviewQuery = rowReviewQuery.trim().toLowerCase();

  function toggleRowReviewGrid(gridId: string) {
    setExpandedRowReviewGrids((current) => {
      const next = new Set(current);
      if (next.has(gridId)) {
        next.delete(gridId);
      } else {
        next.add(gridId);
      }
      return next;
    });
  }

  return (
    <div className="side-panel-section export-panel">
      <section className="export-section" aria-label="Portable document exports">
        <h3>Document</h3>
        <ExportAction
          label="Export .sdoc"
          filename={filenames.sdoc}
          description="Portable single-file container with document, metadata, assets, and derived AI outputs."
          onClick={onExportSdoc}
        />
        <ExportAction label="Export document.json" filename={filenames.json} description="Canonical semantic document JSON for debugging and tooling." onClick={onExportJson} />
      </section>

      <section className="export-section" aria-label="Readable exports">
        <h3>Readable</h3>
        <ExportAction label="Export Markdown" filename={filenames.markdown} description="Human-readable Markdown with stable block anchors." onClick={onExportMarkdown} />
        <ExportAction label="Export HTML" filename={filenames.html} description="Single-file themed HTML for browser reading and lightweight publishing." onClick={onExportHtml} />
      </section>

      <section className="export-section" aria-label="Data grid diagnostics">
        <h3>Data grids</h3>
        <div className="data-grid-diagnostic-summary">
          <div>
            <span>Grids</span>
            <strong>{dataGridDiagnostics.gridCount}</strong>
          </div>
          <div>
            <span>Errors</span>
            <strong className={dataGridDiagnostics.errorCount > 0 ? "error" : "ok"}>{dataGridDiagnostics.errorCount}</strong>
          </div>
          <div>
            <span>Warnings</span>
            <strong className={dataGridDiagnostics.warningCount > 0 ? "warning" : "ok"}>{dataGridDiagnostics.warningCount}</strong>
          </div>
        </div>
        {dataGridDiagnostics.summaries.length === 0 ? (
          <p className="data-grid-diagnostic-empty">No asset-backed data grids</p>
        ) : (
          <ul className="data-grid-diagnostic-list">
            {dataGridDiagnostics.summaries.map((summary) => (
              <li key={summary.gridId}>
                <div>
                  <strong>{summary.title}</strong>
                  <span>
                    {summary.format.toUpperCase()} · {summary.rowCount} rows · {summary.columnCount} columns
                  </span>
                  <code>{summary.sourceAssetId}</code>
                </div>
                {summary.issues.length === 0 ? (
                  <small className="ok">Rows valid</small>
                ) : (
                  <ul>
                    {summary.issues.slice(0, 4).map((issue, index) => (
                      <li className={issue.severity} key={`${summary.gridId}-${index}`}>
                        <span>{issue.severity}</span>
                        <p>
                          {issue.row ? `Row ${issue.row}: ` : ""}
                          {issue.message}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="data-grid-row-review" aria-label="Data grid row review readiness">
          <div className="data-grid-row-review-heading">
            <strong>Row review</strong>
            <span>{dataGridRowReview.label}</span>
          </div>
          {dataGridRowReview.eventCount > 0 && (
            <label className="data-grid-row-event-search">
              <span>Filter row events</span>
              <input
                type="search"
                value={rowReviewQuery}
                placeholder="row, column, kind, message"
                onChange={(event) => setRowReviewQuery(event.currentTarget.value)}
              />
            </label>
          )}
          {dataGridRowReview.items.length === 0 ? (
            <p className="data-grid-diagnostic-empty">No row-review candidates</p>
          ) : (
            <ul className="data-grid-row-review-list">
              {dataGridRowReview.items.map((item) => {
                const filteredEvents =
                  item.status === "ready" && normalizedRowReviewQuery
                    ? item.events.filter((event) => dataGridRowEventMatchesQuery(event, item, normalizedRowReviewQuery))
                    : item.events;
                const visibleEvents = expandedRowReviewGrids.has(item.gridId) ? filteredEvents : filteredEvents.slice(0, 3);

                return (
                  <li key={item.gridId} className={item.status}>
                    <div>
                      <strong>{item.title}</strong>
                      <span>
                        {normalizedRowReviewQuery && item.status === "ready"
                          ? `${filteredEvents.length} of ${item.events.length} row event${item.events.length === 1 ? "" : "s"} matched`
                          : item.label}
                      </span>
                      <small>{item.detail}</small>
                    </div>
                    <code>{item.sourceAssetId}</code>
                    {item.status === "ready" && item.events.length > 0 && (
                      <>
                        {filteredEvents.length === 0 ? (
                          <p className="data-grid-row-event-empty">No row events match this filter</p>
                        ) : (
                          <ul className="data-grid-row-event-list">
                            {visibleEvents.map((event, index) => (
                              <li key={`${item.gridId}-${index}-${event.kind}-${event.rowKey ?? "row"}`}>
                                <div className="data-grid-row-event-detail">
                                  <span>{event.message}</span>
                                  <div className="data-grid-row-event-meta">
                                    <small>{event.kind}</small>
                                    {event.rowKey && <small>Row {event.rowKey}</small>}
                                    {event.column && <small>{event.column}</small>}
                                  </div>
                                  <div className="data-grid-row-cell-review" aria-label="Row event cell review">
                                    <div>
                                      <strong>Before</strong>
                                      <code>{formatDataGridRowEventValue(event.oldValue, event.kind === "row-added" ? "(new row)" : "(empty)")}</code>
                                    </div>
                                    <div>
                                      <strong>After</strong>
                                      <code>{formatDataGridRowEventValue(event.newValue, event.kind === "row-deleted" ? "(deleted row)" : "(empty)")}</code>
                                    </div>
                                  </div>
                                  <RowPayloadPreview event={event} />
                                </div>
                                <div className="data-grid-row-event-actions">
                                  <button className="accept" type="button" onClick={() => onAcceptDataGridRowEvent(item, event)}>
                                    Accept
                                  </button>
                                  <button className="reject" type="button" onClick={() => onRejectDataGridRowEvent(item, event)}>
                                    Reject
                                  </button>
                                  <button className="revision" type="button" onClick={() => onRejectDataGridRowEventAsRevision(item, event)}>
                                    Revision
                                  </button>
                                </div>
                              </li>
                            ))}
                            {filteredEvents.length > 3 && (
                              <li className="data-grid-row-event-toggle">
                                <span>
                                  {expandedRowReviewGrids.has(item.gridId)
                                    ? `Showing all ${filteredEvents.length} row events`
                                    : `${filteredEvents.length - 3} more row event${filteredEvents.length - 3 === 1 ? "" : "s"} hidden`}
                                </span>
                                <button type="button" onClick={() => toggleRowReviewGrid(item.gridId)}>
                                  {expandedRowReviewGrids.has(item.gridId) ? "Show less" : "Show all"}
                                </button>
                              </li>
                            )}
                          </ul>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="export-section" aria-label="PDF publishing boundary">
        <h3>PDF</h3>
        <div className="workspace-boundary">
          <strong>CLI/Tauri PDF</strong>
          <span>Save .sdoc first, then generate PDF through the CLI print pipeline; the browser exports print-ready HTML today.</span>
        </div>
        <ExportAction
          label="Copy PDF CLI command"
          filename={filenames.pdf}
          description="Generates from the saved .sdoc file with Playwright/Chromium print emulation."
          onClick={() => onCopyDeveloperCommand(pdfCommand)}
        />
      </section>

      <section className="export-section" aria-label="Slide export boundary">
        <h3>Slides</h3>
        <div className="workspace-boundary">
          <strong>CLI/Tauri PPTX</strong>
          <span>Save .sdoc first, then generate editable PPTX through the CLI; browser PPTX download is deferred until fidelity and bundle size are proven.</span>
        </div>
        <ExportAction
          label="Copy PPTX CLI command"
          filename={filenames.pptx}
          description="Generates editable native slides from heading sections in canonical document.json."
          onClick={() => onCopyDeveloperCommand(pptxCommand)}
        />
      </section>

      <section className="export-section" aria-label="AI/RAG exports">
        <h3>AI/RAG</h3>
        {DERIVED_OUTPUT_NAMES.map((name) => (
          <ExportAction
            key={name}
            label={`Export ${name}`}
            filename={name}
            description={getDerivedOutputDescription(name)}
            detail={formatBytes(derivedOutputs[name])}
            onClick={() => onExportDerived(name)}
          />
        ))}
      </section>
    </div>
  );
}

function ExportAction({
  label,
  filename,
  description,
  detail,
  onClick
}: {
  label: string;
  filename: string;
  description: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <div className="export-action">
      <div>
        <strong title={filename}>{filename}</strong>
        <span>{description}</span>
        {detail && <em>{detail}</em>}
      </div>
      <button type="button" onClick={onClick}>
        {label}
      </button>
    </div>
  );
}

function RowPayloadPreview({ event }: { event: DataGridRowDiffEvent }) {
  const preview = createDataGridRowPayloadPreview(event);
  if (preview.totalCount === 0) {
    return null;
  }

  return (
    <div className="data-grid-row-payload-preview" aria-label="Row payload preview">
      <dl>
        {preview.entries.map(([column, value]) => (
          <div key={column}>
            <dt>{column}</dt>
            <dd>{formatDataGridRowEventValue(value, "(empty)")}</dd>
          </div>
        ))}
      </dl>
      {preview.hiddenCount > 0 && (
        <span className="data-grid-row-payload-overflow">
          {preview.hiddenCount} more column{preview.hiddenCount === 1 ? "" : "s"} hidden from preview
        </span>
      )}
    </div>
  );
}

function ReviewPanel({
  review,
  baseLabel,
  savedLabel,
  hasUnsavedChanges,
  isDiffOverlayEnabled,
  visualDiffItems,
  visualDiffCounts,
  visualDiffFilter,
  selectedVisualDiffId,
  batchSummary,
  onShowDiff,
  onCompareSavedBaseline,
  onApplyReviewAction,
  onApplyReviewBatch,
  onMarkSaved,
  onSelectVisualDiff,
  onSetVisualDiffFilter,
  onToggleDiffOverlay,
  onCopyDeveloperCommand
}: {
  review: ChangeReviewModel;
  baseLabel: string;
  savedLabel: string;
  hasUnsavedChanges: boolean;
  isDiffOverlayEnabled: boolean;
  visualDiffItems: ReviewActionPlanItem[];
  visualDiffCounts: VisualDiffFilterCounts;
  visualDiffFilter: VisualDiffFilterKind;
  selectedVisualDiffId: string | null;
  batchSummary: ReviewBatchConflictSummary | null;
  onShowDiff: () => void;
  onCompareSavedBaseline: () => void;
  onApplyReviewAction: (item: ReviewActionPlanItem, action: ReviewActionKind) => void;
  onApplyReviewBatch: (action: ReviewActionKind) => void;
  onMarkSaved: () => void;
  onSelectVisualDiff: (item: VisualDiffOverlayItem) => void;
  onSetVisualDiffFilter: (filter: VisualDiffFilterKind) => void;
  onToggleDiffOverlay: () => void;
  onCopyDeveloperCommand: (command: string) => void;
}) {
  const isHistoryBase = baseLabel !== "Saved baseline";
  const semanticDiffCommand = 'npm run sdoc -- diff "old.document.json" "new.document.json"';
  const batchableCount = createReviewBatchItems(visualDiffItems).length;
  const filterOptions: Array<{ value: VisualDiffFilterKind; label: string; count: number }> = [
    { value: "all", label: "All", count: visualDiffCounts.total },
    { value: "added", label: "Added", count: visualDiffCounts.added },
    { value: "modified", label: "Modified", count: visualDiffCounts.modified },
    { value: "moved", label: "Moved", count: visualDiffCounts.moved },
    { value: "reference-broken", label: "Broken", count: visualDiffCounts["reference-broken"] },
    { value: "deleted", label: "Deleted", count: visualDiffCounts.deleted }
  ];

  return (
    <div className="side-panel-section review-panel">
      <div className="status-block">
        <span>Review</span>
        <strong className={hasUnsavedChanges ? "warning" : "ok"}>{review.label}</strong>
      </div>
      <div className="status-block">
        <span>Base</span>
        <strong title={baseLabel}>{baseLabel}</strong>
      </div>
      <div className="status-block">
        <span>Saved</span>
        <strong className={hasUnsavedChanges ? "warning" : undefined}>{savedLabel}</strong>
      </div>

      <div className="review-counts" aria-label="Review counts">
        <div>
          <span>Total</span>
          <strong>{review.total}</strong>
        </div>
        <div>
          <span>Document</span>
          <strong>{review.documentCount}</strong>
        </div>
        <div>
          <span>Metadata</span>
          <strong>{review.metadataCount}</strong>
        </div>
      </div>

      <button type="button" onClick={onShowDiff}>
        Show diff
      </button>
      <label className="review-toggle">
        <input type="checkbox" checked={isDiffOverlayEnabled} onChange={onToggleDiffOverlay} />
        <span>Inline overlay</span>
      </label>
      <div className="review-batch-actions" aria-label="Visible review batch actions">
        <button type="button" disabled={batchableCount === 0} onClick={() => onApplyReviewBatch("accept")}>
          Accept visible
        </button>
        <button type="button" disabled={batchableCount === 0} onClick={() => onApplyReviewBatch("reject")}>
          Reject visible
        </button>
      </div>
      {batchSummary && (
        <section className={`review-batch-result ${batchSummary.status}`} aria-label="Review batch result">
          <div>
            <strong>{batchSummary.title}</strong>
            <span>{batchSummary.detail}</span>
          </div>
          <dl>
            <div>
              <dt>Applied</dt>
              <dd>{batchSummary.appliedCount}</dd>
            </div>
            <div>
              <dt>Skipped</dt>
              <dd>{batchSummary.skippedCount}</dd>
            </div>
          </dl>
          {batchSummary.failures.length > 0 && (
            <ul>
              {batchSummary.failures.map((failure) => (
                <li key={`${failure.kind}-${failure.id}`}>
                  <span className={`review-event-kind ${failure.kind}`}>{failure.kind}</span>
                  <code>{failure.id}</code>
                  <small>{failure.reason}</small>
                  <p>{failure.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="review-events" aria-label="Semantic review events">
        <div className="review-event-filters" aria-label="Review event filters">
          {filterOptions.map((option) => (
            <button
              className={visualDiffFilter === option.value ? "active" : undefined}
              type="button"
              key={option.value}
              aria-pressed={visualDiffFilter === option.value}
              onClick={() => onSetVisualDiffFilter(option.value)}
            >
              <span>{option.label}</span>
              <strong>{option.count}</strong>
            </button>
          ))}
        </div>
        {visualDiffItems.length === 0 ? (
          <p className="review-empty">No document events</p>
        ) : (
          <ul className="review-event-list">
            {visualDiffItems.map((item) => (
              <li className={selectedVisualDiffId === item.id ? "selected" : undefined} key={`${item.kind}-${item.id}`}>
                <button className="review-event-select" type="button" onClick={() => onSelectVisualDiff(item)}>
                  <span className={`review-event-kind ${item.kind}`}>{item.label}</span>
                  <strong>{item.summary}</strong>
                  <small>{item.detail}</small>
                  <code>{item.anchorable ? item.id : "review-only"}</code>
                </button>
                <div className="review-event-actions" aria-label={`${item.summary} review actions`}>
                  {item.actions.map((action) => (
                    <button
                      type="button"
                      key={action.kind}
                      disabled={action.availability === "manual-repair" || action.availability === "unsupported"}
                      title={action.description}
                      onClick={() => onApplyReviewAction(item, action.kind)}
                    >
                      {action.kind === "accept" ? "Accept" : "Reject"}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {isHistoryBase && (
        <button type="button" onClick={onCompareSavedBaseline}>
          Use saved baseline
        </button>
      )}
      <button type="button" onClick={onMarkSaved}>
        Mark saved
      </button>

      <section className="git-workflow" aria-label="Git integration boundary">
        <h3>Git workflow</h3>
        <div className="workspace-boundary">
          <strong>Git is optional</strong>
          <span>Use semantic diff or unpacked folders for developer review; normal authors do not need Git.</span>
        </div>
        <button type="button" onClick={() => onCopyDeveloperCommand(semanticDiffCommand)}>
          Copy semantic diff command
        </button>
      </section>
    </div>
  );
}

function DiffReview({
  review,
  rawPreview,
  baseLabel,
  sideBySideRows,
  onCompareSavedBaseline
}: {
  review: ChangeReviewModel;
  rawPreview: string;
  baseLabel: string;
  sideBySideRows: SideBySideDiffRow[];
  onCompareSavedBaseline: () => void;
}) {
  return (
    <div className="diff-review">
      <div className="diff-review-base">
        <span>{baseLabel}</span>
        {baseLabel !== "Saved baseline" && (
          <button type="button" onClick={onCompareSavedBaseline}>
            Saved baseline
          </button>
        )}
      </div>

      <div className="diff-review-summary" aria-label="Change summary">
        <div>
          <span>Total</span>
          <strong>{review.total}</strong>
        </div>
        <div>
          <span>Document</span>
          <strong>{review.documentCount}</strong>
        </div>
        <div>
          <span>Metadata</span>
          <strong>{review.metadataCount}</strong>
        </div>
      </div>

      {review.sections.length === 0 ? (
        <div className="diff-empty">No changes</div>
      ) : (
        <div className="diff-review-body">
          {sideBySideRows.length > 0 && (
            <section className="diff-side-by-side" aria-label="Side-by-side document diff">
              <h3>Side-by-side document diff</h3>
              <div className="diff-side-by-side-header" aria-hidden="true">
                <span>Change</span>
                <span>Baseline</span>
                <span>Current</span>
              </div>
              <div className="diff-side-by-side-rows">
                {sideBySideRows.map((row) => (
                  <article className={`diff-side-by-side-row ${row.kind}`} key={`${row.kind}-${row.id}`}>
                    <div className="diff-side-change">
                      <span className={`review-event-kind ${row.kind}`}>{row.label}</span>
                      <strong>{row.nodeType}</strong>
                      <code>{row.id}</code>
                      <small>{row.detail}</small>
                    </div>
                    <pre>{row.baselineText}</pre>
                    <pre>{row.currentText}</pre>
                  </article>
                ))}
              </div>
            </section>
          )}

          <div className="diff-review-sections">
            {review.sections.map((section) => (
              <section className="diff-review-section" key={section.title}>
                <h3>{section.title}</h3>
                <ul className="diff-review-list">
                  {section.lines.map((line) => (
                    <li key={`${section.title}-${line}`}>
                      <span />
                      <p>{line}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}

      <pre className="preview-output diff-raw" aria-label="Raw diff preview">
        {rawPreview}
      </pre>
    </div>
  );
}

function HistoryPanel({
  entries,
  selectedId,
  onSaveSnapshot,
  onCompareSnapshot,
  onDeleteSnapshot,
  onRenameSnapshot,
  onCompareSavedBaseline
}: {
  entries: LocalHistoryEntry[];
  selectedId: string | null;
  onSaveSnapshot: () => void;
  onCompareSnapshot: (entryId: string) => void;
  onDeleteSnapshot: (entryId: string) => void;
  onRenameSnapshot: (entryId: string, title: string) => void;
  onCompareSavedBaseline: () => void;
}) {
  return (
    <div className="history-panel">
      <div className="history-toolbar">
        <button className="history-primary" type="button" onClick={onSaveSnapshot} aria-label="Save history snapshot">
          <Save size={16} />
          <span>Save snapshot</span>
        </button>
        <button className="history-secondary" type="button" onClick={onCompareSavedBaseline}>
          Saved baseline
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="history-empty">
          <HistoryIcon size={22} />
          <span>No snapshots</span>
        </div>
      ) : (
        <div className="history-list">
          {entries.map((entry) => (
            <HistoryEntryCard
              entry={entry}
              key={entry.id}
              selected={entry.id === selectedId}
              onCompareSnapshot={onCompareSnapshot}
              onDeleteSnapshot={onDeleteSnapshot}
              onRenameSnapshot={onRenameSnapshot}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryEntryCard({
  entry,
  selected,
  onCompareSnapshot,
  onDeleteSnapshot,
  onRenameSnapshot
}: {
  entry: LocalHistoryEntry;
  selected: boolean;
  onCompareSnapshot: (entryId: string) => void;
  onDeleteSnapshot: (entryId: string) => void;
  onRenameSnapshot: (entryId: string, title: string) => void;
}) {
  const [draftTitle, setDraftTitle] = useState(entry.title);
  const skipCommitRef = useRef(false);

  useEffect(() => {
    setDraftTitle(entry.title);
  }, [entry.id, entry.title]);

  function commitRename() {
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      return;
    }

    if (draftTitle !== entry.title) {
      onRenameSnapshot(entry.id, draftTitle);
    }
  }

  return (
    <article className={selected ? "history-item selected" : "history-item"}>
      <div className="history-entry-main">
        <input
          aria-label="Snapshot name"
          className="history-title-input"
          value={draftTitle}
          onBlur={commitRename}
          onChange={(event) => setDraftTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              skipCommitRef.current = true;
              setDraftTitle(entry.title);
              event.currentTarget.blur();
            }
          }}
        />
        <span>{formatHistoryTime(entry.createdAt)}</span>
      </div>
      <div className="history-actions">
        <button type="button" onClick={() => onCompareSnapshot(entry.id)}>
          Compare
        </button>
        <button
          className="history-delete"
          type="button"
          title={`Delete ${entry.title}`}
          aria-label={`Delete history snapshot ${entry.title}`}
          onClick={() => onDeleteSnapshot(entry.id)}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}

function TraceabilityPanel({
  traceability,
  highlightedNodeId,
  onSetSelectedTag,
  onClearSelectedTag,
  onRevealNode
}: {
  traceability: RequirementTraceabilityModel;
  highlightedNodeId: string | null;
  onSetSelectedTag: () => void;
  onClearSelectedTag: () => void;
  onRevealNode: (nodeId: string, label: string) => void;
}) {
  return (
    <div className="traceability-panel">
      <div className="traceability-summary" aria-label="Requirement traceability summary">
        <div>
          <span>Tagged</span>
          <strong>{traceability.taggedCount}</strong>
        </div>
        <div>
          <span>Duplicates</span>
          <strong className={traceability.duplicateCount > 0 ? "warning" : "ok"}>{traceability.duplicateCount}</strong>
        </div>
        <div>
          <span>Format</span>
          <strong className={traceability.formatIssueCount > 0 ? "warning" : "ok"}>{traceability.formatIssueCount}</strong>
        </div>
        <div>
          <span>Gaps</span>
          <strong className={traceability.coverageGapCount > 0 ? "warning" : "ok"}>{traceability.coverageGapCount}</strong>
        </div>
      </div>

      <div className="traceability-actions">
        <button type="button" onClick={onSetSelectedTag}>
          Set selected ID
        </button>
        <button type="button" onClick={onClearSelectedTag}>
          Clear selected ID
        </button>
      </div>

      {traceability.duplicateHumanIds.length > 0 && (
        <section className="traceability-section">
          <h3>Duplicate IDs</h3>
          <ul className="traceability-issue-list">
            {traceability.duplicateHumanIds.map((issue) => (
              <li key={issue.humanId}>
                <strong>{issue.humanId}</strong>
                <span>{issue.message}</span>
                <div className="traceability-block-links">
                  {issue.blocks.map((block) => (
                    <button type="button" key={block.id} onClick={() => onRevealNode(block.id, `${block.humanId} ${block.label}`)}>
                      {block.id}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {traceability.formatIssues.length > 0 && (
        <section className="traceability-section">
          <h3>Format warnings</h3>
          <ul className="traceability-issue-list">
            {traceability.formatIssues.map((issue) => (
              <li key={issue.humanId}>
                <strong>{issue.humanId}</strong>
                <span>{issue.message}</span>
                <div className="traceability-block-links">
                  {issue.blocks.map((block) => (
                    <button type="button" key={block.id} onClick={() => onRevealNode(block.id, `${block.humanId} ${block.label}`)}>
                      {block.id}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {traceability.coverageGaps.length > 0 && (
        <section className="traceability-section">
          <h3>Heading gaps</h3>
          <ul className="traceability-gap-list">
            {traceability.coverageGaps.map((gap) => (
              <li className={highlightedNodeId === gap.id ? "selected" : undefined} key={gap.id}>
                <div>
                  <strong>{gap.label}</strong>
                  <code>{gap.id}</code>
                </div>
                <button type="button" onClick={() => onRevealNode(gap.id, `heading ${gap.label}`)}>
                  Show
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="traceability-section">
        <h3>Tagged blocks</h3>
        {traceability.taggedBlocks.length === 0 ? (
          <p className="traceability-empty">No requirement IDs</p>
        ) : (
          <ul className="traceability-tag-list">
            {traceability.taggedBlocks.map((block) => (
              <li className={highlightedNodeId === block.id ? "selected" : undefined} key={`${block.humanId}-${block.id}`}>
                <span>{block.type}</span>
                <strong>{block.humanId}</strong>
                <small>{block.label}</small>
                <code>{block.id}</code>
                <button type="button" onClick={() => onRevealNode(block.id, `${block.humanId} ${block.label}`)}>
                  Show
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ReferencePanel({
  diagnostics,
  highlightedNodeId,
  onInsertReference,
  onRevealNode,
  onRetargetReference,
  onRemoveReference,
  onUpdateReferenceLabel
}: {
  diagnostics: ReferenceDiagnosticsModel;
  highlightedNodeId: string | null;
  onInsertReference: (targetId: string) => void;
  onRevealNode: (nodeId: string, label: string) => void;
  onRetargetReference: (referenceId: string, targetId: string) => void;
  onRemoveReference: (referenceId: string) => void;
  onUpdateReferenceLabel: (referenceId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTargets =
    normalizedQuery.length === 0 ? diagnostics.targets : diagnostics.targets.filter((target) => targetMatchesReferenceQuery(target, normalizedQuery));

  return (
    <div className="reference-panel">
      <div className="reference-summary" aria-label="Reference summary">
        <div>
          <span>Targets</span>
          <strong>{diagnostics.targetCount}</strong>
        </div>
        <div>
          <span>References</span>
          <strong>{diagnostics.referenceCount}</strong>
        </div>
        <div>
          <span>Broken</span>
          <strong className={diagnostics.brokenCount > 0 ? "error" : "ok"}>{diagnostics.brokenCount}</strong>
        </div>
        <div>
          <span>Stale</span>
          <strong className={diagnostics.staleCount > 0 ? "warning" : "ok"}>{diagnostics.staleCount}</strong>
        </div>
      </div>

      {diagnostics.brokenReferences.length === 0 && diagnostics.staleReferences.length === 0 ? (
        <div className="reference-empty">
          <Link2 size={22} />
          <span>All references resolve</span>
        </div>
      ) : diagnostics.brokenReferences.length > 0 ? (
        <section className="reference-section">
          <h3>Broken references</h3>
          <ul className="reference-issue-list">
            {diagnostics.brokenReferences.map((reference) => (
              <li className={highlightedNodeId === reference.id ? "selected" : undefined} key={`${reference.path}-${reference.id}`}>
                <AlertTriangle size={16} />
                <div>
                  <strong>{reference.label}</strong>
                  <span>
                    {reference.id} targets missing block {reference.targetId}
                  </span>
                </div>
                <button type="button" onClick={() => onRevealNode(reference.id, `reference ${reference.label}`)}>
                  Show
                </button>
                <div className="reference-repair-actions">
                  {reference.repairCandidates.map((candidate) => (
                    <button
                      type="button"
                      key={`${reference.id}-${candidate.targetId}`}
                      onClick={() => onRetargetReference(reference.id, candidate.targetId)}
                    >
                      <span>Retarget</span>
                      <strong>{candidate.label}</strong>
                      <small>{candidate.detail}</small>
                    </button>
                  ))}
                  <button className="reference-remove" type="button" onClick={() => onRemoveReference(reference.id)}>
                    Remove reference
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {diagnostics.staleReferences.length > 0 && (
        <section className="reference-section">
          <h3>Stale labels</h3>
          <ul className="reference-stale-list">
            {diagnostics.staleReferences.map((reference) => (
              <li className={highlightedNodeId === reference.id ? "selected" : undefined} key={`${reference.path}-${reference.id}`}>
                <Info size={16} />
                <div>
                  <strong>{reference.label}</strong>
                  <span>Target label is {reference.targetLabel}</span>
                </div>
                <div className="reference-stale-actions">
                  <button type="button" onClick={() => onRevealNode(reference.id, `reference ${reference.label}`)}>
                    Show
                  </button>
                  <button type="button" aria-label={`Update label for ${reference.label}`} onClick={() => onUpdateReferenceLabel(reference.id)}>
                    Update
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="reference-section">
        <h3>Target blocks</h3>
        <label className="reference-search">
          <Search size={15} />
          <input
            aria-label="Filter reference targets"
            value={query}
            placeholder="Filter targets"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {diagnostics.targets.length === 0 ? (
          <p className="reference-muted">No targetable blocks</p>
        ) : filteredTargets.length === 0 ? (
          <p className="reference-muted">No matching targets</p>
        ) : (
          <ul className="reference-target-list">
            {filteredTargets.map((target) => (
              <li className={highlightedNodeId === target.id ? "selected" : undefined} key={target.id}>
                <span>{target.type}</span>
                <strong>{target.label}</strong>
                <code>{[target.humanId, target.anchor ? `#${target.anchor}` : "", target.id].filter(Boolean).join(" / ")}</code>
                <div className="reference-target-actions">
                  <button type="button" onClick={() => onRevealNode(target.id, `target ${target.label}`)}>
                    Show
                  </button>
                  <button type="button" aria-label={`Insert reference to ${target.label}`} onClick={() => onInsertReference(target.id)}>
                    <Link2 size={14} />
                    <span>Insert</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function targetMatchesReferenceQuery(target: ReferenceTargetSummary, query: string): boolean {
  return [target.id, target.type, target.label, target.anchor ?? "", target.humanId ?? ""].some((value) => value.toLowerCase().includes(query));
}

function getActivityPanelLabel(panel: ActivityPanel): string {
  const labels: Record<ActivityPanel, string> = {
    files: "Files",
    review: "Review",
    references: "References",
    traceability: "Traceability",
    history: "History",
    export: "Export",
    settings: "Settings"
  };
  return labels[panel];
}

function findDiffEventForReviewItem(events: SDocDiffEvent[], item: ReviewActionPlanItem): SDocDiffEvent | undefined {
  return events.find((event) => event.id === item.id && event.kind === item.kind);
}

function createReviewBatchItems(items: ReviewActionPlanItem[]): SDocReviewBatchItem[] {
  return items
    .filter((item) => item.kind !== "reference-broken")
    .map((item) => ({
      id: item.id,
      kind: item.kind
    }));
}

function getSelectedSectionFoldRange(editor: Editor, ranges: SectionFoldRange[]): SectionFoldRange | null {
  const headingId = getSelectedHeadingId(editor);
  if (!headingId) {
    return null;
  }

  return ranges.find((range) => range.headingId === headingId) ?? null;
}

function getSelectedHeadingId(editor: Editor): string | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "heading" && typeof node.attrs.id === "string" && node.attrs.id.length > 0) {
      return node.attrs.id;
    }
  }

  return null;
}

function collectHiddenFoldNodeIds(ranges: SectionFoldRange[], collapsedHeadingIds: Set<string>): Set<string> {
  const hiddenIds = new Set<string>();
  for (const range of ranges) {
    if (collapsedHeadingIds.has(range.headingId)) {
      range.hiddenBlockIds.forEach((id) => hiddenIds.add(id));
    }
  }

  return hiddenIds;
}

function renderFoldRuntimeCss(hiddenNodeIds: Set<string>, collapsedHeadingIds: Set<string>): string {
  const rules: string[] = [];
  for (const id of hiddenNodeIds) {
    rules.push(`.editor-surface [data-id="${escapeCssAttributeValue(id)}"]{display:none!important;}`);
  }
  for (const id of collapsedHeadingIds) {
    const selector = `.editor-surface [data-id="${escapeCssAttributeValue(id)}"]`;
    rules.push(`${selector}{padding-bottom:6px;border-bottom:1px dashed #92a4b4;}`);
    rules.push(`${selector}::after{content:" collapsed";margin-left:8px;color:#6f7f8e;font-size:12px;font-weight:500;}`);
  }

  return rules.join("\n");
}

function escapeCssAttributeValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function findEditorElementByDataId(nodeId: string): HTMLElement | null {
  const surface = window.document.querySelector(".editor-surface");
  if (!surface) {
    return null;
  }

  return (
    Array.from(surface.querySelectorAll<HTMLElement>("[data-id]")).find((element) => element.getAttribute("data-id") === nodeId) ?? null
  );
}

function measureEditorHighlightOverlay(element: HTMLElement, editorPane: HTMLElement | null): Omit<EditorHighlightOverlay, "nodeId"> | null {
  if (!editorPane) {
    return null;
  }

  const elementRect = element.getBoundingClientRect();
  const paneRect = editorPane.getBoundingClientRect();
  return {
    top: elementRect.top - paneRect.top + editorPane.scrollTop,
    left: elementRect.left - paneRect.left + editorPane.scrollLeft,
    width: Math.max(elementRect.width, 4),
    height: Math.max(elementRect.height, 4)
  };
}

function ToolbarButton({
  title,
  active = false,
  onClick,
  children
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button className={active ? "tool-button active" : "tool-button"} title={title} aria-label={title} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function TabButton({
  label,
  value,
  activeTab,
  onSelect
}: {
  label: string;
  value: PreviewTab;
  activeTab: PreviewTab;
  onSelect: (value: PreviewTab) => void;
}) {
  return (
    <button className={activeTab === value ? "tab active" : "tab"} type="button" onClick={() => onSelect(value)}>
      {label}
    </button>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function filenameFromNativePath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const filename = normalized.split("/").filter(Boolean).pop();
  return filename && filename.length > 0 ? filename : "document.sdoc";
}

function loadStoredHistory(): LocalHistoryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  return parseLocalHistory(window.localStorage.getItem(LOCAL_HISTORY_STORAGE_KEY));
}

function storeHistory(entries: LocalHistoryEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCAL_HISTORY_STORAGE_KEY, serializeLocalHistory(entries));
}

function loadStoredRecentFiles(): RecentFileEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  return parseRecentFiles(window.localStorage.getItem(RECENT_FILES_STORAGE_KEY));
}

function storeRecentFiles(entries: RecentFileEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(RECENT_FILES_STORAGE_KEY, JSON.stringify(entries));
}

function loadStoredDrawioExecutablePath(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(DRAWIO_EXECUTABLE_PATH_STORAGE_KEY)?.trim() ?? "";
}

function storeDrawioExecutablePath(path: string) {
  if (typeof window === "undefined") {
    return;
  }

  const trimmed = path.trim();
  if (trimmed) {
    window.localStorage.setItem(DRAWIO_EXECUTABLE_PATH_STORAGE_KEY, trimmed);
    return;
  }

  window.localStorage.removeItem(DRAWIO_EXECUTABLE_PATH_STORAGE_KEY);
}

function parseRecentFiles(value: string | null): RecentFileEntry[] {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isRecentFileEntry).slice(0, RECENT_FILES_LIMIT);
  } catch {
    return [];
  }
}

function isRecentFileEntry(value: unknown): value is RecentFileEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<RecentFileEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.name === "string" &&
    typeof entry.title === "string" &&
    (entry.action === "opened" || entry.action === "saved") &&
    typeof entry.updatedAt === "string" &&
    (entry.nativePath === undefined || typeof entry.nativePath === "string")
  );
}

function upsertRecentFile(entries: RecentFileEntry[], entry: RecentFileEntry): RecentFileEntry[] {
  return [entry, ...entries.filter((current) => current.id !== entry.id)].slice(0, RECENT_FILES_LIMIT);
}

function formatRecentFileTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
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

function getDerivedOutputDescription(name: DerivedOutputName): string {
  switch (name) {
    case "plain.md":
      return "LLM-friendly Markdown generated from the canonical document.";
    case "chunks.jsonl":
      return "Block-level JSONL chunks for RAG indexing.";
    case "outline.json":
      return "Heading outline with stable IDs and anchors.";
    case "references.json":
      return "Reference targets for headings, figures, tables, equations, and diagrams.";
  }
}

function getDerivedOutputMimeType(name: DerivedOutputName): string {
  switch (name) {
    case "plain.md":
      return "text/markdown";
    case "chunks.jsonl":
      return "application/x-ndjson";
    case "outline.json":
    case "references.json":
      return "application/json";
  }
}

function formatBytes(value: string): string {
  const bytes = new TextEncoder().encode(value).byteLength;
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatHistoryTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function createImageAssetId(filename: string, mimeType: string): string {
  return `${createAssetId()}${getImageExtension(filename, mimeType)}`;
}

function createDataGridAssetId(filename: string, mimeType: string): string {
  return `${createAssetId()}${getDataGridExtension(filename, mimeType)}`;
}

function createDrawioAssetId(filename: string): string {
  return `${createAssetId()}${getDrawioExtension(filename)}`;
}

function getDrawioExtension(filename: string): ".drawio" | ".drawio.xml" {
  return /\.drawio\.xml$/i.test(filename) ? ".drawio.xml" : ".drawio";
}

function isDrawioFile(file: File): boolean {
  return /\.(drawio|drawio\.xml)$/i.test(file.name) || file.type === "application/xml" || file.type === "text/xml";
}

function isUsableDrawioSource(bytes: Uint8Array): boolean {
  const text = new TextDecoder().decode(bytes).trimStart();
  return text.startsWith("<mxfile") || text.startsWith("<diagram") || text.includes("<mxfile ");
}

function getSelectedDrawioDiagramReference(editor: Editor | null): { blockId: string; sourceAssetId: string } | null {
  if (!editor) {
    return null;
  }

  const selection = editor.state.selection as typeof editor.state.selection & { node?: { type?: { name?: string }; attrs?: Record<string, unknown> } };
  const selectedNode = selection.node;
  const selectedReference = getDrawioDiagramReferenceFromNode(selectedNode);
  if (selectedReference) {
    return selectedReference;
  }

  for (let depth = selection.$from.depth; depth >= 0; depth -= 1) {
    const reference = getDrawioDiagramReferenceFromNode(selection.$from.node(depth));
    if (reference) {
      return reference;
    }
  }

  return getDrawioDiagramReferenceFromNode(selection.$from.nodeBefore) ?? getDrawioDiagramReferenceFromNode(selection.$from.nodeAfter);
}

function getDrawioDiagramReferenceFromNode(node: unknown): { blockId: string; sourceAssetId: string } | null {
  if (!node || typeof node !== "object") {
    return null;
  }

  const candidate = node as { type?: { name?: unknown }; attrs?: Record<string, unknown> };
  if (candidate.type?.name !== "diagram" || candidate.attrs?.kind !== "drawio") {
    return null;
  }

  const blockId = candidate.attrs.id;
  const sourceAssetId = candidate.attrs.sourceAssetId;
  if (typeof blockId !== "string" || blockId.length === 0 || typeof sourceAssetId !== "string" || sourceAssetId.length === 0) {
    return null;
  }

  return { blockId, sourceAssetId };
}

function getDrawioDiagramBlockIdBySourceAssetId(document: SDocDocument, sourceAssetId: string): string | null {
  let match: string | null = null;

  function visit(node: SDocDocument["content"][number]): void {
    if (match) {
      return;
    }

    if (node.type === "diagram" && node.attrs?.kind === "drawio" && node.attrs.sourceAssetId === sourceAssetId && typeof node.attrs.id === "string") {
      match = node.attrs.id;
      return;
    }

    node.content?.forEach(visit);
  }

  document.content.forEach(visit);
  return match;
}

function createDrawioRevisionAssetId(sourceAssetId: string, assets: SDocAssets): string {
  const extension = sourceAssetId.toLowerCase().endsWith(".drawio.xml") ? ".drawio.xml" : sourceAssetId.includes(".") ? sourceAssetId.slice(sourceAssetId.lastIndexOf(".")) : ".drawio";
  const base = sourceAssetId.endsWith(extension) ? sourceAssetId.slice(0, -extension.length) : sourceAssetId;
  let index = 1;
  let candidate = `${base}.rev${index}${extension}`;
  while (assets[candidate]) {
    index += 1;
    candidate = `${base}.rev${index}${extension}`;
  }
  return candidate;
}

function getDataGridExtension(filename: string, mimeType: string): ".csv" | ".json" {
  const extension = filename.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (extension === "json") {
    return ".json";
  }
  if (extension === "csv") {
    return ".csv";
  }
  return mimeType === "application/json" ? ".json" : ".csv";
}

function getDataGridFormatFromFile(file: File): "csv" | "json" | null {
  const extension = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (extension === "csv" || file.type === "text/csv") {
    return "csv";
  }
  if (extension === "json" || file.type === "application/json") {
    return "json";
  }
  return null;
}

function decodeTextAsset(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes).replace(/^\uFEFF/, "");
}

function dataGridRowEventMatchesQuery(event: DataGridRowDiffEvent, item: DataGridRowReviewItem, query: string): boolean {
  const payloadValues = createDataGridRowPayloadPreview(event, Number.MAX_SAFE_INTEGER).entries.flat();
  return [
    item.title,
    item.sourceAssetId,
    event.kind,
    event.message,
    event.rowKey ?? "",
    event.column ?? "",
    event.oldValue ?? "",
    event.newValue ?? "",
    ...payloadValues
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function formatDataGridRowEventValue(value: string | undefined, fallback: string): string {
  return value === undefined || value.length === 0 ? fallback : value;
}

function getImageExtension(filename: string, mimeType: string): string {
  const extension = filename.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (extension && ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) {
    return `.${extension}`;
  }

  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/gif":
      return ".gif";
    case "image/webp":
      return ".webp";
    case "image/svg+xml":
      return ".svg";
    default:
      return ".bin";
  }
}

function captionFromFilename(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  const caption = withoutExtension.replace(/[_-]+/g, " ").trim();
  return caption.length > 0 ? caption : "Image caption";
}

function titleFromFilename(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  const title = withoutExtension.replace(/[_-]+/g, " ").trim();
  return title.length > 0 ? title : "Data grid";
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function createAssetSourceMap(assets: SDocAssets): Record<string, string> {
  return Object.fromEntries(Object.entries(assets).map(([assetId, bytes]) => [assetId, bytesToDataUrl(assetId, bytes)]));
}

function bytesToDataUrl(assetId: string, bytes: Uint8Array): string {
  return `data:${mimeTypeFromAssetId(assetId)};base64,${bytesToBase64(bytes)}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.slice(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function mimeTypeFromAssetId(assetId: string): string {
  const extension = assetId.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  switch (extension) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "csv":
      return "text/csv";
    case "json":
      return "application/json";
    default:
      return "application/octet-stream";
  }
}
