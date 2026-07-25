/**
 * `logoP` — the Protora P mark (PLAN.md §5.2 composites), built from the
 * extracted geometry in `src/assets/brand/logoP.ts`.
 *
 * This is the ONE piece of art that stays a fixed shape (docs/NORTH_STAR.md):
 * the P shell is the host, and whatever radar component sits in the
 * `radarFill` slot is punched THROUGH the letterform by the approved
 * luminance mask. That is what makes the mark extensible — drop a live
 * `radarScope`, `polarGrid` or `reticle` in the bowl and the logo animates
 * with it, instead of being a frozen SVG.
 *
 * The host draws its own slot content (rather than letting RenderNode place
 * it as a sibling) because a mask can only affect geometry inside the same
 * SVG. RenderNode skips knockout slots for exactly this reason.
 */
import type { ComponentNode } from "@/components-model/types";
import { componentDef, defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode } from "@/components-model/defaults";
import { part } from "@/components-model/scenes";
import { behaviorOf, timing } from "@/lib/anim";
import { resolveColor } from "@/lib/colorway";
import {
  APPROVED_RADAR,
  LOGO_P_VIEWBOX,
  P_SHELL_PATH,
  RADAR_SLOT_FRAME,
  TM_PATHS,
} from "@/assets/brand/logoP";

const LOGO_BEHAVIORS = ["fadeIn", "drawOn"] as const;

export interface LogoPProps {
  showTm: boolean;
  /**
   * "knockout" punches the slot content out of the P (the approved mark);
   * "overlay" draws the P flat with the radar on top, for explorations.
   */
  slotMode: "knockout" | "overlay";
}

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    logoP: LogoPProps;
  }
}

/**
 * The approved reticle as an ordinary, fully editable `reticle` node whose
 * numbers come straight from APPROVED_RADAR: 4 rings spread from r=77.66 to
 * r=153.035 and a crosshair that breaks at the inner ring. Because it is a
 * normal node, the protected default is pixel-true AND the user can still
 * change ring count, stroke, timing — or swap the whole thing out.
 */
function approvedRadar(): ComponentNode {
  const radii = APPROVED_RADAR.ringRadii;
  const inner = radii[0];
  // The crosshair, not the rings, sets the extent: it runs the full width of
  // the source's radar area and is what the box has to hold.
  const axesLength = APPROVED_RADAR.crosshair.horizontal[1].x2 - APPROVED_RADAR.crosshair.horizontal[0].x1;
  const box = axesLength;
  const cx = APPROVED_RADAR.center.cx - RADAR_SLOT_FRAME.x;
  const cy = APPROVED_RADAR.center.cy - RADAR_SLOT_FRAME.y;

  return part(
    "reticle",
    { x: cx - box / 2, y: cy - box / 2, w: box, h: box },
    {
      axesLength,
      ringCount: radii.length,
      innerRadius: inner,
      ringSpacing: radii[1] - radii[0],
      centerGap: inner,
      strokeWidth: APPROVED_RADAR.strokeWidth,
    },
    {
      name: "Approved Reticle",
      animation: { behavior: "drawOn", durationMs: 1600, staggerMs: 140, loop: true, loopDelayMs: 1400 },
    },
  );
}

function factory(): ComponentNode<"logoP"> {
  return baseNode(
    "logoP",
    "P Mark",
    { showTm: true, slotMode: "knockout" },
    {
      layout: { w: LOGO_P_VIEWBOX.w, h: LOGO_P_VIEWBOX.h },
      animation: { behavior: "fadeIn", cascade: true },
      slots: { radarFill: approvedRadar() },
      provenance: { source: "library", baseComponent: "logoP", protected: true },
    },
  );
}

/**
 * Draw slot content inside the host's coordinate space. A nested `<svg>`
 * viewport with the child's own box means the child renderer is used
 * verbatim — no second copy of its geometry that could drift.
 */
function SlotArt({ node, animate, ink }: { node: ComponentNode; animate: boolean; ink: string | null }) {
  const def = componentDef(node.kind);
  const color = ink
    ? () => ink
    : (role: Parameters<typeof resolveColor>[1]) => resolveColor(node.style, role);
  return (
    <svg
      x={RADAR_SLOT_FRAME.x + node.layout.x}
      y={RADAR_SLOT_FRAME.y + node.layout.y}
      width={node.layout.w}
      height={node.layout.h}
      overflow="visible"
    >
      {def.Render({ node, animate, color })}
    </svg>
  );
}

function Render({ node, animate, color }: RenderProps<"logoP">) {
  const { showTm, slotMode } = node.props;
  const vb = LOGO_P_VIEWBOX;
  const ink = color("ink");
  const behavior = animate ? behaviorOf(node.animation.behavior, LOGO_BEHAVIORS) : null;
  const maskId = `logop-mask-${node.id}`;
  const knockout = slotMode === "knockout";
  const radar = node.slots?.radarFill ?? null;
  const radarRunning = animate && Boolean(radar?.animation.enabled);

  return (
    <svg viewBox={`0 0 ${vb.w} ${vb.h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {behavior === "fadeIn" && <animate attributeName="opacity" {...timing(node.animation, "0", "1")} />}
      {knockout && radar && (
        <mask id={maskId} maskUnits="userSpaceOnUse" style={{ maskType: "luminance" }}>
          <rect width={vb.w} height={vb.h} fill="black" />
          <path d={P_SHELL_PATH} fill="white" />
          {/* Black strokes inside the white P = punched through. */}
          <SlotArt node={radar} animate={radarRunning} ink="black" />
        </mask>
      )}
      <path d={P_SHELL_PATH} fill={ink} mask={knockout && radar ? `url(#${maskId})` : undefined}>
        {behavior === "drawOn" && <animate attributeName="opacity" {...timing(node.animation, "0", "1")} />}
      </path>
      {!knockout && radar && <SlotArt node={radar} animate={radarRunning} ink={null} />}
      {showTm &&
        TM_PATHS.map((d, i) => (
          <path key={i} d={d} fill={ink}>
            {behavior && <animate attributeName="opacity" {...timing(node.animation, "0", "1", 400 + i * 120)} />}
          </path>
        ))}
    </svg>
  );
}

defineComponent({
  kind: "logoP",
  label: "P Mark",
  category: "logos",
  tags: ["logo", "composite"],
  describe:
    "The Protora P mark. Its bowl is a slot: drop any radar component in and it is punched through the letterform.",
  factory,
  Render,
  controls: [
    { kind: "toggle", key: "showTm", label: "TM glyphs" },
    {
      kind: "select",
      key: "slotMode",
      label: "Radar mode",
      options: [
        { value: "knockout", label: "Knockout (approved)" },
        { value: "overlay", label: "Overlay" },
      ],
    },
  ],
  animBehaviors: [...LOGO_BEHAVIORS],
  slots: [
    {
      name: "radarFill",
      accepts: ["radar", "glyph", "hud"],
      frame: RADAR_SLOT_FRAME,
      mode: "knockout",
      defaultContent: approvedRadar,
    },
  ],
  acceptsChildren: false,
});
