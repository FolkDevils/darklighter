/**
 * `sweep` — radar sweep wedge/arm (PLAN.md §5.2), source geometry family:
 * `markwithAccentRadar.svg`. Resting frame = the sweep parked at
 * `angleDeg` with its trail rendered as stacked, opacity-ramped sectors
 * (avoids relying on gradient `<defs>` for the fade — cheap and
 * deterministic). Rotation spins that whole resting frame about the center.
 */
import type { ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode, strokeW } from "@/components-model/defaults";
import { behaviorOf, cycle, timing } from "@/lib/anim";

const SWEEP_BEHAVIORS = ["rotate", "fadeIn"] as const;

export interface SweepProps {
  /** Degrees clockwise from due "east" (screen +x). */
  angleDeg: number;
  arcSpanDeg: number;
  trailFade: boolean;
  /** Fraction (0..1) of the node's half-size the sweep reaches. */
  length: number;
}

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    sweep: SweepProps;
  }
}

function factory(): ComponentNode<"sweep"> {
  return baseNode(
    "sweep",
    "Sweep",
    { angleDeg: 40, arcSpanDeg: 70, trailFade: true, length: 0.92 },
    { layout: { w: 260, h: 260 } },
  );
}

const pt = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
};

const SEGMENTS = 20;

function Render({ node, animate, color }: RenderProps<"sweep">) {
  const { w, h } = node.layout;
  const { angleDeg, arcSpanDeg, trailFade, length } = node.props;
  const cx = w / 2;
  const cy = h / 2;
  const r = (Math.min(w, h) / 2) * length;
  const primary = color("primary");
  const accent = color("accent");

  const span = Math.max(1, arcSpanDeg);
  const startAngle = angleDeg - span;
  const step = span / SEGMENTS;

  const behavior = animate ? behaviorOf(node.animation.behavior, SWEEP_BEHAVIORS) : null;
  const spin = node.animation.direction === "reverse" ? -360 : 360;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
      <g opacity={1}>
        {/* Figma's SVG-timeline importer rotates a group around its imported
            frame center and ignores the explicit SMIL pivot. Without a
            full-box shape it tight-bounds this group to the wedge, so the arm
            orbits beside the radar center. The invisible rect preserves the
            intended w×h frame without changing browser rendering. */}
        <rect width={w} height={h} fill="transparent" data-motion-bounds="sweep" />
        {behavior === "fadeIn" && <animate attributeName="opacity" {...timing(node.animation, "0", "1")} />}
        {behavior === "rotate" && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`0 ${cx} ${cy};${spin} ${cx} ${cy}`}
            {...cycle(node.animation)}
          />
        )}
      {Array.from({ length: SEGMENTS }, (_, i) => {
        const a0 = startAngle + i * step;
        const a1 = a0 + step;
        const [x0, y0] = pt(cx, cy, r, a0);
        const [x1, y1] = pt(cx, cy, r, a1);
        const opacity = trailFade ? ((i + 1) / SEGMENTS) * 0.55 : 0.28;
        return (
          <path
            key={i}
            d={`M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`}
            fill={primary}
            opacity={opacity}
          />
        );
      })}
      {(() => {
        const [ax, ay] = pt(cx, cy, r, angleDeg);
        return (
          <line
            x1={cx}
            y1={cy}
            x2={ax}
            y2={ay}
            stroke={accent}
            strokeWidth={strokeW(node, 2.5)}
            strokeLinecap="round"
          />
        );
      })()}
      </g>
      <circle cx={cx} cy={cy} r={3} fill={accent} />
    </svg>
  );
}

defineComponent({
  kind: "sweep",
  label: "Sweep",
  category: "radar",
  tags: ["radar"],
  describe: "Radar sweep wedge with a fading trail and a bright leading arm.",
  factory,
  Render,
  controls: [
    { kind: "number", key: "angleDeg", label: "Angle", min: 0, max: 360, step: 1 },
    { kind: "number", key: "arcSpanDeg", label: "Trail span", min: 5, max: 180, step: 1 },
    { kind: "toggle", key: "trailFade", label: "Fade trail" },
    { kind: "number", key: "length", label: "Length", min: 0.1, max: 1, step: 0.02 },
  ],
  animBehaviors: [...SWEEP_BEHAVIORS],
  acceptsChildren: false,
});
