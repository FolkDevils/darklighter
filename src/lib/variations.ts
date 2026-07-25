/**
 * DETERMINISTIC VARIATIONS — the "endless" half of the mission (docs/
 * MISSION.md), and the cheapest possible payoff for an engine that is already
 * fully parametric.
 *
 * `generateVariations(node, n, axes)` returns n alternative trees. No AI, no
 * randomness that isn't seeded: variant `i` is a pure function of the base
 * node, the axis set and `i`, so the same request always yields the same grid
 * and a chosen variant re-renders byte-identically (invariant: same node, same
 * SVG). In Phase 7 this same function becomes an AI tool ("give me 20 of these").
 *
 * Nothing here invents geometry. Every axis moves values the component already
 * declares — seeds it already uses, colorways it already resolves through,
 * controls it already publishes. A variation cannot leave the brand system
 * because it never touches anything outside the registry's own vocabulary.
 */
import type { ColorwayId, ComponentNode } from "@/components-model/types";
import { componentDef } from "@/components-model/registry";

export type VariationAxis = "seed" | "colorway" | "density" | "speed";

export const AXIS_LABEL: Record<VariationAxis, string> = {
  seed: "Seed",
  colorway: "Colorway",
  density: "Density",
  speed: "Speed",
};

/**
 * Controls worth calling "density". Matched against a kind's declared control
 * keys rather than a hand-maintained per-kind table, so a new component with a
 * `count` prop joins in for free.
 */
const DENSITY_KEY = /count|density|rings|spokes|arcs|dots|lines|steps|segments|blips/i;

const COLORWAYS: ColorwayId[] = ["alert", "chrome"];

/** Small deterministic hash — variant i of a given base is always the same. */
function mix(seed: number, i: number, salt: number): number {
  let h = (seed ^ (i * 0x9e3779b1) ^ (salt * 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x2545f491) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

/** 0..1 from the same hash, for smooth axes. */
const unit = (seed: number, i: number, salt: number) => mix(seed, i, salt) / 0xffffffff;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Re-seed every node in the subtree that actually consumes a seed. */
function reseed(node: ComponentNode, i: number, depth = 0): ComponentNode {
  return {
    ...node,
    seed: mix(node.seed, i, depth + 1) % 1_000_000,
    children: node.children.map((c, j) => reseed(c, i, depth + j + 2)),
    slots: node.slots
      ? Object.fromEntries(
          Object.entries(node.slots).map(([k, v], j) => [k, v ? reseed(v, i, depth + j + 40) : null]),
        )
      : node.slots,
  };
}

/** A colorway is a whole-subtree skin, so it applies all the way down. */
function recolor(node: ComponentNode, colorway: ColorwayId): ComponentNode {
  return {
    ...node,
    style: { ...node.style, colorway },
    children: node.children.map((c) => recolor(c, colorway)),
    slots: node.slots
      ? Object.fromEntries(Object.entries(node.slots).map(([k, v]) => [k, v ? recolor(v, colorway) : null]))
      : node.slots,
  };
}

/**
 * Nudge every density-ish control in the subtree by one shared factor, clamped
 * to each control's own declared min/max. Shared, not per-node, so a scene
 * reads as "sparser" rather than as scrambled.
 */
function redensify(node: ComponentNode, factor: number): ComponentNode {
  let props = node.props as Record<string, unknown>;
  try {
    for (const c of componentDef(node.kind).controls) {
      if (c.kind !== "number" || !DENSITY_KEY.test(c.key)) continue;
      const current = Number(props[c.key]);
      if (!Number.isFinite(current)) continue;
      const next = Math.round(clamp(current * factor, c.min, c.max));
      if (next !== current) props = { ...props, [c.key]: next };
    }
  } catch {
    // Unknown kind — leave its props alone.
  }
  return {
    ...node,
    props: props as ComponentNode["props"],
    children: node.children.map((c) => redensify(c, factor)),
    slots: node.slots
      ? Object.fromEntries(Object.entries(node.slots).map(([k, v]) => [k, v ? redensify(v, factor) : null]))
      : node.slots,
  };
}

/**
 * Scale timing at the top only. Descendants that inherit follow automatically
 * (AnimationConfig.cascade), and ones that opted out of inheriting did so on
 * purpose — overriding them here would undo a deliberate choice.
 */
const respeed = (node: ComponentNode, factor: number): ComponentNode => ({
  ...node,
  animation: {
    ...node.animation,
    durationMs: Math.round(clamp(node.animation.durationMs * factor, 120, 60_000)),
  },
});

/**
 * `offset` walks to a fresh batch without losing determinism: batch 2 of a
 * grid is always the same batch 2. "More" is a different window onto one
 * infinite deterministic sequence, not a re-roll.
 */
export function generateVariations(
  base: ComponentNode,
  n: number,
  axes: VariationAxis[],
  offset = 0,
): ComponentNode[] {
  if (axes.length === 0) return [];
  const out: ComponentNode[] = [];
  for (let k = 1; k <= n; k++) {
    const i = offset + k;
    let v = base;
    if (axes.includes("seed")) v = reseed(v, i);
    if (axes.includes("colorway")) v = recolor(v, COLORWAYS[i % COLORWAYS.length]);
    if (axes.includes("density")) v = redensify(v, 0.6 + unit(base.seed, i, 7) * 0.9);
    if (axes.includes("speed")) v = respeed(v, 0.5 + unit(base.seed, i, 11) * 1.6);
    out.push(v);
  }
  return out;
}
