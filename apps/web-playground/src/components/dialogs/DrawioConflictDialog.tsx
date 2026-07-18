export interface DrawioConflictDialogProps {
  blockId: string;
  sourceAssetId: string;
  revisionAssetId: string;
  message: string;
  onKeepCurrent: () => void;
  onReplaceSource: () => void;
  onSaveRevision: () => void;
}

export function DrawioConflictDialog({
  blockId,
  sourceAssetId,
  revisionAssetId,
  message,
  onKeepCurrent,
  onReplaceSource,
  onSaveRevision
}: DrawioConflictDialogProps) {
  return (
    <div className="author-dialog-backdrop" role="presentation">
      <section
        className="author-dialog drawio-conflict-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Draw.io external edit conflict"
      >
        <header>
          <div>
            <h2>Draw.io external edit conflict</h2>
            <p>An external edit and the current SDoc source both exist.</p>
          </div>
        </header>
        <div className="author-dialog-body drawio-conflict-body">
          <p>{message}</p>
          <dl className="drawio-conflict-details">
            <div>
              <dt>Diagram block</dt>
              <dd><code>{blockId}</code></dd>
            </div>
            <div>
              <dt>Current source</dt>
              <dd><code>{sourceAssetId}</code></dd>
            </div>
          </dl>
          <div className="drawio-conflict-options">
            <p><strong>Keep current</strong> discards the external result and leaves the SDoc unchanged.</p>
            <p><strong>Replace source</strong> writes the external bytes to the current asset without changing the diagram block ID.</p>
            <p><strong>Save as revision</strong> stores the external bytes as <code>{revisionAssetId}</code> and points this diagram to that asset.</p>
          </div>
          <p className="drawio-conflict-runtime-note">Conflict and external-editor session state are runtime-only and are not written to <code>document.json</code>.</p>
          <footer>
            <button type="button" autoFocus onClick={onKeepCurrent}>Keep current</button>
            <button type="button" onClick={onReplaceSource}>Replace source</button>
            <button className="primary" type="button" onClick={onSaveRevision}>Save as revision</button>
          </footer>
        </div>
      </section>
    </div>
  );
}
