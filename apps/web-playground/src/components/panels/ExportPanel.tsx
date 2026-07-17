import type { PublishingStyleProfileName } from "@sdoc/export";

export interface ExportFilenames {
  sdoc: string;
  json: string;
  markdown: string;
  html: string;
  pdf: string;
  pptx: string;
}

export interface ExportPanelProps {
  filenames: ExportFilenames;
  styleProfile: PublishingStyleProfileName;
  onStyleProfileChange: (profile: PublishingStyleProfileName) => void;
  onExportMarkdown: () => void;
  onExportHtml: () => void;
  onCopyDeveloperCommand: (command: string) => void;
}

export function ExportPanel({
  filenames,
  styleProfile,
  onStyleProfileChange,
  onExportMarkdown,
  onExportHtml,
  onCopyDeveloperCommand
}: ExportPanelProps) {
  const profileOption = styleProfile === "modern" ? "" : ` --profile ${styleProfile}`;
  const pdfCommand = `npm run sdoc -- export ${quoteCliPath(filenames.sdoc)} --format pdf${profileOption} -o ${quoteCliPath(filenames.pdf)}`;
  const docxFilename = filenames.sdoc.replace(/\.sdoc$/i, ".docx");
  const docxCommand = `npm run sdoc -- export ${quoteCliPath(filenames.sdoc)} --format docx --template controlled -o ${quoteCliPath(docxFilename)}`;

  return (
    <div className="side-panel-section export-panel">
      <section className="export-section" aria-label="Readable exports">
        <h3>Deliverables</h3>
        <label className="metadata-field">
          <span>Publishing profile</span>
          <select value={styleProfile} onChange={(event) => onStyleProfileChange(event.target.value as PublishingStyleProfileName)}>
            <option value="modern">Modern</option>
            <option value="ieee">IEEE</option>
            <option value="iso">ISO/IEC</option>
            <option value="korean">Korean</option>
          </select>
        </label>
        <p className="settings-note">Profile selection affects derived HTML/PDF styling only; the source document content is unchanged.</p>
        <ExportAction label="Export Markdown" filename={filenames.markdown} description="Human-readable Markdown with stable block anchors." onClick={onExportMarkdown} />
        <ExportAction label="Export HTML" filename={filenames.html} description="Single-file themed HTML for browser reading and lightweight publishing." onClick={onExportHtml} />
      </section>

      <section className="export-section" aria-label="PDF publishing boundary">
        <h3>PDF</h3>
        <div className="workspace-boundary">
          <strong>CLI/Tauri PDF</strong>
          <span>Save .sdoc first, then generate PDF through the print pipeline; browser HTML export remains the previewable path.</span>
        </div>
        <ExportAction label="Copy PDF command" filename={filenames.pdf} description="Generates from the saved .sdoc file with Playwright/Chromium print emulation." onClick={() => onCopyDeveloperCommand(pdfCommand)} />
      </section>

      <section className="export-section" aria-label="DOCX publishing boundary">
        <h3>DOCX</h3>
        <div className="workspace-boundary">
          <strong>CLI/Tauri DOCX</strong>
          <span>Word handoff is a derived export. Template/profile settings stay outside canonical body content.</span>
        </div>
        <ExportAction label="Copy DOCX command" filename={docxFilename} description="Generates editable Word output from the saved .sdoc file." onClick={() => onCopyDeveloperCommand(docxCommand)} />
      </section>
    </div>
  );
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

function quoteCliPath(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}
