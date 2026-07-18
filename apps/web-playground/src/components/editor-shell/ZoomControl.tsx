import { Minus, Plus, RotateCcw } from "lucide-react";

export const EDITOR_ZOOM_STORAGE_KEY = "sdoc-editor-zoom";
export const MIN_EDITOR_ZOOM = 60;
export const MAX_EDITOR_ZOOM = 200;
export const EDITOR_ZOOM_STEP = 10;

export interface ZoomControlProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

export function ZoomControl({ zoom, onZoomChange }: ZoomControlProps) {
  return (
    <div className="editor-zoom-control" aria-label="Editor zoom controls">
      <button type="button" aria-label="Zoom out" disabled={zoom <= MIN_EDITOR_ZOOM} onClick={() => onZoomChange(normalizeEditorZoom(zoom - EDITOR_ZOOM_STEP))}>
        <Minus size={15} />
      </button>
      <input
        type="range"
        min={MIN_EDITOR_ZOOM}
        max={MAX_EDITOR_ZOOM}
        step={EDITOR_ZOOM_STEP}
        value={zoom}
        aria-label="Editor zoom"
        onChange={(event) => onZoomChange(normalizeEditorZoom(Number(event.target.value)))}
      />
      <output aria-live="polite">{zoom}%</output>
      <button type="button" aria-label="Zoom in" disabled={zoom >= MAX_EDITOR_ZOOM} onClick={() => onZoomChange(normalizeEditorZoom(zoom + EDITOR_ZOOM_STEP))}>
        <Plus size={15} />
      </button>
      <button type="button" aria-label="Reset zoom" disabled={zoom === 100} onClick={() => onZoomChange(100)}>
        <RotateCcw size={14} />
      </button>
    </div>
  );
}

export function normalizeEditorZoom(value: number): number {
  if (!Number.isFinite(value)) {
    return 100;
  }
  const stepped = Math.round(value / EDITOR_ZOOM_STEP) * EDITOR_ZOOM_STEP;
  return Math.min(MAX_EDITOR_ZOOM, Math.max(MIN_EDITOR_ZOOM, stepped));
}

export function loadStoredEditorZoom(storage: Pick<Storage, "getItem"> | null | undefined): number {
  if (!storage) {
    return 100;
  }
  return normalizeEditorZoom(Number(storage.getItem(EDITOR_ZOOM_STORAGE_KEY) ?? 100));
}
