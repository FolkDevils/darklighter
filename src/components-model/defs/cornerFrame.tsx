/**
 * `cornerFrame` — bracket/box framing around a panel (PLAN.md §5.2 telemetry
 * module), source geometry family: `Group 145.svg` / `Group 325.svg` corner
 * ticks and `Frame (3).svg` corner locks.
 *
 * Sized to the node box rather than to content, so it can be dropped behind
 * any group as a frame and resized independently.
 */
import type { ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode, strokeW } from "@/components-model/defaults";
import { behaviorOf, stagger, timing, DRAW_BASE } from "@/lib/anim";

const FRAME_BEHAVIORS = ["drawOn", "fadeIn"] as const;

export interface CornerFrameProps {
  style: "brackets" | "ticks" | "box";
  cornerLength: number;
  inset: number;
  /** Optional caption on the top edge, HUD style. */
  caption: string;
}

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    cornerFrame: CornerFrameProps;
  }
}

function factory(): ComponentNode<"cornerFrame"> {
  return baseNode(
    "cornerFrame",
    "Corner Frame",
    { style: "brackets", cornerLength: 26, inset: 2, caption: "" },
    { layout: { w: 360, h: 260 } },
  );
}

function Render({ node, animate, color }: RenderProps<"cornerFrame">) {
  const { w, h } = node.layout;
  const { style, cornerLength, inset, caption } = node.props;
  const primary = color("primary");
  const sw = strokeW(node, 1.6);
  const L = Math.max(2, cornerLength);
  const x0 = inset;
  const y0 = inset;
  const x1 = w - inset;
  const y1 = h - inset;

  const behavior = animate ? behaviorOf(node.animation.behavior, FRAME_BEHAVIORS) : null;
  const draw = behavior === "drawOn";
  const drawProps = draw ? { pathLength: DRAW_BASE.pathLength, strokeDasharray: DRAW_BASE.strokeDasharray } : null;

  const corners =
    style === "box"
      ? [`M ${x0} ${y0} H ${x1} V ${y1} H ${x0} Z`]
      : style === "ticks"
        ? [
            `M ${x0} ${y0} h ${L}`,
            `M ${x1} ${y0} h ${-L}`,
            `M ${x0} ${y1} h ${L}`,
            `M ${x1} ${y1} h ${-L}`,
          ]
        : [
            `M ${x0} ${y0 + L} V ${y0} H ${x0 + L}`,
            `M ${x1 - L} ${y0} H ${x1} V ${y0 + L}`,
            `M ${x1} ${y1 - L} V ${y1} H ${x1 - L}`,
            `M ${x0 + L} ${y1} H ${x0} V ${y1 - L}`,
          ];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
      {behavior === "fadeIn" && <animate attributeName="opacity" {...timing(node.animation, "0", "1")} />}
      {corners.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={primary} strokeWidth={sw} {...drawProps}>
          {draw && (
            <animate
              attributeName="stroke-dashoffset"
              {...timing(node.animation, "1", "0", stagger(node.animation, i, corners.length))}
            />
          )}
        </path>
      ))}
      {caption.trim() !== "" && (
        <>
          <rect x={x0 + L + 6} y={y0 - 7} width={caption.length * 7.2 + 12} height={14} fill={color("field")} />
          <text
            x={x0 + L + 12}
            y={y0 + 4}
            fontFamily="'IBM Plex Mono', ui-monospace, monospace"
            fontSize={10}
            letterSpacing={1}
            fill={primary}
          >
            {caption.toUpperCase()}
          </text>
        </>
      )}
    </svg>
  );
}

defineComponent({
  kind: "cornerFrame",
  label: "Corner Frame",
  category: "glyphs",
  tags: ["hud", "glyph"],
  describe: "Corner brackets, edge ticks or a full box frame with an optional caption tab.",
  factory,
  Render,
  controls: [
    {
      kind: "select",
      key: "style",
      label: "Style",
      options: [
        { value: "brackets", label: "Brackets" },
        { value: "ticks", label: "Edge ticks" },
        { value: "box", label: "Full box" },
      ],
    },
    { kind: "number", key: "cornerLength", label: "Corner length", min: 2, max: 200, step: 1, visibleWhen: (p) => p.style !== "box" },
    { kind: "number", key: "inset", label: "Inset", min: 0, max: 60, step: 1 },
    { kind: "text", key: "caption", label: "Caption" },
  ],
  animBehaviors: [...FRAME_BEHAVIORS],
  acceptsChildren: false,
});
