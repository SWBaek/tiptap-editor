import { useState } from "react";
import type { DataGridDiagnostics, DataGridRowDiffEvent } from "@sdoc/format";
import {
  createDataGridRowPayloadPreview,
  type DataGridRowReviewItem,
  type DataGridRowReviewModel
} from "../../documentState";
import { ExportAction, type ExportFilenames } from "./ExportPanel";

export type DerivedOutputName = "plain.md" | "chunks.jsonl" | "outline.json" | "references.json";

const DERIVED_OUTPUT_NAMES: DerivedOutputName[] = ["plain.md", "chunks.jsonl", "outline.json", "references.json"];

export interface DeveloperPanelProps {
  filenames: ExportFilenames;
  derivedOutputs: Record<DerivedOutputName, string>;
  dataGridDiagnostics: DataGridDiagnostics;
  dataGridRowReview: DataGridRowReviewModel;
  onAcceptDataGridRowEvent: (item: DataGridRowReviewItem, event: DataGridRowDiffEvent) => void;
  onRejectDataGridRowEvent: (item: DataGridRowReviewItem, event: DataGridRowDiffEvent) => void;
  onRejectDataGridRowEventAsRevision: (item: DataGridRowReviewItem, event: DataGridRowDiffEvent) => void;
  onExportSdoc: () => void;
  onExportJson: () => void;
  onExportDerived: (name: DerivedOutputName) => void;
  onCopyDeveloperCommand: (command: string) => void;
}

export function DeveloperPanel({
  filenames,
  derivedOutputs,
  dataGridDiagnostics,
  dataGridRowReview,
  onAcceptDataGridRowEvent,
  onRejectDataGridRowEvent,
  onRejectDataGridRowEventAsRevision,
  onExportSdoc,
  onExportJson,
  onExportDerived,
  onCopyDeveloperCommand
}: DeveloperPanelProps) {
  const pdfCommand = `npm run sdoc -- export ${quoteCliPath(filenames.sdoc)} --format pdf -o ${quoteCliPath(filenames.pdf)}`;
  const pptxCommand = `npm run sdoc -- export ${quoteCliPath(filenames.sdoc)} --format pptx -o ${quoteCliPath(filenames.pptx)}`;
  const [expandedRowReviewGrids, setExpandedRowReviewGrids] = useState<Set<string>>(new Set());
  const [rowReviewQuery, setRowReviewQuery] = useState("");
  const normalizedRowReviewQuery = rowReviewQuery.trim().toLowerCase();

  function toggleRowReviewGrid(gridId: string) {
    setExpandedRowReviewGrids((current) => {
      const next = new Set(current);
      if (next.has(gridId)) {
        next.delete(gridId);
      } else {
        next.add(gridId);
      }
      return next;
    });
  }

  return (
    <div className="side-panel-section export-panel">
      <section className="export-section" aria-label="Portable document exports">
        <h3>Document</h3>
        <ExportAction
          label="Export .sdoc"
          filename={filenames.sdoc}
          description="Portable single-file container with document, metadata, assets, and derived AI outputs."
          onClick={onExportSdoc}
        />
        <ExportAction label="Export document.json" filename={filenames.json} description="Canonical semantic document JSON for debugging and tooling." onClick={onExportJson} />
      </section>

      <section className="export-section" aria-label="Data grid diagnostics">
        <h3>Data grids</h3>
        <div className="data-grid-diagnostic-summary">
          <div>
            <span>Grids</span>
            <strong>{dataGridDiagnostics.gridCount}</strong>
          </div>
          <div>
            <span>Errors</span>
            <strong className={dataGridDiagnostics.errorCount > 0 ? "error" : "ok"}>{dataGridDiagnostics.errorCount}</strong>
          </div>
          <div>
            <span>Warnings</span>
            <strong className={dataGridDiagnostics.warningCount > 0 ? "warning" : "ok"}>{dataGridDiagnostics.warningCount}</strong>
          </div>
        </div>
        {dataGridDiagnostics.summaries.length === 0 ? (
          <p className="data-grid-diagnostic-empty">No asset-backed data grids</p>
        ) : (
          <ul className="data-grid-diagnostic-list">
            {dataGridDiagnostics.summaries.map((summary) => (
              <li key={summary.gridId}>
                <div>
                  <strong>{summary.title}</strong>
                  <span>
                    {summary.format.toUpperCase()} · {summary.rowCount} rows · {summary.columnCount} columns
                  </span>
                  <code>{summary.sourceAssetId}</code>
                </div>
                {summary.issues.length === 0 ? (
                  <small className="ok">Rows valid</small>
                ) : (
                  <ul>
                    {summary.issues.slice(0, 4).map((issue, index) => (
                      <li className={issue.severity} key={`${summary.gridId}-${index}`}>
                        <span>{issue.severity}</span>
                        <p>
                          {issue.row ? `Row ${issue.row}: ` : ""}
                          {issue.message}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="data-grid-row-review" aria-label="Data grid row review readiness">
          <div className="data-grid-row-review-heading">
            <strong>Row review</strong>
            <span>{dataGridRowReview.label}</span>
          </div>
          {dataGridRowReview.eventCount > 0 && (
            <label className="data-grid-row-event-search">
              <span>Filter row events</span>
              <input
                type="search"
                value={rowReviewQuery}
                placeholder="row, column, kind, message"
                onChange={(event) => setRowReviewQuery(event.currentTarget.value)}
              />
            </label>
          )}
          {dataGridRowReview.items.length === 0 ? (
            <p className="data-grid-diagnostic-empty">No row-review candidates</p>
          ) : (
            <ul className="data-grid-row-review-list">
              {dataGridRowReview.items.map((item) => {
                const filteredEvents =
                  item.status === "ready" && normalizedRowReviewQuery
                    ? item.events.filter((event) => dataGridRowEventMatchesQuery(event, item, normalizedRowReviewQuery))
                    : item.events;
                const visibleEvents = expandedRowReviewGrids.has(item.gridId) ? filteredEvents : filteredEvents.slice(0, 3);

                return (
                  <li key={item.gridId} className={item.status}>
                    <div>
                      <strong>{item.title}</strong>
                      <span>
                        {normalizedRowReviewQuery && item.status === "ready"
                          ? `${filteredEvents.length} of ${item.events.length} row event${item.events.length === 1 ? "" : "s"} matched`
                          : item.label}
                      </span>
                      <small>{item.detail}</small>
                    </div>
                    <code>{item.sourceAssetId}</code>
                    {item.status === "ready" && item.events.length > 0 && (
                      <>
                        {filteredEvents.length === 0 ? (
                          <p className="data-grid-row-event-empty">No row events match this filter</p>
                        ) : (
                          <ul className="data-grid-row-event-list">
                            {visibleEvents.map((event, index) => (
                              <li key={`${item.gridId}-${index}-${event.kind}-${event.rowKey ?? "row"}`}>
                                <div className="data-grid-row-event-detail">
                                  <span>{event.message}</span>
                                  <div className="data-grid-row-event-meta">
                                    <small>{event.kind}</small>
                                    {event.rowKey && <small>Row {event.rowKey}</small>}
                                    {event.column && <small>{event.column}</small>}
                                  </div>
                                  <div className="data-grid-row-cell-review" aria-label="Row event cell review">
                                    <div>
                                      <strong>Before</strong>
                                      <code>{formatDataGridRowEventValue(event.oldValue, event.kind === "row-added" ? "(new row)" : "(empty)")}</code>
                                    </div>
                                    <div>
                                      <strong>After</strong>
                                      <code>{formatDataGridRowEventValue(event.newValue, event.kind === "row-deleted" ? "(deleted row)" : "(empty)")}</code>
                                    </div>
                                  </div>
                                  <RowPayloadPreview event={event} />
                                </div>
                                <div className="data-grid-row-event-actions">
                                  <button className="accept" type="button" onClick={() => onAcceptDataGridRowEvent(item, event)}>
                                    Accept
                                  </button>
                                  <button className="reject" type="button" onClick={() => onRejectDataGridRowEvent(item, event)}>
                                    Reject
                                  </button>
                                  <button className="revision" type="button" onClick={() => onRejectDataGridRowEventAsRevision(item, event)}>
                                    Revision
                                  </button>
                                </div>
                              </li>
                            ))}
                            {filteredEvents.length > 3 && (
                              <li className="data-grid-row-event-toggle">
                                <span>
                                  {expandedRowReviewGrids.has(item.gridId)
                                    ? `Showing all ${filteredEvents.length} row events`
                                    : `${filteredEvents.length - 3} more row event${filteredEvents.length - 3 === 1 ? "" : "s"} hidden`}
                                </span>
                                <button type="button" onClick={() => toggleRowReviewGrid(item.gridId)}>
                                  {expandedRowReviewGrids.has(item.gridId) ? "Show less" : "Show all"}
                                </button>
                              </li>
                            )}
                          </ul>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="export-section" aria-label="PDF publishing boundary">
        <h3>PDF</h3>
        <div className="workspace-boundary">
          <strong>CLI/Tauri PDF</strong>
          <span>Save .sdoc first, then generate PDF through the CLI print pipeline; the browser exports print-ready HTML today.</span>
        </div>
        <ExportAction
          label="Copy PDF CLI command"
          filename={filenames.pdf}
          description="Generates from the saved .sdoc file with Playwright/Chromium print emulation."
          onClick={() => onCopyDeveloperCommand(pdfCommand)}
        />
      </section>

      <section className="export-section" aria-label="Slide export boundary">
        <h3>Slides</h3>
        <div className="workspace-boundary">
          <strong>CLI/Tauri PPTX</strong>
          <span>Save .sdoc first, then generate editable PPTX through the CLI; browser PPTX download is deferred until fidelity and bundle size are proven.</span>
        </div>
        <ExportAction
          label="Copy PPTX CLI command"
          filename={filenames.pptx}
          description="Generates editable native slides from heading sections in canonical document.json."
          onClick={() => onCopyDeveloperCommand(pptxCommand)}
        />
      </section>

      <section className="export-section" aria-label="AI/RAG exports">
        <h3>AI/RAG</h3>
        {DERIVED_OUTPUT_NAMES.map((name) => (
          <ExportAction
            key={name}
            label={`Export ${name}`}
            filename={name}
            description={getDerivedOutputDescription(name)}
            detail={formatBytes(derivedOutputs[name])}
            onClick={() => onExportDerived(name)}
          />
        ))}
      </section>
    </div>
  );
}

function RowPayloadPreview({ event }: { event: DataGridRowDiffEvent }) {
  const preview = createDataGridRowPayloadPreview(event);
  if (preview.totalCount === 0) {
    return null;
  }

  return (
    <div className="data-grid-row-payload-preview" aria-label="Row payload preview">
      <dl>
        {preview.entries.map(([column, value]) => (
          <div key={column}>
            <dt>{column}</dt>
            <dd>{formatDataGridRowEventValue(value, "(empty)")}</dd>
          </div>
        ))}
      </dl>
      {preview.hiddenCount > 0 && (
        <span className="data-grid-row-payload-overflow">
          {preview.hiddenCount} more column{preview.hiddenCount === 1 ? "" : "s"} hidden from preview
        </span>
      )}
    </div>
  );
}

function getDerivedOutputDescription(name: DerivedOutputName): string {
  switch (name) {
    case "plain.md":
      return "LLM-friendly Markdown generated from the canonical document.";
    case "chunks.jsonl":
      return "Block-level JSONL chunks for RAG indexing.";
    case "outline.json":
      return "Heading outline with stable IDs and anchors.";
    case "references.json":
      return "Reference targets for headings, figures, tables, equations, and diagrams.";
  }
}

function formatBytes(value: string): string {
  const bytes = new TextEncoder().encode(value).byteLength;
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
}

function dataGridRowEventMatchesQuery(event: DataGridRowDiffEvent, item: DataGridRowReviewItem, query: string): boolean {
  const payloadValues = createDataGridRowPayloadPreview(event, Number.MAX_SAFE_INTEGER).entries.flat();
  return [
    item.title,
    item.sourceAssetId,
    event.kind,
    event.message,
    event.rowKey ?? "",
    event.column ?? "",
    event.oldValue ?? "",
    event.newValue ?? "",
    ...payloadValues
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function formatDataGridRowEventValue(value: string | undefined, fallback: string): string {
  return value === undefined || value.length === 0 ? fallback : value;
}

function quoteCliPath(value: string): string {
  return `"${value.replaceAll('"', '\\"')}"`;
}
