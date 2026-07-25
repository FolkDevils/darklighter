/**
 * Node tree → standalone SVG string (PLAN.md §9).
 *
 * WHY THIS SERIALIZES THE MODEL AND NOT THE DOM
 * ---------------------------------------------
 * The reference app clones the live `<svg>` element out of the canvas
 * (`svgRegistry` → `cloneNode` → `XMLSerializer`) because one graphic there is
 * one `<svg>`. Darklighter can't: `RenderNode` composes a tree with nested
 * absolutely-positioned `<div>`s (so parent transforms never distort child
 * stroke widths — PLAN.md §5.1), so the DOM for a group is HTML with several
 * sibling `<svg>`s inside it. Cloning that yields markup no other tool can
 * open. `src/lib/flattenSvg.tsx` already re-composes a subtree with nested
 * `<svg>` viewports, so export renders THAT through React and gets one clean
 * document for a part, a group or the whole canvas alike.
 *
 * The WYSIWYG guarantee is kept by construction rather than by inspection:
 * flatten and canvas call the same `def.Render` and the same
 * `resolveAnimation`, and static export simply renders with `animate: false`
 * — the paused frame — instead of stripping SMIL nodes afterwards
 * (invariant #4: base attributes ARE the finished frame).
 */
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentNode } from "@/components-model/types";
import { flattenNode } from "@/lib/flattenSvg";
import { CANVAS_H, CANVAS_W } from "@/lib/constants";
import { brandHex, isHexLiteral, type BrandTokenId } from "@/data/brand/tokens";

const SVG_NS = "http://www.w3.org/2000/svg";
const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>\n';

export interface SvgOptions {
  /** Keep SMIL so the file replays when opened in a browser. */
  animated: boolean;
  /** Paint a backdrop rect (brand token id or hex). Omit/null = transparent. */
  background?: string | null;
  /** Prepend an XML declaration — wanted in files, not inside clipboard HTML. */
  declaration?: boolean;
  /** Breathing room around a part, in canvas units. */
  padding?: number;
}

const round = (v: number) => Math.round(v * 100) / 100;

/** Brand token id or hex literal → hex, resolved the way the canvas does it. */
export const backgroundHex = (color: string): string =>
  isHexLiteral(color) ? color : brandHex(color as BrandTokenId);

/**
 * The axis-aligned box a rotated node actually occupies. A root `<svg>` clips,
 * so a rotated part needs a frame big enough for its corners or the export
 * loses them — the canvas has no such problem, since CSS overflow is visible.
 */
export function rotatedFrame(node: ComponentNode): { w: number; h: number; dx: number; dy: number } {
  const { w, h, rotation } = node.layout;
  if (!rotation) return { w, h, dx: 0, dy: 0 };
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const bw = w * cos + h * sin;
  const bh = w * sin + h * cos;
  return { w: bw, h: bh, dx: (bw - w) / 2, dy: (bh - h) / 2 };
}

function svgDocument(width: number, height: number, opts: SvgOptions, body: ReactNode): string {
  const bg = opts.background ? backgroundHex(opts.background) : null;
  const w = round(width);
  const h = round(height);
  const markup = renderToStaticMarkup(
    <svg xmlns={SVG_NS} viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
      {bg && <rect x={0} y={0} width={w} height={h} fill={bg} />}
      {body}
    </svg>,
  );
  return (opts.declaration ? XML_DECLARATION : "") + markup;
}

/**
 * One part, group or scene as a standalone asset, framed to its own box — the
 * file starts at the graphic, not at wherever it sat on the canvas.
 */
export function serializeNode(node: ComponentNode, opts: SvgOptions): string {
  const pad = opts.padding ?? 0;
  const frame = rotatedFrame(node);
  const placed: ComponentNode = {
    ...node,
    layout: { ...node.layout, x: pad + frame.dx, y: pad + frame.dy },
  };
  return svgDocument(frame.w + pad * 2, frame.h + pad * 2, opts, flattenNode(placed, opts.animated));
}

/** The whole canvas at its true coordinate space, so layer positions survive. */
export function serializeCanvas(nodes: ComponentNode[], opts: SvgOptions): string {
  const layers = nodes.map((n) => {
    const el = flattenNode(n, opts.animated);
    // `flattenNode` returns bare elements; a keyed fragment keeps React quiet
    // without adding anything to the output.
    return el ? <Layer key={n.id}>{el}</Layer> : null;
  });
  return svgDocument(CANVAS_W, CANVAS_H, opts, layers);
}

const Layer = ({ children }: { children: ReactNode }) => <>{children}</>;
