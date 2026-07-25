/**
 * Live registry of each rendered <svg> DOM node, keyed by node id. The
 * canvas renderer registers/unregisters on mount; the export pipeline
 * (Phase 6) reads from here so exports use the exact nodes currently on
 * the canvas. Ported verbatim from the reference app (src/lib/svgRegistry.ts,
 * PLAN.md §4 "PORT").
 */
const registry = new Map<string, SVGSVGElement>();

export function registerSvg(id: string, el: SVGSVGElement | null) {
  if (el) registry.set(id, el);
  else registry.delete(id);
}

export const getSvg = (id: string): SVGSVGElement | undefined => registry.get(id);
