export interface ExportFilenames {
  sdoc: string;
  json: string;
  markdown: string;
  html: string;
  pdf: string;
  pptx: string;
}

export interface ExportActionProps {
  label: string;
  filename: string;
  description: string;
  detail?: string;
  onClick: () => void;
}

export function ExportAction({ label, filename, description, detail, onClick }: ExportActionProps) {
  return (
    <div className="export-action">
      <div>
        <strong title={filename}>{filename}</strong>
        <span>{description}</span>
        {detail && <em>{detail}</em>}
      </div>
      <button type="button" onClick={onClick}>{label}</button>
    </div>
  );
}
