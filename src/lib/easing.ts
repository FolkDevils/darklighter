import type { EasingName } from "@/components-model/types";

/**
 * SMIL animations express easing through `calcMode="spline"` + `keySplines`
 * (cubic bezier control points). These map our friendly preset names to the
 * bezier handles SMIL expects, so the in-app preview and the exported SVG
 * use the exact same timing curve (PLAN.md §7).
 *
 * Ported from the reference app (src/lib/easing.ts, PLAN.md §4 "PORT").
 */
export const KEY_SPLINES: Record<EasingName, string> = {
  linear: "0 0 1 1",
  ease: "0.25 0.1 0.25 1",
  easeIn: "0.42 0 1 1",
  easeOut: "0 0 0.58 1",
  easeInOut: "0.42 0 0.58 1",
};

export const EASING_OPTIONS: { value: EasingName; label: string }[] = [
  { value: "easeOut", label: "Ease Out" },
  { value: "easeInOut", label: "Ease In / Out" },
  { value: "easeIn", label: "Ease In" },
  { value: "ease", label: "Ease" },
  { value: "linear", label: "Linear" },
];

export const isSpline = (e: EasingName) => e !== "linear";
