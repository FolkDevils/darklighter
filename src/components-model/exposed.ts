/**
 * EXPOSED CONTROLS — a new component authored entirely in the UI.
 *
 * An assembly saved to the library is reusable, but its knobs are buried: to
 * change the contact count on a saved "Tracking Panel" you have to descend
 * three levels and find the right blipField. Promoting that control lifts it
 * to the assembly's own inspector, so the saved thing behaves like a component
 * with parameters rather than a frozen arrangement.
 *
 * Why this matters beyond convenience (docs/RECOMMENDATION.md §4): a
 * parameterized preset is a NEW COMPONENT that cannot violate brand logic. It
 * is built from registered defs, so it resolves color through the same roles,
 * strokes through the same scale, and randomness through the same seeds. It is
 * the rung between "a saved thing" and "a real definition" — and the safest
 * surface to eventually hand to an AI, because the worst it can do is
 * rearrange parts that are already on-brand.
 *
 * Targets are addressed by CHILD-INDEX PATH, never by node id: placing an
 * entry clones the tree with fresh ids (see lib/library.ts), so an id-based
 * mapping would break on the first placement. `[0, 2]` means
 * `host.children[0].children[2]`, which survives cloning intact.
 */
import type { ComponentNode } from "./types";
import type { ControlSpec } from "./controlSpec";

/** Which part of a node the knob writes to. */
export type ExposedChannel = "props" | "style" | "animation" | "layout";

/**
 * A serializable control descriptor. ControlSpec carries functions
 * (`visibleWhen`) that can't survive JSON, and a promoted knob is always
 * visible by definition — the user chose to surface it.
 */
export type ExposedControl =
  | { kind: "number"; min: number; max: number; step?: number }
  | { kind: "text" }
  | { kind: "toggle" }
  | { kind: "color" }
  | { kind: "colorway" }
  | { kind: "labellist" }
  | { kind: "select"; options: { value: string; label: string }[] };

export interface ExposedParam {
  id: string;
  label: string;
  /** Child-index path from the host to the node this drives. `[]` = the host itself. */
  path: number[];
  channel: ExposedChannel;
  key: string;
  control: ExposedControl;
  hint?: string;
}

export const exposedParams = (node: ComponentNode): ExposedParam[] => node.exposed ?? [];

/** Walk a child-index path. Returns null if the tree no longer has that shape. */
export function resolveTarget(host: ComponentNode, path: number[]): ComponentNode | null {
  let cur: ComponentNode = host;
  for (const i of path) {
    const next = cur.children[i];
    if (!next) return null;
    cur = next;
  }
  return cur;
}

/** The node ids along a child-index path — what the selection needs to jump to a knob's target. */
export function targetPathIds(host: ComponentNode, path: number[]): string[] {
  const ids: string[] = [];
  let cur: ComponentNode = host;
  for (const i of path) {
    const next = cur.children[i];
    if (!next) return ids;
    ids.push(next.id);
    cur = next;
  }
  return ids;
}

/** The index path from `host` down to `childId`, or null if it isn't a descendant. */
export function childIndexPath(host: ComponentNode, childId: string): number[] | null {
  if (host.id === childId) return [];
  const walk = (n: ComponentNode, acc: number[]): number[] | null => {
    for (let i = 0; i < n.children.length; i++) {
      const c = n.children[i];
      if (c.id === childId) return [...acc, i];
      const hit = walk(c, [...acc, i]);
      if (hit) return hit;
    }
    return null;
  };
  return walk(host, []);
}

/** Current value of a knob, read straight off the target node. */
export function readExposed(host: ComponentNode, p: ExposedParam): unknown {
  const target = resolveTarget(host, p.path);
  if (!target) return undefined;
  switch (p.channel) {
    case "props":
      return (target.props as Record<string, unknown>)[p.key];
    case "style":
      return (target.style as unknown as Record<string, unknown>)[p.key];
    case "animation":
      return (target.animation as unknown as Record<string, unknown>)[p.key];
    case "layout":
      return (target.layout as unknown as Record<string, unknown>)[p.key];
  }
}

/** ControlSpec → the serializable subset. Returns null for kinds with no stable value. */
export function toExposedControl(c: ControlSpec): ExposedControl | null {
  switch (c.kind) {
    case "number":
      return { kind: "number", min: c.min, max: c.max, step: c.step };
    case "select":
      return { kind: "select", options: c.options };
    case "text":
    case "toggle":
    case "color":
    case "colorway":
    case "labellist":
      return { kind: c.kind };
    default:
      return null;
  }
}

/** A promoted colorway control writes `style.colorway`, not a props key. */
export const channelFor = (c: ControlSpec): ExposedChannel =>
  c.kind === "colorway" ? "style" : "props";

export const keyFor = (c: ControlSpec): string => (c.kind === "colorway" ? "colorway" : c.key);

/** Is this control already surfaced on the host? Keeps the promote button honest. */
export const isPromoted = (host: ComponentNode, path: number[], channel: ExposedChannel, key: string) =>
  exposedParams(host).some(
    (p) => p.channel === channel && p.key === key && p.path.join(",") === path.join(","),
  );
