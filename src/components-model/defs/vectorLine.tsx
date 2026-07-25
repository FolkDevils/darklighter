/**
 * `vectorLine` — dashed trajectory/bearing line (PLAN.md §5.2), source
 * geometry family: `Frame (3).svg`, `Group 322.svg`.
 */
import type { ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode, strokeW } from "@/components-model/defaults";
import { behaviorOf, cycle, timing } from "@/lib/anim";

const LINE_BEHAVIORS = ["drawOn", "march", "fadeIn"] as const;

export interface VectorLineProps {
  angleDeg: number;
  length: number;
  dashed: boolean;
  endMarker: "none" | "arrow" | "dot";
  /** Where the line starts: the middle of the box, or its left edge (a rule). */
  origin: "center" | "start";
  /** Run to the edge of the box instead of a fixed length, so it scales with the box. */
  fitBox: boolean;
  /** Draw the origin dot. Off for plain rules and underlines. */
  showOrigin: boolean;
}

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    vectorLine: VectorLineProps;
  }
}

function factory(): ComponentNode<"vectorLine"> {
  return baseNode(
    "vectorLine",
    "Vector Line",
    { angleDeg: -30, length: 140, dashed: true, endMarker: "arrow", origin: "center", fitBox: false, showOrigin: true },
    { layout: { w: 160, h: 160 } },
  );
}

function Render({ node, animate, color }: RenderProps<"vectorLine">) {
  const { w, h } = node.layout;
  const { angleDeg, length, dashed, endMarker, origin, fitBox, showOrigin } = node.props;
  const cx = origin === "start" ? 0 : w / 2;
  const cy = h / 2;
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  // Fitting to the box means solving for the first edge the ray leaves through,
  // which is what lets a rule or bearing line scale with its container.
  const edge = Math.min(
    dx > 0 ? (w - cx) / dx : dx < 0 ? -cx / dx : Infinity,
    dy > 0 ? (h - cy) / dy : dy < 0 ? -cy / dy : Infinity,
  );
  const run = fitBox && Number.isFinite(edge) ? edge : length;
  const ex = cx + run * dx;
  const ey = cy + run * dy;
  const primary = color("primary");
  const accent = color("accent");

  const behavior = animate ? behaviorOf(node.animation.behavior, LINE_BEHAVIORS) : null;
  // Extending the endpoint (rather than borrowing the dash array) keeps
  // draw-on working on a dashed line and drags the end marker along with it.
  const draw = behavior === "drawOn";
  const markerReveal = draw ? (
    <animate attributeName="opacity" {...timing(node.animation, "0", "1", node.animation.durationMs * 0.75)} />
  ) : null;

  const arrow = () => {
    const back = angleDeg + 180;
    const wing = (a: number) => {
      const r = (a * Math.PI) / 180;
      return [ex + 9 * Math.cos(r), ey + 9 * Math.sin(r)] as const;
    };
    const [lx, ly] = wing(back - 24);
    const [rx, ry] = wing(back + 24);
    return (
      <polygon points={`${ex},${ey} ${lx},${ly} ${rx},${ry}`} fill={accent}>
        {markerReveal}
      </polygon>
    );
  };

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
      {behavior === "fadeIn" && <animate attributeName="opacity" {...timing(node.animation, "0", "1")} />}
      <line
        x1={cx}
        y1={cy}
        x2={ex}
        y2={ey}
        stroke={primary}
        strokeWidth={strokeW(node, 1.6)}
        strokeDasharray={dashed ? "6 5" : undefined}
        strokeLinecap="round"
        strokeDashoffset={0}
      >
        {draw && (
          <>
            <animate attributeName="x2" {...timing(node.animation, String(cx), String(ex))} />
            <animate attributeName="y2" {...timing(node.animation, String(cy), String(ey))} />
          </>
        )}
        {behavior === "march" && dashed && (
          <animate attributeName="stroke-dashoffset" values="11;0" {...cycle(node.animation)} />
        )}
      </line>
      {showOrigin && <circle cx={cx} cy={cy} r={2.2} fill={primary} />}
      {endMarker === "arrow" && arrow()}
      {endMarker === "dot" && (
        <circle cx={ex} cy={ey} r={4} fill={accent}>
          {markerReveal}
        </circle>
      )}
    </svg>
  );
}

defineComponent({
  kind: "vectorLine",
  label: "Vector Line",
  category: "radar",
  tags: ["line", "hud"],
  describe: "Dashed bearing/trajectory line with an optional arrow or dot end marker.",
  factory,
  Render,
  controls: [
    { kind: "number", key: "angleDeg", label: "Angle", min: -360, max: 360, step: 1 },
    {
      kind: "select",
      key: "origin",
      label: "Starts at",
      options: [
        { value: "center", label: "Center of box" },
        { value: "start", label: "Left edge" },
      ],
    },
    { kind: "toggle", key: "fitBox", label: "Fit to box", hint: "Length follows the box, so it scales with a group." },
    {
      kind: "number",
      key: "length",
      label: "Length",
      min: 4,
      max: 600,
      step: 1,
      visibleWhen: (p) => !p.fitBox,
    },
    { kind: "toggle", key: "dashed", label: "Dashed" },
    { kind: "toggle", key: "showOrigin", label: "Origin dot" },
    {
      kind: "select",
      key: "endMarker",
      label: "End marker",
      options: [
        { value: "none", label: "None" },
        { value: "arrow", label: "Arrow" },
        { value: "dot", label: "Dot" },
      ],
    },
  ],
  animBehaviors: [...LINE_BEHAVIORS],
  acceptsChildren: false,
});
