/**
 * 3D mesh import pipeline — the sibling of scripts/importAssets.mjs, for
 * `.glb` sources instead of `.svg` ones. Run with `npm run mesh` after adding
 * or replacing a model.
 *
 * WHY THIS EXISTS AT ALL, given docs/NORTH_STAR.md says the assets are the
 * target and not the product: a 3D model isn't art to import, it's GEOMETRY to
 * generate from. What lands in `src/assets/mesh/generated/` is a few hundred
 * numbers — a decimated point/face list — and the `wireMesh` component draws
 * every frame of the spin from it with its own projection math. That makes it
 * programmatic, adjustable and moving (the three properties), and it means the
 * paused frame is real vector line work: literal `<path>` segments a designer
 * can paste into Figma, not a traced raster of a render.
 *
 * The source file never enters the bundle. WINGWATCHER.glb is 45 MB of baked
 * PBR textures and ~500k triangles; none of that survives this script, and
 * none of it needs to — a single-ink wireframe has no use for a normal map.
 *
 * Three things happen here:
 *   1. parse the GLB container (JSON chunk + BIN chunk) and pull POSITION and
 *      the index buffer out of the first mesh primitive — no dependency, since
 *      that is ~60 lines of DataView reads and pulling in a glTF loader for it
 *      would be the tail wagging the dog,
 *   2. DECIMATE by vertex clustering: snap every vertex to a coarse 3D grid,
 *      keep one representative per occupied cell, and drop triangles that
 *      collapse. Deterministic (no RNG, no heuristics), and it's the reduction
 *      that makes an SVG wireframe possible at all — 500k triangles is ~800k
 *      edges, which no browser will draw as DOM,
 *   3. normalize into a UNIT SPHERE centred on the origin, so the renderer can
 *      spin the thing about any axis and know it can never leave a square box.
 *
 * Faces are emitted; edges are derived at runtime (`src/lib/mesh3d.ts`),
 * because the solid look needs the triangles anyway and storing both would be
 * the same data twice.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = join(ROOT, "assets/protora");
const OUT_DIR = join(ROOT, "src/assets/mesh/generated");

/**
 * WHAT GETS IMPORTED. Each detail level describes the model two ways, because
 * the two looks scale in opposite directions:
 *
 *  - `grid` is a CLUSTER RESOLUTION (cells along the model's longest axis) for
 *    the triangulated wireframe. Face count falls out of how much surface the
 *    model has. Note that denser is not better here: past a few hundred edges
 *    a mesh reads as a net rather than as an object.
 *  - `hoops`/`stringers` are how many structural contours to draw — rings
 *    around the long axis and profiles along it. These come off the FULL
 *    resolution mesh, so raising them adds real detail instead of noise.
 *
 * Tune by running this and reading the printed counts. The budget that matters
 * is points × frames: every frame of a spin restates the whole path.
 */
const CATALOG = [
  {
    file: "WINGWATCHER.glb",
    slug: "wingwatcher",
    label: "Wingwatcher",
    describe: "Wingwatcher airship, as a structural frame or a mesh.",
    lods: {
      low: { grid: 5, hoops: 5, stringers: 4, profiles: 2 },
      medium: { grid: 9, hoops: 9, stringers: 6, profiles: 3 },
      high: { grid: 14, hoops: 14, stringers: 8, profiles: 5 },
      ultra: { grid: 28, hoops: 22, stringers: 12, profiles: 8 },
      max: { grid: 56, hoops: 36, stringers: 24, profiles: 12 },
    },
  },
];

/* ------------------------------------------------------------------ */
/* GLB container                                                        */
/* ------------------------------------------------------------------ */

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a; // "JSON"
const CHUNK_BIN = 0x004e4942; // "BIN\0"

function parseGlb(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== GLB_MAGIC) throw new Error("not a binary glTF");
  const total = dv.getUint32(8, true);
  let json = null;
  let bin = null;
  let off = 12;
  while (off + 8 <= total) {
    const len = dv.getUint32(off, true);
    const type = dv.getUint32(off + 4, true);
    const start = off + 8;
    if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(buf.subarray(start, start + len)));
    else if (type === CHUNK_BIN) bin = buf.subarray(start, start + len);
    // Chunks are 4-byte aligned; trust the spec but don't depend on it.
    off = start + len + ((4 - (len % 4)) % 4);
  }
  if (!json || !bin) throw new Error("glb is missing its JSON or BIN chunk");
  return { json, bin };
}

const COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const COMPONENT_READ = {
  5120: (dv, o) => dv.getInt8(o),
  5121: (dv, o) => dv.getUint8(o),
  5122: (dv, o) => dv.getInt16(o, true),
  5123: (dv, o) => dv.getUint16(o, true),
  5125: (dv, o) => dv.getUint32(o, true),
  5126: (dv, o) => dv.getFloat32(o, true),
};
const COMPONENTS_PER = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

/** One accessor as a flat Float64Array — exact for indices too (< 2^53). */
function readAccessor(json, bin, index) {
  const acc = json.accessors[index];
  const per = COMPONENTS_PER[acc.type];
  const bytes = COMPONENT_BYTES[acc.componentType];
  const read = COMPONENT_READ[acc.componentType];
  if (!per || !bytes || !read) throw new Error(`unsupported accessor ${acc.type}/${acc.componentType}`);
  const view = json.bufferViews[acc.bufferView];
  const base = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const stride = view.byteStride ?? bytes * per;
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const out = new Float64Array(acc.count * per);
  for (let i = 0; i < acc.count; i++) {
    for (let c = 0; c < per; c++) out[i * per + c] = read(dv, base + i * stride + c * bytes);
  }
  return out;
}

/** POSITION + indices of the first triangle primitive in the file. */
function firstPrimitive(json, bin) {
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      // mode 4 (TRIANGLES) is the default when omitted.
      if ((prim.mode ?? 4) !== 4 || prim.attributes?.POSITION == null) continue;
      const positions = readAccessor(json, bin, prim.attributes.POSITION);
      const indices =
        prim.indices != null
          ? readAccessor(json, bin, prim.indices)
          : Float64Array.from({ length: positions.length / 3 }, (_, i) => i);
      return { positions, indices };
    }
  }
  throw new Error("no triangle primitive with POSITION in this file");
}

/* ------------------------------------------------------------------ */
/* Decimation — vertex clustering                                       */
/* ------------------------------------------------------------------ */

/**
 * Snap vertices to a `res`-cell grid, average each cell into one
 * representative, and keep the triangles whose three corners still land in
 * three different cells. No randomness and no ordering heuristics, so the
 * same model always reduces to the same wireframe (invariant #6 applies to
 * generated data too, or a re-run would silently redraw every saved document).
 */
function clusterDecimate(positions, indices, res) {
  const vertCount = positions.length / 3;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < vertCount; i++) {
    for (let a = 0; a < 3; a++) {
      const v = positions[i * 3 + a];
      if (v < min[a]) min[a] = v;
      if (v > max[a]) max[a] = v;
    }
  }
  const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
  const cell = span / res;
  const K = res + 2; // grid pitch for the cell key; +2 leaves room for clamping

  const cellOf = (i) => {
    let key = 0;
    for (let a = 0; a < 3; a++) {
      const raw = Math.floor((positions[i * 3 + a] - min[a]) / cell);
      key = key * K + Math.max(0, Math.min(res, raw));
    }
    return key;
  };

  // Cell centroid, so the reduced hull follows the surface rather than the
  // grid — snapping to cell centres would visibly cube the silhouette.
  const sums = new Map();
  const cellIndex = new Int32Array(vertCount);
  for (let i = 0; i < vertCount; i++) {
    const key = cellOf(i);
    cellIndex[i] = key;
    const acc = sums.get(key);
    if (acc) {
      acc[0] += positions[i * 3];
      acc[1] += positions[i * 3 + 1];
      acc[2] += positions[i * 3 + 2];
      acc[3] += 1;
    } else {
      sums.set(key, [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], 1]);
    }
  }

  const seen = new Set();
  const keptFaces = [];
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const a = cellIndex[indices[t]];
    const b = cellIndex[indices[t + 1]];
    const c = cellIndex[indices[t + 2]];
    if (a === b || b === c || a === c) continue; // collapsed to an edge or a point
    const key = [a, b, c].sort((p, q) => p - q).join(",");
    if (seen.has(key)) continue; // several source triangles fell into one cell triple
    seen.add(key);
    keptFaces.push(a, b, c); // original winding preserved
  }

  // Compact the surviving cells into a dense vertex list.
  const idOf = new Map();
  const verts = [];
  const faces = new Array(keptFaces.length);
  for (let i = 0; i < keptFaces.length; i++) {
    const key = keptFaces[i];
    let id = idOf.get(key);
    if (id === undefined) {
      const [sx, sy, sz, n] = sums.get(key);
      id = verts.length / 3;
      verts.push(sx / n, sy / n, sz / n);
      idOf.set(key, id);
    }
    faces[i] = id;
  }
  return { verts, faces };
}

/**
 * Centre on the model's bounding box and scale its farthest point onto a
 * radius of 1. A spinning object sweeps a sphere, so unit-sphere normalization
 * is what lets the renderer guarantee it never clips its (square) box at any
 * rotation, tilt or perspective setting.
 *
 * Solved ONCE against the source mesh and then applied to every LOD and to the
 * contours, so switching detail can't nudge the model: each level is a
 * different drawing of the same object at the same size, not its own fit.
 */
function measure(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      if (positions[i + a] < min[a]) min[a] = positions[i + a];
      if (positions[i + a] > max[a]) max[a] = positions[i + a];
    }
  }
  const mid = [0, 1, 2].map((a) => (min[a] + max[a]) / 2);
  let far = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const d = Math.hypot(positions[i] - mid[0], positions[i + 1] - mid[1], positions[i + 2] - mid[2]);
    if (d > far) far = d;
  }
  return { min, max, mid, scale: far > 0 ? 1 / far : 1 };
}

const applyFit = (pts, fit) =>
  pts.map((v, i) => Math.round((v - fit.mid[i % 3]) * fit.scale * 1000) / 1000);

/* ------------------------------------------------------------------ */
/* Contours — the structural drawing                                    */
/*                                                                      */
/* A triangulated wireframe gets LESS legible as it gets denser: past a */
/* few hundred edges it reads as a net, and past a few thousand as a    */
/* smudge. A technical illustration of an airship doesn't draw the mesh */
/* at all — it draws the FRAME: hoops around the hull and stringers     */
/* along it. Those are exactly the curves you get by intersecting the   */
/* model with a plane, so we slice the FULL-resolution mesh (no         */
/* decimation, no lost fidelity) and keep the outlines.                 */
/*                                                                      */
/* This is both prettier and cheaper: a hoop is one polyline of ~40     */
/* points rather than hundreds of disconnected triangle edges.          */
/* ------------------------------------------------------------------ */

/** Every segment where `positions`/`indices` crosses the plane `n·p = d`. */
function planeSegments(positions, indices, n, d) {
  const segs = [];
  const [nx, ny, nz] = n;
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const ia = indices[t] * 3;
    const ib = indices[t + 1] * 3;
    const ic = indices[t + 2] * 3;
    const fa = nx * positions[ia] + ny * positions[ia + 1] + nz * positions[ia + 2] - d;
    const fb = nx * positions[ib] + ny * positions[ib + 1] + nz * positions[ib + 2] - d;
    const fc = nx * positions[ic] + ny * positions[ic + 1] + nz * positions[ic + 2] - d;
    // Classifying 0 as "positive" keeps a vertex that lands exactly on the
    // plane from being counted as two crossings; plane offsets are nudged off
    // round numbers below so that case is vanishingly rare anyway.
    const pa = fa >= 0;
    const pb = fb >= 0;
    const pc = fc >= 0;
    if (pa === pb && pb === pc) continue;
    const hit = [];
    for (const [i0, f0, i1, f1] of [
      [ia, fa, ib, fb],
      [ib, fb, ic, fc],
      [ic, fc, ia, fa],
    ]) {
      if (f0 >= 0 === f1 >= 0) continue;
      const s = f0 / (f0 - f1);
      hit.push(
        positions[i0] + (positions[i1] - positions[i0]) * s,
        positions[i0 + 1] + (positions[i1 + 1] - positions[i0 + 1]) * s,
        positions[i0 + 2] + (positions[i1 + 2] - positions[i0 + 2]) * s,
      );
    }
    if (hit.length === 6) segs.push(hit);
  }
  return segs;
}

/**
 * Join loose segments into polylines. Endpoints are matched on a quantized
 * key rather than by equality: two triangles sharing an edge interpolate the
 * same crossing point in opposite directions, which agrees to within an ULP
 * but not exactly.
 */
function chainSegments(segs, tol) {
  const key = (x, y, z) =>
    `${Math.round(x / tol)},${Math.round(y / tol)},${Math.round(z / tol)}`;
  const at = new Map();
  segs.forEach((s, i) => {
    for (const k of [key(s[0], s[1], s[2]), key(s[3], s[4], s[5])]) {
      const list = at.get(k);
      if (list) list.push(i);
      else at.set(k, [i]);
    }
  });

  const used = new Array(segs.length).fill(false);
  const chains = [];
  for (let start = 0; start < segs.length; start++) {
    if (used[start]) continue;
    used[start] = true;
    const s = segs[start];
    const pts = [
      [s[0], s[1], s[2]],
      [s[3], s[4], s[5]],
    ];

    // Grow from the tail, then from the head, until nothing connects.
    for (const forward of [true, false]) {
      for (;;) {
        const tip = forward ? pts[pts.length - 1] : pts[0];
        const candidates = at.get(key(tip[0], tip[1], tip[2])) ?? [];
        const next = candidates.find((i) => !used[i]);
        if (next === undefined) break;
        used[next] = true;
        const seg = segs[next];
        const a = [seg[0], seg[1], seg[2]];
        const b = [seg[3], seg[4], seg[5]];
        const far = key(a[0], a[1], a[2]) === key(tip[0], tip[1], tip[2]) ? b : a;
        if (forward) pts.push(far);
        else pts.unshift(far);
      }
    }
    chains.push(pts);
  }
  return chains;
}

/** Ramer–Douglas–Peucker in 3D, endpoints fixed. */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const [ax, ay, az] = pts[0];
  const [bx, by, bz] = pts[pts.length - 1];
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const len2 = dx * dx + dy * dy + dz * dz;
  let worst = 0;
  let at = -1;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py, pz] = pts[i];
    let d2;
    if (len2 === 0) {
      d2 = (px - ax) ** 2 + (py - ay) ** 2 + (pz - az) ** 2;
    } else {
      const t = ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / len2;
      const u = Math.max(0, Math.min(1, t));
      d2 = (px - ax - dx * u) ** 2 + (py - ay - dy * u) ** 2 + (pz - az - dz * u) ** 2;
    }
    if (d2 > worst) {
      worst = d2;
      at = i;
    }
  }
  if (worst <= tol * tol || at < 0) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)];
}

/** Total length of a polyline, for throwing away slivers. */
function chainLength(pts) {
  let sum = 0;
  for (let i = 1; i < pts.length; i++) {
    sum += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
  }
  return sum;
}

function sliceToPolylines(positions, indices, n, d, span) {
  const chains = chainSegments(planeSegments(positions, indices, n, d), span * 1e-5);
  const out = [];
  for (const chain of chains) {
    if (chainLength(chain) < span * 0.015) continue; // slivers and stray shells
    // A closed loop has to be simplified in two halves: RDP pins the two ends,
    // and on a loop they are the same point, which would collapse the whole ring.
    const closed =
      chain.length > 3 &&
      Math.hypot(
        chain[0][0] - chain[chain.length - 1][0],
        chain[0][1] - chain[chain.length - 1][1],
        chain[0][2] - chain[chain.length - 1][2],
      ) < span * 1e-4;
    const tol = span * 0.0015;
    const simple = closed
      ? (() => {
          const half = Math.floor(chain.length / 2);
          return [...simplify(chain.slice(0, half + 1), tol).slice(0, -1), ...simplify(chain.slice(half), tol)];
        })()
      : simplify(chain, tol);
    if (simple.length >= 2) out.push(simple);
  }
  return out;
}

/**
 * The master contour set — a naval lines plan, which is what the reference
 * illustration is: STATIONS around the long axis, STRINGERS fanned along it,
 * and PROFILES cut across the other two axes.
 *
 * The profiles are not decoration. Stations and stringers alone leave a thin
 * part like a tail fin as a row of loose spikes: the ribs across it are there,
 * but nothing bounds their tips, because a stringer plane through the spine is
 * nearly coplanar with a centred fin and slices it lengthwise instead of
 * outlining it. A plane cut across the fin at a height above the hull catches
 * exactly that missing chord line, and on the hull the same planes read as
 * waterlines.
 *
 * (Extracting the model's hard edges was tried here first and removed — see
 * the Phase 5c entry in docs/DECISIONS.md for why it doesn't suit this mesh.)
 *
 * Sliced once at full density; each level then picks an evenly spaced subset
 * (`pickEvenly`), so raising detail ADDS lines between the existing ones
 * rather than redrawing the model somewhere else.
 */
function buildContours(positions, indices, fit, hoops, stringers, profiles) {
  const extent = [0, 1, 2].map((a) => fit.max[a] - fit.min[a]);
  // The spine is the model's longest dimension — for an airship, nose to tail.
  const spine = extent.indexOf(Math.max(...extent));
  const span = Math.max(...extent);
  const other = [0, 1, 2].filter((a) => a !== spine);

  const hoopLines = [];
  for (let i = 0; i < hoops; i++) {
    const n = [0, 0, 0];
    n[spine] = 1;
    // Inset from the tips (a slice through the very end is a point), and
    // nudged off exact round values so vertices rarely land on the plane.
    const t = 0.035 + ((i + 0.5) / hoops) * 0.93;
    const d = fit.min[spine] + extent[spine] * t + span * 1e-6;
    hoopLines.push({ order: i, lines: sliceToPolylines(positions, indices, n, d, span) });
  }

  const stringerLines = [];
  for (let i = 0; i < stringers; i++) {
    // Planes that all contain the spine, fanned around it.
    const a = (i / stringers) * Math.PI;
    const n = [0, 0, 0];
    n[other[0]] = Math.cos(a);
    n[other[1]] = Math.sin(a);
    const d = n[other[0]] * fit.mid[other[0]] + n[other[1]] * fit.mid[other[1]] + span * 1e-6;
    stringerLines.push({ order: i, lines: sliceToPolylines(positions, indices, n, d, span) });
  }

  const profileLines = [];
  for (const axis of other) {
    for (let i = 0; i < profiles; i++) {
      const n = [0, 0, 0];
      n[axis] = 1;
      // Spread across the whole extent of the axis, including heights that
      // clear the hull entirely and catch only the fins. The 0.5 offset keeps
      // every plane off dead centre, where a centred fin lies flat in it.
      const t = 0.06 + ((i + 0.5) / profiles) * 0.88;
      const d = fit.min[axis] + (fit.max[axis] - fit.min[axis]) * t + span * 1e-6;
      profileLines.push({ order: i, lines: sliceToPolylines(positions, indices, n, d, span) });
    }
  }
  return { hoopLines, stringerLines, profileLines };
}

/** `count` items spread evenly across `n` slots, always including the first. */
const pickEvenly = (n, count) => {
  const k = Math.max(0, Math.min(n, count));
  return Array.from({ length: k }, (_, i) => Math.round((i * n) / k));
};

/** Unique undirected edges, for the log line only — the runtime derives its own. */
function edgeCount(faces) {
  const set = new Set();
  for (let i = 0; i + 2 < faces.length; i += 3) {
    const [a, b, c] = [faces[i], faces[i + 1], faces[i + 2]];
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      set.add(p < q ? `${p},${q}` : `${q},${p}`);
    }
  }
  return set.size;
}

/* ------------------------------------------------------------------ */
/* Emit                                                                 */
/* ------------------------------------------------------------------ */

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const index = [];
for (const entry of CATALOG) {
  const { json, bin } = parseGlb(readFileSync(join(SRC_DIR, entry.file)));
  const { positions, indices } = firstPrimitive(json, bin);
  console.log(
    `${entry.slug}  source: ${positions.length / 3} verts, ${indices.length / 3} tris`,
  );

  const fit = measure(positions);

  // Slice ONCE at the finest density every level asks for; each level then
  // takes an evenly spaced subset, so raising detail adds ribs between the
  // ones already there rather than redrawing the frame somewhere else.
  const masterHoops = Math.max(...Object.values(entry.lods).map((l) => l.hoops));
  const masterStringers = Math.max(...Object.values(entry.lods).map((l) => l.stringers));
  const masterProfiles = Math.max(...Object.values(entry.lods).map((l) => l.profiles));
  const { hoopLines, stringerLines, profileLines } = buildContours(
    positions,
    indices,
    fit,
    masterHoops,
    masterStringers,
    masterProfiles,
  );

  const contours = [];
  const group = (sliced) =>
    sliced.map(({ lines }) =>
      lines.map((line) => {
        contours.push(applyFit(line.flat(), fit));
        return contours.length - 1;
      }),
    );
  const hoopGroups = group(hoopLines);
  const stringerGroups = group(stringerLines);
  const profileGroups = group(profileLines);

  const contourPoints = contours.reduce((n, c) => n + c.length / 3, 0);
  console.log(
    `  contours      ${String(contours.length).padStart(4)} lines  ` +
      `${String(contourPoints).padStart(5)} points  ` +
      `(${masterHoops} stations, ${masterStringers} stringers, ${masterProfiles}×2 profiles)`,
  );

  const lods = {};
  const contourLods = {};
  for (const [lod, cfg] of Object.entries(entry.lods)) {
    const { verts, faces } = clusterDecimate(positions, indices, cfg.grid);
    lods[lod] = { verts: applyFit(verts, fit), faces };
    contourLods[lod] = [
      ...pickEvenly(hoopGroups.length, cfg.hoops).flatMap((i) => hoopGroups[i] ?? []),
      ...pickEvenly(stringerGroups.length, cfg.stringers).flatMap((i) => stringerGroups[i] ?? []),
      // Profiles were sliced for both axes back to back, so the pick runs over
      // the doubled list to keep the two axes in step with each other.
      ...pickEvenly(profileGroups.length, cfg.profiles * 2).flatMap((i) => profileGroups[i] ?? []),
    ].sort((a, b) => a - b);
    const pts = contourLods[lod].reduce((n, i) => n + contours[i].length / 3, 0);
    console.log(
      `  ${lod.padEnd(6)} grid ${String(cfg.grid).padStart(2)}  ` +
        `${String(edgeCount(faces)).padStart(5)} mesh edges  |  ` +
        `${String(contourLods[lod].length).padStart(3)} contour lines  ` +
        `${String(pts).padStart(4)} points`,
    );
  }

  // Slicing and crease detection generate far more lines than the densest
  // level draws (thousands of tiny hard edges, most of them rejected by the
  // top-N cut). Only what something actually references is worth shipping.
  const used = [...new Set(Object.values(contourLods).flat())].sort((a, b) => a - b);
  const remap = new Map(used.map((old, i) => [old, i]));
  const shipped = used.map((i) => contours[i]);
  for (const lod of Object.keys(contourLods)) {
    contourLods[lod] = contourLods[lod].map((i) => remap.get(i));
  }
  console.log(
    `  shipping      ${String(shipped.length).padStart(4)} of ${contours.length} contour lines`,
  );

  const body = Object.entries(lods)
    .map(
      ([lod, g]) =>
        `    ${lod}: {\n      verts: [${g.verts.join(",")}],\n      faces: [${g.faces.join(",")}],\n    },`,
    )
    .join("\n");
  const contourBody = shipped.map((c) => `    [${c.join(",")}],`).join("\n");
  const contourLodBody = Object.entries(contourLods)
    .map(([lod, ids]) => `    ${lod}: [${ids.join(",")}],`)
    .join("\n");

  writeFileSync(
    join(OUT_DIR, `${entry.slug}.ts`),
    `/* GENERATED by scripts/importMesh.mjs from assets/protora/${entry.file} — do not edit. */
import type { MeshAsset } from "../meshes";

export const ${entry.slug}: MeshAsset = {
  id: ${JSON.stringify(entry.slug)},
  label: ${JSON.stringify(entry.label)},
  describe: ${JSON.stringify(entry.describe)},
  source: ${JSON.stringify(entry.file)},
  lods: {
${body}
  },
  contours: [
${contourBody}
  ],
  contourLods: {
${contourLodBody}
  },
};
`,
    "utf8",
  );
  index.push(entry.slug);
}

writeFileSync(
  join(OUT_DIR, "index.ts"),
  `/* GENERATED by scripts/importMesh.mjs — do not edit. */
import type { MeshAsset } from "../meshes";
${index.map((s) => `import { ${s} } from "./${s}";`).join("\n")}

export const GENERATED_MESHES: MeshAsset[] = [${index.join(", ")}];
`,
  "utf8",
);
console.log(`\n${index.length} mesh(es) written to src/assets/mesh/generated/`);
