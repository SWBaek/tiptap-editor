import type {
  ChangeReviewModel,
  ReviewActionKind,
  ReviewActionPlanItem,
  ReviewBatchConflictSummary,
  SideBySideDiffRow,
  VisualDiffFilterCounts,
  VisualDiffFilterKind,
  VisualDiffOverlayItem
} from "../../documentState";

export function ReviewPanel({
  review,
  baseLabel,
  savedLabel,
  hasUnsavedChanges,
  isDiffOverlayEnabled,
  visualDiffItems,
  visualDiffCounts,
  visualDiffFilter,
  selectedVisualDiffId,
  batchSummary,
  onShowDiff,
  onCompareSavedBaseline,
  onApplyReviewAction,
  onApplyReviewBatch,
  onSelectVisualDiff,
  onSetVisualDiffFilter,
  onToggleDiffOverlay
}: {
  review: ChangeReviewModel;
  baseLabel: string;
  savedLabel: string;
  hasUnsavedChanges: boolean;
  isDiffOverlayEnabled: boolean;
  visualDiffItems: ReviewActionPlanItem[];
  visualDiffCounts: VisualDiffFilterCounts;
  visualDiffFilter: VisualDiffFilterKind;
  selectedVisualDiffId: string | null;
  batchSummary: ReviewBatchConflictSummary | null;
  onShowDiff: () => void;
  onCompareSavedBaseline: () => void;
  onApplyReviewAction: (item: ReviewActionPlanItem, action: ReviewActionKind) => void;
  onApplyReviewBatch: (action: ReviewActionKind) => void;
  onSelectVisualDiff: (item: VisualDiffOverlayItem) => void;
  onSetVisualDiffFilter: (filter: VisualDiffFilterKind) => void;
  onToggleDiffOverlay: () => void;
}) {
  const isHistoryBase = baseLabel !== "Last saved version";
  const batchableCount = visualDiffItems.filter((item) => item.kind !== "reference-broken").length;
  const filterOptions: Array<{ value: VisualDiffFilterKind; label: string; count: number }> = [
    { value: "all", label: "All", count: visualDiffCounts.total },
    { value: "added", label: "Added", count: visualDiffCounts.added },
    { value: "modified", label: "Modified", count: visualDiffCounts.modified },
    { value: "moved", label: "Moved", count: visualDiffCounts.moved },
    { value: "reference-broken", label: "Broken", count: visualDiffCounts["reference-broken"] },
    { value: "deleted", label: "Deleted", count: visualDiffCounts.deleted }
  ];

  return (
    <div className="side-panel-section review-panel">
      <div className="status-block">
        <span>Review</span>
        <strong className={hasUnsavedChanges ? "warning" : "ok"}>{review.label}</strong>
      </div>
      <div className="status-block">
        <span>Base</span>
        <strong title={baseLabel}>{baseLabel}</strong>
      </div>
      <div className="status-block">
        <span>Saved</span>
        <strong className={hasUnsavedChanges ? "warning" : undefined}>{savedLabel}</strong>
      </div>

      <div className="review-counts" aria-label="Review counts">
        <div>
          <span>Total</span>
          <strong>{review.total}</strong>
        </div>
        <div>
          <span>Document</span>
          <strong>{review.documentCount}</strong>
        </div>
        <div>
          <span>Metadata</span>
          <strong>{review.metadataCount}</strong>
        </div>
      </div>

      <button type="button" onClick={onShowDiff}>
        Show diff
      </button>
      <label className="review-toggle">
        <input type="checkbox" checked={isDiffOverlayEnabled} onChange={onToggleDiffOverlay} />
        <span>Inline overlay</span>
      </label>
      <div className="review-batch-actions" aria-label="Visible review batch actions">
        <button type="button" disabled={batchableCount === 0} onClick={() => onApplyReviewBatch("accept")}>
          Accept visible
        </button>
        <button type="button" disabled={batchableCount === 0} onClick={() => onApplyReviewBatch("reject")}>
          Reject visible
        </button>
      </div>
      {batchSummary && (
        <section className={`review-batch-result ${batchSummary.status}`} aria-label="Review batch result">
          <div>
            <strong>{batchSummary.title}</strong>
            <span>{batchSummary.detail}</span>
          </div>
          <dl>
            <div>
              <dt>Applied</dt>
              <dd>{batchSummary.appliedCount}</dd>
            </div>
            <div>
              <dt>Skipped</dt>
              <dd>{batchSummary.skippedCount}</dd>
            </div>
          </dl>
          {batchSummary.failures.length > 0 && (
            <ul>
              {batchSummary.failures.map((failure) => (
                <li key={`${failure.kind}-${failure.id}`}>
                  <span className={`review-event-kind ${failure.kind}`}>{failure.kind}</span>
                  <code>{failure.id}</code>
                  <small>{failure.reason}</small>
                  <p>{failure.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="review-events" aria-label="Semantic review events">
        <div className="review-event-filters" aria-label="Review event filters">
          {filterOptions.map((option) => (
            <button
              className={visualDiffFilter === option.value ? "active" : undefined}
              type="button"
              key={option.value}
              aria-pressed={visualDiffFilter === option.value}
              onClick={() => onSetVisualDiffFilter(option.value)}
            >
              <span>{option.label}</span>
              <strong>{option.count}</strong>
            </button>
          ))}
        </div>
        {visualDiffItems.length === 0 ? (
          <p className="review-empty">No document events</p>
        ) : (
          <ul className="review-event-list">
            {visualDiffItems.map((item) => (
              <li className={selectedVisualDiffId === item.id ? "selected" : undefined} key={`${item.kind}-${item.id}`}>
                <button className="review-event-select" type="button" onClick={() => onSelectVisualDiff(item)}>
                  <span className={`review-event-kind ${item.kind}`}>{item.label}</span>
                  <strong>{item.summary}</strong>
                  <small>{item.detail}</small>
                </button>
                <div className="review-event-actions" aria-label={`${item.summary} review actions`}>
                  {item.actions.map((action) => (
                    <button
                      type="button"
                      key={action.kind}
                      disabled={action.availability === "manual-repair" || action.availability === "unsupported"}
                      title={action.description}
                      onClick={() => onApplyReviewAction(item, action.kind)}
                    >
                      {action.kind === "accept" ? "Accept" : "Reject"}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {isHistoryBase && (
        <button type="button" onClick={onCompareSavedBaseline}>
          Use last saved version
        </button>
      )}
    </div>
  );
}
export function DiffReview({
  review,
  rawPreview,
  baseLabel,
  sideBySideRows,
  onCompareSavedBaseline
}: {
  review: ChangeReviewModel;
  rawPreview: string;
  baseLabel: string;
  sideBySideRows: SideBySideDiffRow[];
  onCompareSavedBaseline: () => void;
}) {
  return (
    <div className="diff-review">
      <div className="diff-review-base">
        <span>{baseLabel}</span>
        {baseLabel !== "Last saved version" && (
          <button type="button" onClick={onCompareSavedBaseline}>
            Last saved version
          </button>
        )}
      </div>

      <div className="diff-review-summary" aria-label="Change summary">
        <div>
          <span>Total</span>
          <strong>{review.total}</strong>
        </div>
        <div>
          <span>Document</span>
          <strong>{review.documentCount}</strong>
        </div>
        <div>
          <span>Metadata</span>
          <strong>{review.metadataCount}</strong>
        </div>
      </div>

      {review.sections.length === 0 ? (
        <div className="diff-empty">No changes</div>
      ) : (
        <div className="diff-review-body">
          {sideBySideRows.length > 0 && (
            <section className="diff-side-by-side" aria-label="Side-by-side document diff">
              <h3>Side-by-side document diff</h3>
              <div className="diff-side-by-side-header" aria-hidden="true">
                <span>Change</span>
                <span>Last saved</span>
                <span>Current</span>
              </div>
              <div className="diff-side-by-side-rows">
                {sideBySideRows.map((row) => (
                  <article className={`diff-side-by-side-row ${row.kind}`} key={`${row.kind}-${row.id}`}>
                    <div className="diff-side-change">
                      <span className={`review-event-kind ${row.kind}`}>{row.label}</span>
                      <strong>{row.nodeType}</strong>
                      <code>{row.id}</code>
                      <small>{row.detail}</small>
                    </div>
                    <pre>{row.baselineText}</pre>
                    <pre>{row.currentText}</pre>
                  </article>
                ))}
              </div>
            </section>
          )}

          <div className="diff-review-sections">
            {review.sections.map((section) => (
              <section className="diff-review-section" key={section.title}>
                <h3>{section.title}</h3>
                <ul className="diff-review-list">
                  {section.lines.map((line) => (
                    <li key={`${section.title}-${line}`}>
                      <span />
                      <p>{line}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}

      <pre className="preview-output diff-raw" aria-label="Raw diff preview">
        {rawPreview}
      </pre>
    </div>
  );
}
