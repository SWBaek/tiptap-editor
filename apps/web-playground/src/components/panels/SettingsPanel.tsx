import type { SDocMetadata } from "@sdoc/format";
import type { SDocDocument, ValidationResult } from "@sdoc/schema";

export interface HeadingNumberingSettings {
  enabled: boolean;
  maxLevel: number;
}

export interface SettingsPanelProps {
  metadata: SDocMetadata;
  validation: ValidationResult;
  document: SDocDocument;
  assetCount: number;
  drawioExecutablePath: string;
  developerToolsEnabled: boolean;
  headingNumbering: HeadingNumberingSettings;
  outlineDepth: number;
  onMetadataChange: (metadata: SDocMetadata) => void;
  onHeadingNumberingChange: (settings: HeadingNumberingSettings) => void;
  onOutlineDepthChange: (depth: number) => void;
  onDrawioExecutablePathChange: (path: string) => void;
  onDeveloperToolsEnabledChange: (enabled: boolean) => void;
}

export function SettingsPanel({
  metadata,
  validation,
  document,
  assetCount,
  drawioExecutablePath,
  developerToolsEnabled,
  headingNumbering,
  outlineDepth,
  onMetadataChange,
  onHeadingNumberingChange,
  onOutlineDepthChange,
  onDrawioExecutablePathChange,
  onDeveloperToolsEnabledChange
}: SettingsPanelProps) {
  return (
    <div className="side-panel-section settings-panel">
      <section className="settings-section" aria-label="Document properties">
        <h3>Document Properties</h3>
        <label className="metadata-field">
          <span>Author</span>
          <input value={String(metadata.author ?? "")} onChange={(event) => onMetadataChange({ ...metadata, author: event.target.value })} />
        </label>
        <label className="metadata-field">
          <span>Version</span>
          <input value={String(metadata.version ?? "")} onChange={(event) => onMetadataChange({ ...metadata, version: event.target.value })} />
        </label>
        <p className="settings-note">Edit the document title directly above the writing canvas.</p>
      </section>

      <section className="settings-section" aria-label="Authoring settings">
        <h3>Authoring</h3>
        <label className="metadata-field inline">
          <span>Heading numbering</span>
          <input
            type="checkbox"
            checked={headingNumbering.enabled}
            onChange={(event) => onHeadingNumberingChange({ ...headingNumbering, enabled: event.target.checked })}
          />
        </label>
        <label className="metadata-field">
          <span>Number heading levels</span>
          <select
            value={headingNumbering.maxLevel}
            onChange={(event) => onHeadingNumberingChange({ ...headingNumbering, maxLevel: Number(event.target.value) })}
          >
            {[1, 2, 3, 4, 5, 6].map((level) => (
              <option value={level} key={level}>H1-H{level}</option>
            ))}
          </select>
        </label>
        <label className="metadata-field">
          <span>Outline depth</span>
          <select value={outlineDepth} onChange={(event) => onOutlineDepthChange(Number(event.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((level) => (
              <option value={level} key={level}>H1-H{level}</option>
            ))}
          </select>
        </label>
        <p className="settings-note">Numbers and outline depth are runtime projections; heading text in document.json is unchanged.</p>
      </section>

      <section className="settings-section" aria-label="Native integration settings">
        <h3>Native Integrations</h3>
        <label className="metadata-field">
          <span>Draw.io executable</span>
          <input value={drawioExecutablePath} placeholder="Use OS default opener" onChange={(event) => onDrawioExecutablePathChange(event.target.value)} />
        </label>
        <div className="status-block">
          <span>Draw.io launch</span>
          <strong>{drawioExecutablePath.trim() ? "Explicit executable" : "OS default"}</strong>
        </div>
      </section>

      <section className="settings-section" aria-label="Advanced settings">
        <h3>Advanced</h3>
        <label className="metadata-field inline">
          <span>Enable developer tools</span>
          <input
            type="checkbox"
            checked={developerToolsEnabled}
            onChange={(event) => onDeveloperToolsEnabledChange(event.target.checked)}
          />
        </label>
        <p className="settings-note">Shows raw format, AI/RAG, CLI, and data-grid diagnostics for development workflows.</p>
      </section>

      <section className="settings-section" aria-label="Schema status">
        <h3>Schema</h3>
        <div className="status-block">
          <span>Status</span>
          <strong className={validation.ok ? "ok" : "error"}>{validation.ok ? "Valid" : "Invalid"}</strong>
        </div>
        <div className="status-block"><span>Version</span><strong>{document.schemaVersion}</strong></div>
        <div className="status-block"><span>Document ID</span><strong title={document.attrs.id}>{document.attrs.id}</strong></div>
        <div className="status-block"><span>Top blocks</span><strong>{document.content.length}</strong></div>
        <div className="status-block"><span>Assets</span><strong>{assetCount}</strong></div>
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
      </section>
    </div>
  );
}
