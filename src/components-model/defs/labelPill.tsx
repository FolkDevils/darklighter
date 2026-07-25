/**
 * `labelPill` — pill-outline label (PLAN.md §5.2), source geometry family:
 * `Group 145/322/323.svg` (e.g. the `TELEMETRY` pill).
 */
import type { ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode, strokeW } from "@/components-model/defaults";
import { behaviorOf, cycle, timing, DRAW_BASE } from "@/lib/anim";

const PILL_BEHAVIORS = ["fadeIn", "drawOn", "blink"] as const;

export interface LabelPillProps {
  text: string;
  filled: boolean;
  fontSize: number;
}

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    labelPill: LabelPillProps;
  }
}

function factory(): ComponentNode<"labelPill"> {
  return baseNode("labelPill", "Label Pill", { text: "TELEMETRY", filled: false, fontSize: 12 }, { layout: { w: 140, h: 32 } });
}

function Render({ node, animate, color }: RenderProps<"labelPill">) {
  const { w, h } = node.layout;
  const { text, filled, fontSize } = node.props;
  const primary = color("primary");
  const field = color("field");
  const r = h / 2;

  const behavior = animate ? behaviorOf(node.animation.behavior, PILL_BEHAVIORS) : null;
  const draw = behavior === "drawOn";

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
      {behavior === "fadeIn" && <animate attributeName="opacity" {...timing(node.animation, "0", "1")} />}
      {behavior === "blink" && <animate attributeName="opacity" values="1;0.2;1" {...cycle(node.animation)} />}
      <rect
        x={1}
        y={1}
        width={w - 2}
        height={h - 2}
        rx={r}
        fill={filled ? primary : "none"}
        stroke={primary}
        strokeWidth={strokeW(node, 1.5)}
        pathLength={draw ? DRAW_BASE.pathLength : undefined}
        strokeDasharray={draw ? DRAW_BASE.strokeDasharray : undefined}
      >
        {draw && <animate attributeName="stroke-dashoffset" {...timing(node.animation, "1", "0")} />}
      </rect>
      <text
        x={w / 2}
        y={h / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="'IBM Plex Mono', ui-monospace, monospace"
        fontSize={fontSize}
        letterSpacing={1}
        fill={filled ? field : primary}
      >
        {draw && (
          <animate attributeName="opacity" {...timing(node.animation, "0", "1", node.animation.durationMs * 0.5)} />
        )}
        {text.toUpperCase()}
      </text>
    </svg>
  );
}

defineComponent({
  kind: "labelPill",
  label: "Label Pill",
  category: "text",
  tags: ["text", "hud"],
  describe: "Pill-outline label, e.g. TELEMETRY.",
  factory,
  Render,
  controls: [
    { kind: "text", key: "text", label: "Text" },
    { kind: "toggle", key: "filled", label: "Filled" },
    { kind: "number", key: "fontSize", label: "Font size", min: 6, max: 32, step: 1 },
  ],
  animBehaviors: [...PILL_BEHAVIORS],
  acceptsChildren: false,
});
