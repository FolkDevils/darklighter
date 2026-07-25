/**
 * Export orchestration (PLAN.md §9) — the layer the UI talks to.
 *
 * Equivalent of the reference app's `src/lib/exportScene.ts`, with the scope
 * model generalised: Darklighter is a tree, so "one part", "a group" and "a
 * whole scene" are all just a node, and the same three functions cover them.
 *
 * | Output | How |
 * | --- | --- |
 * | Animated SVG | serialize with SMIL (`animated: true`) — replays on open |
 * | Static SVG | serialize the paused frame (`animated: false`) — Figma-safe |
 * | Copy SVG | the same string, written to the clipboard as vector markup |
 * | PNG 1×/2×/4× | static SVG → `<img>` → `<canvas>` → blob (see `renderPng`) |
 * | `.dkl.json` | the node subtree as a document, reopenable in Darklighter |
 */
import type { ComponentNode, DarklighterDoc } from "@/components-model/types";
import { CANVAS_H, CANVAS_W } from "@/lib/constants";
import type { Surface } from "@/lib/colorway";
import { rotatedFrame, serializeCanvas, serializeNode, type SvgOptions } from "./serialize";
import {
  copyImage,
  copySvg,
  copyText,
  downloadBlob,
  downloadJSON,
  downloadSVG,
  slugify,
} from "./download";

/** What to export. A group and a scene are both just `node`. */
export type ExportTarget =
  | { scope: "node"; node: ComponentNode }
  | { scope: "canvas"; nodes: ComponentNode[]; name?: string };

export interface ExportOpts {
  animated: boolean;
  /** Brand token id / hex to paint behind the art, or null for transparency. */
  background?: string | null;
  padding?: number;
  /**
   * The canvas the art was composed against. A transparent export has no
   * backdrop to infer light-or-dark from, so without this a graphic built on
   * the dark canvas would export inked for white paper — the opposite of what
   * the user just approved on screen.
   */
  surface?: Surface;
}

const PAD_DEFAULT = 24;

export function buildSvg(target: ExportTarget, opts: ExportOpts): string {
  const svgOpts: SvgOptions = {
    animated: opts.animated,
    background: opts.background ?? null,
    declaration: true,
    surface: opts.surface,
  };
  return target.scope === "node"
    ? serializeNode(target.node, { ...svgOpts, padding: opts.padding ?? PAD_DEFAULT })
    : serializeCanvas(target.nodes, svgOpts);
}

export const targetName = (target: ExportTarget): string =>
  target.scope === "node" ? target.node.name : (target.name ?? "canvas");

/** Pixel size of the document this target produces — also shown in the UI. */
export function targetSize(target: ExportTarget, opts: ExportOpts): { w: number; h: number } {
  if (target.scope === "canvas") return { w: CANVAS_W, h: CANVAS_H };
  const pad = (opts.padding ?? PAD_DEFAULT) * 2;
  const frame = rotatedFrame(target.node);
  return { w: Math.round(frame.w + pad), h: Math.round(frame.h + pad) };
}

const fileBase = (target: ExportTarget, opts: ExportOpts): string =>
  `${slugify(targetName(target))}-${opts.animated ? "animated" : "static"}`;

export function downloadSvgFile(target: ExportTarget, opts: ExportOpts): void {
  downloadSVG(fileBase(target, opts), buildSvg(target, opts));
}

export const copySvgMarkup = (target: ExportTarget, opts: ExportOpts): Promise<boolean> =>
  copySvg(buildSvg(target, opts));

/* ------------------------------------------------------------------ */
/* PNG                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Safari refuses to allocate a canvas beyond roughly this area, and a silently
 * blank PNG is worse than a slightly smaller one — so a 4× canvas export gets
 * clamped instead of failing.
 */
const MAX_RASTER_PX = 16_000_000;

/** The scale a PNG can actually be rendered at, given the raster ceiling. */
export function pngScale(target: ExportTarget, opts: ExportOpts, want: number): number {
  const { w, h } = targetSize(target, opts);
  const ceiling = Math.sqrt(MAX_RASTER_PX / Math.max(1, w * h));
  return Math.max(0.25, Math.min(want, ceiling));
}

/**
 * Rasterize through an `<img>` and a canvas. Always renders the STATIC frame:
 * an `<img>` runs its own SMIL clock that we can't seek, so an animated source
 * would capture an arbitrary moment. "Pause, then export PNG" is what a user
 * means by a still anyway.
 *
 * Fonts are the one caveat — the image is decoded in an isolated context, so
 * only families installed on the machine resolve (see docs/EXPORT.md).
 */
export async function renderPng(
  target: ExportTarget,
  opts: ExportOpts,
  wantScale: number,
): Promise<Blob | null> {
  const scale = pngScale(target, opts, wantScale);
  const svg = buildSvg(target, { ...opts, animated: false });
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG failed to decode"));
      img.src = url;
    });
    // Safari leaves naturalWidth at 0 for SVGs without intrinsic size; ours
    // always carry width/height, but fall back to the box just in case.
    const w = (img.naturalWidth || img.width) * scale;
    const h = (img.naturalHeight || img.height) * scale;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadPng(
  target: ExportTarget,
  opts: ExportOpts,
  scale: number,
): Promise<boolean> {
  const blob = await renderPng(target, opts, scale);
  if (!blob) return false;
  const at = Math.round(pngScale(target, opts, scale) * 100) / 100;
  downloadBlob(`${slugify(targetName(target))}@${at}x.png`, blob);
  return true;
}

/** Note the un-awaited promise — see `copyImage` for why Safari needs that. */
export function copyPng(target: ExportTarget, opts: ExportOpts, scale: number): Promise<boolean> {
  const pending = renderPng(target, opts, scale).then((blob) => {
    if (!blob) throw new Error("rasterize failed");
    return blob;
  });
  return copyImage(pending);
}

/* ------------------------------------------------------------------ */
/* .dkl.json — the editable format                                     */
/* ------------------------------------------------------------------ */

/**
 * A document containing just this target. Node ids and seeds are preserved, so
 * reopening reproduces byte-identical SVG (the determinism check in
 * `npm run smoke`).
 */
export function buildDoc(target: ExportTarget, background: { color: string }): DarklighterDoc {
  return {
    format: "darklighter",
    version: 1,
    name: targetName(target),
    background,
    nodes: target.scope === "node" ? [target.node] : target.nodes,
  };
}

export const docJson = (doc: DarklighterDoc): string => JSON.stringify(doc, null, 2);

export function downloadDoc(target: ExportTarget, background: { color: string }): void {
  const doc = buildDoc(target, background);
  downloadJSON(`${slugify(doc.name)}.dkl.json`, docJson(doc));
}

export const copyDoc = (target: ExportTarget, background: { color: string }): Promise<boolean> =>
  copyText(docJson(buildDoc(target, background)));

/** Parse a `.dkl.json` file's text. Returns null if it isn't one. */
export function parseDoc(text: string): DarklighterDoc | null {
  try {
    const doc = JSON.parse(text) as DarklighterDoc;
    if (doc?.format !== "darklighter" || !Array.isArray(doc.nodes)) return null;
    return { ...doc, background: doc.background ?? { color: "blimpWhite" } };
  } catch {
    return null;
  }
}

/** Open the OS file picker and hand back a parsed document. */
export function pickDoc(): Promise<DarklighterDoc | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.dkl.json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? parseDoc(await file.text()) : null);
    };
    input.click();
  });
}
