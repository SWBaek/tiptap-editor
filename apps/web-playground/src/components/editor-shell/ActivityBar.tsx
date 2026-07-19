import {
  Braces,
  FolderOpen,
  List,
  Settings,
  Workflow
} from "lucide-react";
import type { ReactNode } from "react";
import type { ActivityPanel } from "./types";

export interface ActivityBarProps {
  activePanel: ActivityPanel;
  isOpen: boolean;
  filesLabel: "Explorer" | "Documents";
  showDeveloperTools: boolean;
  onSelect: (panel: ActivityPanel) => void;
}

export function ActivityBar({ activePanel, isOpen, filesLabel, showDeveloperTools, onSelect }: ActivityBarProps) {
  return (
    <nav className="activity-bar" aria-label="Primary">
      <ActivityButton active={activePanel === "files" && isOpen} label={filesLabel} shortcut="Ctrl+Shift+E" onClick={() => onSelect("files")}>
        <FolderOpen size={20} />
      </ActivityButton>
      <ActivityButton active={activePanel === "outline" && isOpen} label="Outline" onClick={() => onSelect("outline")}>
        <List size={20} />
      </ActivityButton>
      <ActivityButton active={activePanel === "review" && isOpen} label="Review" onClick={() => onSelect("review")}>
        <Workflow size={20} />
      </ActivityButton>
      <div className="activity-spacer" />
      {showDeveloperTools && (
        <ActivityButton active={activePanel === "developer" && isOpen} label="Developer" onClick={() => onSelect("developer")}>
          <Braces size={20} />
        </ActivityButton>
      )}
      <ActivityButton active={activePanel === "settings" && isOpen} label="Settings" onClick={() => onSelect("settings")}>
        <Settings size={20} />
      </ActivityButton>
    </nav>
  );
}

interface ActivityButtonProps {
  active: boolean;
  label: string;
  shortcut?: string;
  onClick: () => void;
  children: ReactNode;
}

function ActivityButton({ active, label, shortcut, onClick, children }: ActivityButtonProps) {
  return (
    <button
      className={active ? "activity-button active" : "activity-button"}
      type="button"
      aria-label={`${label} panel`}
      aria-pressed={active}
      title={`${label} panel${shortcut ? ` (${shortcut})` : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
