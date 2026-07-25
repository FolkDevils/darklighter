/**
 * `arcSignal` — nested quarter-arcs with arrowheads (PLAN.md §5.2), source
 * geometry family: `Group 143/324.svg`.
 */
import type { ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode, strokeW } from "@/components-model/defaults";
import { behaviorOf, cycle, stagger, timing, DRAW_BASE } from "@/lib/anim";

const ARC_BEHAVIORS = ["drawOn", "rotate", "fadeIn"] as const;

export interface ArcSignalProps {
  arcCount: number;
  spreadDeg: number;
  /** Direction the arc fan points, degrees clockwise from "up". */
  baseAngleDeg: number;
  arrowheads: boolean;
  dashedOuter: boolean;
}

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    arcSignal: ArcSignalProps;
  }
}

function factory(): ComponentNode<"arcSignal"> {
  return baseNode(
    "arcSignal",
    "Arc Signal",
    { arcCount: 4, spreadDeg: 80, baseAngleDeg: 0, arrowheads: true, dashedOuter: true },
    { layout: { w: 220, h: 220 } },
  );
}

const pt = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
};

function Render({ node, animate, color }: RenderProps<"arcSignal">) {
  const { w, h } = node.layout;
  const { arcCount, spreadDeg, baseAngleDeg, arrowheads, dashedOuter } = node.props;
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.min(w, h) / 2 - 4;
  const count = Math.max(1, arcCount);
  const span = Math.max(1, spreadDeg);
  const startAngle = -90 + baseAngleDeg - span / 2; // centered on "up" + offset
  const endAngle = startAngle + span;
  const primary = color("primary");
  const accent = color("accent");

  const behavior = animate ? behaviorOf(node.animation.behavior, ARC_BEHAVIORS) : null;
  const spin = node.animation.direction === "reverse" ? -360 : 360;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
      {behavior === "fadeIn" && <animate attributeName="opacity" {...timing(node.animation, "0", "1")} />}
      <g>
        {behavior === "rotate" && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`0 ${cx} ${cy};${spin} ${cx} ${cy}`}
            {...cycle(node.animation)}
          />
        )}
      {Array.from({ length: count }, (_, i) => {
        const r = (maxR * (i + 1)) / count;
        const isOuter = i === count - 1;
        const [sx, sy] = pt(cx, cy, r, startAngle);
        const [ex, ey] = pt(cx, cy, r, endAngle);
        const dashed = isOuter && dashedOuter;
        const drawing = behavior === "drawOn" && !dashed;
        const delay = stagger(node.animation, i, count);
        return (
          <g key={i}>
            {behavior === "drawOn" && dashed && (
              <animate attributeName="opacity" {...timing(node.animation, "0", "1", delay)} />
            )}
            <path
              d={`M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`}
              fill="none"
              stroke={isOuter ? accent : primary}
              strokeWidth={strokeW(node, 2)}
              strokeLinecap="round"
              strokeDasharray={dashed ? "6 5" : drawing ? DRAW_BASE.strokeDasharray : undefined}
              pathLength={drawing ? DRAW_BASE.pathLength : undefined}
            >
              {drawing && <animate attributeName="stroke-dashoffset" {...timing(node.animation, "1", "0", delay)} />}
            </path>
            {arrowheads &&
              [startAngle, endAngle].map((a, j) => {
                const [x, y] = pt(cx, cy, r, a);
                const tangent = a + (j === 0 ? -90 : 90);
                const [tx, ty] = pt(x, y, 7, tangent);
                const [nx, ny] = pt(x, y, 7, tangent + 140);
                return (
                  <polygon
                    key={j}
                    points={`${x},${y} ${tx},${ty} ${nx},${ny}`}
                    fill={isOuter ? accent : primary}
                  >
                    {behavior === "drawOn" && (
                      <animate
                        attributeName="opacity"
                        {...timing(node.animation, "0", "1", delay + node.animation.durationMs * 0.6)}
                      />
                    )}
                  </polygon>
                );
              })}
          </g>
        );
      })}
      </g>
    </svg>
  );
}

defineComponent({
  kind: "arcSignal",
  label: "Arc Signal",
  category: "radar",
  tags: ["radar", "hud"],
  describe: "Nested partial arcs with arrowhead terminals (boot/sweep-module motif).",
  factory,
  Render,
  controls: [
    { kind: "number", key: "arcCount", label: "Arc count", min: 1, max: 8, step: 1 },
    { kind: "number", key: "spreadDeg", label: "Spread", min: 10, max: 359, step: 1 },
    { kind: "number", key: "baseAngleDeg", label: "Direction", min: -180, max: 180, step: 1 },
    { kind: "toggle", key: "arrowheads", label: "Arrowheads" },
    { kind: "toggle", key: "dashedOuter", label: "Dashed outer" },
  ],
  animBehaviors: [...ARC_BEHAVIORS],
  acceptsChildren: false,
});
