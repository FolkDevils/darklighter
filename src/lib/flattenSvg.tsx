/**
 * Flatten a node tree into ONE pure-SVG element tree.
 *
 * The canvas composes the tree with nested absolutely-positioned `<div>`s
 * (RenderNode) because that keeps parent transforms from distorting child
 * stroke widths. That's right for editing but not portable — a file has to be
 * SVG all the way down. This does the same composition with nested `<svg>`
 * viewports: each child gets an `<svg x y width height>` whose coordinate
 * system matches the div box it occupies on canvas, so the flattened output
 * is geometrically identical to what the user sees.
 *
 * Used by scripts/preview.tsx today and by the Phase 6 export pipeline.
 */
import type { ReactElement } from "react";
import type { ComponentNode } from "@/components-model/types";
import { componentDef } from "@/components-model/registry";
import { resolveColor } from "@/lib/colorway";

export function flattenNode(
  node: ComponentNode,
  animate: boolean,
  inherited: ComponentNode["animation"] | null = null,
): ReactElement | null {
  if (node.hidden) return null;

  const def = componentDef(node.kind);
  const color = (role: Parameters<typeof resolveColor>[1]) => resolveColor(node.style, role);

  const effective =
    !node.animation.enabled && inherited
      ? { ...inherited, delayMs: inherited.delayMs + node.animation.delayMs, behavior: node.animation.behavior }
      : node.animation;
  const running = animate && (node.animation.enabled || Boolean(inherited));
  const passDown = effective.cascade && running ? effective : null;

  const { x, y, w, h, rotation } = node.layout;
  const body = (
    <svg x={x} y={y} width={w} height={h} overflow="visible" opacity={node.style.opacity}>
      {def.Render({ node: { ...node, animation: effective }, animate: running, color })}
      {node.children.map((c) => (
        <ChildFrame key={c.id} node={c} animate={animate} inherited={passDown} />
      ))}
      {Object.entries(node.slots ?? {}).map(([name, val]) => {
        const slotDef = def.slots?.find((sd) => sd.name === name);
        // Knockout slots are drawn by the host itself (see defs/logoP.tsx).
        if (!val || slotDef?.mode === "knockout") return null;
        const frame = slotDef?.frame ?? val.layout;
        return (
          <svg key={name} x={frame.x} y={frame.y} width={frame.w} height={frame.h} overflow="visible">
            {flattenNode({ ...val, layout: { ...val.layout, x: 0, y: 0 } }, animate, passDown)}
          </svg>
        );
      })}
    </svg>
  );

  // `transform` isn't valid on <svg>, so rotation needs a wrapping <g>.
  return rotation ? <g transform={`rotate(${rotation} ${x + w / 2} ${y + h / 2})`}>{body}</g> : body;
}

function ChildFrame({
  node,
  animate,
  inherited,
}: {
  node: ComponentNode;
  animate: boolean;
  inherited: ComponentNode["animation"] | null;
}) {
  return flattenNode(node, animate, inherited);
}
