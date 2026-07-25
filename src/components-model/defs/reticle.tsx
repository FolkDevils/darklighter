/**
 * `reticle` — crosshair + micro-circles (PLAN.md §5.2), source geometry
 * family: `Group 145/325/322.svg`. Also the default approved-radar
 * building block referenced by `src/assets/brand/logoP.ts` for Phase 2.
 */
import type { ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode, strokeW } from "@/components-model/defaults";
import { behaviorOf, cycle, stagger, timing, DRAW_BASE } from "@/lib/anim";

const RETICLE_BEHAVIORS = ["drawOn", "fadeIn", "blink"] as const;

export interface ReticleProps {
  axesLength: number;
  ringCount: number;
  strokeWidth: number;
  /**
   * Radius of the innermost ring. 0 spaces rings evenly from the center;
   * a positive value starts the ring stack there.
   */
  innerRadius: number;
  /**
   * Distance between successive rings. 0 fits the stack to the box; a fixed
   * value keeps ring geometry independent of the box, which is what lets the
   * approved P-logo reticle (r=77.66 step 25.125) survive a resize.
   */
  ringSpacing: number;
  /** Radius at which the crosshair breaks, leaving the center clean. */
  centerGap: number;
}

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    reticle: ReticleProps;
  }
}

function factory(): ComponentNode<"reticle"> {
  return baseNode(
    "reticle",
    "Reticle",
    { axesLength: 100, ringCount: 3, strokeWidth: 1.5, innerRadius: 0, ringSpacing: 0, centerGap: 0 },
    { layout: { w: 140, h: 140 } },
  );
}

/** Ring radius for index `i`, honoring `innerRadius`/`ringSpacing` when set. */
function ringRadius(
  i: number,
  count: number,
  maxR: number,
  innerRadius: number,
  ringSpacing: number,
): number {
  if (ringSpacing > 0) return innerRadius + i * ringSpacing;
  if (innerRadius > 0 && count > 1) return innerRadius + ((maxR - innerRadius) * i) / (count - 1);
  if (innerRadius > 0) return innerRadius;
  return (maxR * (i + 1)) / count;
}

function Render({ node, animate, color }: RenderProps<"reticle">) {
  const { w, h } = node.layout;
  const { axesLength, ringCount, innerRadius, ringSpacing, centerGap } = node.props;
  const strokeWidth = strokeW(node, node.props.strokeWidth);
  const cx = w / 2;
  const cy = h / 2;
  const half = axesLength / 2;
  const primary = color("primary");
  const accent = color("accent");
  const maxRingR = Math.min(w, h) / 2 - strokeWidth;
  const rings = Math.max(1, ringCount);
  const gap = Math.max(0, centerGap);

  const behavior = animate ? behaviorOf(node.animation.behavior, RETICLE_BEHAVIORS) : null;
  const draw = behavior === "drawOn";
  const drawProps = draw ? { pathLength: DRAW_BASE.pathLength, strokeDasharray: DRAW_BASE.strokeDasharray } : null;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
      {behavior === "fadeIn" && (
        <animate attributeName="opacity" {...timing(node.animation, "0", "1")} />
      )}
      {/* With a center gap the crosshair is four segments that stop at the
          inner ring — the approved P-logo treatment. */}
      <g stroke={primary} strokeWidth={strokeWidth} fill="none" strokeLinecap="round">
        {(gap > 0
          ? ([
              [cx - half, cy, cx - gap, cy],
              [cx + gap, cy, cx + half, cy],
              [cx, cy - half, cx, cy - gap],
              [cx, cy + gap, cx, cy + half],
            ] as const)
          : ([
              [cx - half, cy, cx + half, cy],
              [cx, cy - half, cx, cy + half],
            ] as const)
        ).map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} {...drawProps}>
            {draw && (
              <animate attributeName="stroke-dashoffset" {...timing(node.animation, "1", "0", node.animation.staggerMs * i)} />
            )}
          </line>
        ))}
      </g>
      {Array.from({ length: rings }, (_, i) => {
        const r = ringRadius(i, rings, maxRingR, innerRadius, ringSpacing);
        const delay = node.animation.staggerMs * 2 + stagger(node.animation, i, rings);
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={primary}
            strokeWidth={strokeWidth * 0.8}
            {...drawProps}
          >
            {draw && <animate attributeName="stroke-dashoffset" {...timing(node.animation, "1", "0", delay)} />}
          </circle>
        );
      })}
      {gap === 0 && (
        <circle cx={cx} cy={cy} r={2.2} fill={accent}>
          {behavior === "blink" && <animate attributeName="opacity" values="1;0.1;1" {...cycle(node.animation)} />}
        </circle>
      )}
    </svg>
  );
}

defineComponent({
  kind: "reticle",
  label: "Reticle",
  category: "glyphs",
  tags: ["glyph", "hud"],
  describe: "Crosshair with concentric micro-circles at the center.",
  factory,
  Render,
  controls: [
    { kind: "number", key: "axesLength", label: "Axes length", min: 10, max: 400, step: 1 },
    { kind: "number", key: "ringCount", label: "Ring count", min: 0, max: 8, step: 1 },
    { kind: "number", key: "innerRadius", label: "Inner radius", min: 0, max: 400, step: 1 },
    { kind: "number", key: "ringSpacing", label: "Ring spacing", hint: "0 fits the rings to the box.", min: 0, max: 200, step: 1 },
    { kind: "number", key: "centerGap", label: "Crosshair gap", min: 0, max: 400, step: 1 },
    { kind: "number", key: "strokeWidth", label: "Stroke width", min: 0.5, max: 8, step: 0.5 },
  ],
  animBehaviors: [...RETICLE_BEHAVIORS],
  acceptsChildren: false,
});
