/**
 * DARKLIGHTER COMPONENT MODEL — AUTHORITATIVE CONTRACT
 * ----------------------------------------------------
 * Written by the planning model. Implement AGAINST this file; do not redesign
 * it. If a change is unavoidable, record it in docs/DECISIONS.md first.
 *
 * The core idea: the canvas is a TREE of ComponentNodes (not a flat layer
 * list). Every node is independently selectable, styleable, animatable, and
 * exportable. Composites own free-form `children`; constrained replacement
 * points are named `slots` (e.g. the radar inside the P logo).
 *
 * Invariants (binding):
 *  - Nodes are only ever mutated through store actions (undo/edit-log safety).
 *  - All randomness flows through `seed` (deterministic render: same node ⇒
 *    same SVG, byte-for-byte).
 *  - Colors are token/colorway references — raw hexes only via
 *    `style.overrides`, and even those should come from brand tokens.
 *  - Base SVG attributes always equal the finished (resting) animation frame,
 *    so stripping SMIL nodes yields a correct static export.
 *  - `provenance.protected` nodes/presets are never overwritten; "save" forks.
 */

/* ------------------------------------------------------------------ */
/* Kind registry (open — extended via declaration merging)             */
/* ------------------------------------------------------------------ */

/**
 * Each component definition file augments this interface to register its
 * typed props payload, e.g.:
 *
 *   declare module "@/components-model/types" {
 *     interface KindPropsRegistry { ringSet: RingSetProps }
 *   }
 *
 * This keeps `types.ts` closed while the kind set stays open (adding a
 * component never edits this file).
 */
export interface KindPropsRegistry {
  /** Free-form group of children; the result of ⌘G. No own geometry. */
  composite: CompositeProps;
  /** Sanitized imported brand art (wordmarks, craft silhouettes…). */
  staticAsset: StaticAssetProps;
}

export type ComponentKind = keyof KindPropsRegistry & string;

export interface CompositeProps {
  /** Optional clip applied to children (SVG path data in node-local space). */
  clipPathData?: string;
}

export interface StaticAssetProps {
  /** Key into the static-asset registry (src/assets/brand/). */
  assetId: string;
  /** Recolor the asset's ink to a brand role (assets are single-ink). */
  inkRole?: ColorRole;
}

/* ------------------------------------------------------------------ */
/* Style                                                                */
/* ------------------------------------------------------------------ */

/** Semantic color roles — components ask for roles, colorways answer. */
export type ColorRole =
  | "primary"   // main line/fill (Red Alert in `alert`, HUD chrome in `chrome`)
  | "accent"    // hot highlight
  | "ink"       // darkest (Burnt Drone Brown)
  | "field"     // background/soft fill (Blimp White / Desert Sand)
  | "friendly"  // Army Green targets
  | "hostile"   // Blood Red targets
  | "electric"; // Electronic Ice Blue / Teal Sky highlights

export type ColorwayId = "alert" | "chrome" | "custom";

export interface StyleConfig {
  colorway: ColorwayId;
  /**
   * Per-role token overrides (values are brand-token ids from
   * src/data/brand/tokens.ts, not raw hexes). Only consulted when set;
   * `colorway: "custom"` typically pairs with a full override map.
   */
  overrides?: Partial<Record<ColorRole, string>>;
  /** Multiplier on the kind's default stroke widths (1 = default). */
  strokeScale: number;
  opacity: number; // 0..1
}

/* ------------------------------------------------------------------ */
/* Animation                                                            */
/* ------------------------------------------------------------------ */

export type EasingName = "linear" | "ease" | "easeIn" | "easeOut" | "easeInOut";

/**
 * Named animation behaviors. Which behaviors a kind supports is declared on
 * its ComponentDef (`animBehaviors`); the inspector only offers those.
 * Every behavior is implemented as SMIL (see PLAN.md §7).
 */
export type AnimBehavior =
  | "drawOn"      // stroke-dashoffset reveal (rings, arcs, lines)
  | "rotate"      // continuous rotation (sweep arm)
  | "ping"        // radiating scale+fade loop (Group 276 ping rings)
  | "pulse"       // opacity/scale pulse in place
  | "blink"       // hard on/off (blips)
  | "orbit"       // travels around the middle of its own box, keeping formation
  | "pathFollow"  // animateMotion along an explicit path child
  | "typewriter"  // per-line staggered text reveal
  | "march"       // dash pattern travels along a stroke (added Phase 2 — see docs/DECISIONS.md)
  | "drift"       // wanders a seeded loop around its home position — swarm/tracking motion (added Phase 3)
  | "fadeIn";

export interface AnimationConfig {
  /**
   * This node's master switch. `false` means this node renders its resting
   * frame, full stop — an ancestor's `cascade` can never override it.
   */
  enabled: boolean;
  /**
   * Take timing (duration/stagger/easing/loop) from the nearest ancestor with
   * `cascade`, so a composite plays as one choreographed sequence. `false`
   * means "use my own numbers", which is how a single part inside a scene gets
   * its own speed. Own `delayMs` and `behavior` always apply on top.
   * Added Phase 3 — see docs/DECISIONS.md.
   */
  inherit: boolean;
  behavior: AnimBehavior | null; // null = kind default
  durationMs: number;
  delayMs: number;
  /** Delay between successive internal elements (rings, blips, lines). */
  staggerMs: number;
  easing: EasingName;
  loop: boolean;
  loopDelayMs: number;
  direction: "normal" | "reverse";
  /**
   * Offer this node's timing to descendants that have `inherit`. A disabled
   * cascading node also silences those descendants, so turning a scene off at
   * the top turns the whole scene off; a child with `inherit: false` keeps
   * running on its own.
   */
  cascade: boolean;
}

/* ------------------------------------------------------------------ */
/* Node tree                                                            */
/* ------------------------------------------------------------------ */

export interface LayoutConfig {
  /** Position/size RELATIVE TO PARENT's local coordinate space. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees, around the node's own center. */
  rotation: number;
}

export interface ModifierInstance {
  defId: string; // key into the modifier registry
  params: Record<string, unknown>;
  enabled: boolean;
}

export type NodeSource = "library" | "user" | "ai" | "import";

export interface Provenance {
  source: NodeSource;
  /** Kind or preset id this node was derived from, if any. */
  baseComponent?: string;
  /** Approved originals: editing forks, never overwrites. */
  protected?: boolean;
  /** Experimental recipe ids attached in AI mode 3 (see patchSchema). */
  recipeIds?: string[];
}

export interface ComponentNode<K extends ComponentKind = ComponentKind> {
  id: string; // nanoid — unique across the WHOLE tree (flat id lookups OK)
  kind: K;
  name: string;
  layout: LayoutConfig;
  props: KindPropsRegistry[K];
  style: StyleConfig;
  animation: AnimationConfig;
  modifiers: ModifierInstance[];
  /** Free-form nesting. Render order = array order (last on top). */
  children: ComponentNode[];
  /**
   * Named slot contents, keyed by SlotDef.name from this kind's definition.
   * null = declared slot intentionally emptied by the user.
   * ONLY kinds whose def declares slots may have entries here.
   */
  slots?: Record<string, ComponentNode | null>;
  seed: number;
  locked: boolean;
  hidden: boolean;
  provenance: Provenance;
  notes?: string;
  /**
   * Knobs this node lifts out of its descendants — the top-level parameters of
   * an assembly (see components-model/exposed.ts). Additive and optional, so
   * every existing node and saved file is unaffected; added in the Library/
   * Composer pass, logged in docs/DECISIONS.md.
   *
   * Targets are child-index paths, not ids, because placing a library entry
   * clones the tree with fresh ids.
   */
  exposed?: import("./exposed").ExposedParam[];
}

/* ------------------------------------------------------------------ */
/* Slots                                                                */
/* ------------------------------------------------------------------ */

/**
 * Tags classify components for slot acceptance & AI reasoning, e.g. the
 * P logo's radar slot accepts anything tagged "radar".
 */
export type ComponentTag =
  | "radar" | "glyph" | "craft" | "text" | "logo" | "composite"
  | "line" | "particle" | "hud";

export interface SlotDef {
  name: string; // e.g. "radarFill"
  accepts: ComponentTag[];
  /** Where slot content is placed, in the HOST's local coordinate space. */
  frame: { x: number; y: number; w: number; h: number };
  /** Optional clip (SVG path data, host-local space) applied to content. */
  clipPathData?: string;
  /**
   * How the host composes slot content:
   *  - "overlay":  content renders normally on top of the host art.
   *  - "knockout": content strokes/fills are punched OUT of the host fill
   *    via a luminance mask (the approved P-logo treatment — see
   *    src/assets/brand/logoP.ts).
   */
  mode: "overlay" | "knockout";
  /** Factory for the approved default content (protected presets use this). */
  defaultContent?: () => ComponentNode;
}

/* ------------------------------------------------------------------ */
/* Selection                                                            */
/* ------------------------------------------------------------------ */

/**
 * Path of node ids from a root canvas node down to the selected node.
 * Click selects the top-level ancestor; double-click descends one level
 * (Figma-style). `[]` = nothing selected.
 */
export type SelectionPath = string[];

/* ------------------------------------------------------------------ */
/* Documents & presets                                                  */
/* ------------------------------------------------------------------ */

export interface DarklighterDoc {
  format: "darklighter";
  version: 1;
  name: string;
  background: { color: string }; // brand token id, default blimpWhite
  nodes: ComponentNode[];        // canvas roots, render order
}

/**
 * Loading is ALWAYS factory-hydrated: missing/new optional fields get
 * defaults from each kind's factory. Old files must stay loadable — keep
 * every future field optional in serialized form.
 */
export type PresetFile = DarklighterDoc & {
  presetId: string;
  protected?: boolean;
};
