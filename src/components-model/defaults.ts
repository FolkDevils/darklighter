/**
 * Shared node-field factories, built against the §5.3 contract
 * (`types.ts`/`registry.tsx`) but not itself part of the contract — every
 * `defs/<kind>.tsx` factory calls `baseNode()` so every ComponentNode is
 * fully hydrated the same way (PLAN.md §11 Phase 1 step 1).
 */
import { nanoid } from "nanoid";
import type {
  AnimationConfig,
  ColorRole,
  ComponentKind,
  ComponentNode,
  KindPropsRegistry,
  LayoutConfig,
  ModifierInstance,
  Provenance,
  StyleConfig,
} from "./types";
import { DEFAULT_COLORWAY } from "@/lib/colorway";

export const defaultLayout = (over: Partial<LayoutConfig> = {}): LayoutConfig => ({
  x: 80,
  y: 80,
  w: 240,
  h: 240,
  rotation: 0,
  ...over,
});

export const defaultStyle = (over: Partial<StyleConfig> = {}): StyleConfig => ({
  colorway: DEFAULT_COLORWAY,
  strokeScale: 1,
  opacity: 1,
  ...over,
});

export const defaultAnimation = (over: Partial<AnimationConfig> = {}): AnimationConfig => ({
  enabled: true,
  inherit: true,
  behavior: null,
  durationMs: 1200,
  delayMs: 0,
  staggerMs: 90,
  easing: "easeOut",
  loop: true,
  loopDelayMs: 900,
  direction: "normal",
  cascade: true,
  ...over,
});

export const defaultProvenance = (over: Partial<Provenance> = {}): Provenance => ({
  source: "library",
  ...over,
});

// Seeds only need to be stable per-node, not globally unique — a running
// counter salted with Date.now() is enough determinism-of-render fodder
// (invariant #6 lives in how the seed is CONSUMED, e.g. src/lib/math.ts).
let seedCounter = Math.floor(Math.random() * 100000);
export const freshSeed = (): number => (seedCounter = (seedCounter + 1) % 1_000_000);

export interface BaseNodeOverrides {
  layout?: Partial<LayoutConfig>;
  style?: Partial<StyleConfig>;
  animation?: Partial<AnimationConfig>;
  modifiers?: ModifierInstance[];
  children?: ComponentNode[];
  slots?: Record<string, ComponentNode | null>;
  provenance?: Partial<Provenance>;
  notes?: string;
  seed?: number;
}

/** Build a fully-hydrated ComponentNode. Every kind factory should go through this. */
export function baseNode<K extends ComponentKind>(
  kind: K,
  name: string,
  props: KindPropsRegistry[K],
  over: BaseNodeOverrides = {},
): ComponentNode<K> {
  return {
    id: nanoid(10),
    kind,
    name,
    layout: defaultLayout(over.layout),
    props,
    style: defaultStyle(over.style),
    animation: defaultAnimation(over.animation),
    modifiers: over.modifiers ?? [],
    children: over.children ?? [],
    slots: over.slots,
    seed: over.seed ?? freshSeed(),
    locked: false,
    hidden: false,
    provenance: defaultProvenance(over.provenance),
    notes: over.notes,
  };
}

/**
 * A kind's own stroke width, multiplied by the node's global `strokeScale`
 * (StyleConfig: "multiplier on the kind's default stroke widths"). Every
 * renderer emits stroke widths through this so the style multiplier is
 * honored uniformly instead of per-def.
 */
export function strokeW(node: ComponentNode, base: number): number {
  return base * (node.style.strokeScale ?? 1);
}

/** Shared `{value,label}` options for controls that pick a ColorRole. */
export const COLOR_ROLE_OPTIONS: { value: ColorRole; label: string }[] = [
  { value: "primary", label: "Primary" },
  { value: "accent", label: "Accent" },
  { value: "ink", label: "Ink" },
  { value: "field", label: "Field" },
  { value: "friendly", label: "Friendly" },
  { value: "hostile", label: "Hostile" },
  { value: "electric", label: "Electric" },
];
