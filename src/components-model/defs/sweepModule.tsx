/**
 * `sweepModule` — boot/sweep status module (PLAN.md §5.2 composites),
 * rebuilt from primitives to match `assets/protora/Group 143.svg` /
 * `Group 324.svg`: nested signal arcs + big % readout + terminal log lines.
 *
 * REBUILT, NOT IMPORTED (docs/NORTH_STAR.md).
 */
import type { ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode } from "@/components-model/defaults";
import { part } from "@/components-model/scenes";

export interface SweepModuleProps {
  /** Divider rule between the arc block and the log block. */
  showDivider: boolean;
}

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    sweepModule: SweepModuleProps;
  }
}

const W = 440;
const H = 300;

function factory(): ComponentNode<"sweepModule"> {
  return baseNode(
    "sweepModule",
    "Sweep Module",
    { showDivider: true },
    {
      layout: { w: W, h: H },
      animation: { cascade: true, staggerMs: 60 },
      children: [
        part(
          "arcSignal",
          { x: 6, y: 6, w: 180, h: 180 },
          { arcCount: 4, spreadDeg: 96, baseAngleDeg: 0, arrowheads: true, dashedOuter: true },
          { name: "Signal Arcs", animation: { behavior: "drawOn", durationMs: 1100, staggerMs: 140 } },
        ),
        part(
          "targetGlyph",
          { x: 76, y: 118, w: 40, h: 40 },
          { glyphId: "circle", size: 14, roleColor: "accent" },
          { name: "Source", animation: { behavior: "ping", durationMs: 1800 } },
        ),
        part(
          "readoutBar",
          { x: 200, y: 24, w: 226, h: 96 },
          { value: 87, label: "SWEEP", segments: 18, barHeight: 8 },
          { name: "Progress", animation: { behavior: "drawOn", delayMs: 300, durationMs: 1600 } },
        ),
        part(
          "statusText",
          { x: 10, y: 200, w: 420, h: 96 },
          {
            lines: [
              "SYSTEM >>> ***ACTIVATED***",
              "INITIATING SWEEP",
              "UNITS AQUIRED :15",
            ],
            fontSize: 13,
            roleColor: "primary",
          },
          { name: "Boot Log", animation: { behavior: "typewriter", delayMs: 500, durationMs: 2200 } },
        ),
      ],
    },
  );
}

function Render({ node, animate, color }: RenderProps<"sweepModule">) {
  const { w, h } = node.layout;
  if (!node.props.showDivider) return <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" />;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
      <line x1={8} y1={h - 112} x2={w - 8} y2={h - 112} stroke={color("primary")} strokeWidth={1} opacity={0.5}>
        {animate && (
          <animate attributeName="x2" values={`8;${w - 8}`} dur="700ms" begin="300ms" fill="freeze" />
        )}
      </line>
    </svg>
  );
}

defineComponent({
  kind: "sweepModule",
  label: "Sweep Module",
  category: "composites",
  tags: ["hud", "composite"],
  describe: "Boot/sweep status module: nested signal arcs, percentage readout and a typing terminal log.",
  factory,
  Render,
  controls: [{ kind: "toggle", key: "showDivider", label: "Divider rule" }],
  animBehaviors: ["fadeIn"],
  acceptsChildren: true,
});
