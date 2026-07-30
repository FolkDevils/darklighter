/**
 * `targetGlyph` — single registry-swappable mark (PLAN.md §5.2), source
 * geometry family: `Group 145/325.svg`, `Group 322.svg`. Shapes live in
 * `src/components-model/glyphs.tsx` (shared with `blipField`): a container
 * `shape` plus a center `icon`, so any pairing is one node, not one id per
 * combination.
 */
import type { ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode, COLOR_ROLE_OPTIONS, strokeW } from "@/components-model/defaults";
import { GLYPH_ICON_OPTIONS, GLYPH_SHAPE_OPTIONS, renderGlyph, type GlyphIcon, type GlyphShape } from "@/components-model/glyphs";
import { behaviorOf, cycle, speedOf, timing, wanderPath } from "@/lib/anim";
import { seededRandom } from "@/lib/math";
import type { ColorRole } from "@/components-model/types";

const GLYPH_BEHAVIORS = ["blink", "pulse", "ping", "rotate", "drift", "fadeIn"] as const;

export interface TargetGlyphProps {
  shape: GlyphShape;
  icon: GlyphIcon;
  /** Solid fill vs stroked outline, for both the shape and its icon. */
  filled: boolean;
  size: number;
  roleColor: ColorRole;
  /** Wander radius for the `drift` behavior — a single contact being tracked. */
  driftRadius: number;
}

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    targetGlyph: TargetGlyphProps;
  }
}

function factory(): ComponentNode<"targetGlyph"> {
  return baseNode(
    "targetGlyph",
    "Target Glyph",
    { shape: "square", icon: "dot", filled: false, size: 32, roleColor: "primary", driftRadius: 12 },
    { layout: { w: 64, h: 64 } },
  );
}

function Render({ node, animate, color }: RenderProps<"targetGlyph">) {
  const { w, h } = node.layout;
  const { shape, icon, filled, size, roleColor, driftRadius } = node.props;
  const fill = color(roleColor);
  const behavior = animate ? behaviorOf(node.animation.behavior, GLYPH_BEHAVIORS) : null;
  const spin = node.animation.direction === "reverse" ? -360 : 360;
  const rand = (salt: number) => seededRandom(0, node.seed, salt);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
      {behavior === "fadeIn" && <animate attributeName="opacity" {...timing(node.animation, "0", "1")} />}
      {behavior === "blink" && <animate attributeName="opacity" values="1;0.1;1" {...cycle(node.animation)} />}
      {/* Motion sits on its own wrapper so it never fights the transform
          animations below (scale/rotate are additive on that group). */}
      <g>
        {behavior === "drift" && (
          <animateMotion
            path={wanderPath(rand, driftRadius, 4, node.animation.direction === "reverse")}
            {...cycle(node.animation, 0, speedOf(node.animation, rand))}
          />
        )}
        <g transform={`translate(${w / 2}, ${h / 2})`}>
          {behavior === "pulse" && (
            <animateTransform attributeName="transform" type="scale" additive="sum" values="1;1.35;1" {...cycle(node.animation)} />
          )}
          {behavior === "rotate" && (
            <animateTransform attributeName="transform" type="rotate" additive="sum" values={`0;${spin}`} {...cycle(node.animation)} />
          )}
          {behavior === "ping" && (
            <circle r={size * 0.6} fill="none" stroke={fill} strokeWidth={strokeW(node, 1.4)} opacity={0}>
              <animate attributeName="r" values={`${size * 0.6};${size * 1.8}`} {...cycle(node.animation)} />
              <animate attributeName="opacity" values="0.9;0" {...cycle(node.animation)} />
            </circle>
          )}
          {renderGlyph(shape, icon, {
            size,
            color: fill,
            fieldColor: color("field"),
            strokeWidth: strokeW(node, 1.6),
            filled,
          })}
        </g>
      </g>
    </svg>
  );
}

defineComponent({
  kind: "targetGlyph",
  label: "Target Glyph",
  category: "glyphs",
  tags: ["glyph"],
  describe: "A single swappable target mark: any container shape (square, circle, hex, bracket) with any center icon, outlined or filled.",
  factory,
  Render,
  controls: [
    { kind: "select", key: "shape", label: "Shape", options: GLYPH_SHAPE_OPTIONS },
    { kind: "select", key: "icon", label: "Center icon", options: GLYPH_ICON_OPTIONS },
    { kind: "toggle", key: "filled", label: "Filled" },
    { kind: "number", key: "size", label: "Size", min: 6, max: 200, step: 1 },
    { kind: "select", key: "roleColor", label: "Color role", options: COLOR_ROLE_OPTIONS },
    {
      kind: "number",
      key: "driftRadius",
      label: "Wander radius",
      hint: "How far the mark strays from its position. Speed is in the Animation section.",
      min: 0,
      max: 120,
      step: 1,
      group: "Movement",
      visibleWhen: (_p, node) => behaviorOf(node.animation.behavior, GLYPH_BEHAVIORS) === "drift",
    },
  ],
  animBehaviors: [...GLYPH_BEHAVIORS],
  acceptsChildren: false,
});
