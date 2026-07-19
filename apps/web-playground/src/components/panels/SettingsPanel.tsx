import type { SDocMetadata } from "@sdoc/format";
import type { SDocDocument, ValidationResult } from "@sdoc/schema";

export interface HeadingNumberingSettings {
  enabled: boolean;
  maxLevel: number;
}

export type SettingsWorkspaceTab = "document" | "application" | "developer";

export interface SettingsPanelProps {
  activeTab: SettingsWorkspaceTab;
  metadata: SDocMetadata;
  validation: ValidationResult;
  document: SDocDocument;
  isDesktopRuntime: boolean;
  drawioExecutablePath: string;
  developerToolsEnabled: boolean;
  headingNumbering: HeadingNumberingSettings;
  outlineDepth: number;
  onTabChange: (tab: SettingsWorkspaceTab) => void;
  onMetadataChange: (metadata: SDocMetadata) => void;
  onHeadingNumberingChange: (settings: HeadingNumberingSettings) => void;
  onOutlineDepthChange: (depth: number) => void;
  onDrawioExecutablePathChange: (path: string) => void;
  onDeveloperToolsEnabledChange: (enabled: boolean) => void;
}

export function SettingsPanel({
  activeTab,
  metadata,
  validation,
  document,
  isDesktopRuntime,
  drawioExecutablePath,
  developerToolsEnabled,
  headingNumbering,
  outlineDepth,
  onTabChange,
  onMetadataChange,
  onHeadingNumberingChange,
  onOutlineDepthChange,
  onDrawioExecutablePathChange,
  onDeveloperToolsEnabledChange
}: SettingsPanelProps) {
  return (
    <div className="side-panel-section settings-panel">
      <div
        className="settings-tabs"
        role="tablist"
        aria-label="Settings sections"
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
          event.preventDefault();
          const tabs: SettingsWorkspaceTab[] = ["document", "application", "developer"];
          const current = tabs.indexOf(activeTab);
          const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
          onTabChange(tabs[next]);
          requestAnimationFrame(() => window.document.getElementById(`settings-tab-${tabs[next]}`)?.focus());
        }}
      >
        <SettingsTab label="Document" value="document" activeTab={activeTab} onSelect={onTabChange} />
        <SettingsTab label="Application" value="application" activeTab={activeTab} onSelect={onTabChange} />
        <SettingsTab label="Developer" value="developer" activeTab={activeTab} onSelect={onTabChange} />
      </div>

      <div className="settings-tab-content" role="tabpanel" aria-labelledby={`settings-tab-${activeTab}`}>
        {activeTab === "document" && (
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
        )}

        {activeTab === "application" && (
          <>
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
                  {[1, 2, 3, 4, 5, 6].map((level) => <option value={level} key={level}>H1-H{level}</option>)}
                </select>
              </label>
              <label className="metadata-field">
                <span>Outline depth</span>
                <select value={outlineDepth} onChange={(event) => onOutlineDepthChange(Number(event.target.value))}>
                  {[1, 2, 3, 4, 5, 6].map((level) => <option value={level} key={level}>H1-H{level}</option>)}
                </select>
              </label>
              <p className="settings-note">Numbering and outline depth change the workspace view only; document content stays unchanged.</p>
            </section>

            {isDesktopRuntime && (
              <section className="settings-section" aria-label="Desktop integrations">
                <h3>Desktop integrations</h3>
                <label className="metadata-field">
                  <span>Draw.io application</span>
                  <input value={drawioExecutablePath} placeholder="Use system default" onChange={(event) => onDrawioExecutablePathChange(event.target.value)} />
                </label>
                <p className="settings-note">Leave blank to use the application associated with Draw.io files in Windows.</p>
              </section>
            )}
          </>
        )}

        {activeTab === "developer" && (
          <section className="settings-section" aria-label="Developer settings">
            <h3>Developer</h3>
            <label className="metadata-field inline">
              <span>Enable developer tools</span>
              <input
                type="checkbox"
                checked={developerToolsEnabled}
                onChange={(event) => onDeveloperToolsEnabledChange(event.target.checked)}
              />
            </label>
            <p className="settings-note">Adds format inspection, derived AI/RAG outputs, command-line handoff, and data-grid diagnostics to the Activity Bar.</p>
            {developerToolsEnabled && (
              <div className="developer-document-facts" aria-label="Developer document details">
                <div className="status-block"><span>Format version</span><strong>{document.schemaVersion}</strong></div>
                <div className="status-block"><span>Document ID</span><strong title={document.attrs.id}>{document.attrs.id}</strong></div>
                <div className="status-block"><span>Top-level blocks</span><strong>{document.content.length}</strong></div>
                {!validation.ok && (
                  <div className="issue-list">
                    {validation.issues.slice(0, 5).map((issue) => (
                      <div key={`${issue.path}-${issue.message}`}><strong>{issue.path}</strong><span>{issue.message}</span></div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function SettingsTab({
  label,
  value,
  activeTab,
  onSelect
}: {
  label: string;
  value: SettingsWorkspaceTab;
  activeTab: SettingsWorkspaceTab;
  onSelect: (tab: SettingsWorkspaceTab) => void;
}) {
  const active = activeTab === value;
  return (
    <button
      id={`settings-tab-${value}`}
      type="button"
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      onClick={() => onSelect(value)}
    >
      {label}
    </button>
  );
}
