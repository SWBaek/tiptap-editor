import { useMemo, useState } from "react";
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
import { exportMarkdown } from "@sdoc/export";
import { createEmptySdocContainer, packSdoc, stableStringify } from "@sdoc/format";
import { validateDocument } from "@sdoc/schema";
import { BlockIdExtension, CalloutNode, initialContent, toSdocDocument } from "./sdocEditor";

type PreviewTab = "json" | "markdown" | "diff";

const initialDocument = toSdocDocument(initialContent);

export function App() {
  const [activeTab, setActiveTab] = useState<PreviewTab>("json");
  const [savedAt, setSavedAt] = useState<string>("Not saved");

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
      CalloutNode,
      BlockIdExtension
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: "editor-surface"
      }
    }
  });

  const document = useMemo(() => {
    return editor ? toSdocDocument(editor.getJSON()) : initialDocument;
  }, [editor?.state.doc]);

  const validation = validateDocument(document);
  const json = stableStringify(document);
  const markdown = exportMarkdown(document);
  const diffLines = renderDiffEvents(diffDocuments(initialDocument, document));
  const preview = activeTab === "json" ? json : activeTab === "markdown" ? markdown : diffLines.join("\n") || "NO_CHANGES\n";

  async function downloadSdoc() {
    const now = new Date().toISOString();
    const container = createEmptySdocContainer({ title: "Playground Document", updatedAt: now });
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
        title: "Playground Document",
        updatedAt: now
      },
      derived: {
        "plain.md": markdown
      }
    });

    const blobPart = packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength) as ArrayBuffer;
    downloadBlob(new Blob([blobPart], { type: "application/vnd.sdoc" }), "playground.sdoc");
    setSavedAt(new Date().toLocaleTimeString());
  }

  function downloadJson() {
    downloadBlob(new Blob([json], { type: "application/json" }), "document.json");
    setSavedAt(new Date().toLocaleTimeString());
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
