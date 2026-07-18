import { useEffect, type ReactNode } from "react";
import { FileText, Image, Link2, Plus, Sigma, Table, Trash2, Workflow } from "lucide-react";

export type EditorContextMenuKind = "editor" | "table" | "equation" | "mermaid";

export interface EditorContextMenuState {
  kind: EditorContextMenuKind;
  x: number;
  y: number;
}

export interface EditorContextMenuProps {
  state: EditorContextMenuState;
  onClose: () => void;
  onInsertImage: () => void;
  onInsertReference: () => void;
  onInsertTable: () => void;
  onInsertInlineEquation: () => void;
  onInsertEquationBlock: () => void;
  onInsertMermaid: () => void;
  onEditEquation: () => void;
  onEditMermaid: () => void;
  onEditTable: () => void;
  onAddTableRow: () => void;
  onAddTableColumn: () => void;
  onDeleteTableRow: () => void;
  onDeleteTableColumn: () => void;
}

export function EditorContextMenu({
  state,
  onClose,
  onInsertImage,
  onInsertReference,
  onInsertTable,
  onInsertInlineEquation,
  onInsertEquationBlock,
  onInsertMermaid,
  onEditEquation,
  onEditMermaid,
  onEditTable,
  onAddTableRow,
  onAddTableColumn,
  onDeleteTableRow,
  onDeleteTableColumn
}: EditorContextMenuProps) {
  useEffect(() => {
    function closeOnPointerDown() {
      onClose();
    }

    function closeOnKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("pointerdown", closeOnPointerDown);
    window.addEventListener("keydown", closeOnKeyDown);
    return () => {
      window.removeEventListener("pointerdown", closeOnPointerDown);
      window.removeEventListener("keydown", closeOnKeyDown);
    };
  }, [onClose]);

  function run(action: () => void) {
    onClose();
    action();
  }

  return (
    <div
      className="editor-context-menu"
      role="menu"
      aria-label={`${state.kind === "editor" ? "Insert" : state.kind === "table" ? "Table" : state.kind === "equation" ? "Equation" : "Mermaid"} context menu`}
      style={{ left: state.x, top: state.y }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {state.kind === "editor" && (
        <>
          <ContextMenuButton label="Insert image" icon={<Image size={16} />} onClick={() => run(onInsertImage)} />
          <ContextMenuButton label="Insert table" icon={<Table size={16} />} onClick={() => run(onInsertTable)} />
          <ContextMenuButton label="Insert reference" icon={<Link2 size={16} />} onClick={() => run(onInsertReference)} />
          <ContextMenuButton label="Insert inline equation" icon={<Sigma size={16} />} onClick={() => run(onInsertInlineEquation)} />
          <ContextMenuButton label="Insert equation block" icon={<Sigma size={16} />} onClick={() => run(onInsertEquationBlock)} />
          <ContextMenuButton label="Insert Mermaid diagram" icon={<Workflow size={16} />} onClick={() => run(onInsertMermaid)} />
        </>
      )}
      {state.kind === "table" && (
        <>
          <ContextMenuButton label="Edit table" icon={<FileText size={16} />} onClick={() => run(onEditTable)} />
          <ContextMenuButton label="Add row after" icon={<Plus size={16} />} onClick={() => run(onAddTableRow)} />
          <ContextMenuButton label="Add column after" icon={<Plus size={16} />} onClick={() => run(onAddTableColumn)} />
          <ContextMenuButton label="Delete row" icon={<Trash2 size={16} />} onClick={() => run(onDeleteTableRow)} danger />
          <ContextMenuButton label="Delete column" icon={<Trash2 size={16} />} onClick={() => run(onDeleteTableColumn)} danger />
        </>
      )}
      {state.kind === "equation" && <ContextMenuButton label="Edit equation" icon={<Sigma size={16} />} onClick={() => run(onEditEquation)} />}
      {state.kind === "mermaid" && <ContextMenuButton label="Edit Mermaid diagram" icon={<Workflow size={16} />} onClick={() => run(onEditMermaid)} />}
    </div>
  );
}

interface ContextMenuButtonProps {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;
}

function ContextMenuButton({ label, icon, onClick, danger = false }: ContextMenuButtonProps) {
  return (
    <button className={danger ? "danger" : undefined} type="button" role="menuitem" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
