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
  Heading1,
  Heading2,
  Image,
  Info,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  RefreshCw,
  Rows3,
  Sigma,
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
  onInsertReference: () => void;
  onInsertTable: () => void;
  onApplyCallout: (kind: "note" | "warning") => void;
  onFoldSection: () => void;
  onUnfoldSection: () => void;
  onUnfoldAllSections: () => void;
  onInsertDataGrid: () => void;
  onMoveBlock: (direction: BlockMoveDirection) => void;
  onRunTableCommand: (command: AdvancedTableCommand, successMessage: string) => void;
  onEditTableCaption: () => void;
  onAlignTableCells: (alignment: TableCellAlignment) => void;
  onInsertInlineEquation: () => void;
  onInsertEquationBlock: () => void;
  onEditEquation: () => void;
  onInsertMermaid: () => void;
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
  onInsertReference,
  onInsertTable,
  onApplyCallout,
  onFoldSection,
  onUnfoldSection,
  onUnfoldAllSections,
  onInsertDataGrid,
  onMoveBlock,
  onRunTableCommand,
  onEditTableCaption,
  onAlignTableCells,
  onInsertInlineEquation,
  onInsertEquationBlock,
  onEditEquation,
  onInsertMermaid,
  onInsertDrawio,
  onOpenDrawioEditor,
  onReadDrawioEdit,
  onCloseDrawioEdit
}: EditorToolbarGroupsProps) {
  return (
    <>
      <div className="toolbar-group primary" aria-label="Basic writing tools">
        <span className="toolbar-group-label">Text</span>
        <ToolbarButton title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 size={18} />
        </ToolbarButton>
        <ToolbarButton title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={18} />
        </ToolbarButton>
        <ToolbarButton title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading2 size={16} />
        </ToolbarButton>
        <ToolbarButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={18} />
        </ToolbarButton>
        <ToolbarButton title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={18} />
        </ToolbarButton>
        <ToolbarButton title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <Underline size={18} />
        </ToolbarButton>
        <ToolbarButton title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={18} />
        </ToolbarButton>
        <ToolbarButton title="Ordered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={18} />
        </ToolbarButton>
      </div>

      <div className="toolbar-group primary" aria-label="Insert tools">
        <span className="toolbar-group-label">Insert</span>
        <ToolbarButton title="Blockquote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={18} />
        </ToolbarButton>
        <ToolbarButton title="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <Code2 size={18} />
        </ToolbarButton>
        <ToolbarButton title="Insert image" active={editor.isActive("figure")} onClick={onInsertImage}>
          <Image size={18} />
        </ToolbarButton>
        <ToolbarButton title="Insert reference" active={editor.isActive("crossReference")} onClick={onInsertReference}>
          <Link2 size={18} />
        </ToolbarButton>
        <ToolbarButton title="Insert table" active={editor.isActive("table")} onClick={onInsertTable}>
          <Table size={18} />
        </ToolbarButton>
        <ToolbarButton title="Note callout" active={editor.isActive("callout", { kind: "note" })} onClick={() => onApplyCallout("note")}>
          <Info size={18} />
        </ToolbarButton>
        <ToolbarButton title="Warning callout" active={editor.isActive("callout", { kind: "warning" })} onClick={() => onApplyCallout("warning")}>
          <AlertTriangle size={18} />
        </ToolbarButton>
      </div>

      <div className="toolbar-group advanced" aria-label="Structure tools">
        <span className="toolbar-group-label">Structure</span>
        <ToolbarButton title="Fold section" onClick={onFoldSection}>
          <ChevronRight size={18} />
        </ToolbarButton>
        <ToolbarButton title="Unfold section" onClick={onUnfoldSection}>
          <ChevronDown size={18} />
        </ToolbarButton>
        <ToolbarButton title="Unfold all sections" active={hasCollapsedSections} onClick={onUnfoldAllSections}>
          <List size={18} />
        </ToolbarButton>
        <ToolbarButton title="Insert data grid" active={editor.isActive("dataGrid")} onClick={onInsertDataGrid}>
          <FileJson size={18} />
        </ToolbarButton>
        <ToolbarButton title="Move block up" onClick={() => onMoveBlock("up")}>
          <ArrowUp size={18} />
        </ToolbarButton>
        <ToolbarButton title="Move block down" onClick={() => onMoveBlock("down")}>
          <ArrowDown size={18} />
        </ToolbarButton>
      </div>

      <div className="toolbar-group advanced" aria-label="Table and advanced insertion tools">
        <span className="toolbar-group-label">Advanced</span>
        <ToolbarButton title="Add row after" active={editor.isActive("table")} onClick={() => onRunTableCommand("addRowAfter", "Added table row")}>
          <Rows3 size={18} />
        </ToolbarButton>
        <ToolbarButton title="Add column after" active={editor.isActive("table")} onClick={() => onRunTableCommand("addColumnAfter", "Added table column")}>
          <Columns3 size={18} />
        </ToolbarButton>
        <ToolbarButton title="Delete row" active={editor.isActive("table")} onClick={() => onRunTableCommand("deleteRow", "Deleted table row")}>
          <Rows3 size={18} />
        </ToolbarButton>
        <ToolbarButton title="Delete column" active={editor.isActive("table")} onClick={() => onRunTableCommand("deleteColumn", "Deleted table column")}>
          <Columns3 size={18} />
        </ToolbarButton>
        <ToolbarButton title="Toggle header row" active={editor.isActive("table")} onClick={() => onRunTableCommand("toggleHeaderRow", "Toggled header row")}>
          <Table size={18} />
        </ToolbarButton>
        <ToolbarButton title="Edit table caption" active={editor.isActive("table")} onClick={onEditTableCaption}>
          <FileText size={18} />
        </ToolbarButton>
        <ToolbarButton title="Toggle header column" active={editor.isActive("table")} onClick={() => onRunTableCommand("toggleHeaderColumn", "Toggled header column")}>
          <Table size={18} />
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
        <ToolbarButton title="Insert inline equation" active={editor.isActive("equation")} onClick={onInsertInlineEquation}>
          <Sigma size={18} />
        </ToolbarButton>
        <ToolbarButton title="Insert equation block" active={editor.isActive("equationBlock")} onClick={onInsertEquationBlock}>
          <Sigma size={18} />
        </ToolbarButton>
        <ToolbarButton title="Edit selected equation" active={editor.isActive("equation") || editor.isActive("equationBlock")} onClick={onEditEquation}>
          <Sigma size={18} />
        </ToolbarButton>
        <ToolbarButton title="Insert Mermaid diagram" active={editor.isActive("diagram")} onClick={onInsertMermaid}>
          <Workflow size={18} />
        </ToolbarButton>
        <ToolbarButton title="Insert Draw.io diagram" active={editor.isActive("diagram", { kind: "drawio" })} onClick={onInsertDrawio}>
          <FileJson size={18} />
        </ToolbarButton>
        <ToolbarButton title="Open Draw.io external editor" active={hasDrawioSession} onClick={onOpenDrawioEditor}>
          <ExternalLink size={18} />
        </ToolbarButton>
        <ToolbarButton title="Read Draw.io external edit" active={hasDrawioSession} onClick={onReadDrawioEdit}>
          <RefreshCw size={18} />
        </ToolbarButton>
        <ToolbarButton title="Close Draw.io external edit" active={hasDrawioSession} onClick={onCloseDrawioEdit}>
          <Trash2 size={18} />
        </ToolbarButton>
      </div>
      <div className="toolbar-spacer" />
    </>
  );
}
