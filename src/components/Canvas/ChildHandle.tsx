/**
 * Drag/resize handle for a node nested inside a canvas root.
 *
 * `RenderNode` composes the tree as plain positioned divs, so a nested part
 * has no interaction surface of its own. Rather than wrapping every level of
 * every tree in react-rnd (which would leak editor chrome into thumbnails and
 * exports), the canvas overlays one handle on whichever nested node is
 * selected. Its box is computed from the model — the sum of the layout offsets
 * between the root and the node — so it can never drift from what's drawn.
 *
 * Slot content is deliberately not draggable: a slot's position is the host's
 * `SlotDef.frame` (types.ts), not the child's layout.
 */
import { Rnd } from "react-rnd";
import type { ComponentNode } from "@/components-model/types";
import { componentDef } from "@/components-model/registry";
import { findNode, nodeChain } from "@/lib/nodeTree";
import { useDarklighter } from "@/state/store";

const CORNERS = {
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
 * Where a nested node sits inside its canvas root, in root-local px. Walks
 * the chain adding each step's own offset — or its slot frame's, for slot
 * content, which is positioned by the host.
 */
function offsetWithinRoot(roots: ComponentNode[], id: string): { x: number; y: number } | null {
  const chain = nodeChain(roots, id);
  if (chain.length < 2) return null;
  let x = 0;
  let y = 0;
  for (let i = 1; i < chain.length; i++) {
    const parent = chain[i - 1];
    const node = chain[i];
    const slotName = parent.slots
      ? Object.entries(parent.slots).find(([, v]) => v?.id === node.id)?.[0]
      : undefined;
    if (slotName) {
      const frame = componentDef(parent.kind).slots?.find((sd) => sd.name === slotName)?.frame;
      x += frame?.x ?? node.layout.x;
      y += frame?.y ?? node.layout.y;
    } else {
      x += node.layout.x;
      y += node.layout.y;
    }
  }
  return { x, y };
}

export function ChildHandle({ nodeId, scale }: { nodeId: string; scale: number }) {
  const nodes = useDarklighter((s) => s.nodes);
  const patchLayout = useDarklighter((s) => s.patchLayout);
  const select = useDarklighter((s) => s.select);

  const loc = findNode(nodes, nodeId);
  const offset = offsetWithinRoot(nodes, nodeId);
  if (!loc || !offset || loc.node.hidden) return null;

  const node = loc.node;
  const inSlot = loc.ref.kind === "slot";
  const movable = !node.locked && !inSlot;

  /**
   * The handle sits on top of the art, so descending further can't go through
   * the usual event target — hit-test the point instead and keep going down.
   */
  const descend = (clientX: number, clientY: number) => {
    const under = document
      .elementsFromPoint(clientX, clientY)
      .filter((el): el is HTMLElement => el instanceof HTMLElement && el.hasAttribute("data-node-id"));
    const deepest = under.find(
      (el) => el.getAttribute("data-node-id") !== nodeId && el.closest(`[data-node-id="${nodeId}"]`),
    );
    if (!deepest) return;
    const steps: string[] = [];
    let el: HTMLElement | null = deepest;
    while (el && el.getAttribute("data-node-id") !== nodeId) {
      steps.unshift(el.getAttribute("data-node-id")!);
      el = el.parentElement?.closest("[data-node-id]") ?? null;
    }
    if (steps.length) select([...loc.path, ...steps]);
  };

  return (
    <Rnd
      className={`child-rnd${movable ? "" : " pinned"}`}
      scale={scale}
      size={{ width: node.layout.w, height: node.layout.h }}
      position={offset}
      disableDragging={!movable}
      enableResizing={movable ? CORNERS : false}
      resizeHandleWrapperStyle={{ zIndex: 4 }}
      style={{ zIndex: 3, cursor: movable ? "move" : "default" }}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        descend(e.clientX, e.clientY);
      }}
      onDragStop={(_e, d) => {
        patchLayout(node.id, {
          x: Math.round(node.layout.x + (d.x - offset.x)),
          y: Math.round(node.layout.y + (d.y - offset.y)),
        });
      }}
      onResizeStop={(_e, _dir, refEl, _delta, pos) => {
        patchLayout(node.id, {
          w: Math.round(parseFloat(refEl.style.width)),
          h: Math.round(parseFloat(refEl.style.height)),
          x: Math.round(node.layout.x + (pos.x - offset.x)),
          y: Math.round(node.layout.y + (pos.y - offset.y)),
        });
      }}
    >
      <span className="child-rnd-tag">{node.name}</span>
    </Rnd>
  );
}
