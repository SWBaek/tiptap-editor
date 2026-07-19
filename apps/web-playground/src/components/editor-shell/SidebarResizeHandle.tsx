import { useEffect, useRef } from "react";
import { MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, clampSidebarWidth } from "./sidebarPreferences";

export interface SidebarResizeHandleProps {
  width: number;
  onWidthChange: (width: number) => void;
}

export function SidebarResizeHandle({ width, onWidthChange }: SidebarResizeHandleProps) {
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => dragCleanupRef.current?.(), []);

  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handlePointerMove = (moveEvent: PointerEvent) => {
      onWidthChange(clampSidebarWidth(startWidth + moveEvent.clientX - startX));
    };
    const stopResize = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      dragCleanupRef.current = null;
    };

    dragCleanupRef.current?.();
    dragCleanupRef.current = stopResize;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
  }

  return (
    <div
      className="sidebar-resize-handle"
      role="separator"
      aria-label="Resize sidebar"
      aria-orientation="vertical"
      aria-valuemin={MIN_SIDEBAR_WIDTH}
      aria-valuemax={MAX_SIDEBAR_WIDTH}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={startResize}
      onDoubleClick={() => onWidthChange(260)}
      onKeyDown={(event) => {
        const increment = event.shiftKey ? 25 : 10;
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onWidthChange(clampSidebarWidth(width - increment));
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          onWidthChange(clampSidebarWidth(width + increment));
        } else if (event.key === "Home") {
          event.preventDefault();
          onWidthChange(MIN_SIDEBAR_WIDTH);
        } else if (event.key === "End") {
          event.preventDefault();
          onWidthChange(MAX_SIDEBAR_WIDTH);
        }
      }}
    />
  );
}
