import "./FloatingWindow.css";
import { useEffect, useRef, type ReactNode } from "react";
import { useDarklighter, type WindowId } from "@/state/store";
import { clamp } from "@/lib/math";

/**
 * A draggable, closeable floating panel. Position is held in the store (so
 * it persists while a window is toggled); until the user drags it the first
 * time, the host-provided `defaultPos` is used. Ported from the reference
 * app (src/components/Windows/FloatingWindow.tsx, PLAN.md §4 "PORT").
 */
export function FloatingWindow({
  id,
  title,
  icon,
  children,
  width = 320,
  defaultPos,
  bounds,
}: {
  id: WindowId;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  width?: number;
  defaultPos: { x: number; y: number };
  bounds: { w: number; h: number };
}) {
  const win = useDarklighter((s) => s.windows[id]);
  const move = useDarklighter((s) => s.moveWindow);
  const resize = useDarklighter((s) => s.resizeWindow);
  const focus = useDarklighter((s) => s.focusWindow);
  const close = useDarklighter((s) => s.closeWindow);

  const x = win.x ?? defaultPos.x;
  const y = win.y ?? defaultPos.y;
  const w = win.w ?? width;

  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const sizeDrag = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (drag.current) {
        const nx = clamp(e.clientX - drag.current.dx, 0, Math.max(0, bounds.w - 60));
        const ny = clamp(e.clientY - drag.current.dy, 0, Math.max(0, bounds.h - 36));
        move(id, nx, ny);
      } else if (sizeDrag.current) {
        const maxW = window.innerWidth * 0.9;
        const maxH = window.innerHeight * 0.9;
        const nw = clamp(sizeDrag.current.w + (e.clientX - sizeDrag.current.x), 240, maxW);
        const nh = clamp(sizeDrag.current.h + (e.clientY - sizeDrag.current.y), 200, maxH);
        resize(id, nw, nh);
      }
    };
    const onUp = () => {
      drag.current = null;
      sizeDrag.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [id, move, resize, bounds.w, bounds.h]);

  return (
    <div
      className="fwin"
      style={{ left: x, top: y, width: w, height: win.h ?? undefined, zIndex: 10 + win.z }}
      onMouseDown={() => focus(id)}
    >
      <div
        className="fwin-head"
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest(".fwin-x")) return;
          drag.current = { dx: e.clientX - x, dy: e.clientY - y };
          focus(id);
        }}
      >
        {icon && <span className="fwin-icon">{icon}</span>}
        <span className="fwin-title">{title}</span>
        <button className="fwin-x" title="Close" onClick={() => close(id)}>
          ✕
        </button>
      </div>
      <div className="fwin-body">{children}</div>
      <span
        className="fwin-resize"
        title="Resize"
        onMouseDown={(e) => {
          e.stopPropagation();
          const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
          sizeDrag.current = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height };
          focus(id);
        }}
      />
    </div>
  );
}
