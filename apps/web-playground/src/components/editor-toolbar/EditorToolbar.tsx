import type { RefObject } from "react";
import { Download, FilePlus, FileText, FolderOpen, Save } from "lucide-react";
import { EditorToolbarGroups, type EditorToolbarGroupsProps } from "./EditorToolbarGroups";
import { ToolbarButton } from "./ToolbarButton";

export interface EditorToolbarProps {
  groups: EditorToolbarGroupsProps;
  fileInputRef: RefObject<HTMLInputElement | null>;
  imageInputRef: RefObject<HTMLInputElement | null>;
  dataGridInputRef: RefObject<HTMLInputElement | null>;
  drawioInputRef: RefObject<HTMLInputElement | null>;
  onOpenFile: (file: File) => void;
  onInsertImageFile: (file: File) => void;
  onInsertDataGridFile: (file: File) => void;
  onInsertDrawioFile: (file: File) => void;
  onNewDocument: () => void;
  onOpenDocument: () => void;
  onDownloadMarkdown: () => void;
  onSaveSdoc: () => void;
  onMarkSaved: () => void;
}

export function EditorToolbar({
  groups,
  fileInputRef,
  imageInputRef,
  dataGridInputRef,
  drawioInputRef,
  onOpenFile,
  onInsertImageFile,
  onInsertDataGridFile,
  onInsertDrawioFile,
  onNewDocument,
  onOpenDocument,
  onDownloadMarkdown,
  onSaveSdoc,
  onMarkSaved
}: EditorToolbarProps) {
  return (
    <div className="toolbar" aria-label="Editor toolbar">
      <EditorToolbarGroups {...groups} />
      <HiddenFileInput inputRef={fileInputRef} label="Open document file" accept=".sdoc,.json,application/json" onFile={onOpenFile} />
      <HiddenFileInput inputRef={imageInputRef} label="Insert image file" accept="image/*" onFile={onInsertImageFile} />
      <HiddenFileInput inputRef={dataGridInputRef} label="Insert data grid file" accept=".csv,.json,text/csv,application/json" onFile={onInsertDataGridFile} />
      <HiddenFileInput inputRef={drawioInputRef} label="Import Draw.io source file" accept=".drawio,.drawio.xml,application/xml,text/xml" onFile={onInsertDrawioFile} />
      <ToolbarButton title="New document" onClick={onNewDocument}>
        <FilePlus size={18} />
      </ToolbarButton>
      <ToolbarButton title="Open .sdoc or document.json" onClick={onOpenDocument}>
        <FolderOpen size={18} />
      </ToolbarButton>
      <ToolbarButton title="Download Markdown" onClick={onDownloadMarkdown}>
        <FileText size={18} />
      </ToolbarButton>
      <ToolbarButton title="Save current .sdoc" onClick={onSaveSdoc}>
        <Download size={18} />
      </ToolbarButton>
      <ToolbarButton title="Mark saved" onClick={onMarkSaved}>
        <Save size={18} />
      </ToolbarButton>
    </div>
  );
}

interface HiddenFileInputProps {
  inputRef: RefObject<HTMLInputElement | null>;
  label: string;
  accept: string;
  onFile: (file: File) => void;
}

function HiddenFileInput({ inputRef, label, accept, onFile }: HiddenFileInputProps) {
  return (
    <input
      ref={inputRef}
      className="file-input"
      type="file"
      aria-label={label}
      accept={accept}
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) {
          onFile(file);
        }
      }}
    />
  );
}
