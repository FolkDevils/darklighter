/**
 * DARKLIGHTER COMPONENT REGISTRY — AUTHORITATIVE CONTRACT
 * -------------------------------------------------------
 * Written by the planning model. Implement AGAINST this shape; do not
 * redesign. Deviations go in docs/DECISIONS.md first.
 *
 * Registry-driven everything (inherited from the reference app): the library
 * gallery, inspector, canvas renderer, export pipeline, and AI manifest ALL
 * read from this registry. Registering one ComponentDef lights up the whole
 * app — no switch statements anywhere else.
 *
 * NOTE: imports resolve after the Phase 0 scaffold installs react. The
 * ControlSpec type is ported verbatim from the reference app
 * (23andme-org-datavis/src/graphics/controlSpec.ts) in Phase 0.
 */
import type { ReactElement } from "react";
import type {
  ComponentKind,
  ComponentNode,
  ComponentTag,
  KindPropsRegistry,
  SlotDef,
  AnimBehavior,
} from "./types";
import type { ControlSpec } from "./controlSpec";

/* ------------------------------------------------------------------ */
/* Definition                                                           */
/* ------------------------------------------------------------------ */

export interface RenderProps<K extends ComponentKind = ComponentKind> {
  node: ComponentNode<K>;
  /** False during static export & paused playback — SMIL nodes are omitted. */
  animate: boolean;
  /**
   * Resolve a ColorRole to a concrete hex through the node's colorway +
   * overrides (implemented in Phase 1 as lib/colorway.ts; injected so
   * renderers never import token tables directly).
   */
  color: (role: import("./types").ColorRole) => string;
  /**
   * Light or dark page. `color` already accounts for it, so most renderers can
   * ignore this — it exists for hosts that resolve colors for a node OTHER than
   * their own (a slot child with its own style: see defs/logoP.tsx).
   */
  surface?: import("@/lib/colorway").Surface;
}

export interface ComponentDef<K extends ComponentKind = ComponentKind> {
  kind: K;
  /** Human name in the library gallery. */
  label: string;
  /** Gallery grouping: Radar / Glyphs / Craft / Text / Logos / Composites. */
  category: "radar" | "glyphs" | "craft" | "text" | "logos" | "composites";
  /** Tags drive slot acceptance + AI reasoning ("replace the aircraft…"). */
  tags: ComponentTag[];
  /** One-liner surfaced in the AI manifest. */
  describe: string;
  /**
   * Factory: a fully hydrated node with on-brand defaults. MUST populate
   * every field of ComponentNode (id, seed, style, animation, provenance…)
   * via shared helpers in defaults.ts. Never partially construct nodes
   * anywhere else — serialization hydration reuses this factory.
   */
  factory: () => ComponentNode<K>;
  /**
   * Renders a complete <svg viewBox="..."> (or <g> when `nested` is true)
   * purely from props. Deterministic: same node ⇒ identical output.
   * Base attributes = finished animation frame (static-export invariant).
   */
  Render: (p: RenderProps<K>) => ReactElement;
  /** Declarative inspector controls for `props` (ControlSpec v2 semantics:
   *  hint / group / visibleWhen all supported). */
  controls: ControlSpec[];
  /** Animation behaviors this kind supports; first entry = default. */
  animBehaviors: AnimBehavior[];
  /** Named constrained replacement points (see types.SlotDef). */
  slots?: SlotDef[];
  /**
   * May users drop children into this node freely (canvas drag-into,
   * ⌘G grouping)? Composites: true. Leaf primitives: false.
   */
  acceptsChildren: boolean;
  /**
   * Native width÷height for kinds that draw into a FIXED viewBox instead of
   * deriving one from `node.layout` — the fixed art (docs/NORTH_STAR.md).
   *
   * Generated parts restate their geometry at whatever box they are given, so
   * they fill it at any ratio. Fixed art can't: it fits with `xMidYMid meet`,
   * so an off-ratio box letterboxes the art while the box — what handles,
   * group bounds and export all measure — stays full size. Declaring the ratio
   * lets the store keep the box ON it, which is also the right answer on
   * brand grounds: a squashed mark is off-brand, not merely mis-measured.
   *
   * A function because it can depend on props (`staticAsset` per `assetId`).
   * Return null to opt a particular node out.
   */
  aspectOf?: (node: ComponentNode<K>) => number | null;
}

/* ------------------------------------------------------------------ */
/* Registration                                                         */
/* ------------------------------------------------------------------ */

const REGISTRY = new Map<ComponentKind, ComponentDef>();

/** Identity + registration helper. Call once per kind at module scope. */
export function defineComponent<K extends ComponentKind>(
  def: ComponentDef<K>,
): ComponentDef<K> {
  if (REGISTRY.has(def.kind)) {
    throw new Error(`duplicate component kind: ${def.kind}`);
  }
  REGISTRY.set(def.kind, def as unknown as ComponentDef);
  return def;
}

export function componentDef<K extends ComponentKind>(kind: K): ComponentDef<K> {
  const def = REGISTRY.get(kind);
  if (!def) throw new Error(`unknown component kind: ${kind}`);
  return def as unknown as ComponentDef<K>;
}

export const allComponentDefs = (): ComponentDef[] => [...REGISTRY.values()];

/** Kinds whose tags intersect `accepts` — the slot-replacement candidates. */
export const kindsForSlot = (accepts: ComponentTag[]): ComponentDef[] =>
  allComponentDefs().filter((d) => d.tags.some((t) => accepts.includes(t)));

/**
 * This node's locked width÷height, or null if it may take any shape. Tolerates
 * unknown kinds so a file from a newer build still loads.
 */
export function nativeAspect(node: ComponentNode): number | null {
  let a: number | null | undefined;
  try {
    a = componentDef(node.kind).aspectOf?.(node);
  } catch {
    return null;
  }
  return a != null && Number.isFinite(a) && a > 0 ? a : null;
}

/** `w`×`h` corrected onto `aspect`, driven by whichever edge the user moved. */
export function fitToAspect(
  w: number,
  h: number,
  aspect: number,
  drive: "w" | "h" = "w",
): { w: number; h: number } {
  const round = (v: number) => Math.max(1, Math.round(v * 100) / 100);
  return drive === "h" ? { w: round(h * aspect), h: round(h) } : { w: round(w), h: round(w / aspect) };
}

/* ------------------------------------------------------------------ */
/* Phase-1 registration order (implement in this order; PLAN.md §5.2)   */
/* ------------------------------------------------------------------ */
// composite, staticAsset                      ← Phase 1, trivial hosts
// ringSet, sweep, polarGrid, targetGlyph,     ← Phase 1 primitives
// reticle, arcSignal, blipField, statusText,
// labelPill, vectorLine
// trajectory, focusArcs, craft, particleField ← Phase 2
// radarScope, telemetryPanel, sweepModule,    ← Phase 2 composites
// launchKit, markLockup, logoP
//
// Each lives in src/components-model/defs/<kind>.ts(x) which:
//   1. declares its props interface,
//   2. augments KindPropsRegistry (declaration merging),
//   3. calls defineComponent({...}).
// A single side-effect import barrel (defs/index.ts) loads them all.

// Re-export for convenience so def files import from one place.
export type { ComponentNode, KindPropsRegistry };
