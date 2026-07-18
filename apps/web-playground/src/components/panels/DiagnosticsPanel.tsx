import { useState } from "react";
import { AlertTriangle, Info, Link2, Search } from "lucide-react";
import type { ReferenceDiagnosticsModel, ReferenceTargetSummary, RequirementTraceabilityModel } from "../../documentState";

export interface DiagnosticsPanelProps {
  diagnostics: ReferenceDiagnosticsModel;
  traceability: RequirementTraceabilityModel;
  highlightedNodeId: string | null;
  onInsertReference: (targetId: string) => void;
  onRevealNode: (nodeId: string, label: string) => void;
  onRetargetReference: (referenceId: string, targetId: string) => void;
  onRemoveReference: (referenceId: string) => void;
  onUpdateReferenceLabel: (referenceId: string) => void;
  onSetSelectedTag: () => void;
  onClearSelectedTag: () => void;
}

export function DiagnosticsPanel({
  diagnostics,
  traceability,
  highlightedNodeId,
  onInsertReference,
  onRevealNode,
  onRetargetReference,
  onRemoveReference,
  onUpdateReferenceLabel,
  onSetSelectedTag,
  onClearSelectedTag
}: DiagnosticsPanelProps) {
  return (
    <div className="side-panel-section diagnostics-panel">
      <section className="diagnostics-summary" aria-label="Document health summary">
        <h3>Document Health</h3>
        <div>
          <span>References</span>
          <strong>{diagnostics.label}</strong>
        </div>
        <div>
          <span>Traceability</span>
          <strong>{traceability.label}</strong>
        </div>
      </section>
      <ReferencePanel
        diagnostics={diagnostics}
        highlightedNodeId={highlightedNodeId}
        onInsertReference={onInsertReference}
        onRevealNode={onRevealNode}
        onRetargetReference={onRetargetReference}
        onRemoveReference={onRemoveReference}
        onUpdateReferenceLabel={onUpdateReferenceLabel}
      />
      <TraceabilityPanel
        traceability={traceability}
        highlightedNodeId={highlightedNodeId}
        onSetSelectedTag={onSetSelectedTag}
        onClearSelectedTag={onClearSelectedTag}
        onRevealNode={onRevealNode}
      />
    </div>
  );
}

interface TraceabilityPanelProps {
  traceability: RequirementTraceabilityModel;
  highlightedNodeId: string | null;
  onSetSelectedTag: () => void;
  onClearSelectedTag: () => void;
  onRevealNode: (nodeId: string, label: string) => void;
}

function TraceabilityPanel({
  traceability,
  highlightedNodeId,
  onSetSelectedTag,
  onClearSelectedTag,
  onRevealNode
}: TraceabilityPanelProps) {
  return (
    <div className="traceability-panel">
      <div className="traceability-summary" aria-label="Requirement traceability summary">
        <div>
          <span>Tagged</span>
          <strong>{traceability.taggedCount}</strong>
        </div>
        <div>
          <span>Duplicates</span>
          <strong className={traceability.duplicateCount > 0 ? "warning" : "ok"}>{traceability.duplicateCount}</strong>
        </div>
        <div>
          <span>Format</span>
          <strong className={traceability.formatIssueCount > 0 ? "warning" : "ok"}>{traceability.formatIssueCount}</strong>
        </div>
        <div>
          <span>Gaps</span>
          <strong className={traceability.coverageGapCount > 0 ? "warning" : "ok"}>{traceability.coverageGapCount}</strong>
        </div>
      </div>

      <div className="traceability-actions">
        <button type="button" onClick={onSetSelectedTag}>
          Set selected ID
        </button>
        <button type="button" onClick={onClearSelectedTag}>
          Clear selected ID
        </button>
      </div>

      {traceability.duplicateHumanIds.length > 0 && (
        <section className="traceability-section">
          <h3>Duplicate IDs</h3>
          <ul className="traceability-issue-list">
            {traceability.duplicateHumanIds.map((issue) => (
              <li key={issue.humanId}>
                <strong>{issue.humanId}</strong>
                <span>{issue.message}</span>
                <div className="traceability-block-links">
                  {issue.blocks.map((block) => (
                    <button type="button" key={block.id} onClick={() => onRevealNode(block.id, `${block.humanId} ${block.label}`)}>
                      {block.id}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {traceability.formatIssues.length > 0 && (
        <section className="traceability-section">
          <h3>Format warnings</h3>
          <ul className="traceability-issue-list">
            {traceability.formatIssues.map((issue) => (
              <li key={issue.humanId}>
                <strong>{issue.humanId}</strong>
                <span>{issue.message}</span>
                <div className="traceability-block-links">
                  {issue.blocks.map((block) => (
                    <button type="button" key={block.id} onClick={() => onRevealNode(block.id, `${block.humanId} ${block.label}`)}>
                      {block.id}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {traceability.coverageGaps.length > 0 && (
        <section className="traceability-section">
          <h3>Heading gaps</h3>
          <ul className="traceability-gap-list">
            {traceability.coverageGaps.map((gap) => (
              <li className={highlightedNodeId === gap.id ? "selected" : undefined} key={gap.id}>
                <div>
                  <strong>{gap.label}</strong>
                  <code>{gap.id}</code>
                </div>
                <button type="button" onClick={() => onRevealNode(gap.id, `heading ${gap.label}`)}>
                  Show
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="traceability-section">
        <h3>Tagged blocks</h3>
        {traceability.taggedBlocks.length === 0 ? (
          <p className="traceability-empty">No requirement IDs</p>
        ) : (
          <ul className="traceability-tag-list">
            {traceability.taggedBlocks.map((block) => (
              <li className={highlightedNodeId === block.id ? "selected" : undefined} key={`${block.humanId}-${block.id}`}>
                <span>{block.type}</span>
                <strong>{block.humanId}</strong>
                <small>{block.label}</small>
                <code>{block.id}</code>
                <button type="button" onClick={() => onRevealNode(block.id, `${block.humanId} ${block.label}`)}>
                  Show
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface ReferencePanelProps {
  diagnostics: ReferenceDiagnosticsModel;
  highlightedNodeId: string | null;
  onInsertReference: (targetId: string) => void;
  onRevealNode: (nodeId: string, label: string) => void;
  onRetargetReference: (referenceId: string, targetId: string) => void;
  onRemoveReference: (referenceId: string) => void;
  onUpdateReferenceLabel: (referenceId: string) => void;
}

function ReferencePanel({
  diagnostics,
  highlightedNodeId,
  onInsertReference,
  onRevealNode,
  onRetargetReference,
  onRemoveReference,
  onUpdateReferenceLabel
}: ReferencePanelProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTargets =
    normalizedQuery.length === 0 ? diagnostics.targets : diagnostics.targets.filter((target) => targetMatchesReferenceQuery(target, normalizedQuery));

  return (
    <div className="reference-panel">
      <div className="reference-summary" aria-label="Reference summary">
        <div>
          <span>Targets</span>
          <strong>{diagnostics.targetCount}</strong>
        </div>
        <div>
          <span>References</span>
          <strong>{diagnostics.referenceCount}</strong>
        </div>
        <div>
          <span>Broken</span>
          <strong className={diagnostics.brokenCount > 0 ? "error" : "ok"}>{diagnostics.brokenCount}</strong>
        </div>
        <div>
          <span>Stale</span>
          <strong className={diagnostics.staleCount > 0 ? "warning" : "ok"}>{diagnostics.staleCount}</strong>
        </div>
      </div>

      {diagnostics.brokenReferences.length === 0 && diagnostics.staleReferences.length === 0 ? (
        <div className="reference-empty">
          <Link2 size={22} />
          <span>All references resolve</span>
        </div>
      ) : diagnostics.brokenReferences.length > 0 ? (
        <section className="reference-section">
          <h3>Broken references</h3>
          <ul className="reference-issue-list">
            {diagnostics.brokenReferences.map((reference) => (
              <li className={highlightedNodeId === reference.id ? "selected" : undefined} key={`${reference.path}-${reference.id}`}>
                <AlertTriangle size={16} />
                <div>
                  <strong>{reference.label}</strong>
                  <span>
                    {reference.id} targets missing block {reference.targetId}
                  </span>
                </div>
                <button type="button" onClick={() => onRevealNode(reference.id, `reference ${reference.label}`)}>
                  Show
                </button>
                <div className="reference-repair-actions">
                  {reference.repairCandidates.map((candidate) => (
                    <button type="button" key={`${reference.id}-${candidate.targetId}`} onClick={() => onRetargetReference(reference.id, candidate.targetId)}>
                      <span>Retarget</span>
                      <strong>{candidate.label}</strong>
                      <small>{candidate.detail}</small>
                    </button>
                  ))}
                  <button className="reference-remove" type="button" onClick={() => onRemoveReference(reference.id)}>
                    Remove reference
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {diagnostics.staleReferences.length > 0 && (
        <section className="reference-section">
          <h3>Stale labels</h3>
          <ul className="reference-stale-list">
            {diagnostics.staleReferences.map((reference) => (
              <li className={highlightedNodeId === reference.id ? "selected" : undefined} key={`${reference.path}-${reference.id}`}>
                <Info size={16} />
                <div>
                  <strong>{reference.label}</strong>
                  <span>Target label is {reference.targetLabel}</span>
                </div>
                <div className="reference-stale-actions">
                  <button type="button" onClick={() => onRevealNode(reference.id, `reference ${reference.label}`)}>
                    Show
                  </button>
                  <button type="button" aria-label={`Update label for ${reference.label}`} onClick={() => onUpdateReferenceLabel(reference.id)}>
                    Update
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="reference-section">
        <h3>Target blocks</h3>
        <label className="reference-search">
          <Search size={15} />
          <input aria-label="Filter reference targets" value={query} placeholder="Filter targets" onChange={(event) => setQuery(event.target.value)} />
        </label>
        {diagnostics.targets.length === 0 ? (
          <p className="reference-muted">No targetable blocks</p>
        ) : filteredTargets.length === 0 ? (
          <p className="reference-muted">No matching targets</p>
        ) : (
          <ul className="reference-target-list">
            {filteredTargets.map((target) => (
              <li className={highlightedNodeId === target.id ? "selected" : undefined} key={target.id}>
                <span>{target.type}</span>
                <strong>{target.label}</strong>
                <code>{[target.humanId, target.anchor ? `#${target.anchor}` : "", target.id].filter(Boolean).join(" / ")}</code>
                <div className="reference-target-actions">
                  <button type="button" onClick={() => onRevealNode(target.id, `target ${target.label}`)}>
                    Show
                  </button>
                  <button type="button" aria-label={`Insert reference to ${target.label}`} onClick={() => onInsertReference(target.id)}>
                    <Link2 size={14} />
                    <span>Insert</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function targetMatchesReferenceQuery(target: ReferenceTargetSummary, query: string): boolean {
  return [target.id, target.type, target.label, target.anchor ?? "", target.humanId ?? ""].some((value) => value.toLowerCase().includes(query));
}
