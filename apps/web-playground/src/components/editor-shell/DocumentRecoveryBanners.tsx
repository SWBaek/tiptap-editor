export interface DocumentRecoveryBannersProps {
  fileLabel: string;
  saveFailureMessage: string | null;
  externalChangeMessage: string | null;
  validationMessage: string | null;
  onRetrySave: () => void;
  onSaveAs: () => void;
  onReloadExternalChange: () => void;
  onKeepExternalChange: () => void;
  onCompareExternalChange: () => void;
  onReviewDocumentHealth: () => void;
}

export function DocumentRecoveryBanners({
  fileLabel,
  saveFailureMessage,
  externalChangeMessage,
  validationMessage,
  onRetrySave,
  onSaveAs,
  onReloadExternalChange,
  onKeepExternalChange,
  onCompareExternalChange,
  onReviewDocumentHealth
}: DocumentRecoveryBannersProps) {
  return (
    <div className="document-recovery-region" aria-label="Document alerts">
      {saveFailureMessage && (
        <section className="document-recovery-banner error" role="alert" aria-label="Save failed">
          <div>
            <strong>Could not save {fileLabel}</strong>
            <span>{saveFailureMessage}</span>
          </div>
          <div className="document-recovery-actions">
            <button type="button" onClick={onRetrySave}>Retry</button>
            <button type="button" onClick={onSaveAs}>Save As</button>
          </div>
        </section>
      )}
      {externalChangeMessage && (
        <section className="document-recovery-banner warning" role="alert" aria-label="External change detected">
          <div>
            <strong>External change: {fileLabel}</strong>
            <span>{externalChangeMessage}</span>
          </div>
          <div className="document-recovery-actions">
            <button type="button" onClick={onReloadExternalChange}>Reload from disk</button>
            <button type="button" onClick={onKeepExternalChange}>Keep current</button>
            <button type="button" onClick={onCompareExternalChange}>Compare</button>
          </div>
        </section>
      )}
      {validationMessage && (
        <section className="document-recovery-banner error" role="alert" aria-label="Document needs attention">
          <div>
            <strong>Save and export are unavailable</strong>
            <span>{validationMessage}</span>
          </div>
          <div className="document-recovery-actions">
            <button type="button" onClick={onReviewDocumentHealth}>Review document health</button>
          </div>
        </section>
      )}
    </div>
  );
}
