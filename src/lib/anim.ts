/**
 * SMIL animation helpers (PLAN.md §7, docs/NORTH_STAR.md property 3).
 *
 * Every behavior is expressed as SVG SMIL so the in-app preview and the
 * exported SVG are the same thing — no CSS keyframes, no JS tweening.
 *
 * The binding rule (invariant #4): a component's base attributes always draw
 * the FINISHED frame. SMIL nodes are additive and only emitted when `animate`
 * is true, so stripping them yields a correct static export automatically.
 *
 * Looping bakes the pause into the timeline rather than using a second
 * animation: one cycle runs for `durationMs`, then holds its end state for
 * `loopDelayMs`, giving keyTimes like `0; d/(d+pause); 1`.
 */
import type { AnimationConfig } from "@/components-model/types";
import { KEY_SPLINES } from "@/lib/easing";

export interface AnimProps {
  /** Comma/semicolon-separated SMIL values list. */
  values: string;
  keyTimes?: string;
  dur: string;
  begin: string;
  repeatCount?: "indefinite";
  fill?: "freeze";
  calcMode?: "spline";
  keySplines?: string;
}

/**
 * Build the timing half of a one-shot-or-looping SMIL animation.
 *
 * @param from   value at the start of a cycle
 * @param to     value at the end of a cycle (also the resting/base value)
 * @param extraDelayMs per-element stagger, added on top of the node's delay
 */
export function timing(
  anim: AnimationConfig,
  from: string,
  to: string,
  extraDelayMs = 0,
): AnimProps {
  const dur = Math.max(1, anim.durationMs);
  const pause = anim.loop ? Math.max(0, anim.loopDelayMs) : 0;
  const total = dur + pause;
  const begin = `${Math.max(0, anim.delayMs + extraDelayMs)}ms`;
  const spline = KEY_SPLINES[anim.easing];
  const [a, b] = anim.direction === "reverse" ? [to, from] : [from, to];

  if (!anim.loop) {
    return {
      values: `${a};${b}`,
      dur: `${dur}ms`,
      begin,
      fill: "freeze",
      calcMode: "spline",
      keySplines: spline,
    };
  }

  // Hold the finished value through the pause, then snap back for the next cycle.
  const t = (dur / total).toFixed(4);
  return {
    values: `${a};${b};${b}`,
    keyTimes: `0;${t};1`,
    dur: `${total}ms`,
    begin,
    repeatCount: "indefinite",
    calcMode: "spline",
    keySplines: `${spline};0 0 1 1`,
  };
}

/**
 * Cycle timing for behaviors that are inherently continuous (rotate, blink,
 * pulse, ping, drift, orbit) — these ignore `loop`, since a single pass makes
 * no sense, and run forever at `durationMs` per cycle.
 *
 * @param durationMsOverride per-element duration, for behaviors where every
 *        element should move at its own speed (a swarm of contacts). Still
 *        scaled by the node's own duration by the caller.
 */
export function cycle(anim: AnimationConfig, extraDelayMs = 0, durationMsOverride?: number) {
  return {
    dur: `${Math.max(1, durationMsOverride ?? anim.durationMs)}ms`,
    begin: `${Math.max(0, anim.delayMs + extraDelayMs)}ms`,
    repeatCount: "indefinite" as const,
  };
}

/** Per-element stagger, capped so a 200-blip field doesn't take a minute. */
export function stagger(anim: AnimationConfig, index: number, count: number): number {
  if (anim.staggerMs <= 0 || count <= 1) return 0;
  const span = Math.min(anim.staggerMs * (count - 1), 2400);
  return (index / (count - 1)) * span;
}

/**
 * Which behavior a node actually runs: its explicit choice, else the kind's
 * first declared behavior (the documented default).
 */
export function behaviorOf<T extends string>(
  chosen: string | null,
  supported: readonly T[],
): T | null {
  if (chosen && (supported as readonly string[]).includes(chosen)) return chosen as T;
  return supported[0] ?? null;
}

/**
 * Draw-on base attributes. `pathLength={1}` normalizes any geometry to a
 * 0..1 dash space, so one set of numbers works for circles, arcs and lines
 * alike. Resting state is fully drawn (offset 0).
 */
export const DRAW_BASE = { pathLength: 1, strokeDasharray: "1 1", strokeDashoffset: 0 } as const;

/* ------------------------------------------------------------------ */
/* Travel: things that change position, not just appearance            */
/* ------------------------------------------------------------------ */

const round = (v: number) => Math.round(v * 100) / 100;

/**
 * Smooth closed loop through `pts` (Catmull-Rom converted to cubic beziers).
 * Closed and starting at `pts[0]`, which is what keeps a travelling element's
 * resting position identical to its base position — so the static export still
 * shows the layout the editor shows when paused.
 */
function closedSpline(pts: readonly (readonly [number, number])[]): string {
  const n = pts.length;
  const at = (i: number) => pts[((i % n) + n) % n];
  let d = `M ${round(pts[0][0])} ${round(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const [p0x, p0y] = at(i - 1);
    const [p1x, p1y] = at(i);
    const [p2x, p2y] = at(i + 1);
    const [p3x, p3y] = at(i + 2);
    const c1x = p1x + (p2x - p0x) / 6;
    const c1y = p1y + (p2y - p0y) / 6;
    const c2x = p2x - (p3x - p1x) / 6;
    const c2y = p2y - (p3y - p1y) / 6;
    d += ` C ${round(c1x)} ${round(c1y)} ${round(c2x)} ${round(c2y)} ${round(p2x)} ${round(p2y)}`;
  }
  return `${d} Z`;
}

/**
 * A meandering closed route around the origin, for `animateMotion` — how a
 * tracked contact wanders while a radar keeps painting it. Deterministic:
 * `rand` must be the caller's seeded generator (invariant #6), so the same
 * node always wanders the same way.
 *
 * @param rand    seeded 0..1 generator, called with a salt
 * @param radius  how far the element strays from its home position
 * @param legs    waypoints in the loop; more legs = busier wandering
 * @param reverse travel the loop the other way round
 */
export function wanderPath(
  rand: (salt: number) => number,
  radius: number,
  legs = 4,
  reverse = false,
): string {
  // Tolerate a hand-edited/legacy props blob rather than emitting a NaN path.
  const spread = Number.isFinite(radius) ? Math.max(0, radius) : 0;
  const count = Math.max(3, Math.round(Number.isFinite(legs) ? legs : 4));
  const pts: [number, number][] = [[0, 0]];
  for (let k = 1; k < count; k++) {
    // Spread the waypoints around the compass so the route encircles home
    // instead of doubling back on itself, then jitter each one.
    const deg = (k / count) * 360 + (rand(k * 3 + 1) - 0.5) * 70;
    const r = spread * (0.45 + rand(k * 3 + 2) * 0.55);
    const rad = (deg * Math.PI) / 180;
    pts.push([r * Math.cos(rad), r * Math.sin(rad)]);
  }
  return closedSpline(reverse ? [pts[0], ...pts.slice(1).reverse()] : pts);
}

/**
 * Per-element speed spread for swarm motion: contacts that all move at exactly
 * the same rate read as a mechanism, not as separate things being tracked.
 */
export function speedOf(anim: AnimationConfig, rand: (salt: number) => number, salt = 41): number {
  return Math.max(1, anim.durationMs * (0.75 + rand(salt) * 0.7));
}
