/**
 * `focusArcs` — bidirectional handshake arcs (PLAN.md §5.2), rebuilt from
 * primitives to match `assets/protora/Group 344.svg`: two arc fans facing
 * each other with node marks and a standby status row.
 *
 * REBUILT, NOT IMPORTED (docs/NORTH_STAR.md). Mirroring is just the second
 * arc fan's `baseAngleDeg`, which is why the arc primitive got that knob.
 */
import type { ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode } from "@/components-model/defaults";
import { part } from "@/components-model/scenes";

export interface FocusArcsProps {
  /** Gap between the two facing fans, in node units. */
  gap: number;
}

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    focusArcs: FocusArcsProps;
  }
}

const W = 440;
const H = 240;

function factory(): ComponentNode<"focusArcs"> {
  return baseNode(
    "focusArcs",
    "Focus Arcs",
    { gap: 40 },
    {
      layout: { w: W, h: H },
      animation: { cascade: true, staggerMs: 80 },
      children: [
        part(
          "arcSignal",
          { x: 10, y: 20, w: 170, h: 170 },
          { arcCount: 3, spreadDeg: 70, baseAngleDeg: 90, arrowheads: true, dashedOuter: false },
          { name: "Left Fan", animation: { behavior: "drawOn", durationMs: 1000, staggerMs: 130 } },
        ),
        part(
          "arcSignal",
          { x: 260, y: 20, w: 170, h: 170 },
          { arcCount: 3, spreadDeg: 70, baseAngleDeg: -90, arrowheads: true, dashedOuter: false },
          { name: "Right Fan", animation: { behavior: "drawOn", delayMs: 160, durationMs: 1000, staggerMs: 130 } },
        ),
        part(
          "targetGlyph",
          { x: 60, y: 85, w: 40, h: 40 },
          { glyphId: "circleX", size: 22, roleColor: "primary" },
          { name: "Node A", animation: { behavior: "blink", durationMs: 1500 } },
        ),
        part(
          "targetGlyph",
          { x: 340, y: 85, w: 40, h: 40 },
          { glyphId: "circleX", size: 22, roleColor: "primary" },
          { name: "Node B", animation: { behavior: "blink", delayMs: 300, durationMs: 1500 } },
        ),
        part(
          "statusText",
          { x: 14, y: 196, w: 412, h: 40 },
          { lines: ["STANDBY - ID: 3B-19"], fontSize: 12, align: "center", roleColor: "ink" },
          { name: "Status Row", animation: { behavior: "typewriter", delayMs: 900, durationMs: 900 } },
        ),
      ],
    },
  );
}

function Render({ node, animate, color }: RenderProps<"focusArcs">) {
  const { w, h } = node.layout;
  const { gap } = node.props;
  const half = Math.max(0, gap) / 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
      <line
        x1={w / 2 - half}
        y1={h / 2 - 15}
        x2={w / 2 + half}
        y2={h / 2 - 15}
        stroke={color("accent")}
        strokeWidth={1.5}
        strokeDasharray="4 4"
        strokeDashoffset={0}
      >
        {animate && <animate attributeName="stroke-dashoffset" values="8;0" dur="600ms" repeatCount="indefinite" />}
      </line>
    </svg>
  );
}

defineComponent({
  kind: "focusArcs",
  label: "Focus Arcs",
  category: "composites",
  tags: ["hud", "composite"],
  describe: "Two facing arc fans with node marks and a status row — the handshake/focus graphic.",
  factory,
  Render,
  controls: [{ kind: "number", key: "gap", label: "Link gap", min: 0, max: 200, step: 2 }],
  animBehaviors: ["fadeIn"],
  acceptsChildren: true,
});
