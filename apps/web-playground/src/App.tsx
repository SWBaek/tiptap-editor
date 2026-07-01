import { useMemo, useRef, useState } from "react";
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
  FolderOpen,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Quote,
  Save,
  Underline as UnderlineIcon
} from "lucide-react";
import { diffDocuments, renderReadableDiffEvents } from "@sdoc/diff";
import { exportMarkdown } from "@sdoc/export";
import { stableStringify, type SDocMetadata } from "@sdoc/format";
import { type SDocDocument, validateDocument } from "@sdoc/schema";
import {
  BlockIdExtension,
  CalloutNode,
  fromSdocDocument,
  initialContent,
  moveSelectedTopLevelBlock,
  repairEditorBlockIds,
  toSdocDocument,
  type BlockMoveDirection
} from "@sdoc/editor-tiptap";
import { createSdocPayload, openDocumentInput } from "./documentIo";
import { getSavedLabel, isMetadataDirty, renderDiffPreview, renderMetadataDiff } from "./documentState";

type PreviewTab = "json" | "markdown" | "diff";

const initialDocument = toSdocDocument(initialContent);
const initialMetadata: SDocMetadata = {
  title: "Playground Document",
  author: "",
  version: "0.1"
};

const sdocExtensions = [CalloutNode, BlockIdExtension] as unknown as AnyExtension[];

export function App() {
  const [activeTab, setActiveTab] = useState<PreviewTab>("json");
  const [savedAt, setSavedAt] = useState<string>("Not saved");
  const [statusMessage, setStatusMessage] = useState<string>("Ready");
  const [documentId, setDocumentId] = useState<string>(initialDocument.attrs.id);
  const [metadata, setMetadata] = useState<SDocMetadata>(initialMetadata);
  const [baselineDocument, setBaselineDocument] = useState<SDocDocument>(initialDocument);
  const [baselineMetadata, setBaselineMetadata] = useState<SDocMetadata>(initialMetadata);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    }
  });

  const document = useMemo(() => {
    return editor ? toSdocDocument(editor.getJSON(), documentId) : initialDocument;
  }, [documentId, editor?.state.doc]);

  const validation = validateDocument(document);
  const json = stableStringify(document);
  const markdown = exportMarkdown(document);
  const documentDiffEvents = diffDocuments(baselineDocument, document);
  const documentDiffLines = renderReadableDiffEvents(documentDiffEvents);
  const metadataDiffLines = renderMetadataDiff(metadata, baselineMetadata);
  const diffPreview = renderDiffPreview(documentDiffLines, metadataDiffLines);
  const hasDocumentChanges = documentDiffEvents.length > 0;
  const hasMetadataChanges = isMetadataDirty(metadata, baselineMetadata);
  const hasUnsavedChanges = hasDocumentChanges || hasMetadataChanges;
  const savedLabel = getSavedLabel(savedAt, hasUnsavedChanges);
  const preview = activeTab === "json" ? json : activeTab === "markdown" ? markdown : diffPreview;

  async function downloadSdoc() {
    const payload = await createSdocPayload(document, metadata);
    const blobPart = payload.bytes.buffer.slice(payload.bytes.byteOffset, payload.bytes.byteOffset + payload.bytes.byteLength) as ArrayBuffer;
    downloadBlob(new Blob([blobPart], { type: "application/vnd.sdoc" }), payload.filename);
    setBaselineDocument(document);
    setBaselineMetadata(metadata);
    markSaved("Saved .sdoc");
  }

  function downloadJson() {
    downloadBlob(new Blob([json], { type: "application/json" }), "document.json");
    setBaselineDocument(document);
    markSaved("Saved document.json");
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

      editor.commands.setContent(fromSdocDocument(loaded.document), { emitUpdate: true });
      repairEditorBlockIds(editor);
      setDocumentId(loaded.document.attrs.id);
      const nextMetadata = {
        ...metadata,
        ...loaded.metadata,
        title: loaded.metadata.title || metadata.title
      };
      setMetadata(nextMetadata);
      setBaselineDocument(loaded.document);
      setBaselineMetadata(nextMetadata);
      setActiveTab("json");
      setStatusMessage(loaded.statusMessage);
      setSavedAt("Not saved");
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
    setBaselineDocument(document);
    setBaselineMetadata(metadata);
    markSaved("Marked current state as saved");
  }

  function moveBlock(direction: BlockMoveDirection) {
    const moved = moveSelectedTopLevelBlock(editor, direction);
    setStatusMessage(moved ? `Moved block ${direction}` : `Cannot move block ${direction}`);
    if (moved) {
      setActiveTab("diff");
    }
  }

  if (!editor) {
    return null;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <FileJson size={22} />
          <div>
            <strong>SDoc</strong>
            <span>Phase 1 Playground</span>
          </div>
        </div>

        <div className="status-block">
          <span>Schema</span>
          <strong className={validation.ok ? "ok" : "error"}>{validation.ok ? "Valid" : "Invalid"}</strong>
        </div>
        <div className="status-block">
          <span>Saved</span>
          <strong className={hasUnsavedChanges ? "warning" : undefined}>{savedLabel}</strong>
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
        <div className="status-note">{statusMessage}</div>
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
      </aside>

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
          <ToolbarButton title="Callout" active={editor.isActive("callout")} onClick={() => editor.chain().focus().wrapIn("callout", { kind: "note" }).run()}>
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
            accept=".sdoc,.json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void openFile(file);
              }
            }}
          />
          <ToolbarButton title="Open .sdoc or document.json" onClick={() => fileInputRef.current?.click()}>
            <FolderOpen size={18} />
          </ToolbarButton>
          <ToolbarButton title="Download document.json" onClick={downloadJson}>
            <Braces size={18} />
          </ToolbarButton>
          <ToolbarButton title="Download .sdoc" onClick={downloadSdoc}>
            <Download size={18} />
          </ToolbarButton>
          <ToolbarButton title="Mark saved" onClick={markCurrentAsBaseline}>
            <Save size={18} />
          </ToolbarButton>
        </div>

        <div className="editor-grid">
          <section className="editor-pane">
            <EditorContent editor={editor} />
          </section>

          <section className="preview-pane">
            <div className="tabs" role="tablist">
              <TabButton label="JSON" value="json" activeTab={activeTab} onSelect={setActiveTab} />
              <TabButton label="Markdown" value="markdown" activeTab={activeTab} onSelect={setActiveTab} />
              <TabButton label="Diff" value="diff" activeTab={activeTab} onSelect={setActiveTab} />
            </div>
            <pre className="preview-output">{preview}</pre>
          </section>
        </div>
      </section>
    </main>
  );
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
