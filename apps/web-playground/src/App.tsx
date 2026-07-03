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
import { applyDiffEventAcceptanceToBaseline, applyDiffEventAction, diffDocuments, renderReadableDiffEvents, type SDocDiffEvent } from "@sdoc/diff";
import { exportDerivedOutputs, exportMarkdown } from "@sdoc/export";
import { stableStringify, type SDocMetadata } from "@sdoc/format";
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
import {
  addLocalHistoryEntry,
  createChangeReview,
  createReviewActionPlan,
  createVisualDiffFilterCounts,
  createLocalHistoryEntry,
  createReferenceDiagnostics,
  createRequirementTraceability,
  createSectionFoldRanges,
  createVisualDiffOverlayItems,
  filterVisualDiffOverlayItems,
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
  updateCrossReferenceLabel,
  type LocalHistoryEntry,
  type ChangeReviewModel,
  type ReferenceDiagnosticsModel,
  type ReferenceTargetSummary,
  type RequirementTraceabilityModel,
  type SectionFoldRange,
  type ReviewActionKind,
  type ReviewActionPlanItem,
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
}
interface EditorHighlightOverlay {
  nodeId: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

const LOCAL_HISTORY_STORAGE_KEY = "sdoc.localHistory.v1";
const RECENT_FILES_STORAGE_KEY = "sdoc.recentFiles.v1";
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
  const [activeTab, setActiveTab] = useState<PreviewTab>("json");
  const [activePanel, setActivePanel] = useState<ActivityPanel>("settings");
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);
  const [savedAt, setSavedAt] = useState<string>("Not saved");
  const [statusMessage, setStatusMessage] = useState<string>("Ready");
  const [documentId, setDocumentId] = useState<string>(initialDocument.attrs.id);
  const [metadata, setMetadata] = useState<SDocMetadata>(initialMetadata);
  const [baselineDocument, setBaselineDocument] = useState<SDocDocument>(initialDocument);
  const [baselineMetadata, setBaselineMetadata] = useState<SDocMetadata>(initialMetadata);
  const [assets, setAssets] = useState<SDocAssets>({});
  const [currentFilename, setCurrentFilename] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFileEntry[]>(loadStoredRecentFiles);
  const [historyEntries, setHistoryEntries] = useState<LocalHistoryEntry[]>(loadStoredHistory);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [highlightOverlay, setHighlightOverlay] = useState<EditorHighlightOverlay | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const [collapsedHeadingIds, setCollapsedHeadingIds] = useState<Set<string>>(() => new Set());
  const [isDiffOverlayEnabled, setIsDiffOverlayEnabled] = useState(false);
  const [visualDiffFilter, setVisualDiffFilter] = useState<VisualDiffFilterKind>("all");
  const [selectedVisualDiffId, setSelectedVisualDiffId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const dataGridInputRef = useRef<HTMLInputElement>(null);
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
  const referenceDiagnostics = createReferenceDiagnostics(document);
  const requirementTraceability = useMemo(() => createRequirementTraceability(document), [document]);
  const visualDiffOverlayItems = useMemo(() => createVisualDiffOverlayItems(documentDiffEvents), [documentDiffEvents]);
  const visualDiffFilterCounts = useMemo(() => createVisualDiffFilterCounts(visualDiffOverlayItems), [visualDiffOverlayItems]);
  const visibleVisualDiffItems = useMemo(
    () => filterVisualDiffOverlayItems(visualDiffOverlayItems, visualDiffFilter),
    [visualDiffFilter, visualDiffOverlayItems]
  );
  const visibleReviewActionItems = useMemo(() => createReviewActionPlan(visibleVisualDiffItems).items, [visibleVisualDiffItems]);
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
  const hasUnsavedChanges = hasDocumentChanges || hasMetadataChanges;
  const fileLabel = getFileLabel(currentFilename, metadata);
  const savedLabel = getSavedLabel(savedAt, hasUnsavedChanges);
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
      const blobPart = payload.bytes.buffer.slice(payload.bytes.byteOffset, payload.bytes.byteOffset + payload.bytes.byteLength) as ArrayBuffer;
      downloadBlob(new Blob([blobPart], { type: "application/vnd.sdoc" }), payload.filename);
      setBaselineDocument(document);
      setBaselineMetadata(metadata);
      setSelectedHistoryId(null);
      setCurrentFilename(payload.filename);
      addRecentFile(payload.filename, metadata.title || payload.filename, "saved");
      markSaved("Saved .sdoc");
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

  async function openFile(file: File) {
    try {
      const loaded = await openDocumentInput({
        name: file.name,
        data: await file.arrayBuffer(),
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
      setSelectedHistoryId(null);
      setCollapsedHeadingIds(new Set());
      setCurrentFilename(file.name);
      addRecentFile(file.name, nextMetadata.title || file.name, "opened");
      setActiveTab("json");
      markSaved(loaded.statusMessage);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
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
    setSelectedHistoryId(null);
    markSaved("Marked current state as saved");
  }

  function addRecentFile(name: string, title: string, action: RecentFileAction) {
    const entry: RecentFileEntry = {
      id: name,
      name,
      title,
      action,
      updatedAt: new Date().toISOString()
    };
    const nextEntries = upsertRecentFile(recentFiles, entry);
    setRecentFiles(nextEntries);
    storeRecentFiles(nextEntries);
  }

  function explainRecentFileAccess(entry: RecentFileEntry) {
    setStatusMessage(`Recent file metadata only: reopen ${entry.name} from disk to load it in the browser`);
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
    setActiveTab("diff");
    setStatusMessage(`Comparing with history snapshot: ${entry.title}`);
  }

  function compareSavedBaseline() {
    setSelectedHistoryId(null);
    setActiveTab("diff");
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
    setAssets({});
    setSelectedHistoryId(null);
    setCollapsedHeadingIds(new Set());
    setCurrentFilename(null);
    setActiveTab("json");
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
    setActiveTab("diff");
    setStatusMessage(`Rejected ${item.kind} ${item.id}`);
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

          <div className="status-note">{statusMessage}</div>

          {activePanel === "settings" && (
            <SettingsPanel metadata={metadata} validation={validation} document={document} assetCount={Object.keys(assets).length} onMetadataChange={setMetadata} />
          )}

          {activePanel === "files" && (
            <FilesPanel
              currentFile={fileLabel}
              sdocFilename={exportFilenames.sdoc}
              savedLabel={savedLabel}
              recentFiles={recentFiles}
              onNewDocument={createNewDocument}
              onOpenDocument={() => fileInputRef.current?.click()}
              onSaveSdoc={downloadSdoc}
              onSelectRecentFile={explainRecentFileAccess}
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
              onShowDiff={() => setActiveTab("diff")}
              onCompareSavedBaseline={compareSavedBaseline}
              onApplyReviewAction={applyReviewAction}
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
        <div className="toolbar" aria-label="Editor toolbar">
          <ToolbarButton title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            <Heading1 size={18} />
          </ToolbarButton>
          <ToolbarButton title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 size={18} />
          </ToolbarButton>
          <ToolbarButton title="Fold section" onClick={foldSelectedSection}>
            <ChevronRight size={18} />
          </ToolbarButton>
          <ToolbarButton title="Unfold section" onClick={unfoldSelectedSection}>
            <ChevronDown size={18} />
          </ToolbarButton>
          <ToolbarButton title="Unfold all sections" active={collapsedHeadingIds.size > 0} onClick={unfoldAllSections}>
            <List size={18} />
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
          <ToolbarButton title="Note callout" active={editor.isActive("callout", { kind: "note" })} onClick={() => applyCallout("note")}>
            <Info size={18} />
          </ToolbarButton>
          <ToolbarButton title="Warning callout" active={editor.isActive("callout", { kind: "warning" })} onClick={() => applyCallout("warning")}>
            <AlertTriangle size={18} />
          </ToolbarButton>
          <ToolbarButton title="Move block up" onClick={() => moveBlock("up")}>
            <ArrowUp size={18} />
          </ToolbarButton>
          <ToolbarButton title="Move block down" onClick={() => moveBlock("down")}>
            <ArrowDown size={18} />
          </ToolbarButton>
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
          <ToolbarButton title="New document" onClick={createNewDocument}>
            <FilePlus size={18} />
          </ToolbarButton>
          <ToolbarButton title="Open .sdoc or document.json" onClick={() => fileInputRef.current?.click()}>
            <FolderOpen size={18} />
          </ToolbarButton>
          <ToolbarButton title="Download document.json" onClick={downloadJson}>
            <Braces size={18} />
          </ToolbarButton>
          <ToolbarButton title="Download Markdown" onClick={downloadMarkdown}>
            <FileText size={18} />
          </ToolbarButton>
          <ToolbarButton title="Download .sdoc" onClick={downloadSdoc}>
            <Download size={18} />
          </ToolbarButton>
          <ToolbarButton title="Mark saved" onClick={markCurrentAsBaseline}>
            <Save size={18} />
          </ToolbarButton>
        </div>

        <div className="editor-grid">
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

          <section className="preview-pane">
            <div className="tabs" role="tablist">
              <TabButton label="JSON" value="json" activeTab={activeTab} onSelect={setActiveTab} />
              <TabButton label="Markdown" value="markdown" activeTab={activeTab} onSelect={setActiveTab} />
              <TabButton label="Diff" value="diff" activeTab={activeTab} onSelect={setActiveTab} />
            </div>
            {activeTab === "diff" ? (
              <DiffReview review={changeReview} rawPreview={diffPreview} baseLabel={reviewBaseLabel} onCompareSavedBaseline={compareSavedBaseline} />
            ) : (
              <pre className="preview-output">{preview}</pre>
            )}
          </section>
        </div>
      </section>
    </main>
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
  onMetadataChange
}: {
  metadata: SDocMetadata;
  validation: ValidationResult;
  document: SDocDocument;
  assetCount: number;
  onMetadataChange: (metadata: SDocMetadata) => void;
}) {
  return (
    <div className="side-panel-section settings-panel">
      <section className="settings-section" aria-label="Document metadata">
        <h3>Metadata</h3>
        <label className="metadata-field">
          <span>Title</span>
          <input value={metadata.title} onChange={(event) => onMetadataChange({ ...metadata, title: event.target.value })} />
        </label>
        <label className="metadata-field">
          <span>Author</span>
          <input value={String(metadata.author ?? "")} onChange={(event) => onMetadataChange({ ...metadata, author: event.target.value })} />
        </label>
        <label className="metadata-field">
          <span>Version</span>
          <input value={String(metadata.version ?? "")} onChange={(event) => onMetadataChange({ ...metadata, version: event.target.value })} />
        </label>
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
  onNewDocument,
  onOpenDocument,
  onSaveSdoc,
  onSelectRecentFile,
  onCopyDeveloperCommand
}: {
  currentFile: string;
  sdocFilename: string;
  savedLabel: string;
  recentFiles: RecentFileEntry[];
  onNewDocument: () => void;
  onOpenDocument: () => void;
  onSaveSdoc: () => void;
  onSelectRecentFile: (entry: RecentFileEntry) => void;
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
          Save .sdoc
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
  onExportSdoc: () => void;
  onExportJson: () => void;
  onExportMarkdown: () => void;
  onExportHtml: () => void;
  onExportDerived: (name: DerivedOutputName) => void;
  onCopyDeveloperCommand: (command: string) => void;
}) {
  const pdfCommand = `npm run sdoc -- export ${quoteCliPath(filenames.sdoc)} --format pdf -o ${quoteCliPath(filenames.pdf)}`;
  const pptxCommand = `npm run sdoc -- export ${quoteCliPath(filenames.sdoc)} --format pptx -o ${quoteCliPath(filenames.pptx)}`;

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
  onShowDiff,
  onCompareSavedBaseline,
  onApplyReviewAction,
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
  onShowDiff: () => void;
  onCompareSavedBaseline: () => void;
  onApplyReviewAction: (item: ReviewActionPlanItem, action: ReviewActionKind) => void;
  onMarkSaved: () => void;
  onSelectVisualDiff: (item: VisualDiffOverlayItem) => void;
  onSetVisualDiffFilter: (filter: VisualDiffFilterKind) => void;
  onToggleDiffOverlay: () => void;
  onCopyDeveloperCommand: (command: string) => void;
}) {
  const isHistoryBase = baseLabel !== "Saved baseline";
  const semanticDiffCommand = 'npm run sdoc -- diff "old.document.json" "new.document.json"';
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
  onCompareSavedBaseline
}: {
  review: ChangeReviewModel;
  rawPreview: string;
  baseLabel: string;
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
    typeof entry.updatedAt === "string"
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
