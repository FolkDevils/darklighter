/**
 * `ringSet` — concentric range rings (PLAN.md §5.2), source geometry family:
 * `assets/protora/Group 81 (1).svg`. Base attributes draw the resting (fully
 * drawn) frame; SMIL only ever animates *into* that frame, so a static export
 * is correct with the animation nodes stripped.
 */
import type { ColorRole, ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode, COLOR_ROLE_OPTIONS, strokeW } from "@/components-model/defaults";
import { behaviorOf, cycle, stagger, timing, DRAW_BASE } from "@/lib/anim";

const RING_BEHAVIORS = ["drawOn", "ping", "fadeIn"] as const;

export interface RingSetProps {
  count: number;
  spacing: "linear" | "exp";
  strokeWidth: number;
  dashed: boolean;
  labeled: boolean;
  labelUnit: string;
  /** Value shown on ring `i` is `labelStep * (i + 1)`, e.g. 2NM, 4NM, 6NM… */
  labelStep: number;
  /** Labels need their own role: ink reads on a light page, field on a dark scope. */
  labelRole: ColorRole;
  /** Outermost ring paints with the "electric" role (cyan) — Group 81's outer ring. */
  accentOuter: boolean;
}

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    ringSet: RingSetProps;
  }
}

function factory(): ComponentNode<"ringSet"> {
  return baseNode(
    "ringSet",
    "Range Rings",
    {
      count: 5,
      spacing: "linear",
      strokeWidth: 1.6,
      dashed: false,
      labeled: true,
      labelUnit: "NM",
      labelStep: 2,
      labelRole: "ink",
      accentOuter: true,
    },
    { layout: { w: 280, h: 280 } },
  );
}

function radiusFor(i: number, count: number, maxR: number, mode: "linear" | "exp"): number {
  const t = (i + 1) / count;
  return mode === "exp" ? maxR * Math.pow(t, 1.4) : maxR * t;
}

function Render({ node, animate, color }: RenderProps<"ringSet">) {
  const { w, h } = node.layout;
  const { count, spacing, dashed, labeled, labelUnit, labelStep, labelRole, accentOuter } = node.props;
  const strokeWidth = strokeW(node, node.props.strokeWidth);
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.min(w, h) / 2 - strokeWidth * 2;
  const primary = color("primary");
  const electric = color("electric");
  const ink = color(labelRole);

  const n = Math.max(1, count);
  const behavior = animate ? behaviorOf(node.animation.behavior, RING_BEHAVIORS) : null;
  // Draw-on borrows the dash array, so a ring that's already dashed reveals
  // by fading instead — same intent, no fighting over one attribute.
  const drawing = behavior === "drawOn" && !dashed;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
      {Array.from({ length: n }, (_, i) => {
        const r = radiusFor(i, count, maxR, spacing);
        const isOuter = i === count - 1;
        const delay = stagger(node.animation, i, n);
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={Math.max(1, r)}
            fill="none"
            stroke={isOuter && accentOuter ? electric : primary}
            strokeWidth={strokeWidth}
            strokeDasharray={dashed ? "5 4" : drawing ? DRAW_BASE.strokeDasharray : undefined}
            pathLength={drawing ? DRAW_BASE.pathLength : undefined}
          >
            {drawing && <animate attributeName="stroke-dashoffset" {...timing(node.animation, "1", "0", delay)} />}
            {behavior === "drawOn" && dashed && (
              <animate attributeName="opacity" {...timing(node.animation, "0", "1", delay)} />
            )}
            {behavior === "fadeIn" && <animate attributeName="opacity" {...timing(node.animation, "0", "1", delay)} />}
            {/* Ping: each ring radiates outward and fades — the Group 276 motif. */}
            {behavior === "ping" && (
              <>
                <animate attributeName="r" values={`${Math.max(1, r * 0.35)};${Math.max(1, r)}`} {...cycle(node.animation, delay)} />
                <animate attributeName="opacity" values="0.9;0" {...cycle(node.animation, delay)} />
              </>
            )}
          </circle>
        );
      })}
      {labeled &&
        Array.from({ length: n }, (_, i) => {
          const r = radiusFor(i, count, maxR, spacing);
          // Labels ride just inside their own ring along the +x axis, so they
          // never collide with the next label out and never leave the box.
          return (
            <text
              key={i}
              x={cx + r - 4}
              textAnchor="end"
              y={cy - 3}
              fontFamily="'IBM Plex Mono', ui-monospace, monospace"
              fontSize={9}
              fill={ink}
            >
              {behavior && behavior !== "ping" && (
                <animate attributeName="opacity" {...timing(node.animation, "0", "1", stagger(node.animation, i, n))} />
              )}
              {labelStep * (i + 1)}
              {labelUnit}
            </text>
          );
        })}
    </svg>
  );
}

defineComponent({
  kind: "ringSet",
  label: "Range Rings",
  category: "radar",
  tags: ["radar"],
  describe: "Concentric range rings with optional NM labels; outermost ring can accent electric-blue.",
  factory,
  Render,
  controls: [
    { kind: "number", key: "count", label: "Ring count", min: 1, max: 10, step: 1 },
    {
      kind: "select",
      key: "spacing",
      label: "Spacing",
      options: [
        { value: "linear", label: "Linear" },
        { value: "exp", label: "Exponential" },
      ],
    },
    { kind: "number", key: "strokeWidth", label: "Stroke width", min: 0.5, max: 6, step: 0.5 },
    { kind: "toggle", key: "dashed", label: "Dashed" },
    { kind: "toggle", key: "labeled", label: "Show labels" },
    { kind: "text", key: "labelUnit", label: "Label unit", visibleWhen: (p) => Boolean(p.labeled) },
    { kind: "number", key: "labelStep", label: "Label step", min: 1, max: 20, step: 1, visibleWhen: (p) => Boolean(p.labeled) },
    { kind: "select", key: "labelRole", label: "Label color", options: COLOR_ROLE_OPTIONS, visibleWhen: (p) => Boolean(p.labeled) },
    { kind: "toggle", key: "accentOuter", label: "Accent outer ring" },
  ],
  animBehaviors: [...RING_BEHAVIORS],
  acceptsChildren: false,
});
