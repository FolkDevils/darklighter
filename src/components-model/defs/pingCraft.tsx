/**
 * `pingCraft` — tracked-unit icon (PLAN.md §5.2 composites), rebuilt from
 * primitives to match `assets/protora/Group 276.svg`: an X45C planform
 * inside radiating ping rings.
 *
 * REBUILT, NOT IMPORTED (docs/NORTH_STAR.md).
 */
import type { ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode } from "@/components-model/defaults";
import { part } from "@/components-model/scenes";

export interface PingCraftProps {
  /** Small upward marker under the craft, as in the source icon. */
  showMarker: boolean;
}

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    pingCraft: PingCraftProps;
  }
}

const SIZE = 300;
/** X45C native 188∶141. Drift room is handled inside craft's padded viewBox. */
const UNIT_DRIFT = 18;
const UNIT_W = 120;
const UNIT_H = Math.round((UNIT_W * 141) / 188);

function factory(): ComponentNode<"pingCraft"> {
  return baseNode(
    "pingCraft",
    "Ping Craft",
    { showMarker: true },
    {
      layout: { w: SIZE, h: SIZE },
      animation: { cascade: true },
      children: [
        part(
          "ringSet",
          { x: 0, y: 0, w: SIZE, h: SIZE },
          { count: 4, labeled: false, accentOuter: false, strokeWidth: 1.4 },
          { name: "Ping Rings", animation: { behavior: "ping", durationMs: 2400, staggerMs: 320, easing: "easeOut" } },
        ),
        part(
          "craft",
          { x: SIZE / 2 - UNIT_W / 2, y: SIZE / 2 - UNIT_H / 2, w: UNIT_W, h: UNIT_H },
          { craftId: "x45c", roleColor: "ink", driftRadius: UNIT_DRIFT },
          { name: "Unit", animation: { behavior: "drift", inherit: false, durationMs: 7000 } },
        ),
      ],
    },
  );
}

function Render({ node, animate, color }: RenderProps<"pingCraft">) {
  const { w, h } = node.layout;
  if (!node.props.showMarker) return <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" />;
  const y = h - 22;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
      <polygon points={`${w / 2},${y - 10} ${w / 2 - 7},${y} ${w / 2 + 7},${y}`} fill={color("primary")}>
        {animate && <animate attributeName="opacity" values="1;0.3;1" dur="1400ms" repeatCount="indefinite" />}
      </polygon>
    </svg>
  );
}

defineComponent({
  kind: "pingCraft",
  label: "Ping Craft",
  category: "composites",
  tags: ["craft", "radar", "composite"],
  describe: "Tracked-unit icon: craft silhouette inside radiating ping rings.",
  factory,
  Render,
  controls: [{ kind: "toggle", key: "showMarker", label: "Direction marker" }],
  animBehaviors: ["fadeIn"],
  acceptsChildren: true,
});
