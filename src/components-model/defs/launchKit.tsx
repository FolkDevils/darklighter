/**
 * `launchKit` — trajectory + craft + coordinate block (PLAN.md §5.2
 * composites), rebuilt from primitives to match `assets/protora/Group
 * 147.svg` / `Group 328.svg`.
 *
 * REBUILT, NOT IMPORTED (docs/NORTH_STAR.md). The "wasp formation" variant
 * of the source pair is just the formation toggle below.
 */
import type { ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode } from "@/components-model/defaults";
import { part } from "@/components-model/scenes";

export interface LaunchKitProps {
  /** Horizon rule the trajectory launches from. */
  groundLine: boolean;
}

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    launchKit: LaunchKitProps;
  }
}

const W = 520;
const H = 340;

function wasps(count: number): ComponentNode[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) =>
    part(
      "craft",
      { x: 316 + (i % 2) * 54, y: 232 + Math.floor(i / 2) * 48, w: 44, h: 44 },
      { craftId: "wasp", roleColor: "primary", headingDeg: -28 },
      { name: `Wasp ${i + 1}`, animation: { behavior: "fadeIn", delayMs: 900 + i * 140, durationMs: 500 } },
    ),
  );
}

function factory(): ComponentNode<"launchKit"> {
  return baseNode(
    "launchKit",
    "Launch Kit",
    { groundLine: true },
    {
      layout: { w: W, h: H },
      animation: { cascade: true, staggerMs: 60 },
      children: [
        part(
          "trajectory",
          { x: 10, y: 20, w: 400, h: 190 },
          { arcHeight: 0.5, dashed: true, tickCount: 7, showApex: true, marker: "chevron" },
          { name: "Flight Path", animation: { behavior: "pathFollow", durationMs: 3600, easing: "linear" } },
        ),
        part(
          "craft",
          { x: 352, y: 16, w: 96, h: 96 },
          { craftId: "reaper", roleColor: "ink", headingDeg: 48 },
          { name: "Ownship", animation: { behavior: "fadeIn", delayMs: 400, durationMs: 700 } },
        ),
        part(
          "labelPill",
          { x: 12, y: 224, w: 140, h: 28 },
          { text: "TELEMETRY", fontSize: 11 },
          { name: "Telemetry Pill", animation: { behavior: "drawOn", delayMs: 500, durationMs: 700 } },
        ),
        part(
          "statusText",
          { x: 12, y: 262, w: 280, h: 74 },
          {
            lines: ["07:43:30 GMT-8", "051.4700° N / 000.4543° W", "STANDBY - ID: 3B-19"],
            fontSize: 11,
            roleColor: "ink",
          },
          { name: "Coords", animation: { behavior: "typewriter", delayMs: 700, durationMs: 1800 } },
        ),
        part(
          "readoutBar",
          { x: 316, y: 176, w: 190, h: 44 },
          { value: 62, label: "RANGE", showValue: false, segments: 22, barHeight: 8 },
          { name: "Range Bar", animation: { behavior: "drawOn", delayMs: 800, durationMs: 1400 } },
        ),
        ...wasps(4),
      ],
    },
  );
}

function Render({ node, animate, color }: RenderProps<"launchKit">) {
  const { w, h } = node.layout;
  if (!node.props.groundLine) return <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" />;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
      <line x1={10} y1={206} x2={w - 90} y2={206} stroke={color("primary")} strokeWidth={1} opacity={0.45}>
        {animate && <animate attributeName="x2" values={`10;${w - 90}`} dur="800ms" fill="freeze" />}
      </line>
    </svg>
  );
}

defineComponent({
  kind: "launchKit",
  label: "Launch Kit",
  category: "composites",
  tags: ["craft", "hud", "composite"],
  describe: "Launch/flight kit: trajectory arc, ownship craft, coordinate readout and wasp formation.",
  factory,
  Render,
  controls: [{ kind: "toggle", key: "groundLine", label: "Horizon rule" }],
  animBehaviors: ["fadeIn"],
  acceptsChildren: true,
});
