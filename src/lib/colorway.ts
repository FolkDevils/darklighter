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
 * Which way round the page is. The colorway maps above describe the brand on a
 * LIGHT page — `ink` is what you draw with, `field` is the paper. Put the same
 * graphic on a dark page and both of those have to reverse or the mark
 * disappears into its own background.
 */
export type Surface = "light" | "dark";

/**
 * `ink` and `field` are the two poles of the page, so a dark surface trades
 * them. Every other role is a signal color with a fixed meaning — a hostile
 * contact is Blood Red on white and on brown, and flipping it would be a
 * different piece of information, not a different rendering of the same one.
 */
const REVERSED: Record<ColorRole, ColorRole> = {
  primary: "primary",
  accent: "accent",
  ink: "field",
  field: "ink",
  friendly: "friendly",
  hostile: "hostile",
  electric: "electric",
};

/**
 * Resolve one role to a hex string for the given style config.
 * Order: explicit override (hex literal passes through, else treated as a
 * token id) → colorway base map, reversed on a dark surface → "alert" fallback
 * (never throws).
 *
 * Overrides are checked FIRST and so are never reversed: pinning a role to a
 * literal is the user saying "this exact color", and second-guessing that would
 * make the override useless on half the canvases.
 */
export function resolveColor(style: StyleConfig, role: ColorRole, surface: Surface = "light"): string {
  const override = style.overrides?.[role];
  if (override) {
    return isHexLiteral(override) ? override : brandHex(override as BrandTokenId);
  }
  const base = style.colorway === "custom" ? COLORWAYS.alert : COLORWAYS[style.colorway];
  return brandHex(base[surface === "dark" ? REVERSED[role] : role]);
}

/**
 * Is this backdrop dark enough that the page has flipped? Derived from
 * luminance rather than a list of "dark tokens" so it stays right for a custom
 * hex background too.
 */
export function surfaceOf(color: string | null | undefined): Surface {
  if (!color) return "light";
  const hex = isHexLiteral(color) ? color : brandHex(color as BrandTokenId);
  const [r, g, b] = rgbOf(hex);
  // Rec. 601 luma — good enough to answer "light or dark", and cheap.
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255 < 0.5 ? "dark" : "light";
}

function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = Number.parseInt(full, 16);
  return Number.isNaN(n) ? [255, 255, 255] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The page color itself, for chrome that has to sit legibly on the canvas. */
export const contrastInk = (surface: Surface): string =>
  brandHex(surface === "dark" ? "blimpWhite" : "burntDroneBrown");

/** All brand hexes, for swatch pickers (inspector Style section, Phase 3). */
export const BRAND_SWATCHES: string[] = Object.values(BRAND_TOKENS);
