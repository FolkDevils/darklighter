/**
 * `polarGrid` — radial spokes + concentric arcs fan (PLAN.md §5.2), source
 * geometry family: `markwithAccentRadar.svg`. Full circle or a fan sector.
 */
import type { ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode, strokeW } from "@/components-model/defaults";
import { behaviorOf, cycle, stagger, timing, DRAW_BASE } from "@/lib/anim";

const GRID_BEHAVIORS = ["fadeIn", "drawOn", "rotate"] as const;

export interface PolarGridProps {
  spokeCount: number;
  ringCount: number;
  sector: "full" | "fan";
  fanSpanDeg: number;
  gridOpacity: number;
}

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    polarGrid: PolarGridProps;
  }
}

function factory(): ComponentNode<"polarGrid"> {
  return baseNode(
    "polarGrid",
    "Polar Grid",
    { spokeCount: 8, ringCount: 4, sector: "full", fanSpanDeg: 90, gridOpacity: 0.55 },
    { layout: { w: 280, h: 280 } },
  );
}

const pt = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
};

function Render({ node, animate, color }: RenderProps<"polarGrid">) {
  const { w, h } = node.layout;
  const { spokeCount, ringCount, sector, fanSpanDeg, gridOpacity } = node.props;
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.min(w, h) / 2 - 2;
  const grid = color("electric");
  const span = sector === "fan" ? Math.max(1, fanSpanDeg) : 360;
  const startAngle = -span / 2;

  const spokes = Math.max(1, spokeCount);
  const rings = Math.max(1, ringCount);

  const behavior = animate ? behaviorOf(node.animation.behavior, GRID_BEHAVIORS) : null;
  const draw = behavior === "drawOn";
  const drawProps = draw ? { pathLength: DRAW_BASE.pathLength, strokeDasharray: DRAW_BASE.strokeDasharray } : null;
  const spin = node.animation.direction === "reverse" ? -360 : 360;
  const spokeTotal = spokes + (sector === "fan" ? 1 : 0);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
      <g stroke={grid} strokeWidth={strokeW(node, 1)} opacity={gridOpacity} fill="none">
        {behavior === "fadeIn" && <animate attributeName="opacity" {...timing(node.animation, "0", String(gridOpacity))} />}
        {behavior === "rotate" && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`0 ${cx} ${cy};${spin} ${cx} ${cy}`}
            {...cycle(node.animation)}
          />
        )}
        {Array.from({ length: spokeTotal }, (_, i) => {
          const a = sector === "fan" ? startAngle + (span * i) / spokes : (360 / spokes) * i;
          const [x, y] = pt(cx, cy, maxR, a);
          return (
            <line key={i} x1={cx} y1={cy} x2={x} y2={y} {...drawProps}>
              {draw && (
                <animate
                  attributeName="stroke-dashoffset"
                  {...timing(node.animation, "1", "0", stagger(node.animation, i, spokeTotal))}
                />
              )}
            </line>
          );
        })}
        {Array.from({ length: rings }, (_, i) => {
          const r = (maxR * (i + 1)) / rings;
          const drawAnim = draw ? (
            <animate
              attributeName="stroke-dashoffset"
              {...timing(node.animation, "1", "0", stagger(node.animation, i, rings))}
            />
          ) : null;
          if (sector === "full")
            return (
              <circle key={i} cx={cx} cy={cy} r={r} {...drawProps}>
                {drawAnim}
              </circle>
            );
          const [sx, sy] = pt(cx, cy, r, startAngle);
          const [ex, ey] = pt(cx, cy, r, startAngle + span);
          return (
            <path key={i} d={`M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`} {...drawProps}>
              {drawAnim}
            </path>
          );
        })}
      </g>
    </svg>
  );
}

defineComponent({
  kind: "polarGrid",
  label: "Polar Grid",
  category: "radar",
  tags: ["radar", "hud"],
  describe: "Radial spokes and arc fan, full circle or a fan sector.",
  factory,
  Render,
  controls: [
    { kind: "number", key: "spokeCount", label: "Spokes", min: 2, max: 32, step: 1 },
    { kind: "number", key: "ringCount", label: "Rings", min: 1, max: 12, step: 1 },
    {
      kind: "select",
      key: "sector",
      label: "Sector",
      options: [
        { value: "full", label: "Full circle" },
        { value: "fan", label: "Fan" },
      ],
    },
    { kind: "number", key: "fanSpanDeg", label: "Fan span", min: 5, max: 359, step: 1, visibleWhen: (p) => p.sector === "fan" },
    { kind: "number", key: "gridOpacity", label: "Opacity", min: 0.05, max: 1, step: 0.05 },
  ],
  animBehaviors: [...GRID_BEHAVIORS],
  acceptsChildren: false,
});
