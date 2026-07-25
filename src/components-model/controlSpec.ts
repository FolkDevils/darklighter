/**
 * Declarative description of the editable controls a component exposes in
 * the inspector. Keeps the inspector generic — each component just publishes
 * which props fields are tweakable and how; complex/nested props are edited
 * via a raw JSON editor every component gets for free (Phase 3).
 *
 * Ported from the reference app (23andme-org-datavis/src/graphics/
 * controlSpec.ts, PLAN.md §4 "PORT"). Trimmed of genetics/map-specific
 * control kinds (`maptheme`, `fillmap`, `wheelway`) that have no Darklighter
 * equivalent — logged in docs/DECISIONS.md. `colorway` is kept and now means
 * the Protora `alert`/`chrome`/`custom` colorway (see src/lib/colorway.ts),
 * not Helix's research color ramps.
 */

/**
 * Metadata shared by every control kind (ControlSpec v2). All optional, so
 * existing specs keep working untouched.
 */
export interface ControlMeta {
  /**
   * Short human/AI-readable note about what the control does. Surfaced in
   * the AI tool manifest (Phase 7) so the partner understands each field's
   * intent.
   */
  hint?: string;
  /**
   * Optional group label. Controls sharing a `group` render together under a
   * labelled sub-section in the inspector (e.g. a shared trait). Ungrouped
   * controls render in the component's own kind-specific block.
   */
  group?: string;
  /**
   * Conditional visibility. When present and it returns false for the
   * current props, the control is hidden. Pure — never mutates.
   *
   * The whole node is passed as a second argument (added Phase 3 — see
   * docs/DECISIONS.md) so a control can also depend on state that doesn't live
   * in props: movement-shaping controls, for example, are pointless unless the
   * node's `animation.behavior` is one that actually moves anything.
   */
  visibleWhen?: (props: Record<string, unknown>, node: import("./types").ComponentNode) => boolean;
}

export type ControlSpec = ControlMeta &
  (
    | { kind: "number"; key: string; label: string; min: number; max: number; step?: number }
    | { kind: "text"; key: string; label: string }
    | { kind: "toggle"; key: string; label: string }
    | { kind: "color"; key: string; label: string }
    | { kind: "colorway"; label: string }
    | { kind: "labellist"; key: string; label: string }
    | { kind: "image"; key: string; label: string }
    | {
        kind: "select";
        key: string;
        label: string;
        options: { value: string; label: string }[];
      }
  );

/** The stable key a control edits (falls back to its kind for keyless controls). */
export const controlKey = (c: ControlSpec): string => ("key" in c ? c.key : c.kind);
