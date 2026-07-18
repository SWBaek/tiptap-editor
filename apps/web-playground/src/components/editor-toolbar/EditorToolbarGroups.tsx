import type { ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import type { AdvancedTableCommand, BlockMoveDirection, TableCellAlignment } from "@sdoc/editor-tiptap";
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
  Code2,
  Columns3,
  ExternalLink,
  FileJson,
  FileText,
  Image,
  Info,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  MoreHorizontal,
  Quote,
  RefreshCw,
  Rows3,
  Sigma,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  Trash2,
  Underline,
  Workflow
} from "lucide-react";
import { ToolbarButton } from "./ToolbarButton";

export interface EditorToolbarGroupsProps {
  editor: Editor;
  hasCollapsedSections: boolean;
  hasDrawioSession: boolean;
  onInsertImage: () => void;
  onEditImage: () => void;
  onEditLink: () => void;
  onInsertReference: () => void;
  onInsertTable: () => void;
  onApplyCallout: (kind: "note" | "warning") => void;
  onFoldSection: () => void;
  onUnfoldSection: () => void;
  onUnfoldAllSections: () => void;
  onInsertDataGrid: () => void;
  onMoveBlock: (direction: BlockMoveDirection) => void;
  onRunTableCommand: (command: AdvancedTableCommand, successMessage: string) => void;
  onEditTable: () => void;
  onAlignTableCells: (alignment: TableCellAlignment) => void;
  onInsertInlineEquation: () => void;
  onInsertEquationBlock: () => void;
  onEditEquation: () => void;
  onInsertMermaid: () => void;
  onEditMermaid: () => void;
  onInsertDrawio: () => void;
  onOpenDrawioEditor: () => void;
  onReadDrawioEdit: () => void;
  onCloseDrawioEdit: () => void;
}

export function EditorToolbarGroups({
  editor,
  hasCollapsedSections,
  hasDrawioSession,
  onInsertImage,
  onEditImage,
  onEditLink,
  onInsertReference,
  onInsertTable,
  onApplyCallout,
  onFoldSection,
  onUnfoldSection,
  onUnfoldAllSections,
  onInsertDataGrid,
  onMoveBlock,
  onRunTableCommand,
  onEditTable,
  onAlignTableCells,
  onInsertInlineEquation,
  onInsertEquationBlock,
  onEditEquation,
  onInsertMermaid,
  onEditMermaid,
  onInsertDrawio,
  onOpenDrawioEditor,
  onReadDrawioEdit,
  onCloseDrawioEdit
}: EditorToolbarGroupsProps) {
  return (
    <>
      <div className="toolbar-group primary toolbar-writing-tools" aria-label="Basic writing tools">
        <label className="toolbar-block-style">
          <span className="visually-hidden">Text style</span>
          <select
            aria-label="Text style"
            value={activeBlockStyle(editor)}
            onChange={(event) => {
              const style = event.target.value;
              if (style === "paragraph") {
                editor.chain().focus().setParagraph().run();
                return;
              }
              editor.chain().focus().setHeading({ level: Number(style.slice(1)) as 1 | 2 | 3 }).run();
            }}
          >
            <option value="paragraph">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
          </select>
        </label>
        <ToolbarButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={18} />
        </ToolbarButton>
        <ToolbarButton title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={18} />
        </ToolbarButton>
        <ToolbarButton title="Link" active={editor.isActive("link")} onMouseDown={(event) => event.preventDefault()} onClick={onEditLink}>
          <Link2 size={18} />
        </ToolbarButton>
        <ToolbarButton title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={18} />
        </ToolbarButton>
        <ToolbarButton title="Ordered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={18} />
        </ToolbarButton>
        <ToolbarButton title="Task list" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>
          <ListChecks size={18} />
        </ToolbarButton>
      </div>

      <div className="toolbar-group primary toolbar-insert-tools" aria-label="Common insert tools">
        <ToolbarButton title="Insert image" active={editor.isActive("figure")} onClick={onInsertImage}>
          <Image size={18} />
        </ToolbarButton>
        <ToolbarButton title="Insert table" active={editor.isActive("table")} onClick={onInsertTable}>
          <Table size={18} />
        </ToolbarButton>
      </div>

      <ToolbarMenu label="+ Insert" icon={null}>
        <ToolbarButton title="Insert reference" active={editor.isActive("crossReference")} onClick={onInsertReference}>
          <Link2 size={18} />
        </ToolbarButton>
        <ToolbarButton title="Insert data grid" active={editor.isActive("dataGrid")} onClick={onInsertDataGrid}>
          <FileJson size={18} />
        </ToolbarButton>
        <ToolbarButton title="Insert inline equation" active={editor.isActive("equation")} onClick={onInsertInlineEquation}>
          <Sigma size={18} />
        </ToolbarButton>
        <ToolbarButton title="Insert equation block" active={editor.isActive("equationBlock")} onClick={onInsertEquationBlock}>
          <Sigma size={18} />
        </ToolbarButton>
        <ToolbarButton title="Insert Mermaid diagram" active={editor.isActive("diagram", { kind: "mermaid" })} onClick={onInsertMermaid}>
          <Workflow size={18} />
        </ToolbarButton>
        <ToolbarButton title="Insert Draw.io diagram" active={editor.isActive("diagram", { kind: "drawio" })} onClick={onInsertDrawio}>
          <FileJson size={18} />
        </ToolbarButton>
      </ToolbarMenu>

      <ToolbarMenu label="More" icon={<MoreHorizontal size={17} />} active={hasCollapsedSections}>
        <ToolbarButton title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <Underline size={18} />
        </ToolbarButton>
        <ToolbarButton title="Strike" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough size={18} />
        </ToolbarButton>
        <ToolbarButton title="Align text left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <AlignLeft size={18} />
        </ToolbarButton>
        <ToolbarButton title="Align text center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <AlignCenter size={18} />
        </ToolbarButton>
        <ToolbarButton title="Align text right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <AlignRight size={18} />
        </ToolbarButton>
        <ToolbarButton title="Subscript" active={editor.isActive("subscript")} onClick={() => editor.chain().focus().toggleSubscript().run()}>
          <Subscript size={18} />
        </ToolbarButton>
        <ToolbarButton title="Superscript" active={editor.isActive("superscript")} onClick={() => editor.chain().focus().toggleSuperscript().run()}>
          <Superscript size={18} />
        </ToolbarButton>
        <ToolbarButton title="Blockquote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={18} />
        </ToolbarButton>
        <ToolbarButton title="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <Code2 size={18} />
        </ToolbarButton>
        <ToolbarButton title="Note callout" active={editor.isActive("callout", { kind: "note" })} onClick={() => onApplyCallout("note")}>
          <Info size={18} />
        </ToolbarButton>
        <ToolbarButton title="Warning callout" active={editor.isActive("callout", { kind: "warning" })} onClick={() => onApplyCallout("warning")}>
          <AlertTriangle size={18} />
        </ToolbarButton>
        <ToolbarButton title="Fold section" onClick={onFoldSection}>
          <ChevronRight size={18} />
        </ToolbarButton>
        <ToolbarButton title="Unfold section" onClick={onUnfoldSection}>
          <ChevronDown size={18} />
        </ToolbarButton>
        <ToolbarButton title="Unfold all sections" active={hasCollapsedSections} onClick={onUnfoldAllSections}>
          <List size={18} />
        </ToolbarButton>
        <ToolbarButton title="Move block up" onClick={() => onMoveBlock("up")}>
          <ArrowUp size={18} />
        </ToolbarButton>
        <ToolbarButton title="Move block down" onClick={() => onMoveBlock("down")}>
          <ArrowDown size={18} />
        </ToolbarButton>
      </ToolbarMenu>

      {(editor.isActive("equation") || editor.isActive("equationBlock")) && (
        <ToolbarMenu label="Equation tools" icon={<Sigma size={17} />} active>
          <ToolbarButton title="Edit selected equation" active onClick={onEditEquation}>
            <Sigma size={18} />
          </ToolbarButton>
        </ToolbarMenu>
      )}

      {editor.isActive("diagram", { kind: "mermaid" }) && (
        <ToolbarMenu label="Mermaid tools" icon={<Workflow size={17} />} active>
          <ToolbarButton title="Edit selected Mermaid diagram" active onClick={onEditMermaid}>
            <Workflow size={18} />
          </ToolbarButton>
        </ToolbarMenu>
      )}

      {editor.isActive("table") && (
        <ToolbarMenu label="Table tools" icon={<Table size={17} />} active>
          <ToolbarButton title="Add row after" active onClick={() => onRunTableCommand("addRowAfter", "Added table row")}>
            <Rows3 size={18} />
          </ToolbarButton>
          <ToolbarButton title="Add column after" active onClick={() => onRunTableCommand("addColumnAfter", "Added table column")}>
            <Columns3 size={18} />
          </ToolbarButton>
          <ToolbarButton title="Delete row" active onClick={() => onRunTableCommand("deleteRow", "Deleted table row")}>
            <Rows3 size={18} />
          </ToolbarButton>
          <ToolbarButton title="Delete column" active onClick={() => onRunTableCommand("deleteColumn", "Deleted table column")}>
            <Columns3 size={18} />
          </ToolbarButton>
          <ToolbarButton title="Toggle header row" active onClick={() => onRunTableCommand("toggleHeaderRow", "Toggled header row")}>
            <Table size={18} />
          </ToolbarButton>
          <ToolbarButton title="Toggle header column" active onClick={() => onRunTableCommand("toggleHeaderColumn", "Toggled header column")}>
            <Table size={18} />
          </ToolbarButton>
          <ToolbarButton title="Edit table" active onClick={onEditTable}>
            <FileText size={18} />
          </ToolbarButton>
          <ToolbarButton title="Align table cell left" active={editor.isActive("tableCell", { align: "left" }) || editor.isActive("tableHeader", { align: "left" })} onClick={() => onAlignTableCells("left")}>
            <AlignLeft size={18} />
          </ToolbarButton>
          <ToolbarButton title="Align table cell center" active={editor.isActive("tableCell", { align: "center" }) || editor.isActive("tableHeader", { align: "center" })} onClick={() => onAlignTableCells("center")}>
            <AlignCenter size={18} />
          </ToolbarButton>
          <ToolbarButton title="Align table cell right" active={editor.isActive("tableCell", { align: "right" }) || editor.isActive("tableHeader", { align: "right" })} onClick={() => onAlignTableCells("right")}>
            <AlignRight size={18} />
          </ToolbarButton>
        </ToolbarMenu>
      )}

      {editor.isActive("figure") && (
        <ToolbarMenu label="Image tools" icon={<Image size={17} />} active>
          <ToolbarButton title="Edit selected image" active onClick={onEditImage}>
            <Image size={18} />
          </ToolbarButton>
        </ToolbarMenu>
      )}

      {(editor.isActive("diagram", { kind: "drawio" }) || hasDrawioSession) && (
        <ToolbarMenu label="Draw.io tools" icon={<Workflow size={17} />} active>
          <ToolbarButton title="Open Draw.io external editor" active onClick={onOpenDrawioEditor}>
            <ExternalLink size={18} />
          </ToolbarButton>
          {hasDrawioSession && (
            <>
              <ToolbarButton title="Read Draw.io external edit" active onClick={onReadDrawioEdit}>
                <RefreshCw size={18} />
              </ToolbarButton>
              <ToolbarButton title="Close Draw.io external edit" active onClick={onCloseDrawioEdit}>
                <Trash2 size={18} />
              </ToolbarButton>
            </>
          )}
        </ToolbarMenu>
      )}

      <div className="toolbar-spacer" />
    </>
  );
}

function activeBlockStyle(editor: Editor): "paragraph" | "h1" | "h2" | "h3" {
  if (editor.isActive("heading", { level: 1 })) return "h1";
  if (editor.isActive("heading", { level: 2 })) return "h2";
  if (editor.isActive("heading", { level: 3 })) return "h3";
  return "paragraph";
}

interface ToolbarMenuProps {
  label: string;
  icon: ReactNode;
  active?: boolean;
  children: ReactNode;
}

function ToolbarMenu({ label, icon, active = false, children }: ToolbarMenuProps) {
  return (
    <details className={active ? "toolbar-menu active" : "toolbar-menu"}>
      <summary title={label} aria-label={`${label} menu`}>
        {icon}
        <span>{label}</span>
        <ChevronDown size={14} />
      </summary>
      <div
        className="toolbar-menu-popover"
        role="group"
        aria-label={`${label} commands`}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("button")) {
            event.currentTarget.parentElement?.removeAttribute("open");
          }
        }}
      >
        {children}
      </div>
    </details>
  );
}
