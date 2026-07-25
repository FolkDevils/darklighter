/**
 * `markLockup` / `heroLockup` — wordmark + live radar (PLAN.md §5.2
 * composites), the generated answer to `Markwith acentleftsmalle accent.svg`
 * and `markwithAccentRadar.svg`.
 *
 * Only the wordmark is fixed art (docs/NORTH_STAR.md); the radar beside or
 * behind it is real `polarGrid`/`ringSet`/`sweep`/`blipField` children, so the
 * lockups animate and re-seed instead of being frozen exports.
 *
 * The radar parts are wrapped in ONE group so the whole radar can be dragged
 * and scaled as a unit (resizing a container scales its contents — see
 * `scaleSubtree` in state/store.ts), while each ring, spoke and blip inside it
 * stays individually editable. The hosts themselves draw nothing and expose no
 * props: everything visible is a part you can select.
 */
import type { ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode } from "@/components-model/defaults";
import { part } from "@/components-model/scenes";

export type MarkLockupProps = Record<string, never>;
export type HeroLockupProps = Record<string, never>;

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    markLockup: MarkLockupProps;
    heroLockup: HeroLockupProps;
  }
}

const W = 720;
const H = 260;
/** protoraWordmark's native aspect (1489×203), scaled into the lockup. */
const WORDMARK = { w: 470, h: 64 };

const EMPTY = ({ node }: RenderProps<"markLockup"> | RenderProps<"heroLockup">) => (
  <svg viewBox={`0 0 ${node.layout.w} ${node.layout.h}`} width="100%" height="100%" />
);

/** Compact lockup: a 176px radar mark to the left of the type. */
function markLeftChildren(): ComponentNode[] {
  const mark = { x: 8, y: 42, w: 176, h: 176 };
  const inner = { x: 0, y: 0, w: mark.w, h: mark.h };
  return [
    part("composite", mark, {}, {
      name: "Radar Mark",
      animation: { cascade: true, staggerMs: 90 },
      children: [
        part("polarGrid", inner, { spokeCount: 10, ringCount: 3, gridOpacity: 0.35 }, {
          name: "Mark Grid",
          animation: { behavior: "fadeIn" },
        }),
        part("ringSet", inner, { count: 3, labeled: false, strokeWidth: 1.4 }, {
          name: "Mark Rings",
          animation: { behavior: "drawOn", delayMs: 120 },
        }),
        part("sweep", inner, { arcSpanDeg: 55, length: 0.94 }, {
          name: "Mark Sweep",
          animation: { behavior: "rotate", inherit: false, durationMs: 3600, easing: "linear" },
        }),
        // Subtle drift only: the mark still has to read as a logo, and the
        // resting frame (what exports) is the blips at home either way.
        part("blipField", inner, {
          count: 5,
          distribution: "ring",
          dotSize: 6,
          roleColor: "accent",
          driftRadius: 9,
          driftLegs: 4,
          trail: 0,
        }, {
          name: "Mark Blips",
          animation: { behavior: "drift", inherit: false, delayMs: 400, durationMs: 8000 },
        }),
      ],
    }),
    part("staticAsset", { x: 214, y: 98, w: WORDMARK.w, h: WORDMARK.h }, { assetId: "protoraWordmark", inkRole: "ink" }, {
      name: "PROTORA Wordmark",
      animation: { behavior: "fadeIn", delayMs: 500 },
    }),
    part("vectorLine", { x: 214, y: 190, w: WORDMARK.w, h: 8 }, {
      angleDeg: 0,
      origin: "start",
      fitBox: true,
      dashed: false,
      endMarker: "none",
      showOrigin: false,
    }, {
      name: "Baseline Rule",
      style: { opacity: 0.7 },
      animation: { behavior: "drawOn", delayMs: 620 },
    }),
  ];
}

/** Hero lockup: a big fan sweeping behind the type. */
function radarBehindChildren(): ComponentNode[] {
  // The fan sits fully inside its group's box: a child's own viewBox clips it,
  // so bleeding it off the edge would cut the arcs flat.
  const fan = { x: 372, y: 0, w: 300, h: 300 };
  const inner = { x: 0, y: 0, w: fan.w, h: fan.h };
  return [
    part("composite", fan, {}, {
      name: "Radar Fan",
      animation: { cascade: true, staggerMs: 90 },
      children: [
        part("polarGrid", inner, { spokeCount: 16, ringCount: 5, sector: "fan", fanSpanDeg: 120, gridOpacity: 0.45 }, {
          name: "Fan Grid",
          animation: { behavior: "fadeIn" },
        }),
        part("sweep", inner, { arcSpanDeg: 100, length: 0.98, trailFade: true }, {
          name: "Fan Sweep",
          animation: { behavior: "rotate", inherit: false, durationMs: 5200, easing: "linear" },
        }),
        part("blipField", { x: 20, y: 20, w: inner.w - 40, h: inner.h - 40 }, {
          count: 10,
          distribution: "cluster",
          dotSize: 7,
          roleColor: "hostile",
          driftRadius: 14,
          driftLegs: 5,
          trail: 1,
        }, {
          name: "Fan Blips",
          animation: { behavior: "drift", inherit: false, delayMs: 300, durationMs: 9000 },
        }),
      ],
    }),
    part("staticAsset", { x: 70, y: 118, w: WORDMARK.w, h: WORDMARK.h }, { assetId: "protoraWordmark", inkRole: "ink" }, {
      name: "PROTORA Wordmark",
      animation: { behavior: "fadeIn", delayMs: 600 },
    }),
  ];
}

defineComponent({
  kind: "markLockup",
  label: "Mark Lockup",
  category: "logos",
  tags: ["logo", "composite"],
  describe:
    "PROTORA wordmark with a live radar mark to its left — the animated replacement for the compact lockup export.",
  factory: () =>
    baseNode(
      "markLockup",
      "Mark Lockup",
      {},
      { layout: { w: W, h: H }, animation: { cascade: true, staggerMs: 70 }, children: markLeftChildren() },
    ),
  Render: EMPTY,
  controls: [],
  animBehaviors: [],
  acceptsChildren: true,
});

defineComponent({
  kind: "heroLockup",
  label: "Hero Lockup",
  category: "logos",
  tags: ["logo", "composite"],
  describe: "PROTORA wordmark with the big radar fan sweeping behind the type — the generated hero lockup.",
  factory: () =>
    baseNode(
      "heroLockup",
      "Hero Lockup",
      {},
      { layout: { w: W, h: 300 }, animation: { cascade: true, staggerMs: 70 }, children: radarBehindChildren() },
    ),
  Render: EMPTY,
  controls: [],
  animBehaviors: [],
  acceptsChildren: true,
});
