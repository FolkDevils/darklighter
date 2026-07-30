/**
 * 3D → SVG projection. Turns a decimated mesh (`src/assets/mesh/meshes.ts`)
 * into the `d` strings of a rotation, one per frame, so a spinning model can
 * be expressed as ordinary SMIL on a single `<path>`.
 *
 * The reason it works this way, rather than with a canvas or WebGL: a
 * projected edge IS a line segment. Doing the projection ourselves means every
 * frame — including the paused one the editor shows and the static export
 * writes — is real, exact vector geometry that pastes into Figma as paths. A
 * WebGL preview would have to be traced back into vectors and would lose the
 * one property that makes the part useful here. It also keeps invariant #4
 * intact: frame 0 is the base `d`, and the SMIL values loop back to it.
 *
 * Everything is one path with many subpaths, not one element per edge. That's
 * a 1-node DOM cost instead of hundreds, and it pastes into Figma as a single
 * vector object rather than a folder of loose lines.
 */
import type { MeshGeometry } from "@/assets/mesh/meshes";

export type SpinAxis = "x" | "y" | "z";
/**
 * How the model is drawn:
 *  - `frame`  structural contours — rings around the long axis and profiles
 *             along it, the way a technical illustration draws an airframe,
 *  - `wire`   every edge of the triangulated mesh,
 *  - `solid`  the filled union of the triangles (a silhouette).
 */
export type MeshLook = "frame" | "wire" | "solid";

export interface MeshFrameOptions {
  axis: SpinAxis;
  /**
   * Rotation about `axis` at frame 0 — which way the model faces when it is
   * still, and where a turn begins and ends.
   */
  spinDeg: number;
  /** Camera pitch, so the model reads as 3D instead of dead-on flat. */
  tiltDeg: number;
  /** 0 = orthographic, 100 = strongly foreshortened. */
  perspective: number;
  /** Rotation samples in one full turn. SMIL interpolates between them. */
  frames: number;
  look: MeshLook;
  /** Box to draw into; the model is centred and uniformly scaled to fit. */
  w: number;
  h: number;
  /** Inset from the box edge, in px. */
  pad: number;
}

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                     */
/* ------------------------------------------------------------------ */

/** Unique undirected edges of a face list, derived once per geometry. */
const edgeCache = new WeakMap<MeshGeometry, Int32Array>();

function meshEdges(geom: MeshGeometry): Int32Array {
  const cached = edgeCache.get(geom);
  if (cached) return cached;
  const seen = new Set<number>();
  const out: number[] = [];
  const { faces } = geom;
  for (let i = 0; i + 2 < faces.length; i += 3) {
    const tri = [faces[i], faces[i + 1], faces[i + 2]];
    for (let e = 0; e < 3; e++) {
      const a = tri[e];
      const b = tri[(e + 1) % 3];
      const lo = a < b ? a : b;
      const hi = a < b ? b : a;
      // One integer key per pair; vertex counts here are in the hundreds, so
      // a 20-bit shift is far more headroom than the importer can produce.
      const key = lo * 0x100000 + hi;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(lo, hi);
    }
  }
  const edges = Int32Array.from(out);
  edgeCache.set(geom, edges);
  return edges;
}

/* ------------------------------------------------------------------ */
/* Path emission                                                        */
/* ------------------------------------------------------------------ */

/**
 * One decimal place. Every coordinate is repeated once per frame in a SMIL
 * `values` list, so the digit that buys nothing visually costs real bytes:
 * at 0.1px the quantization is well below a hairline stroke.
 */
const fmt = (v: number): string => String(Math.round(v * 10) / 10);

/** `x y`, dropping the separator when y is negative — legal path grammar, fewer bytes. */
function pair(x: number, y: number): string {
  const sy = fmt(y);
  return sy.startsWith("-") ? `${fmt(x)}${sy}` : `${fmt(x)} ${sy}`;
}

/* ------------------------------------------------------------------ */
/* Projection                                                           */
/* ------------------------------------------------------------------ */

const framesCache = new Map<string, string[]>();
const FRAMES_CACHE_MAX = 32;

/** Sweep resolution for measuring the turn's extent — 5°, deliberately fixed. */
const SWEEP_STEPS = 72;

const geomIds = new WeakMap<MeshGeometry, number>();
let nextGeomId = 0;
const geomId = (geom: MeshGeometry): number => {
  let id = geomIds.get(geom);
  if (id === undefined) {
    id = nextGeomId++;
    geomIds.set(geom, id);
  }
  return id;
};

/**
 * The `d` string for every frame of one full turn, frame 0 first.
 *
 * Scale is solved ACROSS all frames, not per frame: a per-frame fit would
 * make the model breathe as its projected width changes through the turn.
 */
export function meshFrames(geom: MeshGeometry, o: MeshFrameOptions): string[] {
  const frames = Math.max(1, Math.round(o.frames));
  const key = [
    geomId(geom),
    o.axis,
    Math.round(o.spinDeg * 10),
    Math.round(o.tiltDeg * 10),
    Math.round(o.perspective * 10),
    frames,
    o.look,
    Math.round(o.w * 10),
    Math.round(o.h * 10),
    Math.round(o.pad * 10),
  ].join("|");
  const hit = framesCache.get(key);
  if (hit) return hit;

  const { faces } = geom;
  // The frame look draws its own point set (the contour polylines), so it
  // projects those instead of the mesh vertices. Everything downstream of here
  // is identical for all three looks.
  const contourRuns: { at: number; len: number }[] = [];
  let verts = geom.verts;
  if (o.look === "frame") {
    const pts: number[] = [];
    for (const line of geom.contours) {
      contourRuns.push({ at: pts.length / 3, len: line.length / 3 });
      for (const v of line) pts.push(v);
    }
    verts = pts;
  }
  const vertCount = verts.length / 3;
  const tilt = (o.tiltDeg * Math.PI) / 180;
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);
  // Reciprocal camera distance: 0 is exactly orthographic, so the control has
  // no discontinuity at its low end. Capped below 1 so a vertex on the unit
  // sphere can never reach or cross the camera plane.
  const invD = (Math.min(100, Math.max(0, o.perspective)) / 100) * 0.55;

  /** Vertex `i`, spun by `a`, pitched, projected, written to `out` at `at`. */
  const project = (i: number, cosA: number, sinA: number, out: Float64Array, at: number) => {
    const vx = verts[i * 3];
    const vy = verts[i * 3 + 1];
    const vz = verts[i * 3 + 2];

    // Spin the model about its own axis…
    let x: number;
    let y: number;
    let z: number;
    if (o.axis === "x") {
      x = vx;
      y = vy * cosA - vz * sinA;
      z = vy * sinA + vz * cosA;
    } else if (o.axis === "z") {
      x = vx * cosA - vy * sinA;
      y = vx * sinA + vy * cosA;
      z = vz;
    } else {
      x = vx * cosA + vz * sinA;
      y = vy;
      z = -vx * sinA + vz * cosA;
    }

    // …then pitch the camera over it.
    const ty = y * cosT - z * sinT;
    const tz = y * sinT + z * cosT;

    const persp = 1 / (1 - tz * invD);
    out[at] = x * persp;
    // SVG's y axis points down; the model's points up.
    out[at + 1] = -ty * persp;
  };

  // Pass 0: the extent of the WHOLE swept turn, measured on a fixed dense
  // sweep rather than on the frames being drawn. Scale therefore depends only
  // on the model, the view and the box — never on `spinDeg` or `frames`. Three
  // things follow, and all three are things a user would otherwise report as
  // bugs: turning the model doesn't resize it, pausing doesn't make it jump,
  // and no rotation can clip its box.
  const scratch = new Float64Array(2);
  let extent = 0;
  for (let m = 0; m < SWEEP_STEPS; m++) {
    const a = (m / SWEEP_STEPS) * Math.PI * 2;
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    for (let i = 0; i < vertCount; i++) {
      project(i, cosA, sinA, scratch, 0);
      const mx = Math.max(Math.abs(scratch[0]), Math.abs(scratch[1]));
      if (mx > extent) extent = mx;
    }
  }

  // Pass 1: project the frames actually being drawn. A still node draws one,
  // and gets it at the same scale the full turn would have used.
  const projected: Float64Array[] = [];
  const start = (o.spinDeg * Math.PI) / 180;
  for (let f = 0; f < frames; f++) {
    // Frame 0 sits at `spinDeg`, so the attitude the user dialled in is the one
    // a paused editor, a still export and the ends of the loop all show.
    const a = start + (f / frames) * Math.PI * 2;
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    const buf = new Float64Array(vertCount * 2);
    for (let i = 0; i < vertCount; i++) project(i, cosA, sinA, buf, i * 2);
    projected.push(buf);
  }

  const fit = Math.max(1, Math.min(o.w, o.h) / 2 - o.pad);
  const scale = extent > 0 ? fit / extent : fit;
  const cx = o.w / 2;
  const cy = o.h / 2;
  const edges = o.look === "wire" ? meshEdges(geom) : null;

  // Pass 2: one `d` per frame, all with identical command structure so SMIL
  // can interpolate between them.
  const out = projected.map((buf) => {
    const at = (i: number): [number, number] => [cx + buf[i * 2] * scale, cy + buf[i * 2 + 1] * scale];
    let d = "";
    if (o.look === "frame") {
      // One `M` and then a run of `L`s per contour. That shared start is why
      // the frame look draws more of the model for fewer bytes than a
      // wireframe, where every edge restates both of its endpoints.
      for (const run of contourRuns) {
        const [x0, y0] = at(run.at);
        d += `M${pair(x0, y0)}`;
        for (let k = 1; k < run.len; k++) {
          const [x, y] = at(run.at + k);
          d += `L${pair(x, y)}`;
        }
      }
      return d;
    }
    if (edges) {
      for (let e = 0; e + 1 < edges.length; e += 2) {
        const [x1, y1] = at(edges[e]);
        const [x2, y2] = at(edges[e + 1]);
        d += `M${pair(x1, y1)}L${pair(x2, y2)}`;
      }
      return d;
    }
    for (let i = 0; i + 2 < faces.length; i += 3) {
      const p0 = at(faces[i]);
      let p1 = at(faces[i + 1]);
      let p2 = at(faces[i + 2]);
      // Wind every triangle the same way on screen. With `fill-rule: nonzero`,
      // a back face laid over a front face would otherwise cancel it and punch
      // a hole through the silhouette. Swapping two corners is safe to
      // interpolate across frames because a triangle only changes handedness
      // as it crosses edge-on, where it has no area to distort.
      const area = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]);
      if (area < 0) [p1, p2] = [p2, p1];
      d += `M${pair(p0[0], p0[1])}L${pair(p1[0], p1[1])}L${pair(p2[0], p2[1])}Z`;
    }
    return d;
  });

  if (framesCache.size >= FRAMES_CACHE_MAX) {
    framesCache.delete(framesCache.keys().next().value as string);
  }
  framesCache.set(key, out);
  return out;
}
