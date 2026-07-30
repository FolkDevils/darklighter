/**
 * `signalIntercept` — mirrored geo/timestamp readouts converging on a tracked
 * contact, over a decode/export status footer (PLAN.md §5.2 composites),
 * rebuilt from primitives to match a Figma "signal intercept" HUD panel.
 *
 * REBUILT, NOT IMPORTED (docs/NORTH_STAR.md) — the source panel's copy is
 * outlined vector paths with no live text; every field here is a real
 * `statusText`/`labelPill`/`craft` node instead, so it stays editable.
 *
 * The two coordinate columns and the two convergence arrows are each ONE
 * shared config rendered twice (mirrored `x`/`align`), not hand-duplicated
 * blocks — see `readoutColumn`/`readoutArrow` below. The DRK/LTR side rails
 * follow the same shape, generalizing `telemetryPanel`'s single rail to two
 * independently-labeled ones through one `rail()` helper.
 */
import type { ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode } from "@/components-model/defaults";
import { part } from "@/components-model/scenes";

export interface SignalInterceptProps {
  /** Vertical labels bookending the footer, like `telemetryPanel`'s rail — split across both edges here. */
  showRails: boolean;
  leftRailText: string;
  rightRailText: string;
}

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    signalIntercept: SignalInterceptProps;
  }
}

const W = 480;
const H = 340;

/** Both coordinate columns read the same intercept — one array, two renders. */
const READOUT_LINES = ["07:43:30 GMT-8", "LOCATION SPEC.", "SKY:", "TERRAIN:", "", "051.4700° N", "000.4543° W"];

/** One readout config, mirrored by `x`/`align` — see file header. */
function readoutColumn(x: number, align: "left" | "right", delayMs: number): ComponentNode {
  return part(
    "statusText",
    { x, y: 0, w: 190, h: 118 },
    { lines: READOUT_LINES, align, fontSize: 11, roleColor: "primary" },
    {
      name: align === "left" ? "Readout (Left)" : "Readout (Right)",
      animation: { behavior: "typewriter", delayMs, durationMs: 1400 },
    },
  );
}

/** One arrow config, placed twice — left/right is an `x` parameter, not a fork. */
function readoutArrow(x: number, delayMs: number): ComponentNode {
  return part(
    "vectorLine",
    { x, y: 108, w: 20, h: 48 },
    { angleDeg: 90, length: 38, dashed: false, endMarker: "arrow", origin: "start", showOrigin: false },
    { name: "Convergence Arrow", animation: { behavior: "drawOn", delayMs, durationMs: 500 } },
  );
}

function factory(): ComponentNode<"signalIntercept"> {
  return baseNode(
    "signalIntercept",
    "Signal Intercept",
    { showRails: true, leftRailText: "DRK", rightRailText: "LTR" },
    {
      layout: { w: W, h: H },
      animation: { cascade: true, staggerMs: 80 },
      children: [
        readoutColumn(0, "left", 0),
        readoutColumn(W - 190, "right", 0),
        readoutArrow(74, 500),
        readoutArrow(W - 94, 500),
        part(
          // nEUROn is the most compact planform — reads clearly in this tight gap.
          "craft",
          { x: W / 2 - 24, y: 146, w: 48, h: Math.round((48 * 129) / 146) },
          { craftId: "nEUROn", roleColor: "primary", headingDeg: 0 },
          { name: "Contact", animation: { behavior: "fadeIn", delayMs: 700, durationMs: 500 } },
        ),
        part(
          "statusText",
          { x: 30, y: 216, w: 380, h: 34 },
          {
            lines: ["DOMIRA — DECODING // ACCESS ALLOCATED GRANTED DATA", "LOG_034.TXT"],
            fontSize: 8.5,
            align: "left",
            roleColor: "ink",
          },
          { name: "Decode Log", animation: { behavior: "typewriter", delayMs: 900, durationMs: 1000 } },
        ),
        part(
          "labelPill",
          { x: 30, y: 254, w: 132, h: 26 },
          { text: "EXPORT PACKAGE", fontSize: 9 },
          { name: "Export Pill", animation: { behavior: "drawOn", delayMs: 1000, durationMs: 600 } },
        ),
        part(
          "targetGlyph",
          { x: 172, y: 250, w: 30, h: 30 },
          { shape: "none", icon: "loader", size: 20, roleColor: "primary" },
          { name: "Decode Spinner", animation: { behavior: "rotate", delayMs: 1000, durationMs: 1200 } },
        ),
        part(
          "targetGlyph",
          { x: 206, y: 250, w: 30, h: 30 },
          { shape: "none", icon: "dot", filled: true, size: 13, roleColor: "primary" },
          { name: "Live Dot", animation: { behavior: "blink", delayMs: 1000, durationMs: 900 } },
        ),
        part(
          "targetGlyph",
          { x: 2, y: 280, w: 50, h: 56 },
          { shape: "none", icon: "sparkle", filled: true, size: 36, roleColor: "primary" },
          { name: "Sparkle", animation: { behavior: "pulse", delayMs: 1150, durationMs: 1800 } },
        ),
        part(
          "statusText",
          { x: 62, y: 286, w: 386, h: 46 },
          { lines: ["THREATS VIA FREQUENCY", "IDENTIFIED"], fontSize: 15, align: "left", roleColor: "primary" },
          { name: "Threat Line", animation: { behavior: "fadeIn", delayMs: 1250, durationMs: 500 } },
        ),
      ],
    },
  );
}

/**
 * One vertical rail label, mirrored left/right by `x` — same
 * translate-then-rotate composition as `telemetryPanel`'s single rail (text
 * left at local origin, default start-anchor; `text-anchor`/an explicit
 * text `x,y` alongside a `rotate(...,cx,cy)` transform renders inconsistently
 * across SVG engines, so this shape is the one to reuse, not that one).
 */
function rail(text: string, x: number, h: number, primary: string) {
  return (
    <text
      transform={`translate(${x}, ${h - 40}) rotate(-90)`}
      fontFamily="'IBM Plex Mono', ui-monospace, monospace"
      fontSize={11}
      letterSpacing={4}
      fill={primary}
    >
      {text.toUpperCase()}
    </text>
  );
}

function Render({ node, animate, color }: RenderProps<"signalIntercept">) {
  const { w, h } = node.layout;
  const { showRails, leftRailText, rightRailText } = node.props;
  if (!showRails) return <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" />;

  const primary = color("primary");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
      {animate && (
        <animate attributeName="opacity" values="0;1" dur="600ms" begin="200ms" fill="freeze" />
      )}
      {rail(leftRailText, 14, h, primary)}
      {rail(rightRailText, w - 14, h, primary)}
    </svg>
  );
}

defineComponent({
  kind: "signalIntercept",
  label: "Signal Intercept",
  category: "composites",
  tags: ["hud", "craft", "text", "composite"],
  describe:
    "Mirrored geo/timestamp readouts converging on a tracked contact, with a decode/export status footer and side rails.",
  factory,
  Render,
  controls: [
    { kind: "toggle", key: "showRails", label: "Side rails" },
    { kind: "text", key: "leftRailText", label: "Left rail text", visibleWhen: (p) => Boolean(p.showRails) },
    { kind: "text", key: "rightRailText", label: "Right rail text", visibleWhen: (p) => Boolean(p.showRails) },
  ],
  animBehaviors: ["fadeIn"],
  acceptsChildren: true,
});
