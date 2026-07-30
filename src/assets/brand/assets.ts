/**
 * Static brand-asset registry (PLAN.md §11 Phase 2 step 2). The sanitized
 * markup itself is generated — `npm run assets` re-runs the pipeline in
 * scripts/importAssets.mjs over assets/protora/. This module is the hand-
 * written half: the type, lookup helpers, and category labels the Library
 * panel groups by.
 *
 * Assets render exactly as delivered by default. `staticAsset.inkRole`
 * flattens one to a single brand role (the contract's stated behavior for
 * wordmarks and silhouettes); `palette` records what each baked-in hex maps
 * to so later phases can recolor without re-parsing markup.
 */
import type { BrandTokenId } from "@/data/brand/tokens";
import { GENERATED_ASSETS } from "./generated";

export type BrandAssetCategory = "brand" | "scenes" | "modules" | "craft" | "hud";

export interface BrandAsset {
  id: string;
  label: string;
  category: BrandAssetCategory;
  describe: string;
  /** Original filename in assets/protora/, for traceability. */
  source: string;
  viewBox: { w: number; h: number };
  /** Every hex baked into the markup, with the brand token it sits closest to. */
  palette: { hex: string; token: BrandTokenId | null }[];
  markup: string;
}

export const BRAND_ASSETS: BrandAsset[] = GENERATED_ASSETS;

export const brandAsset = (id: string): BrandAsset | undefined =>
  BRAND_ASSETS.find((a) => a.id === id);

/**
 * Generated markup is namespaced per asset file, but a document can contain
 * many instances of the same asset. SVG ids are document-global, so give each
 * rendered instance its own ids before export/Figma import.
 */
export function namespaceSvgIds(markup: string, namespace: string): string {
  const safeNamespace = namespace.replace(/[^A-Za-z0-9_.:-]/g, "_");
  const ids = [...new Set([...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]))];
  let result = markup;
  for (const id of ids) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const next = `${safeNamespace}-${id}`;
    result = result
      .replace(new RegExp(`(\\sid=")${escaped}(")`, "g"), `$1${next}$2`)
      .replace(new RegExp(`url\\(#${escaped}\\)`, "g"), `url(#${next})`)
      .replace(new RegExp(`((?:xlink:)?href=")#${escaped}(")`, "g"), `$1#${next}$2`);
  }
  return result;
}

export const ASSET_CATEGORY_LABEL: Record<BrandAssetCategory, string> = {
  brand: "Brand",
  scenes: "Scenes",
  modules: "Modules",
  craft: "Craft",
  hud: "HUD",
};

/** Longest edge a freshly placed asset gets, preserving its aspect ratio. */
const PLACED_MAX_EDGE = 420;

export function assetPlacementSize(asset: BrandAsset): { w: number; h: number } {
  const { w, h } = asset.viewBox;
  const scale = Math.min(PLACED_MAX_EDGE / Math.max(w, h), 1);
  // Only one edge is rounded to a whole pixel; the other is derived from it, so
  // the placed box sits on the asset's exact ratio. Rounding both independently
  // left a fraction of a percent of error, which `xMidYMid meet` then pays for
  // by letterboxing the art the moment it is placed.
  const pw = Math.max(1, Math.round(w * scale));
  return { w: pw, h: Math.max(1, Math.round((pw * h) / w * 100) / 100) };
}
