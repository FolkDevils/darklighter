/**
 * Mesh registry — the hand-written half of the 3D pipeline, exactly parallel
 * to `src/assets/brand/assets.ts`: the type, the lookup, and the `{value,label}`
 * option lists the inspector's selects read. The geometry itself is generated
 * (`npm run mesh` → `scripts/importMesh.mjs`), which is why the import below
 * points at a generated barrel.
 *
 * A mesh is stored as plain numbers — vertices normalized into a unit sphere
 * around the origin, plus triangle indices — and NOT as markup. That is the
 * whole point: `wireMesh` projects these points itself at whatever tilt,
 * perspective and rotation its props ask for, so the model is a parametric
 * part like everything else rather than a picture of one.
 */
import { GENERATED_MESHES } from "./generated";

/** Decimation levels baked by the importer: more detail = heavier markup. */
export type MeshLodId = "low" | "medium" | "high" | "ultra" | "max";

/** The triangulated form of one detail level. */
export interface MeshTriangles {
  /** Flat xyz triples, centred on the origin, farthest point at radius 1. */
  verts: number[];
  /** Flat triangle index triples into `verts`. */
  faces: number[];
}

/** One detail level with both representations resolved — what a renderer draws. */
export interface MeshGeometry extends MeshTriangles {
  /**
   * Structural contours: rings around the model's long axis and profiles
   * along it, each a flat xyz polyline. Sliced off the FULL resolution mesh,
   * so unlike the triangulated form these get better as they get denser.
   */
  contours: number[][];
}

export interface MeshAsset {
  id: string;
  label: string;
  describe: string;
  /** Original filename in assets/protora/, for traceability. */
  source: string;
  lods: Record<MeshLodId, MeshTriangles>;
  /** Every contour polyline, at the finest density any level uses. */
  contours: number[][];
  /** Which of `contours` each level draws — a subset, never its own slicing. */
  contourLods: Record<MeshLodId, number[]>;
}

export const MESH_ASSETS: MeshAsset[] = GENERATED_MESHES;

export const DEFAULT_MESH = "wingwatcher";

export const MESH_OPTIONS: { value: string; label: string }[] = MESH_ASSETS.map((m) => ({
  value: m.id,
  label: m.label,
}));

export const MESH_LOD_OPTIONS: { value: MeshLodId; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "ultra", label: "Ultra" },
  { value: "max", label: "Max" },
];

/**
 * Geometry for one mesh at one detail level. Memoized because the renderer
 * caches projected frames against the IDENTITY of what it is handed — a fresh
 * object per render would miss that cache on every frame and grow it forever.
 */
const resolved = new Map<string, MeshGeometry | null>();

/**
 * Tolerates an unknown id or lod (a document written by a newer build, or a
 * mesh dropped from the catalog) by falling back rather than throwing inside
 * a render.
 */
export function meshGeometry(id: string, lod: MeshLodId): MeshGeometry | null {
  const key = `${id}|${lod}`;
  const hit = resolved.get(key);
  if (hit !== undefined) return hit;

  const asset = MESH_ASSETS.find((m) => m.id === id) ?? MESH_ASSETS[0];
  const tris = asset?.lods[lod] ?? asset?.lods.low;
  const geom: MeshGeometry | null =
    asset && tris
      ? {
          verts: tris.verts,
          faces: tris.faces,
          contours: (asset.contourLods[lod] ?? asset.contourLods.low ?? []).map(
            (i) => asset.contours[i],
          ),
        }
      : null;
  resolved.set(key, geom);
  return geom;
}
