/**
 * `trajectory` — launch/flight arc with a travelling marker (PLAN.md §5.2),
 * source geometry family: `Group 147.svg` / `Group 328.svg`.
 *
 * The arc is a quadratic curve whose height is a knob, so the same component
 * covers a flat bearing line, a lob, and a steep apogee. `pathFollow` moves
 * the marker along the identical path via `animateMotion` — no duplicated
 * geometry, so the resting frame and the animated frame can't disagree.
 */
import type { ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode, strokeW } from "@/components-model/defaults";
import { behaviorOf, cycle, timing, DRAW_BASE } from "@/lib/anim";

const TRAJ_BEHAVIORS = ["drawOn", "pathFollow", "fadeIn"] as const;

export interface TrajectoryProps {
  /** Apex height as a fraction of the node height (0 = straight line). */
  arcHeight: number;
  dashed: boolean;
  /** Tick marks along the path. */
  tickCount: number;
  showApex: boolean;
  marker: "none" | "craftDot" | "chevron";
}

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    trajectory: TrajectoryProps;
  }
}

function factory(): ComponentNode<"trajectory"> {
  return baseNode(
    "trajectory",
    "Trajectory",
    { arcHeight: 0.55, dashed: true, tickCount: 6, showApex: true, marker: "chevron" },
    { layout: { w: 360, h: 180 } },
  );
}

/** Quadratic bezier point at t, for tick placement. */
function bezier(t: number, p0: number, p1: number, p2: number): number {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

function Render({ node, animate, color }: RenderProps<"trajectory">) {
  const { w, h } = node.layout;
  const { arcHeight, dashed, tickCount, showApex, marker } = node.props;
  const primary = color("primary");
  const accent = color("accent");

  const x0 = 6;
  const y0 = h - 6;
  const x2 = w - 6;
  const y2 = h * 0.28;
  const cx = w / 2;
  const cy = y0 - h * arcHeight * 1.6;
  const d = `M ${x0} ${y0} Q ${cx} ${cy} ${x2} ${y2}`;

  const behavior = animate ? behaviorOf(node.animation.behavior, TRAJ_BEHAVIORS) : null;
  const draw = behavior === "drawOn" && !dashed;
  const ticks = Math.max(0, tickCount);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
      {behavior === "fadeIn" && <animate attributeName="opacity" {...timing(node.animation, "0", "1")} />}
      <path
        d={d}
        fill="none"
        stroke={primary}
        strokeWidth={strokeW(node, 1.8)}
        strokeLinecap="round"
        strokeDasharray={dashed ? "7 6" : draw ? DRAW_BASE.strokeDasharray : undefined}
        pathLength={draw ? DRAW_BASE.pathLength : undefined}
      >
        {draw && <animate attributeName="stroke-dashoffset" {...timing(node.animation, "1", "0")} />}
        {behavior === "drawOn" && dashed && (
          <animate attributeName="stroke-dashoffset" values="13;0" {...cycle(node.animation)} />
        )}
      </path>

      {Array.from({ length: ticks }, (_, i) => {
        const t = (i + 1) / (ticks + 1);
        const px = bezier(t, x0, cx, x2);
        const py = bezier(t, y0, cy, y2);
        return <line key={i} x1={px} y1={py - 5} x2={px} y2={py + 5} stroke={primary} strokeWidth={strokeW(node, 1.2)} />;
      })}

      {showApex && (
        <g>
          <circle cx={bezier(0.5, x0, cx, x2)} cy={bezier(0.5, y0, cy, y2)} r={4} fill={accent} />
          <text
            x={bezier(0.5, x0, cx, x2) - 6}
            y={bezier(0.5, y0, cy, y2) - 14}
            textAnchor="end"
            fontFamily="'IBM Plex Mono', ui-monospace, monospace"
            fontSize={10}
            fill={accent}
          >
            APOGEE
          </text>
        </g>
      )}

      {marker !== "none" && (
        <g>
          {marker === "craftDot" ? (
            <circle r={5} fill={accent} cx={x0} cy={y0} />
          ) : (
            <polygon points="-6,5 0,-7 6,5 0,1" fill={accent} transform={`translate(${x0}, ${y0})`} />
          )}
          {behavior === "pathFollow" && (
            <animateMotion path={d} rotate="auto" {...cycle(node.animation)} />
          )}
        </g>
      )}
    </svg>
  );
}

defineComponent({
  kind: "trajectory",
  label: "Trajectory",
  category: "radar",
  tags: ["radar", "line", "hud"],
  describe: "Launch/flight arc with range ticks, apogee mark and a marker that can fly the path.",
  factory,
  Render,
  controls: [
    { kind: "number", key: "arcHeight", label: "Arc height", min: 0, max: 1, step: 0.02 },
    { kind: "number", key: "tickCount", label: "Range ticks", min: 0, max: 20, step: 1 },
    { kind: "toggle", key: "dashed", label: "Dashed" },
    { kind: "toggle", key: "showApex", label: "Apogee mark" },
    {
      kind: "select",
      key: "marker",
      label: "Marker",
      options: [
        { value: "none", label: "None" },
        { value: "craftDot", label: "Dot" },
        { value: "chevron", label: "Chevron" },
      ],
    },
  ],
  animBehaviors: [...TRAJ_BEHAVIORS],
  acceptsChildren: false,
});
