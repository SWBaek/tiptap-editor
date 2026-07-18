import type { RefObject } from "react";
import { EditorToolbarGroups, type EditorToolbarGroupsProps } from "./EditorToolbarGroups";

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
  onInsertDrawioFile
}: EditorToolbarProps) {
  return (
    <div className="toolbar" aria-label="Editor toolbar">
      <EditorToolbarGroups {...groups} />
      <HiddenFileInput inputRef={fileInputRef} label="Open document file" accept=".sdoc,.json,application/json" onFile={onOpenFile} />
      <HiddenFileInput inputRef={imageInputRef} label="Insert image file" accept="image/*" onFile={onInsertImageFile} />
      <HiddenFileInput inputRef={dataGridInputRef} label="Insert data grid file" accept=".csv,.json,text/csv,application/json" onFile={onInsertDataGridFile} />
      <HiddenFileInput inputRef={drawioInputRef} label="Import Draw.io source file" accept=".drawio,.drawio.xml,application/xml,text/xml" onFile={onInsertDrawioFile} />
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
