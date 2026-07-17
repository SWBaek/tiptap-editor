import {
  Braces,
  Download,
  FolderOpen,
  History,
  List,
  Search,
  Settings,
  Workflow
} from "lucide-react";
import type { ReactNode } from "react";
import type { ActivityPanel } from "./types";

export interface ActivityBarProps {
  activePanel: ActivityPanel;
  isOpen: boolean;
  onSelect: (panel: ActivityPanel) => void;
}

export function ActivityBar({ activePanel, isOpen, onSelect }: ActivityBarProps) {
  return (
    <nav className="activity-bar" aria-label="Primary">
      <span className="activity-group-label">Write</span>
      <ActivityButton active={activePanel === "files" && isOpen} label="Files" onClick={() => onSelect("files")}>
        <FolderOpen size={20} />
      </ActivityButton>
      <ActivityButton active={activePanel === "outline" && isOpen} label="Outline" onClick={() => onSelect("outline")}>
        <List size={20} />
      </ActivityButton>
      <ActivityButton active={activePanel === "export" && isOpen} label="Export" onClick={() => onSelect("export")}>
        <Download size={20} />
      </ActivityButton>
      <ActivityButton active={activePanel === "settings" && isOpen} label="Settings" onClick={() => onSelect("settings")}>
        <Settings size={20} />
      </ActivityButton>
      <span className="activity-group-label advanced">Review</span>
      <ActivityButton active={activePanel === "review" && isOpen} label="Review" onClick={() => onSelect("review")}>
        <Workflow size={20} />
      </ActivityButton>
      <ActivityButton active={activePanel === "diagnostics" && isOpen} label="Diagnostics" onClick={() => onSelect("diagnostics")}>
        <Search size={20} />
      </ActivityButton>
      <ActivityButton active={activePanel === "history" && isOpen} label="History" onClick={() => onSelect("history")}>
        <History size={20} />
      </ActivityButton>
      <div className="activity-spacer" />
      <ActivityButton active={activePanel === "developer" && isOpen} label="Developer" onClick={() => onSelect("developer")}>
        <Braces size={20} />
      </ActivityButton>
    </nav>
  );
}

interface ActivityButtonProps {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}

function ActivityButton({ active, label, onClick, children }: ActivityButtonProps) {
  return (
    <button
      className={active ? "activity-button active" : "activity-button"}
      type="button"
      aria-label={`${label} panel`}
      aria-pressed={active}
      title={`${label} panel`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
