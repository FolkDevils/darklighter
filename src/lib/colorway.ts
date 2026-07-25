/**
 * Resolves a component's semantic `ColorRole` (PLAN.md §3 / components-model
 * types.ts) to a concrete hex through its colorway + per-role overrides.
 * Injected into every renderer as `RenderProps.color` (registry.tsx) so
 * component code never imports the token table directly.
 */
import type { ColorRole, ColorwayId, StyleConfig } from "@/components-model/types";
import { BRAND_TOKENS, brandHex, isHexLiteral, type BrandTokenId } from "@/data/brand/tokens";

/**
 * The two shipped brand skins observed across the asset kit (ELEMENTS.md):
 * "alert" = hot Red Alert skin, "chrome" = dark maroon HUD-chrome skin.
 * "custom" has no base map — every role must come from `style.overrides`.
 */
export const COLORWAYS: Record<Exclude<ColorwayId, "custom">, Record<ColorRole, BrandTokenId>> = {
  alert: {
    primary: "redAlert",
    // The hot skin is deliberately near-monochrome (PLAN.md §3: redAlert IS
    // the hot accent). Cyan is not an accent here — it's the `electric` role,
    // used sparingly, e.g. Group 81's outer range ring.
    accent: "redAlert",
    ink: "burntDroneBrown",
    field: "blimpWhite",
    friendly: "armyGreen",
    hostile: "bloodRed",
    electric: "electronicIceBlue",
  },
  chrome: {
    primary: "hudChrome",
    accent: "redAlert",
    ink: "burntDroneBrown",
    field: "desertSand",
    friendly: "armyGreen",
    hostile: "bloodRed",
    electric: "tealSky",
  },
};

/** Default colorway for a freshly created node (used by factories). */
export const DEFAULT_COLORWAY: ColorwayId = "alert";

/**
 * Resolve one role to a hex string for the given style config.
 * Order: explicit override (hex literal passes through, else treated as a
 * token id) → colorway base map → "alert" fallback (never throws).
 */
export function resolveColor(style: StyleConfig, role: ColorRole): string {
  const override = style.overrides?.[role];
  if (override) {
    return isHexLiteral(override) ? override : brandHex(override as BrandTokenId);
  }
  const base = style.colorway === "custom" ? COLORWAYS.alert : COLORWAYS[style.colorway];
  return brandHex(base[role]);
}

/** All brand hexes, for swatch pickers (inspector Style section, Phase 3). */
export const BRAND_SWATCHES: string[] = Object.values(BRAND_TOKENS);
