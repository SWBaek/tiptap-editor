import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { AnyExtension, Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import {
  FileJson,
  Settings
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
import { exportDerivedOutputs, exportMarkdown, type PublishingStyleProfileName } from "@sdoc/export";
import {
  applyDataGridAssetRevision,
  applyDataGridRowMerge,
  createDataGridDiagnostics,
  createDataGridRowDiff,
  stableStringify,
  type DataGridAssetRevisionPolicy,
  type DataGridRowDiffEvent,
  type SDocMetadata
} from "@sdoc/format";
import { createAssetId, createBlockId, createEmptyDocument, type SDocDocument, type SDocNode, validateDocument } from "@sdoc/schema";
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
  type DataGridRowReviewItem,
  type SectionFoldRange,
  type ReviewActionKind,
  type ReviewActionPlanItem,
  type ReviewBatchConflictSummary,
  type VisualDiffFilterKind,
  type VisualDiffOverlayItem
} from "./documentState";
import { ActivityBar } from "./components/editor-shell/ActivityBar";
import { DesktopStartScreen } from "./components/editor-shell/DesktopStartScreen";
import { DocumentCommandBar } from "./components/editor-shell/DocumentCommandBar";
import { PreviewTabButton as TabButton } from "./components/editor-shell/PreviewTabButton";
import type { ActivityPanel, PreviewTab, RecentFileAction, RecentFileEntry } from "./components/editor-shell/types";
import { EditorToolbar } from "./components/editor-toolbar/EditorToolbar";
import { EditorContextMenu, type EditorContextMenuKind, type EditorContextMenuState } from "./components/editor-toolbar/EditorContextMenu";
import { SelectionBubbleToolbar, type BubbleToolbarPosition, type BubbleSelectionCommand } from "./components/editor-toolbar/SelectionBubbleToolbar";
import { SettingsPanel, type HeadingNumberingSettings } from "./components/panels/SettingsPanel";
import { OutlinePanel, type AuthorFigureItem, type AuthorOutlineItem, type AuthorTableItem } from "./components/panels/OutlinePanel";
import { ExportPanel } from "./components/panels/ExportPanel";
import { FilesPanel } from "./components/panels/FilesPanel";
import { HistoryPanel } from "./components/panels/HistoryPanel";
import { DiagnosticsPanel } from "./components/panels/DiagnosticsPanel";
import { DeveloperPanel, type DerivedOutputName } from "./components/panels/DeveloperPanel";
import { DiffReview, ReviewPanel } from "./components/panels/ReviewPanel";
import { LinkDialog } from "./components/dialogs/LinkDialog";

const ExclusiveSubscript = Subscript.extend({ excludes: "superscript" });
const ExclusiveSuperscript = Superscript.extend({ excludes: "subscript" });

type CalloutKind = "note" | "warning";
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
interface LinkDialogState {
  from: number;
  to: number;
  href: string;
}

const LOCAL_HISTORY_STORAGE_KEY = "sdoc.localHistory.v1";
const RECENT_FILES_STORAGE_KEY = "sdoc.recentFiles.v1";
const DRAWIO_EXECUTABLE_PATH_STORAGE_KEY = "sdoc.drawioExecutablePath.v1";
const RECENT_FILES_LIMIT = 6;

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
  const [selectionRevision, setSelectionRevision] = useState(0);
  const [collapsedHeadingIds, setCollapsedHeadingIds] = useState<Set<string>>(() => new Set());
  const [headingNumbering, setHeadingNumbering] = useState<HeadingNumberingSettings>({ enabled: true, maxLevel: 3 });
  const [outlineDepth, setOutlineDepth] = useState(3);
  const [publishingStyleProfile, setPublishingStyleProfile] = useState<PublishingStyleProfileName>("modern");
  const [bubbleToolbarPosition, setBubbleToolbarPosition] = useState<BubbleToolbarPosition | null>(null);
  const [editorContextMenu, setEditorContextMenu] = useState<EditorContextMenuState | null>(null);
  const [linkDialog, setLinkDialog] = useState<LinkDialogState | null>(null);
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
  const bubbleSelectionRangeRef = useRef<{ from: number; to: number } | null>(null);

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
      ExclusiveSubscript,
      ExclusiveSuperscript,
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right"], defaultAlignment: "left" }),
      Placeholder.configure({ placeholder: "Write the technical document..." }),
      ...sdocExtensions
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: "editor-surface"
      }
    },
    onUpdate: () => setEditorRevision((revision) => revision + 1),
    onSelectionUpdate: () => setSelectionRevision((revision) => revision + 1)
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
  const outlineItems = useMemo(() => createAuthorOutlineItems(document, headingNumbering.enabled ? headingNumbering.maxLevel : 0), [document, headingNumbering]);
  const figureItems = useMemo(() => createAuthorFigureItems(document), [document]);
  const tableItems = useMemo(() => createAuthorTableItems(document), [document]);
  const visibleOutlineItems = useMemo(() => outlineItems.filter((item) => item.headingLevel <= outlineDepth), [outlineDepth, outlineItems]);
  const hiddenByFoldNodeIds = useMemo(() => collectHiddenFoldNodeIds(sectionFoldRanges, collapsedHeadingIds), [collapsedHeadingIds, sectionFoldRanges]);
  const foldRuntimeCss = useMemo(() => renderFoldRuntimeCss(hiddenByFoldNodeIds, collapsedHeadingIds), [collapsedHeadingIds, hiddenByFoldNodeIds]);
  const headingNumberRuntimeCss = useMemo(
    () => renderHeadingNumberRuntimeCss(outlineItems, headingNumbering.enabled),
    [headingNumbering.enabled, outlineItems]
  );

  useEffect(() => {
    if (editor) {
      syncEditorTableCaptionProjection(editor, document);
    }
  }, [document, editor]);

  useEffect(() => {
    setCollapsedHeadingIds((current) => pruneCollapsedHeadingIds(current, sectionFoldRanges));
  }, [sectionFoldRanges]);

  useEffect(() => {
    if (!editor || !editorPaneRef.current) {
      setBubbleToolbarPosition(null);
      return;
    }

    const { from, to, empty } = editor.state.selection;
    if (empty || editor.isActive("codeBlock")) {
      setBubbleToolbarPosition(null);
      return;
    }

    bubbleSelectionRangeRef.current = { from, to };
    const start = editor.view.coordsAtPos(from);
    const end = editor.view.coordsAtPos(to);
    const pane = editorPaneRef.current;
    const paneRect = pane.getBoundingClientRect();
    const left = Math.max(12, Math.min((start.left + end.right) / 2 - paneRect.left + pane.scrollLeft, pane.clientWidth - 12));
    const top = Math.max(12, Math.min(start.top, end.top) - paneRect.top + pane.scrollTop - 50);
    setBubbleToolbarPosition({ left, top });
  }, [editor, editorRevision, selectionRevision]);

  function runBubbleSelectionCommand(command: BubbleSelectionCommand) {
    const range = bubbleSelectionRangeRef.current;
    const markType = editor.state.schema.marks[command];
    if (!range || !markType) {
      setStatusMessage(`Cannot format selection: ${command}`);
      return;
    }

    const from = Math.max(0, Math.min(range.from, range.to));
    const to = Math.max(from, Math.max(range.from, range.to));
    if (from === to) {
      setStatusMessage(`Cannot format selection: ${command}`);
      return;
    }

    const hasMark = editor.state.doc.rangeHasMark(from, to, markType);
    const transaction = hasMark ? editor.state.tr.removeMark(from, to, markType) : editor.state.tr.addMark(from, to, markType.create());
    editor.view.dispatch(transaction.scrollIntoView());
    editor.view.focus();
    setStatusMessage(`Formatted selection: ${command}`);
  }

  function openLinkDialog() {
    const { from, to } = editor.state.selection;
    if (from === to) {
      setStatusMessage("Select text to add or edit a link");
      return;
    }

    const href = typeof editor.getAttributes("link").href === "string" ? editor.getAttributes("link").href : "";
    setLinkDialog({ from, to, href });
    setStatusMessage(href ? "Editing external link" : "Adding external link");
  }

  function applyLink(href: string) {
    if (!linkDialog) {
      return;
    }

    const linkType = editor.state.schema.marks.link;
    if (!linkType) {
      setLinkDialog(null);
      setStatusMessage("Link mark is unavailable");
      return;
    }

    const transaction = editor.state.tr
      .removeMark(linkDialog.from, linkDialog.to, linkType)
      .addMark(linkDialog.from, linkDialog.to, linkType.create({ href }));
    editor.view.dispatch(transaction.scrollIntoView());
    editor.view.focus();
    setLinkDialog(null);
    setActiveTab("json");
    setStatusMessage(`Applied external link: ${href}`);
  }

  function removeLink() {
    if (!linkDialog) {
      return;
    }

    const linkType = editor.state.schema.marks.link;
    if (linkType) {
      editor.view.dispatch(editor.state.tr.removeMark(linkDialog.from, linkDialog.to, linkType).scrollIntoView());
      editor.view.focus();
    }
    setLinkDialog(null);
    setActiveTab("json");
    setStatusMessage("Removed external link");
  }

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

    const payload = createHtmlPayload(document, metadata, assets, publishingStyleProfile);
    downloadBlob(new Blob([payload.text], { type: "text/html" }), payload.filename);
    setStatusMessage(`Exported HTML with ${publishingStyleProfile} profile`);
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

  function editSelectedTableCaptionFromPrompt() {
    const target = getSelectedTableTarget(editor);
    if (!target) {
      setStatusMessage("Select a table to edit caption");
      return;
    }

    const currentCaption = typeof target.attrs.caption === "string" ? target.attrs.caption : "";
    const rawCaption = window.prompt("Table caption", currentCaption);
    if (rawCaption === null) {
      setStatusMessage("Canceled table caption");
      return;
    }

    const nextCaption = rawCaption.trim();
    if (nextCaption === currentCaption) {
      setStatusMessage("Canceled table caption");
      return;
    }

    const nextAttrs: Record<string, unknown> = { ...target.attrs };
    if (nextCaption) {
      nextAttrs.caption = nextCaption;
    } else {
      delete nextAttrs.caption;
    }

    const transaction = editor.state.tr.setNodeMarkup(target.position, undefined, nextAttrs);
    editor.view.dispatch(transaction.scrollIntoView());
    editor.view.focus();
    setActiveTab("json");
    setStatusMessage(nextCaption ? "Updated table caption" : "Removed table caption");
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

  function startDrawioInsertFlow() {
    const createNew = window.confirm("Create a new Draw.io diagram? Choose Cancel to import an existing .drawio file.");
    if (createNew) {
      void createNewDrawioDiagram();
      return;
    }

    drawioInputRef.current?.click();
  }

  async function createNewDrawioDiagram() {
    const blockId = createBlockId();
    const assetId = `${createAssetId()}.drawio`;
    const sourceBytes = createEmptyDrawioSourceBytes(assetId);
    const inserted = insertDrawioDiagram(editor, assetId, undefined, blockId);
    if (!inserted) {
      setStatusMessage("Cannot create Draw.io diagram");
      return;
    }

    setAssets((current) => ({ ...current, [assetId]: sourceBytes }));
    setActiveTab("json");

    if (!nativeDrawioExternalEditorAdapter) {
      setStatusMessage(`Created Draw.io diagram ${assetId}. External editing is available in the desktop app.`);
      return;
    }

    try {
      const session = await nativeDrawioExternalEditorAdapter.checkoutSource(assetId, sourceBytes);
      const opened = await nativeDrawioExternalEditorAdapter.openExternalEditor(session.sessionId, drawioExecutablePath);
      if (opened.status === "launch-failed") {
        await nativeDrawioExternalEditorAdapter.closeSession(session.sessionId).catch(() => undefined);
        setStatusMessage(opened.message ?? `Created Draw.io diagram ${assetId}, but could not launch the external editor.`);
        return;
      }

      setDrawioBridgeSession(session);
      setDrawioBridgeTargetId(blockId);
      setDrawioExternalEditConflict(null);
      setStatusMessage(`Created Draw.io diagram ${assetId} and opened external editor.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
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
    openActivityPanel("diagnostics");
    setStatusMessage("Choose a reference target");
  }

  function insertCrossReferenceToTarget(targetId: string) {
    const target = referenceDiagnostics.targets.find((current) => current.id === targetId);
    if (!target) {
      setStatusMessage(`Reference target is no longer available: ${targetId}`);
      return;
    }

    const inserted = insertCrossReference(editor, target.id, undefined, target.label);
    openActivityPanel("diagnostics");
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
    openActivityPanel("diagnostics");
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
    openActivityPanel("diagnostics");
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
    openActivityPanel("diagnostics");
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
    openActivityPanel("diagnostics");
    setStatusMessage(updated ? `Set requirement ID ${normalized} on ${target.id}` : `Cannot set requirement ID on ${target.id}`);
  }

  function clearSelectedBlockTag() {
    const target = getSelectedBlockHumanIdTarget(editor);
    if (!target) {
      setStatusMessage("Select a block before clearing a requirement ID");
      return;
    }

    const updated = setSelectedBlockHumanId(editor, null);
    openActivityPanel("diagnostics");
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

  function editSelectedEquationFromPrompt() {
    const position = getSelectedEquationPosition(editor);
    if (position === null) {
      setStatusMessage("Select an equation to edit");
      return;
    }

    editEquationAtPosition(position);
  }

  function editEquationAtPosition(position: number) {
    const node = editor.state.doc.nodeAt(position);
    if (!node || (node.type.name !== "equation" && node.type.name !== "equationBlock")) {
      setStatusMessage("Select an equation to edit");
      return;
    }

    const currentLatex = typeof node.attrs.latex === "string" ? node.attrs.latex : "";
    const nextLatex = window.prompt("Edit equation", currentLatex)?.trim();
    if (!nextLatex || nextLatex === currentLatex) {
      setStatusMessage("Canceled equation edit");
      return;
    }

    const transaction = editor.state.tr.setNodeMarkup(position, undefined, { ...node.attrs, latex: nextLatex });
    editor.view.dispatch(transaction.scrollIntoView());
    editor.view.focus();
    setActiveTab("json");
    setStatusMessage("Updated equation");
  }

  function handleEditorPaneDoubleClick(event: React.MouseEvent<HTMLElement>) {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-type='equation'], [data-type='equationBlock']") : null;
    if (!target) {
      return;
    }

    const position = findEquationPositionFromElement(editor, target);
    if (position !== null) {
      event.preventDefault();
      editEquationAtPosition(position);
    }
  }

  function handleEditorPaneContextMenu(event: ReactMouseEvent<HTMLElement>) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !target.closest(".editor-surface")) {
      return;
    }

    const equationElement = target.closest<HTMLElement>("[data-type='equation'], [data-type='equationBlock']");
    const kind: EditorContextMenuKind = equationElement ? "equation" : target.closest("table") ? "table" : "editor";
    if (equationElement) {
      const position = findEquationPositionFromElement(editor, equationElement);
      if (position !== null) {
        editor.commands.setNodeSelection(position);
      }
    } else {
      const position = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
      if (position) {
        editor.commands.setTextSelection(position.pos);
      }
    }

    event.preventDefault();
    const menuWidth = 230;
    const menuHeight = kind === "editor" ? 250 : kind === "table" ? 210 : 50;
    setEditorContextMenu({
      kind,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8))
    });
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
              headingNumbering={headingNumbering}
              outlineDepth={outlineDepth}
              onMetadataChange={setMetadata}
              onHeadingNumberingChange={setHeadingNumbering}
              onOutlineDepthChange={setOutlineDepth}
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

          {activePanel === "outline" && (
            <OutlinePanel
              items={visibleOutlineItems}
              figures={figureItems}
              tables={tableItems}
              outlineDepth={outlineDepth}
              onOutlineDepthChange={setOutlineDepth}
              highlightedNodeId={highlightedNodeId}
              onRevealNode={revealEditorNode}
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

          {activePanel === "diagnostics" && (
            <DiagnosticsPanel
              diagnostics={referenceDiagnostics}
              traceability={requirementTraceability}
              highlightedNodeId={highlightedNodeId}
              onInsertReference={insertCrossReferenceToTarget}
              onRevealNode={revealEditorNode}
              onRetargetReference={retargetBrokenReference}
              onRemoveReference={removeBrokenReference}
              onUpdateReferenceLabel={updateReferenceLabel}
              onSetSelectedTag={tagSelectedBlock}
              onClearSelectedTag={clearSelectedBlockTag}
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
              styleProfile={publishingStyleProfile}
              onStyleProfileChange={setPublishingStyleProfile}
              onExportMarkdown={downloadMarkdown}
              onExportHtml={downloadHtml}
              onCopyDeveloperCommand={showDeveloperCommand}
            />
          )}

          {activePanel === "developer" && (
            <DeveloperPanel
              filenames={exportFilenames}
              derivedOutputs={derivedOutputs}
              dataGridDiagnostics={dataGridDiagnostics}
              dataGridRowReview={dataGridRowReview}
              onExportSdoc={downloadSdoc}
              onExportJson={downloadJson}
              onExportDerived={downloadDerivedOutput}
              onAcceptDataGridRowEvent={acceptDataGridRowEvent}
              onRejectDataGridRowEvent={(item, event) => rejectDataGridRowEvent(item, event)}
              onRejectDataGridRowEventAsRevision={(item, event) => rejectDataGridRowEvent(item, event, "revision")}
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
        <DocumentCommandBar
          title={metadata.title}
          author={metadata.author ?? ""}
          version={metadata.version ?? ""}
          fileLabel={fileLabel}
          savedLabel={savedLabel}
          isValid={validation.ok}
          statusMessage={statusMessage}
          saveLabel={sdocSaveRoute.label}
          isPreviewOpen={isPreviewOpen}
          onTitleChange={(title) => setMetadata({ ...metadata, title })}
          onAuthorChange={(author) => setMetadata({ ...metadata, author })}
          onVersionChange={(version) => setMetadata({ ...metadata, version })}
          onNewDocument={createNewDocument}
          onOpenDocument={() => void openDocumentAction()}
          onSaveDocument={() => void downloadSdoc()}
          onOpenExport={() => openActivityPanel("export")}
          onTogglePreview={() => setIsPreviewOpen((open) => !open)}
        />

        <EditorToolbar
          groups={{
            editor,
            hasCollapsedSections: collapsedHeadingIds.size > 0,
            hasDrawioSession: drawioBridgeSession !== null,
            onInsertImage: () => imageInputRef.current?.click(),
            onEditLink: openLinkDialog,
            onInsertReference: openReferencePicker,
            onInsertTable: insertTable,
            onApplyCallout: applyCallout,
            onFoldSection: foldSelectedSection,
            onUnfoldSection: unfoldSelectedSection,
            onUnfoldAllSections: unfoldAllSections,
            onInsertDataGrid: () => dataGridInputRef.current?.click(),
            onMoveBlock: moveBlock,
            onRunTableCommand: runTableCommand,
            onEditTableCaption: editSelectedTableCaptionFromPrompt,
            onAlignTableCells: alignTableCells,
            onInsertInlineEquation: insertInlineEquationFromPrompt,
            onInsertEquationBlock: insertEquationBlockFromPrompt,
            onEditEquation: editSelectedEquationFromPrompt,
            onInsertMermaid: insertMermaidDiagramFromPrompt,
            onInsertDrawio: startDrawioInsertFlow,
            onOpenDrawioEditor: () => void openSelectedDrawioExternalEditor(),
            onReadDrawioEdit: () => void readDrawioExternalEdit(),
            onCloseDrawioEdit: () => void closeDrawioExternalEdit()
          }}
          fileInputRef={fileInputRef}
          imageInputRef={imageInputRef}
          dataGridInputRef={dataGridInputRef}
          drawioInputRef={drawioInputRef}
          onOpenFile={(file) => void openFile(file)}
          onInsertImageFile={(file) => void insertImageFile(file)}
          onInsertDataGridFile={(file) => void insertDataGridFile(file)}
          onInsertDrawioFile={(file) => void insertDrawioFile(file)}
          onNewDocument={createNewDocument}
          onOpenDocument={() => void openDocumentAction()}
          onDownloadMarkdown={downloadMarkdown}
          onSaveSdoc={() => void downloadSdoc()}
          onMarkSaved={markCurrentAsBaseline}
        />

        <div className={isPreviewOpen ? "editor-grid" : "editor-grid preview-collapsed"}>
          <section className="editor-pane" ref={editorPaneRef} onDoubleClick={handleEditorPaneDoubleClick} onContextMenu={handleEditorPaneContextMenu}>
            {foldRuntimeCss && <style data-sdoc-fold-runtime>{foldRuntimeCss}</style>}
            {headingNumberRuntimeCss && <style data-sdoc-heading-number-runtime>{headingNumberRuntimeCss}</style>}
            {brokenReferenceRuntimeCss && <style data-sdoc-broken-reference-runtime>{brokenReferenceRuntimeCss}</style>}
            {visualDiffRuntimeCss && <style data-sdoc-diff-overlay-runtime>{visualDiffRuntimeCss}</style>}
            {bubbleToolbarPosition && (
              <SelectionBubbleToolbar
                editor={editor}
                position={bubbleToolbarPosition}
                onRunCommand={runBubbleSelectionCommand}
                onEditLink={openLinkDialog}
                onInsertReference={openReferencePicker}
              />
            )}
            {editorContextMenu && (
              <EditorContextMenu
                state={editorContextMenu}
                onClose={() => setEditorContextMenu(null)}
                onInsertImage={() => imageInputRef.current?.click()}
                onInsertReference={openReferencePicker}
                onInsertTable={insertTable}
                onInsertInlineEquation={insertInlineEquationFromPrompt}
                onInsertEquationBlock={insertEquationBlockFromPrompt}
                onInsertMermaid={insertMermaidDiagramFromPrompt}
                onEditEquation={editSelectedEquationFromPrompt}
                onEditTableCaption={editSelectedTableCaptionFromPrompt}
                onAddTableRow={() => runTableCommand("addRowAfter", "Added table row")}
                onAddTableColumn={() => runTableCommand("addColumnAfter", "Added table column")}
                onDeleteTableRow={() => runTableCommand("deleteRow", "Deleted table row")}
                onDeleteTableColumn={() => runTableCommand("deleteColumn", "Deleted table column")}
              />
            )}
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
      {linkDialog && (
        <LinkDialog
          initialHref={linkDialog.href}
          onApply={applyLink}
          onRemove={removeLink}
          onCancel={() => {
            setLinkDialog(null);
            editor.view.focus();
            setStatusMessage("Canceled external link edit");
          }}
        />
      )}
    </main>
  );
}

function getActivityPanelLabel(panel: ActivityPanel): string {
  const labels: Record<ActivityPanel, string> = {
    files: "Files",
    outline: "Outline",
    export: "Export",
    settings: "Settings",
    review: "Review",
    diagnostics: "Diagnostics",
    history: "History",
    developer: "Developer"
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

function createAuthorOutlineItems(document: SDocDocument, numberingMaxLevel: number): AuthorOutlineItem[] {
  const counters = [0, 0, 0, 0, 0, 0];
  const items: AuthorOutlineItem[] = [];

  for (const node of document.content) {
    if (node.type !== "heading") {
      continue;
    }

    const headingId = typeof node.attrs?.id === "string" ? node.attrs.id : null;
    const headingLevel = typeof node.attrs?.level === "number" ? node.attrs.level : null;
    if (!headingId || headingLevel === null || headingLevel < 1 || headingLevel > 6) {
      continue;
    }

    counters[headingLevel - 1] += 1;
    for (let index = headingLevel; index < counters.length; index += 1) {
      counters[index] = 0;
    }
    for (let index = 0; index < headingLevel - 1; index += 1) {
      if (counters[index] === 0) {
        counters[index] = 1;
      }
    }

    const number = numberingMaxLevel > 0 && headingLevel <= numberingMaxLevel ? counters.slice(0, headingLevel).join(".") : undefined;
    items.push({
      headingId,
      headingLevel,
      title: getSdocNodeText(node).trim() || headingId,
      number
    });
  }

  return items;
}

function createAuthorFigureItems(document: SDocDocument): AuthorFigureItem[] {
  let count = 0;
  return document.content.flatMap((node) => {
    if (node.type !== "figure") {
      return [];
    }

    const id = getSdocNodeId(node);
    if (!id) {
      return [];
    }

    count += 1;
    const caption = getSdocNodeText(node).trim() || "Untitled figure";
    const assetId = typeof node.attrs?.assetId === "string" ? node.attrs.assetId : "asset";
    return [{ id, number: `Figure ${count}`, caption, detail: assetId }];
  });
}

function createAuthorTableItems(document: SDocDocument): AuthorTableItem[] {
  let count = 0;
  return document.content.flatMap((node) => {
    if (node.type !== "table") {
      return [];
    }

    const id = getSdocNodeId(node);
    if (!id) {
      return [];
    }

    count += 1;
    const rows = node.content ?? [];
    const columnCount = rows.reduce((max, row) => Math.max(max, row.content?.length ?? 0), 0);
    const caption = typeof node.attrs?.caption === "string" ? node.attrs.caption.trim() : "";
    const headerText = rows[0]?.content?.map((cell) => getSdocNodeText(cell).trim()).filter(Boolean).join(", ");
    const title = caption || headerText || `${rows.length} row${rows.length === 1 ? "" : "s"}`;
    const detail = `${rows.length} row${rows.length === 1 ? "" : "s"} x ${columnCount} column${columnCount === 1 ? "" : "s"}`;
    return [{ id, number: `Table ${count}`, title, detail }];
  });
}

function syncEditorTableCaptionProjection(editor: Editor, document: SDocDocument) {
  const captions = new Map<string, string>();
  collectTableCaptions(document.content, captions);

  editor.view.dom.querySelectorAll<HTMLElement>("table[data-id]").forEach((element) => {
    const id = element.getAttribute("data-id");
    const caption = id ? captions.get(id) : undefined;
    if (caption) {
      element.setAttribute("data-caption", caption);
    } else {
      element.removeAttribute("data-caption");
    }
  });
}

function collectTableCaptions(nodes: SDocNode[] | undefined, captions: Map<string, string>) {
  for (const node of nodes ?? []) {
    if (node.type === "table") {
      const id = getSdocNodeId(node);
      const caption = typeof node.attrs?.caption === "string" ? node.attrs.caption.trim() : "";
      if (id && caption) {
        captions.set(id, caption);
      }
    }

    collectTableCaptions(node.content, captions);
  }
}

function getSdocNodeId(node: SDocNode): string | null {
  return typeof node.attrs?.id === "string" && node.attrs.id.length > 0 ? node.attrs.id : null;
}

function getSdocNodeText(node: SDocNode): string {
  if (typeof node.text === "string") {
    return node.text;
  }

  if (Array.isArray(node.content)) {
    return node.content.map((child) => getSdocNodeText(child)).join("");
  }

  return "";
}

function getSelectedTableTarget(editor: Editor): { position: number; attrs: Record<string, unknown> } | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "table") {
      return { position: $from.before(depth), attrs: node.attrs };
    }
  }

  return null;
}

function getSelectedEquationPosition(editor: Editor): number | null {
  const { selection } = editor.state;
  const candidates = [selection.from, selection.from - 1, selection.to, selection.to - 1];
  for (const position of candidates) {
    if (position < 0) {
      continue;
    }

    const node = editor.state.doc.nodeAt(position);
    if (node?.type.name === "equation" || node?.type.name === "equationBlock") {
      return position;
    }
  }

  return null;
}

function findEquationPositionFromElement(editor: Editor, element: HTMLElement): number | null {
  const basePosition = editor.view.posAtDOM(element, 0);
  const candidates = [basePosition, basePosition - 1, basePosition + 1];
  for (const position of candidates) {
    if (position < 0) {
      continue;
    }

    const node = editor.state.doc.nodeAt(position);
    if (node?.type.name === "equation" || node?.type.name === "equationBlock") {
      return position;
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

function renderHeadingNumberRuntimeCss(items: AuthorOutlineItem[], enabled: boolean): string {
  if (!enabled) {
    return "";
  }

  return items
    .filter((item) => item.number)
    .map((item) => {
      const selector = `.editor-surface h${item.headingLevel}[data-id="${escapeCssAttributeValue(item.headingId)}"]::before`;
      return `${selector}{content:"${escapeCssContent(`${item.number}. `)}";color:#697887;font-weight:600;margin-right:0.35em;}`;
    })
    .join("\n");
}

function escapeCssAttributeValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function escapeCssContent(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\A ");
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

function createEmptyDrawioSourceBytes(assetId: string): Uint8Array {
  const diagramId = createBlockId();
  const escapedName = escapeXmlText(assetId.replace(/\.(drawio|drawio\.xml)$/i, "") || "Diagram");
  const graphModel =
    '<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';
  const source = `<mxfile host="SDoc"><diagram id="${diagramId}" name="${escapedName}">${graphModel}</diagram></mxfile>`;
  return new TextEncoder().encode(source);
}

function escapeXmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
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
