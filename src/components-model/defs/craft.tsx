/**
 * `craft` — aircraft / drone silhouettes (PLAN.md §5.2). Geometry comes from
 * the named planforms in `assets/protora/drones/`, imported once as brand
 * assets (`npm run assets`) and swapped by `craftId`. Heading, ink role,
 * outline and drift stay parametric on top of that fixed art.
 *
 * The silhouette set itself lives in `craftMarks.tsx` so `blipField` can stamp
 * the same planforms into a swarm without importing this def.
 */
import type { ColorRole, ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode, COLOR_ROLE_OPTIONS } from "@/components-model/defaults";
import { brandAsset, assetPlacementSize } from "@/assets/brand/assets";
import {
  CRAFT_NOSE_TO_PATH,
  CRAFT_OPTIONS,
  DEFAULT_CRAFT,
  paintCraft,
  type CraftId,
} from "@/components-model/craftMarks";
import { behaviorOf, cycle, flightLoopPath, speedOf, timing } from "@/lib/anim";
import { seededRandom } from "@/lib/math";

export type { CraftId };
export { CRAFT_OPTIONS };

const CRAFT_BEHAVIORS = ["fadeIn", "pulse", "blink", "rotate", "drift"] as const;

export interface CraftProps {
  craftId: CraftId;
  roleColor: ColorRole;
  outlined: boolean;
  /** Nose direction in degrees; 0 = pointing up. */
  headingDeg: number;
  /** Wander radius for the `drift` behavior — a loitering patrol rather than a fixed icon. */
  driftRadius: number;
}

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    craft: CraftProps;
  }
}

/** Longest edge for a freshly placed craft — smaller than a full brand drop. */
const CRAFT_MAX_EDGE = 140;

/**
 * `flightLoopPath` is a Catmull-Rom spline — control points overshoot the
 * waypoint radius. The viewBox has to grow by more than `driftRadius` or the
 * tips still clip against the CSS box (HTML SVG ignores overflow="visible"
 * for that).
 */
const DRIFT_VIEW_PAD = 1.75;

function craftSize(craftId: CraftId): { w: number; h: number } {
  const asset = brandAsset(craftId);
  if (!asset) return { w: CRAFT_MAX_EDGE, h: CRAFT_MAX_EDGE };
  const placed = assetPlacementSize(asset);
  const scale = CRAFT_MAX_EDGE / Math.max(placed.w, placed.h);
  return {
    w: Math.max(1, Math.round(placed.w * scale)),
    h: Math.max(1, Math.round(placed.h * scale * 100) / 100),
  };
}

function factory(): ComponentNode<"craft"> {
  return baseNode(
    "craft",
    "Craft",
    { craftId: DEFAULT_CRAFT, roleColor: "ink", outlined: false, headingDeg: 0, driftRadius: 14 },
    { layout: craftSize(DEFAULT_CRAFT) },
  );
}

function Render({ node, animate, color }: RenderProps<"craft">) {
  const { w, h } = node.layout;
  const { craftId, roleColor, outlined, headingDeg, driftRadius } = node.props;
  const asset = brandAsset(craftId);
  const paint = color(roleColor);
  const behavior = animate ? behaviorOf(node.animation.behavior, CRAFT_BEHAVIORS) : null;
  const spin = node.animation.direction === "reverse" ? -360 : 360;
  const rand = (salt: number) => seededRandom(0, node.seed, salt);
  const vb = asset?.viewBox ?? { w: 100, h: 100 };
  const markup = asset
    ? paintCraft(asset.markup, `${asset.id}:${paint}:${outlined ? "o" : "f"}`, paint, outlined)
    : "";

  // Whenever this node is configured to drift — including while paused —
  // give it a physical margin around the layout box so the planform can
  // wander outside it without being clipped. A wider viewBox alone does NOT
  // do this: with width/height="100%" the viewBox-to-viewport ratio just
  // shrinks to fit the SAME physical box, so nothing actually bleeds. The
  // `<svg>` has to be physically bigger than its box, inset by `-pad` so it
  // stays centered — at pad=0 this is just the ordinary box, unchanged.
  const drifting = behavior === "drift";
  const pad = drifting ? Math.ceil(Math.max(0, driftRadius) * DRIFT_VIEW_PAD) : 0;

  const s = Math.min(w / vb.w, h / vb.h);
  // Offsets from the box's CENTER, not its top-left — every transform below
  // is expressed in a coordinate system re-origined there (see the outer
  // <g> below), so rotation always pivots on the artwork's own middle
  // instead of the box corner.
  const artX = -(vb.w * s) / 2;
  const artY = -(vb.h * s) / 2;

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${w + 2 * pad} ${h + 2 * pad}`}
      width={w + 2 * pad}
      height={h + 2 * pad}
      style={{ position: "absolute", left: -pad, top: -pad, overflow: "visible" }}
    >
      {behavior === "fadeIn" && <animate attributeName="opacity" {...timing(node.animation, "0", "1")} />}
      {behavior === "blink" && <animate attributeName="opacity" values="1;0.2;1" {...cycle(node.animation)} />}
      {/* Re-origin ONCE onto the box's center: `animateMotion` (and its
          rotate="auto") pivots on the LOCAL origin of the element it's
          attached to, not on wherever the art happens to be drawn. Leaving
          that origin at the box's top-left corner — the art's actual center
          — is what made a drifting craft swing in a wide arc around that
          corner instead of turning on the spot. */}
      <g transform={`translate(${w / 2}, ${h / 2})`}>
        <g>
          {behavior === "drift" && (
            <animateMotion
              path={flightLoopPath(rand, driftRadius, 8, node.animation.direction === "reverse")}
              rotate="auto"
              {...cycle(node.animation, 0, speedOf(node.animation, rand))}
            />
          )}
          {/* rotate="auto" yaws the nose onto the flight path; headingDeg is trim on top. */}
          <g transform={`rotate(${headingDeg + (drifting ? CRAFT_NOSE_TO_PATH : 0)})`}>
            {behavior === "pulse" && (
              <animateTransform
                attributeName="transform"
                type="scale"
                additive="sum"
                values="1;1.12;1"
                {...cycle(node.animation)}
              />
            )}
            {behavior === "rotate" && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                additive="sum"
                values={`0;${spin}`}
                {...cycle(node.animation)}
              />
            )}
            <g transform={`translate(${artX}, ${artY}) scale(${s})`} dangerouslySetInnerHTML={{ __html: markup }} />
          </g>
        </g>
      </g>
    </svg>
  );
}

defineComponent({
  kind: "craft",
  label: "Craft",
  category: "craft",
  tags: ["craft"],
  describe:
    "Named drone planform (X47C, nEUROn, X45C, Sentinel) with adjustable heading; can loiter on a drifting patrol.",
  factory,
  Render,
  controls: [
    { kind: "select", key: "craftId", label: "Craft", options: CRAFT_OPTIONS },
    {
      kind: "number",
      key: "headingDeg",
      label: "Heading",
      hint: "Nose angle when parked. While drifting, this is trim on top of the flight-path yaw.",
      min: -180,
      max: 180,
      step: 1,
    },
    { kind: "toggle", key: "outlined", label: "Outline only" },
    { kind: "select", key: "roleColor", label: "Color role", options: COLOR_ROLE_OPTIONS },
    {
      kind: "number",
      key: "driftRadius",
      label: "Wander radius",
      hint: "How far it loiters from its position. Speed is in the Animation section.",
      min: 0,
      max: 120,
      step: 1,
      group: "Movement",
      visibleWhen: (_p, node) => behaviorOf(node.animation.behavior, CRAFT_BEHAVIORS) === "drift",
    },
  ],
  animBehaviors: [...CRAFT_BEHAVIORS],
  // Fixed art: the planform's viewBox is native, so the box stays on that ratio.
  aspectOf: (node) => {
    const asset = brandAsset(node.props.craftId);
    return asset ? asset.viewBox.w / asset.viewBox.h : null;
  },
  acceptsChildren: false,
});
