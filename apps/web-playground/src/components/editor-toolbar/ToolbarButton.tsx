import type { MouseEvent, ReactNode } from "react";

export interface ToolbarButtonProps {
  title: string;
  active?: boolean;
  onClick: () => void;
  onMouseDown?: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}

export function ToolbarButton({ title, active = false, onClick, onMouseDown, children }: ToolbarButtonProps) {
  return (
    <button className={active ? "tool-button active" : "tool-button"} title={title} aria-label={title} type="button" onMouseDown={onMouseDown} onClick={onClick}>
      {children}
    </button>
  );
}
