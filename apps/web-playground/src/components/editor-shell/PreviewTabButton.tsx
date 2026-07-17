import type { PreviewTab } from "./types";

export interface PreviewTabButtonProps {
  label: string;
  value: PreviewTab;
  activeTab: PreviewTab;
  onSelect: (value: PreviewTab) => void;
}

export function PreviewTabButton({ label, value, activeTab, onSelect }: PreviewTabButtonProps) {
  return (
    <button className={activeTab === value ? "tab active" : "tab"} type="button" onClick={() => onSelect(value)}>
      {label}
    </button>
  );
}
