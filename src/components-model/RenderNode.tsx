/**
 * Generic recursive tree renderer — NOT a §5.3 contract file. Every
 * ComponentDef's `Render` only draws that node's OWN geometry (a
 * self-contained `<svg viewBox="0 0 w h">`); this component is what
 * actually composes the tree by nesting children/slots inside their
 * parent, each getting its own viewBox-sized box positioned via CSS from
 * `node.layout` (PLAN.md §5.1: "parent transforms don't distort child
 * stroke widths" — positions/sizes match exactly, so nothing scales).
 */
import type { ComponentNode } from "./types";
import { componentDef } from "./registry";
import { resolveAnimation } from "./animResolve";
import { resolveColor, type Surface } from "@/lib/colorway";

interface Props {
  node: ComponentNode;
  /** Global transport state — the play/pause button, not a per-node setting. */
  animate: boolean;
  /** Id of the deep-selected node, so the canvas can outline it in place. */
  selectedId?: string;
  /**
   * Light or dark page. Reverses `ink`/`field` for the whole subtree so a mark
   * stays legible when the canvas background flips (lib/colorway.ts).
   */
  surface?: Surface;
  /**
   * Timing offered by the nearest cascading ancestor, with its `enabled`
   * already reduced to "is that ancestor actually playing". Consumed only by
   * nodes whose own `animation.inherit` is true (types.ts AnimationConfig).
   */
  inherited?: ComponentNode["animation"] | null;
}

export function RenderNode({ node, animate, selectedId, inherited = null, surface = "light" }: Props) {
  if (node.hidden) return null;

  const def = componentDef(node.kind);
  const color = (role: Parameters<typeof resolveColor>[1]) => resolveColor(node.style, role, surface);

  const { effective, running, passDown } = resolveAnimation(node.animation, inherited, animate);

  const content = def.Render({ node: { ...node, animation: effective }, animate: running, color, surface });
  const cls = node.id === selectedId ? "node-deep-selected" : undefined;

  const slotEntries = node.slots ? Object.entries(node.slots).filter(([, v]) => v) : [];
  const hasNested = node.children.length > 0 || slotEntries.length > 0;

  if (!hasNested) {
    return (
      <div
        data-node-id={node.id}
        className={cls}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          opacity: node.style.opacity,
          overflow: "visible",
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      data-node-id={node.id}
      className={cls}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        opacity: node.style.opacity,
        overflow: "visible",
      }}
    >
      <div style={{ position: "absolute", inset: 0, overflow: "visible" }}>{content}</div>
      {node.children.map(
        (child) =>
          !child.hidden && (
            <div
              key={child.id}
              style={{
                position: "absolute",
                left: child.layout.x,
                top: child.layout.y,
                width: child.layout.w,
                height: child.layout.h,
                overflow: "visible",
                transform: child.layout.rotation ? `rotate(${child.layout.rotation}deg)` : undefined,
              }}
            >
              <RenderNode
                node={child}
                animate={animate}
                selectedId={selectedId}
                inherited={passDown}
                surface={surface}
              />
            </div>
          ),
      )}
      {slotEntries.map(([name, val]) => {
        const slotDef = def.slots?.find((sd) => sd.name === name);
        // Knockout slots are composed by the host inside its own SVG (a mask
        // can't reach sibling DOM), so don't draw them a second time here.
        if (slotDef?.mode === "knockout") return null;
        const frame = slotDef?.frame ?? val!.layout;
        return (
          <div
            key={name}
            style={{ position: "absolute", left: frame.x, top: frame.y, width: frame.w, height: frame.h }}
          >
            <RenderNode
              node={val!}
              animate={animate}
              selectedId={selectedId}
              inherited={passDown}
              surface={surface}
            />
          </div>
        );
      })}
    </div>
  );
}
