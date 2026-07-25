/**
 * `radarScope` — the whole-scope scene (PLAN.md §5.2 composites), rebuilt
 * from primitives to match `assets/protora/Group 81 (1).svg`.
 *
 * REBUILT, NOT IMPORTED (docs/NORTH_STAR.md): every ring, spoke, blip and
 * label is a live child node, so the scope can be re-seeded, re-counted,
 * recolored and re-timed into a hundred variants instead of one flat file.
 */
import type { ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode } from "@/components-model/defaults";
import { part } from "@/components-model/scenes";

/**
 * No props: the scope is purely a container for its parts.
 *
 * It used to paint a dark disc behind itself (the source scene's `#330000`
 * field). That's gone, not defaulted off — a component that paints its own
 * backdrop can only ever sit on that backdrop, which makes it a picture of a
 * radar rather than a part you can compose with. Transparent, it takes the
 * colour of whatever page it lands on, and its contacts re-ink with that page
 * (lib/colorway.ts). Removing the prop rather than flipping its default also
 * means documents saved with the disc switched on lose it too.
 */
export type RadarScopeProps = Record<string, never>;

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    radarScope: RadarScopeProps;
  }
}

const SIZE = 520;

function factory(): ComponentNode<"radarScope"> {
  const inset = (n: number) => (SIZE - n) / 2;
  return baseNode(
    "radarScope",
    "Radar Scope",
    {},
    {
      layout: { w: SIZE, h: SIZE },
      animation: { cascade: true, staggerMs: 70 },
      children: [
        part(
          "polarGrid",
          { x: inset(470), y: inset(470), w: 470, h: 470 },
          { spokeCount: 12, ringCount: 3, gridOpacity: 0.3 },
          { name: "Grid", animation: { behavior: "fadeIn", delayMs: 0, durationMs: 900 } },
        ),
        part(
          "ringSet",
          { x: inset(470), y: inset(470), w: 470, h: 470 },
          // `ink` rather than `field`: these used to be light type ON the dark
          // disc. With no disc they sit on the page, and `ink` is the role that
          // reverses with it, so they read on either canvas.
          { count: 5, labeled: true, labelStep: 2, labelUnit: "NM", labelRole: "ink", accentOuter: true },
          { name: "Range Rings", animation: { behavior: "drawOn", delayMs: 150, durationMs: 1400, staggerMs: 120 } },
        ),
        part(
          "sweep",
          { x: inset(460), y: inset(460), w: 460, h: 460 },
          { arcSpanDeg: 62, length: 0.95 },
          { name: "Sweep", animation: { behavior: "rotate", durationMs: 4200, easing: "linear", loop: true } },
        ),
        // The three contact fields are what makes the scope read as live: each
        // one moves on its own terms — loose traffic wandering, a friendly
        // formation orbiting, and three hostiles tracking with visible trails.
        part(
          "blipField",
          { x: inset(430), y: inset(430), w: 430, h: 430 },
          {
            count: 9,
            distribution: "ring",
            glyphId: "squareDot",
            dotSize: 9,
            roleColor: "ink",
            driftRadius: 24,
            driftLegs: 5,
            trail: 1,
          },
          { name: "Contacts", animation: { behavior: "drift", durationMs: 9000, delayMs: 400 } },
        ),
        part(
          "blipField",
          { x: inset(360), y: inset(360), w: 360, h: 360 },
          { count: 5, distribution: "cluster", glyphId: "plainX", dotSize: 11, roleColor: "friendly", glow: false, trail: 0 },
          { name: "Friendlies", animation: { behavior: "orbit", durationMs: 26000, delayMs: 600, easing: "linear" } },
        ),
        part(
          "blipField",
          { x: inset(400), y: inset(400), w: 400, h: 400 },
          {
            count: 3,
            distribution: "ring",
            glyphId: "circleX",
            dotSize: 13,
            roleColor: "hostile",
            driftRadius: 46,
            driftLegs: 4,
            trail: 3,
          },
          { name: "Hostiles", animation: { behavior: "drift", durationMs: 6500, delayMs: 300 } },
        ),
        part(
          "reticle",
          { x: inset(120), y: inset(120), w: 120, h: 120 },
          { axesLength: 96, ringCount: 2, strokeWidth: 1.2 },
          { name: "Center Reticle", animation: { behavior: "drawOn", delayMs: 900, durationMs: 700 } },
        ),
      ],
    },
  );
}

/**
 * Draws nothing of its own — every mark on screen belongs to a child node, and
 * the background belongs to the page. The empty `<svg>` is still the contract:
 * `RenderNode` expects one element back, and the children compose inside it.
 */
function Render({ node }: RenderProps<"radarScope">) {
  const { w, h } = node.layout;
  return <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" />;
}

defineComponent({
  kind: "radarScope",
  label: "Radar Scope",
  category: "composites",
  tags: ["radar", "composite"],
  describe:
    "Full radar scope generated from grid + range rings + sweep + seeded contact blips + center reticle. Every part stays editable.",
  factory,
  Render,
  controls: [],
  // A pure container: the parts inside carry the motion, and cascade timing
  // reaches them from this node's animation config.
  animBehaviors: [],
  acceptsChildren: true,
});
