/**
 * Geometry + determinism helpers. Ported from the reference app (src/lib/
 * math.ts, PLAN.md §4 "PORT"). `seededRandom`/`markJitterOffset` are the
 * backbone of invariant #6 (deterministic rendering — all randomness flows
 * through a seed stored on the node).
 */

export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Map v from [inMin,inMax] to [outMin,outMax]. */
export const remap = (
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
) => {
  if (inMax === inMin) return outMin;
  return outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin);
};

export const round = (v: number, dp = 2) => {
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
};

/** Convert a #rgb / #rrggbb hex colour + alpha (0..1) into an `rgba()` string. */
export const hexToRgba = (hex: string, alpha: number): string => {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (h.length !== 6 || Number.isNaN(n)) return hex; // pass through non-hex inputs
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const a = clamp(alpha, 0, 1);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/**
 * Deterministic pseudo-random value in [0, 1) for index `i` under `seed`,
 * optionally salted so multiple independent random streams can share one
 * node seed (e.g. a blipField's position stream vs. its size stream).
 * The ONLY sanctioned source of randomness in the render path (invariant #6
 * — same node ⇒ identical output).
 */
export const seededRandom = (i: number, seed: number, salt = 0): number => {
  const r = Math.sin((i + 1) * 12.9898 + seed * 78.233 + salt * 37.719) * 43758.5453;
  return r - Math.floor(r);
};

/** Deterministic offset in [-amount, amount], built on seededRandom. */
export const jitterOffset = (i: number, seed: number, amount: number, salt = 0): number =>
  (seededRandom(i, seed, salt) * 2 - 1) * amount;

let _id = 0;
/** Short, collision-resistant id for nodes created outside the nanoid path. */
export const uid = (prefix = "n") =>
  `${prefix}_${Date.now().toString(36)}_${(_id++).toString(36)}`;
