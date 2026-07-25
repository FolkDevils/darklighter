/**
 * Global editor shortcuts (PLAN.md §6). Every branch goes through a store
 * action, so undo/redo and the future AI edit log stay correct (invariant
 * #3 — store actions are the only mutators). Marquee/⌘-click multi-select
 * and the richer selection UX arrive in Phase 3.
 *
 * ⌘Z/⇧⌘Z undo · ⌘D duplicate · ⌘G group · ⇧⌘G ungroup · ⌫ delete ·
 * arrows nudge (⇧ = ×10) · Space play/pause · R replay ·
 * ↩ step into a group · esc step back out · ⇧⌘C copy the selection as SVG
 */
import { useEffect } from "react";
import { useDarklighter } from "@/state/store";
import { findNode } from "@/lib/nodeTree";
import { copySvgMarkup } from "@/lib/svg/export";

const NUDGE = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as const;

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

      const s = useDarklighter.getState();
      const selectedId = s.selection[s.selection.length - 1];
      const meta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (meta && key === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (meta && key === "d" && selectedId) {
        e.preventDefault();
        s.duplicateNode(selectedId);
        return;
      }
      // Copy what you're looking at: animated while playing, the resting frame
      // while paused. Explicit animated/static buttons live in the Export panel.
      if (meta && e.shiftKey && key === "c" && selectedId) {
        const node = findNode(s.nodes, selectedId)?.node;
        if (node) {
          e.preventDefault();
          void copySvgMarkup({ scope: "node", node }, { animated: s.playing });
        }
        return;
      }
      if (meta && key === "g" && selectedId) {
        e.preventDefault();
        if (e.shiftKey) s.ungroupSelection();
        else s.groupSelection();
        return;
      }
      if (key === " ") {
        e.preventDefault();
        s.setPlaying(!s.playing);
        return;
      }
      if (key === "r" && !meta) {
        e.preventDefault();
        s.replay();
        return;
      }
      // Step out of / into a group, so the whole nesting model is reachable
      // from the keyboard rather than only by double-clicking the right pixel.
      if (e.key === "Escape") {
        e.preventDefault();
        s.select(s.selection.slice(0, -1));
        return;
      }
      if (e.key === "Enter" && selectedId) {
        const loc = findNode(s.nodes, selectedId);
        const first = loc?.node.children.find((c) => !c.hidden && !c.locked);
        if (first) {
          e.preventDefault();
          s.select([...(loc?.path ?? [selectedId]), first.id]);
        }
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        s.removeNode(selectedId);
        return;
      }
      if (e.key in NUDGE && selectedId) {
        const loc = findNode(s.nodes, selectedId);
        if (!loc) return;
        e.preventDefault();
        const [dx, dy] = NUDGE[e.key as keyof typeof NUDGE];
        const step = e.shiftKey ? 10 : 1;
        s.patchLayout(selectedId, {
          x: loc.node.layout.x + dx * step,
          y: loc.node.layout.y + dy * step,
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
