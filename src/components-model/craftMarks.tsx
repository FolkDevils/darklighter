/**
 * Named drone planforms from `assets/protora/drones/` — shared between the
 * `craft` kind and `blipField` (which can stamp a drone at every contact the
 * same way it stamps a glyph). Lives next to `glyphs.tsx` for the same reason:
 * the silhouette set should only exist in one place.
 *
 * Every mark is drawn centered on local (0,0); callers wrap the result in a
 * positioning `<g transform="translate(cx,cy)">`. `size` is the longest edge.
 */
import type { ReactElement } from "react";
import { brandAsset, namespaceSvgIds } from "@/assets/brand/assets";

/** Asset ids from `assets/protora/drones/` (see scripts/importAssets.mjs). */
export type CraftId = "x47c" | "nEUROn" | "x45c" | "sentinel" | "mobile01";

export const CRAFT_OPTIONS: { value: CraftId; label: string }[] = [
  { value: "x47c", label: "X47C" },
  { value: "nEUROn", label: "nEUROn" },
  { value: "x45c", label: "X45C" },
  { value: "sentinel", label: "Sentinel" },
  { value: "mobile01", label: "Mobile 01" },
];

export const DEFAULT_CRAFT: CraftId = "x47c";

/**
 * Planforms are drawn nose-up, i.e. facing local −Y. `animateMotion
 * rotate="auto"` aligns the element's +X axis with the path's tangent, so the
 * art needs +90° added on top of that to bring the nose (currently sitting at
 * −90° from +X) onto the tangent instead of the tail. Get the sign wrong and
 * the craft flies backwards — tail-first, upside down relative to its path.
 */
export const CRAFT_NOSE_TO_PATH = 90;

const paintCache = new Map<string, string>();

/** Flatten imported fill/stroke hexes to one role color; outline drops the fill. */
export function paintCraft(markup: string, cacheKey: string, hex: string, outlined: boolean): string {
  const cached = paintCache.get(cacheKey);
  if (cached) return cached;
  const painted = outlined
    ? markup
        .replace(/(fill)="#[0-9A-Fa-f]{3,8}"/g, `fill="none" stroke="${hex}" stroke-width="1.25"`)
        .replace(/(stroke)="#[0-9A-Fa-f]{3,8}"/g, `stroke="${hex}"`)
        .replace(/(fill|stroke):\s*#[0-9A-Fa-f]{3,8}/g, (_m, prop: string) =>
          prop === "fill" ? `fill:none` : `stroke:${hex}`,
        )
    : markup
        .replace(/(fill|stroke)="#[0-9A-Fa-f]{3,8}"/g, `$1="${hex}"`)
        .replace(/(fill|stroke):\s*#[0-9A-Fa-f]{3,8}/g, `$1:${hex}`);
  paintCache.set(cacheKey, painted);
  return painted;
}

interface CraftMarkProps {
  size: number;
  color: string;
  outlined?: boolean;
  /** Unique within the exported SVG; imported masks/clips use document-global ids. */
  instanceId: string;
}

/** Render one drone planform, centered at local (0,0). */
export function renderCraftMark(
  id: CraftId,
  { size, color, outlined = false, instanceId }: CraftMarkProps,
): ReactElement {
  const asset = brandAsset(id);
  if (!asset) return <g />;
  const { w, h } = asset.viewBox;
  const s = size / Math.max(w, h);
  const markup = namespaceSvgIds(
    paintCraft(asset.markup, `${asset.id}:${color}:${outlined ? "o" : "f"}`, color, outlined),
    instanceId,
  );
  return (
    <g
      transform={`translate(${(-w * s) / 2}, ${(-h * s) / 2}) scale(${s})`}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
