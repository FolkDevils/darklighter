/**
 * `blipField` — generated target dots (PLAN.md §5.2), source geometry
 * family: `Frame (3).svg`, `Group 81.svg`. All positions derive from
 * `node.seed` via `seededRandom` (invariant #6 — deterministic render).
 *
 * Contacts can TRAVEL, not just flicker: `drift` wanders each blip around its
 * home position and `orbit` walks the whole formation around the middle of the
 * field, which is what makes a scope read as tracking moving things. Both come
 * from the shared helpers in `src/lib/anim.ts` (`wanderPath`, `speedOf`), so
 * any other kind can pick them up — see `craft`.
 *
 * Each contact is either a registry glyph or a named drone planform
 * (`craftMarks.tsx`) — same swarm, pick the mark family then the shape.
 */
import type { ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode, COLOR_ROLE_OPTIONS, strokeW } from "@/components-model/defaults";
import { GLYPH_OPTIONS, renderGlyph, type GlyphId } from "@/components-model/glyphs";
import {
  CRAFT_NOSE_TO_PATH,
  CRAFT_OPTIONS,
  DEFAULT_CRAFT,
  renderCraftMark,
  type CraftId,
} from "@/components-model/craftMarks";
import { seededRandom } from "@/lib/math";
import { behaviorOf, cycle, flightLoopPath, speedOf, stagger, timing, wanderPath } from "@/lib/anim";
import type { ColorRole } from "@/components-model/types";

/** Behaviors that move a blip rather than restyle it — they share the travel props. */
const TRAVEL = ["drift", "orbit"] as const;
const BLIP_BEHAVIORS = ["drift", "orbit", "blink", "pulse", "ping", "fadeIn"] as const;

/** Is this node set to a behavior that actually moves its blips? */
const travels = (node: ComponentNode): boolean =>
  (TRAVEL as readonly string[]).includes(behaviorOf(node.animation.behavior, BLIP_BEHAVIORS) ?? "");

export type BlipMark = "glyph" | "drone";

export interface BlipFieldProps {
  count: number;
  distribution: "ring" | "cluster" | "uniform";
  /** Glyph marks vs named drone planforms for every contact in the swarm. */
  mark: BlipMark;
  glyphId: GlyphId;
  craftId: CraftId;
  dotSize: number;
  glow: boolean;
  roleColor: ColorRole;
  /** How far a drifting contact strays from its home position, in px. */
  driftRadius: number;
  /** Waypoints in each contact's route: 3 is a lazy loop, 8 is jittery searching. */
  driftLegs: number;
  /** Ghost copies lagging behind each contact — the track history a scope paints. */
  trail: number;
}

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    blipField: BlipFieldProps;
  }
}

function factory(): ComponentNode<"blipField"> {
  return baseNode(
    "blipField",
    "Blip Field",
    {
      count: 14,
      distribution: "ring",
      mark: "glyph",
      glyphId: "squareDot",
      craftId: DEFAULT_CRAFT,
      dotSize: 10,
      glow: true,
      roleColor: "hostile",
      driftRadius: 26,
      driftLegs: 4,
      trail: 2,
    },
    { layout: { w: 280, h: 280 }, animation: { durationMs: 6000, staggerMs: 0 } },
  );
}

function positionFor(
  i: number,
  seed: number,
  distribution: BlipFieldProps["distribution"],
  w: number,
  h: number,
): [number, number] {
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.min(w, h) / 2 - 8;
  if (distribution === "uniform") {
    return [seededRandom(i, seed, 1) * w, seededRandom(i, seed, 2) * h];
  }
  if (distribution === "cluster") {
    const clusterAngle = seededRandom(Math.floor(i / 3), seed, 3) * 360;
    const clusterR = seededRandom(Math.floor(i / 3), seed, 4) * maxR * 0.7;
    const jitterA = clusterAngle + (seededRandom(i, seed, 5) - 0.5) * 40;
    const jitterR = clusterR + (seededRandom(i, seed, 6) - 0.5) * maxR * 0.25;
    const rad = (jitterA * Math.PI) / 180;
    return [cx + jitterR * Math.cos(rad), cy + jitterR * Math.sin(rad)];
  }
  // ring: scattered around the perimeter band
  const angle = seededRandom(i, seed, 7) * 360;
  const r = maxR * (0.55 + seededRandom(i, seed, 8) * 0.42);
  const rad = (angle * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function Render({ node, animate, color }: RenderProps<"blipField">) {
  const { w, h } = node.layout;
  const {
    count,
    distribution,
    mark,
    glyphId,
    craftId,
    dotSize,
    glow,
    roleColor,
    driftRadius,
    driftLegs,
    trail,
  } = node.props;
  const fill = color(roleColor);
  const n = Math.max(0, count);
  const anim = node.animation;
  const behavior = animate ? behaviorOf(anim.behavior, BLIP_BEHAVIORS) : null;
  const moving = behavior === "drift" || behavior === "orbit";
  const reverse = anim.direction === "reverse";
  const ghosts = moving ? Math.max(0, Math.min(4, Math.round(trail))) : 0;
  const cx = w / 2;
  const cy = h / 2;

  // Orbit just rotates existing positions around the field's own center, so
  // it never leaves the box. Drift is the one that pushes a contact past the
  // field's edge — give the box real (not just visual) room for that so
  // contacts don't get clipped mid-wander. Same trick as craft.tsx: the
  // viewBox alone doesn't create bleed room while width/height stay "100%",
  // so the <svg> has to be physically bigger, inset by `-pad` to stay
  // centered — at pad=0 (not drifting) this is just the ordinary box.
  const pad = behavior === "drift" ? Math.ceil(Math.max(0, driftRadius) * 1.75) : 0;

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${w + 2 * pad} ${h + 2 * pad}`}
      width={w + 2 * pad}
      height={h + 2 * pad}
      style={{ position: "absolute", left: -pad, top: -pad, overflow: "visible" }}
    >
      {Array.from({ length: n }, (_, i) => {
        const [x, y] = positionFor(i, node.seed, distribution, w, h);
        const s = dotSize * (0.75 + seededRandom(i, node.seed, 9) * 0.5);
        const rand = (salt: number) => seededRandom(i, node.seed, salt);
        // Blips read as independent contacts, so each gets a seeded phase
        // offset on top of the stagger — still deterministic, never lockstep.
        const phase = stagger(anim, i, n) + rand(10) * anim.durationMs;
        const markEl =
          mark === "drone"
            ? renderCraftMark(craftId, { size: s, color: fill })
            : renderGlyph(glyphId, { size: s, color: fill, strokeWidth: strokeW(node, 1.3) });
        const glowEl = glow ? <circle r={s * 1.9} fill={fill} opacity={0.18} /> : null;
        const body = (
          <>
            {glowEl}
            {markEl}
          </>
        );

        if (moving) {
          // Each contact travels at its own pace, and a ghost is simply the
          // same route started later — so the trail is always exactly the path
          // the contact took.
          const dur = speedOf(anim, rand);
          // Drones fly a one-direction loitering circuit (no path reversals, so
          // rotate="auto" turns the nose smoothly); glyphs keep the older
          // wander-to-random-points route since they have no heading to whip.
          const path =
            behavior !== "drift"
              ? ""
              : mark === "drone"
                ? flightLoopPath(rand, driftRadius, driftLegs, reverse)
                : wanderPath(rand, driftRadius, driftLegs, reverse);
          const turn = (reverse ? -360 : 360) * (rand(42) > 0.5 ? 1 : -1);
          const lag = dur * 0.055;
          // Orbit bank: tangent to the circle (bearing ± 90°), then the same
          // nose-to-tangent correction `flightLoopPath` needs (craftMarks.tsx).
          const bearing = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
          const bank = bearing + (turn > 0 ? 90 : -90) + CRAFT_NOSE_TO_PATH;

          const layer = (k: number) => {
            const timingProps = cycle(anim, phase + k * lag, dur);
            return (
              <g key={k} opacity={k === 0 ? undefined : 0.4 / k}>
                {behavior === "drift" ? (
                  <>
                    {/* rotate="auto" yaws onto the path tangent — same trick as
                        trajectory's pathFollow. Art is nose-up, so −90° first. */}
                    <animateMotion path={path} rotate={mark === "drone" ? "auto" : 0} {...timingProps} />
                    {glowEl}
                    {mark === "drone" ? (
                      <g transform={`rotate(${CRAFT_NOSE_TO_PATH})`}>{markEl}</g>
                    ) : (
                      markEl
                    )}
                  </>
                ) : (
                  <>
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      values={`0 ${cx - x} ${cy - y};${turn} ${cx - x} ${cy - y}`}
                      {...timingProps}
                    />
                    {mark === "drone" ? (
                      // No upright counter-spin: bank with the formation so the
                      // nose stays on the flight path as the swarm turns.
                      <g transform={`rotate(${bank})`}>
                        {glowEl}
                        {markEl}
                      </g>
                    ) : (
                      <g>
                        <animateTransform
                          attributeName="transform"
                          type="rotate"
                          values={`0;${-turn}`}
                          {...timingProps}
                        />
                        {body}
                      </g>
                    )}
                  </>
                )}
              </g>
            );
          };

          return (
            <g key={i} transform={`translate(${x}, ${y})`}>
              {/* Ghosts first so the live contact paints over its own history. */}
              {Array.from({ length: ghosts }, (_, k) => layer(ghosts - k))}
              {layer(0)}
            </g>
          );
        }

        return (
          <g key={i} transform={`translate(${x}, ${y})`}>
            {behavior === "fadeIn" && (
              <animate attributeName="opacity" {...timing(anim, "0", "1", stagger(anim, i, n))} />
            )}
            {behavior === "blink" && (
              <animate attributeName="opacity" values="1;0.12;1" {...cycle(anim, phase)} />
            )}
            {behavior === "pulse" && (
              <animateTransform
                attributeName="transform"
                type="scale"
                additive="sum"
                values="1;1.5;1"
                {...cycle(anim, phase)}
              />
            )}
            {behavior === "ping" && (
              <circle r={s} fill="none" stroke={fill} strokeWidth={strokeW(node, 1.2)} opacity={0}>
                <animate attributeName="r" values={`${s};${s * 4}`} {...cycle(anim, phase)} />
                <animate attributeName="opacity" values="0.85;0" {...cycle(anim, phase)} />
              </circle>
            )}
            {body}
          </g>
        );
      })}
    </svg>
  );
}

defineComponent({
  kind: "blipField",
  label: "Blip Field",
  category: "radar",
  tags: ["radar"],
  describe:
    "Deterministically generated contacts (seed-driven ring/cluster/uniform). Stamp each as a glyph or a named drone planform; drones yaw onto their flight path while glyphs stay upright. Drift, orbit, optional track trails.",
  factory,
  Render,
  controls: [
    { kind: "number", key: "count", label: "Count", min: 0, max: 200, step: 1 },
    {
      kind: "select",
      key: "distribution",
      label: "Distribution",
      options: [
        { value: "ring", label: "Ring" },
        { value: "cluster", label: "Cluster" },
        { value: "uniform", label: "Uniform" },
      ],
    },
    {
      kind: "select",
      key: "mark",
      label: "Mark",
      options: [
        { value: "glyph", label: "Glyph" },
        { value: "drone", label: "Drone" },
      ],
      hint: "Glyphs are the classic tracking marks; drones stamp a named planform at every contact.",
    },
    {
      kind: "select",
      key: "glyphId",
      label: "Glyph",
      options: GLYPH_OPTIONS,
      visibleWhen: (p) => p.mark !== "drone",
    },
    {
      kind: "select",
      key: "craftId",
      label: "Drone",
      options: CRAFT_OPTIONS,
      visibleWhen: (p) => p.mark === "drone",
    },
    { kind: "number", key: "dotSize", label: "Dot size", min: 2, max: 60, step: 1 },
    { kind: "toggle", key: "glow", label: "Glow" },
    { kind: "select", key: "roleColor", label: "Color role", options: COLOR_ROLE_OPTIONS },
    // Shown only when the node's behavior actually moves the contacts — speed
    // itself stays in the Animation section, where every kind's timing lives.
    {
      kind: "number",
      key: "driftRadius",
      label: "Wander radius",
      hint: "How far each contact strays from where it started.",
      min: 0,
      max: 160,
      step: 1,
      group: "Movement",
      visibleWhen: (_p, node) => travels(node),
    },
    {
      kind: "number",
      key: "driftLegs",
      label: "Route legs",
      hint: "Waypoints per lap: 3 is a lazy loop, 8 is jittery searching.",
      min: 3,
      max: 8,
      step: 1,
      group: "Movement",
      visibleWhen: (_p, node) => travels(node),
    },
    {
      kind: "number",
      key: "trail",
      label: "Track trail",
      hint: "Ghost copies lagging behind each contact, like a scope's track history.",
      min: 0,
      max: 4,
      step: 1,
      group: "Movement",
      visibleWhen: (_p, node) => travels(node),
    },
  ],
  animBehaviors: [...BLIP_BEHAVIORS],
  acceptsChildren: false,
});
