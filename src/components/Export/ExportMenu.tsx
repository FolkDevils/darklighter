import { useEffect, useRef, useState } from "react";
import { useDarklighter } from "@/state/store";
import { findNode } from "@/lib/nodeTree";
import type { ExportTarget } from "@/lib/svg/export";
import { ExportActions } from "./ExportActions";

/**
 * Toolbar export popover. Holds the scope choice — the selected part/group or
 * the whole canvas — and hands a target to the shared `ExportActions`. The
 * inspector renders the same component for the selection, so there is one
 * export surface to change, not two.
 */
export function ExportMenu() {
  const nodes = useDarklighter((s) => s.nodes);
  const selection = useDarklighter((s) => s.selection);
  const selected = selection.length ? findNode(nodes, selection[selection.length - 1])?.node : undefined;

  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"node" | "canvas">("node");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const effective = selected && scope === "node" ? "node" : "canvas";
  const target: ExportTarget =
    effective === "node" && selected
      ? { scope: "node", node: selected }
      : { scope: "canvas", nodes, name: "canvas" };

  return (
    <div className="exp-pop-wrap" ref={wrapRef}>
      <button
        className="btn"
        title="Export or copy as SVG, PNG or .dkl.json"
        onClick={() => setOpen((v) => !v)}
      >
        Export
      </button>
      {open && (
        <div className="exp-pop" role="dialog" aria-label="Export">
          <div className="exp-tabs">
            <button
              className={`exp-tab${effective === "node" ? " on" : ""}`}
              disabled={!selected}
              title={selected ? "Export the selected part or group" : "Nothing selected"}
              onClick={() => setScope("node")}
            >
              Selection
            </button>
            <button
              className={`exp-tab${effective === "canvas" ? " on" : ""}`}
              onClick={() => setScope("canvas")}
            >
              Canvas
            </button>
          </div>
          <ExportActions target={target} />
        </div>
      )}
    </div>
  );
}
