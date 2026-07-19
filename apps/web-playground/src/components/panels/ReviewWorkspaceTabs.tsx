import { useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ReviewWorkspaceTab } from "../editor-shell/types";

const tabs: Array<{ id: ReviewWorkspaceTab; label: string }> = [
  { id: "changes", label: "Changes" },
  { id: "history", label: "History" },
  { id: "health", label: "Health" }
];

export function ReviewWorkspaceTabs({
  activeTab,
  changeCount,
  historyCount,
  issueCount,
  onSelect
}: {
  activeTab: ReviewWorkspaceTab;
  changeCount: number;
  historyCount: number;
  issueCount: number;
  onSelect: (tab: ReviewWorkspaceTab) => void;
}) {
  const tabRefs = useRef(new Map<ReviewWorkspaceTab, HTMLButtonElement>());
  const counts: Record<ReviewWorkspaceTab, number> = {
    changes: changeCount,
    history: historyCount,
    health: issueCount
  };

  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, tab: ReviewWorkspaceTab) {
    const index = tabs.findIndex((candidate) => candidate.id === tab);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : event.key === "ArrowRight"
          ? (index + 1) % tabs.length
          : event.key === "ArrowLeft"
            ? (index - 1 + tabs.length) % tabs.length
            : -1;
    if (nextIndex < 0) {
      return;
    }
    event.preventDefault();
    const nextTab = tabs[nextIndex].id;
    onSelect(nextTab);
    requestAnimationFrame(() => tabRefs.current.get(nextTab)?.focus());
  }

  return (
    <div className="review-workspace-tabs" role="tablist" aria-label="Review views">
      {tabs.map((tab) => (
        <button
          ref={(node) => {
            if (node) {
              tabRefs.current.set(tab.id, node);
            } else {
              tabRefs.current.delete(tab.id);
            }
          }}
          id={`review-tab-${tab.id}`}
          key={tab.id}
          type="button"
          role="tab"
          aria-label={tab.id === "health" ? "Document Health" : undefined}
          aria-selected={activeTab === tab.id}
          aria-controls={`review-panel-${tab.id}`}
          tabIndex={activeTab === tab.id ? 0 : -1}
          onClick={() => onSelect(tab.id)}
          onKeyDown={(event) => handleKeyDown(event, tab.id)}
        >
          <span>{tab.label}</span>
          {counts[tab.id] > 0 && <strong aria-label={`${counts[tab.id]} ${tab.label.toLowerCase()}`}>{counts[tab.id]}</strong>}
        </button>
      ))}
    </div>
  );
}
