import type { Editor } from "@tiptap/core";
import { Bold, Code2, Italic, Link2, Strikethrough, Underline } from "lucide-react";
import { ToolbarButton } from "./ToolbarButton";

export type BubbleSelectionCommand = "bold" | "italic" | "underline" | "strike" | "code";

export interface BubbleToolbarPosition {
  top: number;
  left: number;
}

export interface SelectionBubbleToolbarProps {
  editor: Editor;
  position: BubbleToolbarPosition;
  onRunCommand: (command: BubbleSelectionCommand) => void;
  onInsertReference: () => void;
}

export function SelectionBubbleToolbar({ editor, position, onRunCommand, onInsertReference }: SelectionBubbleToolbarProps) {
  return (
    <div
      className="selection-bubble-toolbar"
      style={{ top: position.top, left: position.left }}
      aria-label="Selected text formatting"
      onMouseDown={(event) => event.preventDefault()}
    >
      <ToolbarButton title="Bold selection" active={editor.isActive("bold")} onMouseDown={(event) => {
        event.preventDefault();
        onRunCommand("bold");
      }} onClick={() => undefined}>
        <Bold size={16} />
      </ToolbarButton>
      <ToolbarButton title="Italic selection" active={editor.isActive("italic")} onMouseDown={(event) => {
        event.preventDefault();
        onRunCommand("italic");
      }} onClick={() => undefined}>
        <Italic size={16} />
      </ToolbarButton>
      <ToolbarButton title="Underline selection" active={editor.isActive("underline")} onMouseDown={(event) => {
        event.preventDefault();
        onRunCommand("underline");
      }} onClick={() => undefined}>
        <Underline size={16} />
      </ToolbarButton>
      <ToolbarButton title="Strike selection" active={editor.isActive("strike")} onMouseDown={(event) => {
        event.preventDefault();
        onRunCommand("strike");
      }} onClick={() => undefined}>
        <Strikethrough size={16} />
      </ToolbarButton>
      <ToolbarButton title="Code selection" active={editor.isActive("code")} onMouseDown={(event) => {
        event.preventDefault();
        onRunCommand("code");
      }} onClick={() => undefined}>
        <Code2 size={16} />
      </ToolbarButton>
      <ToolbarButton title="Insert reference for selection" active={editor.isActive("crossReference")} onClick={onInsertReference}>
        <Link2 size={16} />
      </ToolbarButton>
    </div>
  );
}
