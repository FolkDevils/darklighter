import "./NodeLayer.css";
import { useLayoutEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import type { ComponentNode } from "@/components-model/types";
import { RenderNode } from "@/components-model/RenderNode";
import { registerSvg } from "@/lib/svgRegistry";
import { findNode } from "@/lib/nodeTree";
import { useDarklighter } from "@/state/store";
import { ChildHandle } from "./ChildHandle";

interface Props {
  node: ComponentNode;
  scale: number;
  selected: boolean;
  /** Set when the real selection is a node nested inside this one, so it can be outlined. */
  deepSelectedId?: string;
  animate: boolean;
}

const CORNER_RESIZE = {
  top: false,
  right: false,
  bottom: false,
  left: false,
  topLeft: true,
  topRight: true,
  bottomLeft: true,
  bottomRight: true,
} as const;

/**
 * Top-level (canvas root) node wrapper: react-rnd drag/resize (PLAN.md §11
 * Phase 1 step 3) plus the Figma-style selection model from PLAN.md §5.1.
 *
 * Click selects the whole node. Double-click enters it, selecting whichever
 * nested part was actually under the pointer — read off the `data-node-id`
 * attributes `RenderNode` stamps on every level of the tree. Once inside,
 * plain clicks keep picking parts (so you can move between siblings without
 * re-entering), root dragging stands down in favour of the selected part's own
 * handle, and Escape steps back out.
 */
export function NodeLayer({ node, scale, selected, deepSelectedId, animate }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const select = useDarklighter((s) => s.select);
  const patchLayout = useDarklighter((s) => s.patchLayout);
  const inside = Boolean(deepSelectedId);

  /**
   * Ids from this root down to the deepest part under the pointer. Locked
   * parts are stepped over so they can't shield what's behind them — that's
   * what locking a backdrop is for.
   */
  const pickPath = (target: EventTarget | null): string[] => {
    const wrap = wrapRef.current;
    if (!wrap || !(target instanceof HTMLElement)) return [node.id];
    let el = target.closest("[data-node-id]") as HTMLElement | null;
    const ids: string[] = [];
    while (el && wrap.contains(el)) {
      ids.unshift(el.getAttribute("data-node-id")!);
      el = el.parentElement?.closest("[data-node-id]") ?? null;
    }
    if (ids.length === 0) return [node.id];
    const { nodes } = useDarklighter.getState();
    while (ids.length > 1 && findNode(nodes, ids[ids.length - 1])?.node.locked) ids.pop();
    return ids;
  };
  // Remounting is the only reliable way to restart a tree of SMIL timelines
  // from zero, so Replay simply bumps a nonce that keys the subtree.
  const playNonce = useDarklighter((s) => s.playNonce);
  const [hovered, setHovered] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const showChrome = selected && (hovered || interacting);

  // Keep the export registry (Phase 6) pointed at the live <svg> element;
  // re-find it whenever the rendered markup could have been replaced.
  useLayoutEffect(() => {
    const svg = wrapRef.current?.querySelector("svg") as SVGSVGElement | null;
    registerSvg(node.id, svg);
    return () => registerSvg(node.id, null);
  }, [node.id, node.children.length, node.props]);

  if (node.hidden) return null;

  return (
    <Rnd
      className={`node-rnd${selected ? " selected" : ""}${showChrome ? " chrome" : ""}`}
      scale={scale}
      size={{ width: node.layout.w, height: node.layout.h }}
      position={{ x: node.layout.x, y: node.layout.y }}
      disableDragging={node.locked || inside}
      enableResizing={showChrome && !node.locked && !inside ? CORNER_RESIZE : false}
      resizeHandleWrapperStyle={{ zIndex: 3 }}
      onMouseDown={(e) => {
        e.stopPropagation();
        // Presses that start on the nested part's own handle belong to it.
        if (e.target instanceof HTMLElement && e.target.closest(".child-rnd")) return;
        select(inside ? pickPath(e.target) : [node.id]);
      }}
      onDoubleClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        if (e.target instanceof HTMLElement && e.target.closest(".child-rnd")) return;
        select(pickPath(e.target));
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragStart={() => setInteracting(true)}
      onDragStop={(_e, d) => {
        setInteracting(false);
        patchLayout(node.id, { x: d.x, y: d.y });
      }}
      onResizeStart={() => setInteracting(true)}
      onResizeStop={(_e, _dir, refEl, _delta, pos) => {
        setInteracting(false);
        patchLayout(node.id, {
          w: parseFloat(refEl.style.width),
          h: parseFloat(refEl.style.height),
          x: pos.x,
          y: pos.y,
        });
      }}
      style={{
        cursor: node.locked ? "default" : showChrome ? "move" : "pointer",
        overflow: "visible",
        zIndex: showChrome ? 10000 : undefined,
      }}
    >
      <div
        ref={wrapRef}
        style={{
          width: "100%",
          height: "100%",
          transform: node.layout.rotation ? `rotate(${node.layout.rotation}deg)` : undefined,
        }}
      >
        <RenderNode key={`${playNonce}:${animate}`} node={node} animate={animate} selectedId={deepSelectedId} />
        {deepSelectedId && <ChildHandle nodeId={deepSelectedId} scale={scale} />}
      </div>
    </Rnd>
  );
}
