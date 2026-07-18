import { ArrowLeft, ArrowRight } from "lucide-react";

export interface CursorHistoryControlProps {
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
}

export function CursorHistoryControl({ canGoBack, canGoForward, onGoBack, onGoForward }: CursorHistoryControlProps) {
  return (
    <div className="cursor-history-control" aria-label="Cursor history controls">
      <button type="button" aria-label="Previous cursor position" title="Previous cursor position (Alt+Left)" disabled={!canGoBack} onClick={onGoBack}>
        <ArrowLeft size={15} />
      </button>
      <button type="button" aria-label="Next cursor position" title="Next cursor position (Alt+Right)" disabled={!canGoForward} onClick={onGoForward}>
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
