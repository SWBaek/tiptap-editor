import { useMemo, useRef, useState } from "react";
import type { AnyExtension } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import {
  AlertTriangle,
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
import { diffDocuments, renderDiffEvents } from "@sdoc/diff";
import { exportDerivedOutputs, exportMarkdown } from "@sdoc/export";
import { createEmptySdocContainer, packSdoc, stableStringify, unpackSdoc, type SDocMetadata } from "@sdoc/format";
import { createEmptyDocument, type SDocDocument, validateDocument } from "@sdoc/schema";
import { BlockIdExtension, CalloutNode, fromSdocDocument, initialContent, toSdocDocument } from "@sdoc/editor-tiptap";

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
  const diffLines = renderDiffEvents(diffDocuments(baselineDocument, document));
  const preview = activeTab === "json" ? json : activeTab === "markdown" ? markdown : diffLines.join("\n") || "NO_CHANGES\n";

  async function downloadSdoc() {
    const now = new Date().toISOString();
    const container = createEmptySdocContainer({ ...metadata, updatedAt: now });
    const derived = exportDerivedOutputs(document);
    const packed = await packSdoc({
      ...container,
      manifest: {
        ...container.manifest,
        documentId: document.attrs.id,
        updatedAt: now
      },
      document,
      metadata: {
        ...container.metadata,
        ...metadata,
        updatedAt: now
      },
      derived
    });

    const blobPart = packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength) as ArrayBuffer;
    downloadBlob(new Blob([blobPart], { type: "application/vnd.sdoc" }), `${safeFilename(metadata.title || "document")}.sdoc`);
    markSaved("Saved .sdoc");
  }

  function downloadJson() {
    downloadBlob(new Blob([json], { type: "application/json" }), "document.json");
    markSaved("Saved document.json");
  }

  async function openFile(file: File) {
    try {
      const loaded =
        file.name.endsWith(".sdoc") || file.size === 0
          ? await loadSdocFile(file)
          : { document: JSON.parse(await file.text()) as SDocDocument, metadata };

      const validationResult = validateDocument(loaded.document);
      if (!validationResult.ok) {
        setStatusMessage(`Invalid document: ${validationResult.issues[0]?.message ?? "schema validation failed"}`);
        return;
      }

      editor.commands.setContent(fromSdocDocument(loaded.document), { emitUpdate: true });
      setDocumentId(loaded.document.attrs.id);
      setMetadata((current) => ({
        ...current,
        ...loaded.metadata,
        title: loaded.metadata.title || current.title
      }));
      setBaselineDocument(loaded.document);
      setActiveTab("json");
      setStatusMessage(file.size === 0 ? "Initialized empty .sdoc" : `Opened ${file.name}`);
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
          <strong>{savedAt}</strong>
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
          <ToolbarButton title="Mark saved" onClick={() => setSavedAt(new Date().toLocaleTimeString())}>
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

async function loadSdocFile(file: File): Promise<{ document: SDocDocument; metadata: SDocMetadata }> {
  if (file.size === 0) {
    const document = createEmptyDocument();
    return {
      document,
      metadata: {
        title: file.name.replace(/\.sdoc$/i, "") || "Untitled"
      }
    };
  }

  const container = await unpackSdoc(await file.arrayBuffer());
  return {
    document: container.document,
    metadata: container.metadata
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

function safeFilename(value: string): string {
  const name = value.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, "-");
  return name.length > 0 ? name : "document";
}
