/**
 * `telemetryPanel` — small scope + framing + corner labels (PLAN.md §5.2
 * composites), rebuilt from primitives to match `assets/protora/Group
 * 145.svg` / `Group 325.svg`.
 *
 * REBUILT, NOT IMPORTED (docs/NORTH_STAR.md). The hot-red vs dark-maroon
 * "skins" of the source pair are just the `alert` and `chrome` colorways on
 * the same node — one component, both files.
 */
import type { ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode } from "@/components-model/defaults";
import { part } from "@/components-model/scenes";

export interface TelemetryPanelProps {
  /** Vertical `SYSTEM` rail down the left edge of the source panels. */
  showSideRail: boolean;
  railText: string;
}

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    telemetryPanel: TelemetryPanelProps;
  }
}

const W = 460;
const H = 320;

function factory(): ComponentNode<"telemetryPanel"> {
  return baseNode(
    "telemetryPanel",
    "Telemetry Panel",
    { showSideRail: true, railText: "SYSTEM" },
    {
      layout: { w: W, h: H },
      animation: { cascade: true, staggerMs: 60 },
      children: [
        part(
          "cornerFrame",
          { x: 0, y: 0, w: W, h: H },
          { style: "brackets", cornerLength: 30, caption: "TELEMETRY" },
          { name: "Frame", animation: { behavior: "drawOn", durationMs: 800 } },
        ),
        part(
          "ringSet",
          { x: 36, y: 60, w: 200, h: 200 },
          { count: 2, labeled: true, labelStep: 2, labelUnit: "NM", accentOuter: false, strokeWidth: 1.3 },
          { name: "Scope Rings", animation: { behavior: "drawOn", delayMs: 200, durationMs: 900 } },
        ),
        part(
          "reticle",
          { x: 56, y: 80, w: 160, h: 160 },
          { axesLength: 160, ringCount: 1, innerRadius: 34, strokeWidth: 1, centerGap: 0 },
          { name: "Crosshair", animation: { behavior: "drawOn", delayMs: 350, durationMs: 700 } },
        ),
        part(
          "blipField",
          { x: 46, y: 70, w: 180, h: 180 },
          {
            count: 6,
            distribution: "cluster",
            glyphShape: "square",
            glyphIcon: "dot",
            dotSize: 8,
            roleColor: "hostile",
            driftRadius: 16,
            driftLegs: 5,
            trail: 1,
          },
          { name: "Contacts", animation: { behavior: "drift", delayMs: 700, durationMs: 7500 } },
        ),
        part(
          "labelPill",
          { x: 262, y: 62, w: 150, h: 28 },
          { text: "UNITS AQUIRED", fontSize: 10 },
          { name: "Units Pill", animation: { behavior: "drawOn", delayMs: 500, durationMs: 700 } },
        ),
        part(
          "statusText",
          { x: 262, y: 104, w: 180, h: 90 },
          {
            lines: ["CONFIG TARGET", "SUCCESSFUL", "*** DATA_042"],
            fontSize: 11,
            roleColor: "primary",
          },
          { name: "Status", animation: { behavior: "typewriter", delayMs: 800, durationMs: 1600 } },
        ),
        part(
          "targetGlyph",
          { x: 268, y: 214, w: 40, h: 40 },
          { shape: "hex", icon: "bolt", size: 26, roleColor: "primary" },
          { name: "Bolt", animation: { behavior: "pulse", delayMs: 900, durationMs: 2000 } },
        ),
        part(
          "vectorLine",
          { x: 292, y: 196, w: 160, h: 80 },
          { angleDeg: -12, length: 120, dashed: true, endMarker: "arrow" },
          { name: "Bearing", animation: { behavior: "drawOn", delayMs: 1000, durationMs: 900 } },
        ),
      ],
    },
  );
}

function Render({ node, animate, color }: RenderProps<"telemetryPanel">) {
  const { w, h } = node.layout;
  const { showSideRail, railText } = node.props;
  if (!showSideRail) return <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" />;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
      <text
        transform={`translate(14, ${h - 40}) rotate(-90)`}
        fontFamily="'IBM Plex Mono', ui-monospace, monospace"
        fontSize={11}
        letterSpacing={4}
        fill={color("primary")}
      >
        {animate && <animate attributeName="opacity" values="0;1" dur="600ms" begin="200ms" fill="freeze" />}
        {railText.toUpperCase()}
      </text>
    </svg>
  );
}

defineComponent({
  kind: "telemetryPanel",
  label: "Telemetry Panel",
  category: "composites",
  tags: ["radar", "hud", "composite"],
  describe: "Small 2NM scope with corner frame, acquisition pill, status block and bearing line.",
  factory,
  Render,
  controls: [
    { kind: "toggle", key: "showSideRail", label: "Side rail" },
    { kind: "text", key: "railText", label: "Rail text", visibleWhen: (p) => Boolean(p.showSideRail) },
  ],
  animBehaviors: ["fadeIn"],
  acceptsChildren: true,
});
