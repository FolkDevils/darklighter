/**
 * What a kind actually uses — derived by running its own renderer, never by
 * hand-annotating 25 def files.
 *
 * The inspector needs this to stop showing dead controls: seven color-role
 * pickers on a component that only draws in `primary`, a stroke-weight slider
 * on a component with no strokes, or a seed field on one that ignores it. Any
 * of those is a control the user can drag with nothing happening, which is
 * exactly the kind of thing that makes an editor feel broken.
 *
 * A `Render` function is a pure function of props (registry.tsx contract), so
 * it's safe to call directly, spy on the `color` callback it was handed, and
 * walk the element tree it returns. Results are cached per kind: the answer
 * depends on the kind, not on the node.
 */
import { isValidElement, type ReactElement, type ReactNode } from "react";
import type { ColorRole, ComponentKind } from "./types";
import { componentDef } from "./registry";

export interface KindUsage {
  /** Color roles this kind resolves — the only ones worth offering as overrides. */
  roles: ColorRole[];
  /** Does it stroke anything? If not, `style.strokeScale` does nothing. */
  usesStroke: boolean;
  /** Does its output change with `node.seed`? If not, Seed/Shuffle do nothing. */
  usesSeed: boolean;
  /**
   * Does this kind draw anything itself? Pure containers (a group, a lockup)
   * don't: their colorway and stroke controls would be dead, because every
   * part inside resolves its own style.
   */
  paintsOwnArt: boolean;
}

const CACHE = new Map<ComponentKind, KindUsage>();

const ALL_ROLES: ColorRole[] = ["primary", "accent", "ink", "field", "friendly", "hostile", "electric"];

/** Walk a rendered element tree, feeding every element's props to `visit`. */
function walk(node: ReactNode, visit: (props: Record<string, unknown>) => void) {
  if (Array.isArray(node)) {
    for (const n of node) walk(n, visit);
    return;
  }
  if (!isValidElement(node)) return;
  const props = node.props as Record<string, unknown>;
  visit(props);
  walk(props.children as ReactNode, visit);
}

/**
 * Structural fingerprint of a render, used only to compare two renders of the
 * same kind against each other (so it needs to be stable, not pretty).
 */
function fingerprint(node: ReactNode): string {
  const parts: string[] = [];
  walk(node, (props) => {
    for (const [k, v] of Object.entries(props)) {
      if (k === "children" || typeof v === "function" || typeof v === "object") continue;
      parts.push(`${k}=${String(v)}`);
    }
  });
  return parts.join("|");
}

export function kindUsage(kind: ComponentKind): KindUsage {
  const hit = CACHE.get(kind);
  if (hit) return hit;

  const def = componentDef(kind);
  let usage: KindUsage = { roles: ALL_ROLES, usesStroke: true, usesSeed: true, paintsOwnArt: true };

  try {
    const node = def.factory();
    const asked = new Set<ColorRole>();
    const render = (seed: number): ReactElement =>
      def.Render({
        node: { ...node, seed },
        animate: false,
        color: (role) => {
          asked.add(role);
          // A real hex keeps renderers that parse or compare colors happy.
          return "#ff0000";
        },
      });

    const first = render(node.seed);
    let usesStroke = false;
    let elements = 0;
    walk(first, (props) => {
      elements++;
      if (props.stroke !== undefined && props.stroke !== "none") usesStroke = true;
      if (props.strokeWidth !== undefined) usesStroke = true;
      // Imported art carries its own paint inside a markup string.
      const html = props.dangerouslySetInnerHTML as { __html?: string } | undefined;
      if (html?.__html?.includes("stroke")) usesStroke = true;
    });

    // 1 element = just the wrapping <svg>: nothing of its own was drawn.
    const paintsOwnArt = elements > 1;
    usage = {
      roles: ALL_ROLES.filter((r) => asked.has(r)),
      usesStroke,
      usesSeed: fingerprint(first) !== fingerprint(render(node.seed + 977)),
      paintsOwnArt,
    };
    // Art that resolves no roles is painted with its own imported colors, so
    // offer the whole palette rather than an empty section.
    if (paintsOwnArt && usage.roles.length === 0) usage.roles = ALL_ROLES;
  } catch {
    // A renderer that won't run headlessly keeps the full control set — never
    // hide a control because introspection failed.
  }

  CACHE.set(kind, usage);
  return usage;
}
