import { CursorHistoryControl } from "./CursorHistoryControl";
import { ZoomControl } from "./ZoomControl";

export interface StatusBarProps {
  fileLabel: string;
  savedLabel: string;
  isValid: boolean;
  issueCount: number;
  statusMessage: string;
  wordCount: number;
  blockCount: number;
  zoom: number;
  canGoBack: boolean;
  canGoForward: boolean;
  onZoomChange: (zoom: number) => void;
  onGoBack: () => void;
  onGoForward: () => void;
}

export function StatusBar({
  fileLabel,
  savedLabel,
  isValid,
  issueCount,
  statusMessage,
  wordCount,
  blockCount,
  zoom,
  canGoBack,
  canGoForward,
  onZoomChange,
  onGoBack,
  onGoForward
}: StatusBarProps) {
  return (
    <footer className="workbench-status-bar" role="contentinfo" aria-label="Workbench status">
      <div className="workbench-status-document" title={fileLabel}>
        <span>{fileLabel}</span>
        <strong className={savedLabel === "Unsaved" ? "unsaved" : ""}>{savedLabel}</strong>
        <span className={isValid ? "healthy" : "attention"}>
          {isValid ? "Document healthy" : `${issueCount} issue${issueCount === 1 ? "" : "s"}`}
        </span>
      </div>
      <div className="status-note workbench-status-message" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </div>
      <div className="workbench-status-tools">
        <span>{wordCount} words</span>
        <span>{blockCount} blocks</span>
        <CursorHistoryControl canGoBack={canGoBack} canGoForward={canGoForward} onGoBack={onGoBack} onGoForward={onGoForward} />
        <ZoomControl zoom={zoom} onZoomChange={onZoomChange} />
      </div>
    </footer>
  );
}
