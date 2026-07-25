/**
 * Protora brand tokens — the ONLY place raw hex values may live (PLAN.md §3,
 * §4 invariant #2). Components ask for a `ColorRole`; `src/lib/colorway.ts`
 * resolves role → token → hex. Never hard-code a hex in a component.
 *
 * Values sampled from the approved brand swatch board (2026-07-24) and
 * cross-checked against assets/protora/ELEMENTS.md.
 */

export const BRAND_TOKENS = {
  // Primary
  blimpWhite: "#F0EEDF",
  redAlert: "#FE3B1F",
  burntDroneBrown: "#330000",

  // Secondary ("in theatre" accents)
  desertSand: "#E9D3BC",
  armyGreen: "#5E6532",
  bloodRed: "#780606",
  tealSky: "#9BCCC7",
  electronicIceBlue: "#00FFFF",

  // Asset-observed aliases (kept distinct — half the asset kit uses these
  // exact hexes; collapsing them into the nearest primary/secondary token
  // would lose import fidelity when porting existing SVG art).
  hudChrome: "#450810", // "chrome" skin default ink, near bloodRed
  gridTeal: "#5C7A76", // muted tealSky, polar grid behind wordmark
} as const;

export type BrandTokenId = keyof typeof BRAND_TOKENS;

export const brandHex = (id: BrandTokenId): string => BRAND_TOKENS[id];

/** True if `value` is already a literal hex (vs. a token id to resolve). */
export const isHexLiteral = (value: string): boolean => /^#[0-9a-fA-F]{3,8}$/.test(value);
