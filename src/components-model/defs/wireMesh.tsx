/**
 * `wireMesh` — a 3D model turning in place, drawn as vector line work.
 *
 * The geometry is imported from a `.glb` (`npm run mesh` →
 * `src/assets/mesh/meshes.ts`) in two forms: structural contours cut off the
 * full-resolution model, and a decimated triangle mesh. This component
 * projects whichever the `look` asks for, one `d` string per rotation step,
 * and hands the sequence to a single SMIL `<animate>` on one `<path>`
 * (`src/lib/mesh3d.ts` explains the choice).
 *
 * `frame` is the default because it is the one that reads as a drawing of the
 * object rather than a dump of its mesh — a triangulated wireframe gets busier
 * with detail where a set of stations and stringers gets clearer.
 *
 * Two consequences worth knowing before editing:
 *  - The paused frame is genuine geometry, so Export ▸ Static SVG and a paste
 *    into Figma give real editable paths — the thing a rendered 3D view can
 *    never give you without tracing it back.
 *  - Every frame restates the whole path, so markup weight is
 *    `edges × frames`. `detail` is nearly free on a still node and the most
 *    expensive knob on a spinning one; both control hints say so.
 */
import type { ColorRole, ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode, COLOR_ROLE_OPTIONS, strokeW } from "@/components-model/defaults";
import {
  DEFAULT_MESH,
  MESH_LOD_OPTIONS,
  MESH_OPTIONS,
  meshGeometry,
  type MeshLodId,
} from "@/assets/mesh/meshes";
import { meshFrames, type MeshLook, type SpinAxis } from "@/lib/mesh3d";
import { behaviorOf, cycle, timing, DRAW_BASE } from "@/lib/anim";
import { clamp } from "@/lib/math";

const MESH_BEHAVIORS = ["rotate", "drawOn", "fadeIn", "blink", "pulse"] as const;

/** Rotation samples per turn. SMIL interpolates between them, so ~16 already reads as smooth. */
const MIN_FRAMES = 6;
const MAX_FRAMES = 48;
/** Breathing room so a stroke's own width can't touch the box edge. */
const BOX_PAD = 6;

export interface WireMeshProps {
  meshId: string;
  /** Decimation level of the imported geometry. */
  detail: MeshLodId;
  /** Structural contours, the raw triangulation, or a filled silhouette. */
  look: MeshLook;
  spinAxis: SpinAxis;
  /**
   * Rotation about the spin axis at rest — aims the still frame, and sets
   * where the turn starts and ends.
   */
  spinDeg: number;
  /** Camera pitch, so the model reads as 3D rather than dead-on flat. */
  tiltDeg: number;
  /** 0 = orthographic, 100 = strongly foreshortened. */
  perspective: number;
  /** Rotation steps baked into one turn — smoothness against markup weight. */
  frames: number;
  roleColor: ColorRole;
}

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    wireMesh: WireMeshProps;
  }
}

function factory(): ComponentNode<"wireMesh"> {
  return baseNode(
    "wireMesh",
    "Wire Mesh",
    {
      meshId: DEFAULT_MESH,
      // Medium is the whole model at the size this part is placed at; the
      // finer levels add lines you can only see once it's scaled up, and pay
      // for them on every frame of the spin.
      detail: "medium",
      look: "frame",
      spinAxis: "y",
      spinDeg: 0,
      tiltDeg: 16,
      perspective: 45,
      frames: 16,
      roleColor: "primary",
    },
    // A model turns slowly; the 1200ms default would read as a blur.
    { layout: { w: 260, h: 260 }, animation: { durationMs: 9000 } },
  );
}

function Render({ node, animate, color }: RenderProps<"wireMesh">) {
  const { w, h } = node.layout;
  const { meshId, detail, look, spinAxis, spinDeg, tiltDeg, perspective, frames, roleColor } =
    node.props;
  const geom = meshGeometry(meshId, detail);
  const paint = color(roleColor);
  const behavior = animate ? behaviorOf(node.animation.behavior, MESH_BEHAVIORS) : null;
  const spinning = behavior === "rotate";
  const draw = behavior === "drawOn";

  if (!geom) return <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" />;

  // A still node shows one attitude, so it only pays for one frame.
  const steps = spinning ? Math.round(clamp(frames, MIN_FRAMES, MAX_FRAMES)) : 1;
  const turn = meshFrames(geom, {
    axis: spinAxis,
    spinDeg,
    tiltDeg,
    perspective,
    frames: steps,
    look,
    w,
    h,
    pad: BOX_PAD,
  });
  // Frame 0 is the base attribute AND the last value in the loop, so the
  // resting frame and the finished frame are the same drawing (invariant #4).
  const rest = turn[0];
  const order = node.animation.direction === "reverse" ? [rest, ...turn.slice(1).reverse()] : turn;

  const body = (
    <path
      d={rest}
      fill={look === "solid" ? paint : "none"}
      // Solid faces are stroked in their own color too: adjacent triangles
      // otherwise leave hairline antialiasing seams across the silhouette.
      stroke={paint}
      strokeWidth={strokeW(node, look === "solid" ? 0.75 : 1)}
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={draw ? DRAW_BASE.pathLength : undefined}
      strokeDasharray={draw ? DRAW_BASE.strokeDasharray : undefined}
    >
      {spinning && (
        <animate attributeName="d" values={[...order, rest].join(";")} {...cycle(node.animation)} />
      )}
      {draw && <animate attributeName="stroke-dashoffset" {...timing(node.animation, "1", "0")} />}
    </path>
  );

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
      {behavior === "fadeIn" && <animate attributeName="opacity" {...timing(node.animation, "0", "1")} />}
      {behavior === "blink" && <animate attributeName="opacity" values="1;0.15;1" {...cycle(node.animation)} />}
      {behavior === "pulse" ? (
        // Re-origin onto the box centre so the scale pulses about the model
        // rather than dragging it toward the corner.
        <g transform={`translate(${w / 2}, ${h / 2})`}>
          <animateTransform
            attributeName="transform"
            type="scale"
            additive="sum"
            values="1;1.08;1"
            {...cycle(node.animation)}
          />
          <g transform={`translate(${-w / 2}, ${-h / 2})`}>{body}</g>
        </g>
      ) : (
        body
      )}
    </svg>
  );
}

defineComponent({
  kind: "wireMesh",
  label: "Wire Mesh",
  category: "craft",
  tags: ["craft", "hud"],
  describe:
    "A 3D model turning in place as vector line work — drawn as a structural frame of stations, stringers and profiles, as the raw mesh, or as a solid silhouette. Every frame is real geometry, so the paused one exports as editable paths.",
  factory,
  Render,
  controls: [
    { kind: "select", key: "meshId", label: "Model", options: MESH_OPTIONS },
    {
      kind: "select",
      key: "look",
      label: "Look",
      options: [
        { value: "frame", label: "Frame — structural contours" },
        { value: "wire", label: "Wireframe — raw mesh" },
        { value: "solid", label: "Solid silhouette" },
      ],
      hint: "Frame draws rings and profiles the way a technical illustration would. Wireframe draws the triangulation, which gets busier rather than clearer as detail rises.",
    },
    {
      kind: "select",
      key: "detail",
      label: "Detail",
      options: MESH_LOD_OPTIONS,
      hint: "More ribs on a frame; more triangles on a wireframe. Nearly free while still, and the heaviest knob while spinning, since every frame restates the whole path.",
    },
    {
      kind: "select",
      key: "spinAxis",
      label: "Spin axis",
      options: [
        { value: "y", label: "Y — upright turn" },
        { value: "x", label: "X — tumble" },
        { value: "z", label: "Z — roll" },
      ],
      group: "View",
    },
    {
      kind: "number",
      key: "spinDeg",
      label: "Rotation",
      hint: "Turns the model about its spin axis. This is the attitude a paused or exported frame shows, so it's how you grab the shape from a different angle — and while spinning, where the turn starts.",
      min: 0,
      max: 360,
      step: 1,
      group: "View",
    },
    {
      kind: "number",
      key: "tiltDeg",
      label: "Tilt",
      hint: "Camera pitch. 0 looks at it edge-on; 20–30 reads as a HUD three-quarter view.",
      min: -90,
      max: 90,
      step: 1,
      group: "View",
    },
    {
      kind: "number",
      key: "perspective",
      label: "Perspective",
      hint: "0 is orthographic — a technical projection. Higher throws the near side forward.",
      min: 0,
      max: 100,
      step: 1,
      group: "View",
    },
    {
      kind: "number",
      key: "frames",
      label: "Rotation steps",
      hint: "Samples in one turn. Higher is smoother and heavier; only applies while spinning.",
      min: MIN_FRAMES,
      max: MAX_FRAMES,
      step: 1,
      group: "Movement",
      visibleWhen: (_p, node) => behaviorOf(node.animation.behavior, MESH_BEHAVIORS) === "rotate",
    },
    { kind: "select", key: "roleColor", label: "Color role", options: COLOR_ROLE_OPTIONS },
  ],
  animBehaviors: [...MESH_BEHAVIORS],
  // A spinning body sweeps a cylinder, so its drawing is square whatever the
  // model's own proportions are — and the geometry is normalized to a unit
  // sphere for exactly that reason (scripts/importMesh.mjs).
  aspectOf: () => 1,
  acceptsChildren: false,
});
