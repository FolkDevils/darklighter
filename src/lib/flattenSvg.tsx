/**
 * Flatten a node tree into ONE pure-SVG element tree.
 *
 * The canvas composes the tree with nested absolutely-positioned `<div>`s
 * (RenderNode) because that keeps parent transforms from distorting child
 * stroke widths. That's right for editing but not portable — a file has to be
 * SVG all the way down.
 *
 * Composition here is `<g transform>`, NOT nested `<svg>` viewports, and that
 * is load-bearing rather than stylistic. A nested `<svg>` is the natural
 * translation of a positioned div, but Figma's importer does not implement
 * nested viewports properly: it drops the inner viewBox scale and clips to the
 * frame, which cropped every imported mark on paste (docs/EXPORT.md). Browsers
 * render both spellings identically, so the group form costs nothing and is
 * the one that survives a paste.
 *
 * `viewportToGroup` therefore does by hand what a nested `<svg>` would have
 * done implicitly: apply x/y, resolve `viewBox` against the box the element
 * was given, and honour `preserveAspectRatio`. It runs over `def.Render`'s own
 * output too, so a host that nests an inner viewport (defs/logoP.tsx draws its
 * slot that way) comes out as groups all the way down.
 *
 * This is the serialization source of truth: `src/lib/svg/serialize.ts` (export,
 * copy) and `scripts/preview.tsx` both go through it. It deliberately shares
 * `def.Render` and `resolveAnimation` with `RenderNode`, so the only difference
 * between what the canvas shows and what a file contains is div-vs-group
 * composition — which is geometrically identical by construction.
 */
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import type { ComponentNode } from "@/components-model/types";
import { componentDef } from "@/components-model/registry";
import { resolveAnimation } from "@/components-model/animResolve";
import { resolveColor, type Surface } from "@/lib/colorway";

/* ------------------------------------------------------------------ */
/* Nested <svg> viewports → <g transform>                              */
/* ------------------------------------------------------------------ */

interface Box {
  w: number;
  h: number;
}

/** A length that may be a number, a px string, or a percentage of `basis`. */
function len(v: unknown, basis: number): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string" || v.trim() === "") return basis;
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return basis;
  return v.trim().endsWith("%") ? (n / 100) * basis : n;
}

function parseViewBox(vb: unknown): { x: number; y: number; w: number; h: number } | null {
  if (typeof vb !== "string") return null;
  const p = vb.trim().split(/[\s,]+/).map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n)) || p[2] <= 0 || p[3] <= 0) return null;
  return { x: p[0], y: p[1], w: p[2], h: p[3] };
}

/** The fractional alignment `preserveAspectRatio` asks for, e.g. xMidYMax. */
function alignment(par: string): { ax: number; ay: number } {
  const frac = (s: string) => (s === "Min" ? 0 : s === "Max" ? 1 : 0.5);
  const m = /^x(Min|Mid|Max)Y(Min|Mid|Max)$/.exec(par.trim().split(/\s+/)[0] ?? "");
  return m ? { ax: frac(m[1]), ay: frac(m[2]) } : { ax: 0.5, ay: 0.5 };
}

const round = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Renderers that need motion bleed make their `<svg>` physically larger and
 * pull it back over the layout box with absolute `left`/`top` offsets. In the
 * canvas those CSS offsets and the widened viewBox cancel each other. Once the
 * viewport becomes a `<g>`, CSS positioning no longer applies, so fold those
 * offsets into the SVG transform explicitly or animated exports drift by the
 * bleed padding (most visibly: lockup blips no longer center on their rings).
 */
function styleOffset(style: unknown, axis: "left" | "top", basis: number): number {
  if (!style || typeof style !== "object") return 0;
  const value = (style as Record<string, unknown>)[axis];
  if (value == null || value === "") return 0;
  return len(value, basis);
}

/** CSS box-positioning has been resolved into the group transform above. */
function portableGroupStyle(style: unknown): Record<string, unknown> | undefined {
  if (!style || typeof style !== "object") return undefined;
  const next = { ...(style as Record<string, unknown>) };
  for (const key of ["position", "left", "top", "right", "bottom", "width", "height", "overflow"]) {
    delete next[key];
  }
  return Object.keys(next).length ? next : undefined;
}

/**
 * The `<g>` equivalent of an `<svg>` viewport occupying `box`, plus the box its
 * own children should be measured against.
 */
function viewportToGroup(el: ReactElement, box: Box): { transform?: string; inner: Box } {
  const p = el.props as Record<string, unknown>;
  const x = (len(p.x, 0) || 0) + styleOffset(p.style, "left", box.w);
  const y = (len(p.y, 0) || 0) + styleOffset(p.style, "top", box.h);
  const w = len(p.width, box.w);
  const h = len(p.height, box.h);
  const vb = parseViewBox(p.viewBox);

  if (!vb) {
    const t = x || y ? `translate(${round(x)} ${round(y)})` : undefined;
    return { transform: t, inner: { w, h } };
  }

  const par = typeof p.preserveAspectRatio === "string" ? p.preserveAspectRatio : "xMidYMid meet";
  let sx = w / vb.w;
  let sy = h / vb.h;
  let tx = x;
  let ty = y;
  if (!/^none/.test(par.trim())) {
    // "slice" fills and overflows; "meet" (the default) fits inside.
    const s = /\bslice\b/.test(par) ? Math.max(sx, sy) : Math.min(sx, sy);
    const { ax, ay } = alignment(par);
    tx += (w - vb.w * s) * ax;
    ty += (h - vb.h * s) * ay;
    sx = s;
    sy = s;
  }
  tx -= vb.x * sx;
  ty -= vb.y * sy;

  const parts: string[] = [];
  if (round(tx) !== 0 || round(ty) !== 0) parts.push(`translate(${round(tx)} ${round(ty)})`);
  if (round(sx) !== 1 || round(sy) !== 1) parts.push(`scale(${round(sx)} ${round(sy)})`);
  return { transform: parts.length ? parts.join(" ") : undefined, inner: { w: vb.w, h: vb.h } };
}

/** Props a viewport carries that have to move onto the group replacing it. */
const CARRIED = ["opacity", "mask", "clipPath", "filter", "className"] as const;

/**
 * Rewrite every `<svg>` in a rendered tree as a `<g transform>`. Anything else
 * is passed through untouched, including `dangerouslySetInnerHTML` payloads —
 * imported brand markup is already plain geometry.
 */
function degroup(child: ReactNode, box: Box): ReactNode {
  if (!isValidElement(child)) return child;
  const el = child as ReactElement<Record<string, unknown>>;

  if (el.type !== "svg") {
    // A non-viewport element doesn't change the coordinate system, so its
    // children keep measuring against the same box.
    const kids = (el.props as { children?: ReactNode }).children;
    if (kids === undefined || (el.props as Record<string, unknown>).dangerouslySetInnerHTML) return el;
    return cloneElement(el, undefined, mapKids(kids, box));
  }

  const { transform, inner } = viewportToGroup(el, box);
  const p = el.props as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  if (transform) next.transform = transform;
  for (const k of CARRIED) if (p[k] !== undefined) next[k] = p[k];
  const style = portableGroupStyle(p.style);
  if (style) next.style = style;
  return (
    <g key={el.key ?? undefined} {...next}>
      {mapKids(p.children as ReactNode, inner)}
    </g>
  );
}

const mapKids = (kids: ReactNode, box: Box): ReactNode =>
  Children.map(kids, (k) => degroup(k, box));

/* ------------------------------------------------------------------ */
/* Tree composition                                                     */
/* ------------------------------------------------------------------ */

export function flattenNode(
  node: ComponentNode,
  animate: boolean,
  inherited: ComponentNode["animation"] | null = null,
  /** Light or dark page — reverses ink/field, exactly as on canvas. */
  surface: Surface = "light",
): ReactElement | null {
  if (node.hidden) return null;

  const def = componentDef(node.kind);
  const color = (role: Parameters<typeof resolveColor>[1]) => resolveColor(node.style, role, surface);

  const { effective, running, passDown } = resolveAnimation(node.animation, inherited, animate);

  const { x, y, w, h, rotation } = node.layout;
  const own = def.Render({ node: { ...node, animation: effective }, animate: running, color, surface });

  const body = (
    <g
      transform={x || y ? `translate(${round(x)} ${round(y)})` : undefined}
      opacity={node.style.opacity === 1 ? undefined : node.style.opacity}
    >
      {degroup(own, { w, h })}
      {node.children.map((c) => (
        <ChildFrame key={c.id} node={c} animate={animate} inherited={passDown} surface={surface} />
      ))}
      {Object.entries(node.slots ?? {}).map(([name, val]) => {
        const slotDef = def.slots?.find((sd) => sd.name === name);
        // Knockout slots are drawn by the host itself (see defs/logoP.tsx).
        if (!val || slotDef?.mode === "knockout") return null;
        const frame = slotDef?.frame ?? val.layout;
        return (
          <g key={name} transform={`translate(${round(frame.x)} ${round(frame.y)})`}>
            {flattenNode({ ...val, layout: { ...val.layout, x: 0, y: 0, w: frame.w, h: frame.h } }, animate, passDown, surface)}
          </g>
        );
      })}
    </g>
  );

  return rotation ? <g transform={`rotate(${rotation} ${round(x + w / 2)} ${round(y + h / 2)})`}>{body}</g> : body;
}

function ChildFrame({
  node,
  animate,
  inherited,
  surface,
}: {
  node: ComponentNode;
  animate: boolean;
  inherited: ComponentNode["animation"] | null;
  surface: Surface;
}) {
  return flattenNode(node, animate, inherited, surface);
}
