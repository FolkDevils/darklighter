/**
 * `craft` — aircraft / drone silhouettes (PLAN.md §5.2), source geometry
 * family: `Group 276.svg` (delta), `Group 278.svg` (Reaper), `Group 328.svg`
 * (wasp formation).
 *
 * The silhouettes are drawn parametrically in a normalized 100×100 space and
 * scaled into the node's box, so they stay crisp at any size and can be
 * swapped from one select without touching layout — the same reason blips
 * share a glyph registry.
 */
import type { ColorRole, ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode, COLOR_ROLE_OPTIONS, strokeW } from "@/components-model/defaults";
import { behaviorOf, cycle, speedOf, timing, wanderPath } from "@/lib/anim";
import { seededRandom } from "@/lib/math";

const CRAFT_BEHAVIORS = ["fadeIn", "pulse", "blink", "rotate", "drift"] as const;

export type CraftId = "delta" | "reaper" | "wasp" | "arrowhead";

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

export const CRAFT_OPTIONS: { value: CraftId; label: string }[] = [
  { value: "delta", label: "Delta / stealth" },
  { value: "reaper", label: "Reaper drone" },
  { value: "wasp", label: "Wasp" },
  { value: "arrowhead", label: "Arrowhead" },
];

/** Path data in a 100×100 box, nose at the top, centered on x=50. */
const CRAFT_PATHS: Record<CraftId, string[]> = {
  delta: [
    "M50 6 L58 34 L94 88 L50 76 L6 88 L42 34 Z",
    "M50 24 L50 70",
  ],
  reaper: [
    "M47.6 10 C47.6 5 52.4 5 52.4 10 L52.4 70 L47.6 70 Z",
    "M6 45 L94 45 L94 48.5 L6 48.5 Z",
    "M50 70 L38 90 L41 90 L50 76 L59 90 L62 90 Z",
    "M43 62 L57 62 L57 65 L43 65 Z",
  ],
  wasp: [
    "M50 14 L57 44 L50 84 L43 44 Z",
    "M22 38 L43 46 L22 54 Z",
    "M78 38 L57 46 L78 54 Z",
  ],
  arrowhead: ["M50 8 L90 90 L50 68 L10 90 Z"],
};

function factory(): ComponentNode<"craft"> {
  return baseNode(
    "craft",
    "Craft",
    { craftId: "delta", roleColor: "ink", outlined: false, headingDeg: 0, driftRadius: 14 },
    { layout: { w: 120, h: 120 } },
  );
}

function Render({ node, animate, color }: RenderProps<"craft">) {
  const { w, h } = node.layout;
  const { craftId, roleColor, outlined, headingDeg, driftRadius } = node.props;
  const paint = color(roleColor);
  const s = Math.min(w, h) / 100;
  const behavior = animate ? behaviorOf(node.animation.behavior, CRAFT_BEHAVIORS) : null;
  const spin = node.animation.direction === "reverse" ? -360 : 360;
  const rand = (salt: number) => seededRandom(0, node.seed, salt);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
      {behavior === "fadeIn" && <animate attributeName="opacity" {...timing(node.animation, "0", "1")} />}
      {behavior === "blink" && <animate attributeName="opacity" values="1;0.2;1" {...cycle(node.animation)} />}
      {/* Drift moves the whole craft, so it wraps the oriented silhouette in
          its own group — animateMotion has no effect on an <svg> element. */}
      <g>
        {behavior === "drift" && (
          <animateMotion
            path={wanderPath(rand, driftRadius, 4, node.animation.direction === "reverse")}
            {...cycle(node.animation, 0, speedOf(node.animation, rand))}
          />
        )}
        <g transform={`translate(${w / 2}, ${h / 2}) rotate(${headingDeg}) scale(${s}) translate(-50, -50)`}>
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
              values={`0 50 50;${spin} 50 50`}
              {...cycle(node.animation)}
            />
          )}
          {CRAFT_PATHS[craftId].map((d, i) => (
            <path
              key={i}
              d={d}
              fill={outlined ? "none" : paint}
              stroke={paint}
              strokeWidth={strokeW(node, outlined ? 2 : 0.8)}
              strokeLinejoin="round"
            />
          ))}
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
    "Aircraft/drone silhouette (delta, Reaper, wasp, arrowhead) with adjustable heading; can loiter on a drifting patrol.",
  factory,
  Render,
  controls: [
    { kind: "select", key: "craftId", label: "Craft", options: CRAFT_OPTIONS },
    { kind: "number", key: "headingDeg", label: "Heading", min: -180, max: 180, step: 1 },
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
  acceptsChildren: false,
});
