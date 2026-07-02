import { useEffect, useMemo, useRef, useState } from "react";
import type { AnyExtension } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bold,
  Braces,
  Code2,
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
  Save,
  Search,
  Settings,
  Sigma,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Workflow
} from "lucide-react";
import { diffDocuments, renderReadableDiffEvents } from "@sdoc/diff";
import { exportMarkdown } from "@sdoc/export";
import { stableStringify, type SDocMetadata } from "@sdoc/format";
import { createAssetId, createBlockId, createEmptyDocument, type SDocDocument, validateDocument } from "@sdoc/schema";
import {
  BlockIdExtension,
  CalloutNode,
  CrossReferenceNode,
  DiagramNode,
  EquationBlockNode,
  FigureNode,
  fromSdocDocument,
  insertCrossReference,
  InlineEquationNode,
  initialContent,
  insertEquationBlock,
  insertInlineEquation,
  insertMermaidDiagram,
  insertSimpleTable,
  moveSelectedTopLevelBlock,
  repairEditorBlockIds,
  TableExtensions,
  toSdocDocument,
  type BlockMoveDirection
} from "@sdoc/editor-tiptap";
import { createMarkdownPayload, createSdocPayload, openDocumentInput, type SDocAssets } from "./documentIo";
import {
  addLocalHistoryEntry,
  createChangeReview,
  createLocalHistoryEntry,
  createReferenceDiagnostics,
  getFileLabel,
  getSavedLabel,
  getValidationFailureMessage,
  isMetadataDirty,
  parseLocalHistory,
  renderDiffPreview,
  renderMetadataDiff,
  removeLocalHistoryEntry,
  renameLocalHistoryEntry,
  serializeLocalHistory,
  updateCrossReferenceLabel,
  type LocalHistoryEntry,
  type ChangeReviewModel,
  type ReferenceDiagnosticsModel,
  type ReferenceTargetSummary
} from "./documentState";

type PreviewTab = "json" | "markdown" | "diff";
type ActivityPanel = "files" | "review" | "references" | "history" | "export" | "settings";
type CalloutKind = "note" | "warning";
interface EditorHighlightOverlay {
  nodeId: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

const LOCAL_HISTORY_STORAGE_KEY = "sdoc.localHistory.v1";

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
  const [historyEntries, setHistoryEntries] = useState<LocalHistoryEntry[]>(loadStoredHistory);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [highlightOverlay, setHighlightOverlay] = useState<EditorHighlightOverlay | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
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

  const validation = validateDocument(document);
  const json = stableStringify(document);
  const markdown = exportMarkdown(document);
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
  const hasDocumentChanges = diffDocuments(baselineDocument, document).length > 0;
  const hasMetadataChanges = isMetadataDirty(metadata, baselineMetadata);
  const hasUnsavedChanges = hasDocumentChanges || hasMetadataChanges;
  const fileLabel = getFileLabel(currentFilename, metadata);
  const savedLabel = getSavedLabel(savedAt, hasUnsavedChanges);
  const preview = activeTab === "json" ? json : markdown;

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
      setCurrentFilename(file.name);
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
          <div className="status-block">
            <span>Schema</span>
            <strong className={validation.ok ? "ok" : "error"}>{validation.ok ? "Valid" : "Invalid"}</strong>
          </div>

          {activePanel === "settings" && (
            <>
              <div className="status-block">
                <span>Saved</span>
                <strong className={hasUnsavedChanges ? "warning" : undefined}>{savedLabel}</strong>
              </div>
              <div className="status-block">
                <span>Review</span>
                <strong className={hasUnsavedChanges ? "warning" : "ok"}>{changeReview.label}</strong>
              </div>
              <div className="status-block">
                <span>References</span>
                <strong className={getReferenceStatusClass(referenceDiagnostics)}>{referenceDiagnostics.label}</strong>
              </div>
              <div className="status-block">
                <span>File</span>
                <strong>{fileLabel}</strong>
              </div>
              <label className="metadata-field">
                <span>Title</span>
                <input value={metadata.title} onChange={(event) => setMetadata({ ...metadata, title: event.target.value })} />
              </label>
              <label className="metadata-field">
                <span>Author</span>
                <input value={String(metadata.author ?? "")} onChange={(event) => setMetadata({ ...metadata, author: event.target.value })} />
              </label>
              <label className="metadata-field">
                <span>Version</span>
                <input value={String(metadata.version ?? "")} onChange={(event) => setMetadata({ ...metadata, version: event.target.value })} />
              </label>
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
            </>
          )}

          {activePanel === "files" && (
            <div className="side-panel-section">
              <div className="status-block">
                <span>Current file</span>
                <strong>{fileLabel}</strong>
              </div>
              <button type="button" onClick={createNewDocument}>
                New document
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()}>
                Open .sdoc or JSON
              </button>
              <button type="button" onClick={downloadSdoc}>
                Save .sdoc
              </button>
            </div>
          )}

          {activePanel === "review" && (
            <div className="side-panel-section">
              <div className="status-block">
                <span>Review</span>
                <strong className={hasUnsavedChanges ? "warning" : "ok"}>{changeReview.label}</strong>
              </div>
              <div className="status-block">
                <span>Saved</span>
                <strong className={hasUnsavedChanges ? "warning" : undefined}>{savedLabel}</strong>
              </div>
              <button type="button" onClick={() => setActiveTab("diff")}>
                Show diff
              </button>
              <button type="button" onClick={markCurrentAsBaseline}>
                Mark saved
              </button>
            </div>
          )}

          {activePanel === "references" && (
            <ReferencePanel
              diagnostics={referenceDiagnostics}
              highlightedNodeId={highlightedNodeId}
              onInsertReference={insertCrossReferenceToTarget}
              onRevealNode={revealEditorNode}
              onUpdateReferenceLabel={updateReferenceLabel}
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
            <div className="side-panel-section">
              <button type="button" onClick={downloadSdoc}>
                Export .sdoc
              </button>
              <button type="button" onClick={downloadJson}>
                Export document.json
              </button>
              <button type="button" onClick={downloadMarkdown}>
                Export Markdown
              </button>
            </div>
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

function ReferencePanel({
  diagnostics,
  highlightedNodeId,
  onInsertReference,
  onRevealNode,
  onUpdateReferenceLabel
}: {
  diagnostics: ReferenceDiagnosticsModel;
  highlightedNodeId: string | null;
  onInsertReference: (targetId: string) => void;
  onRevealNode: (nodeId: string, label: string) => void;
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
                <code>{target.anchor ? `${target.id} / #${target.anchor}` : target.id}</code>
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
  return [target.id, target.type, target.label, target.anchor ?? ""].some((value) => value.toLowerCase().includes(query));
}

function getActivityPanelLabel(panel: ActivityPanel): string {
  const labels: Record<ActivityPanel, string> = {
    files: "Files",
    review: "Review",
    references: "References",
    history: "History",
    export: "Export",
    settings: "Settings"
  };
  return labels[panel];
}

function getReferenceStatusClass(diagnostics: ReferenceDiagnosticsModel): string {
  if (diagnostics.brokenCount > 0) {
    return "error";
  }

  return diagnostics.staleCount > 0 ? "warning" : "ok";
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
    default:
      return "application/octet-stream";
  }
}
