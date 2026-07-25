/**
 * `readoutBar` — big percentage readout + segmented progress bar (PLAN.md
 * §5.2 "sweep/boot module"), source geometry family: `Group 143.svg` /
 * `Group 324.svg` (the `87%` block) and `Group 328.svg` (range bar).
 *
 * `count` counts the number up rather than fading it in, because the boot
 * modules read as live telemetry — the resting frame is the final value, so
 * a static export still shows the correct number.
 */
import type { ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode, strokeW } from "@/components-model/defaults";
import { behaviorOf, cycle, timing } from "@/lib/anim";

const READOUT_BEHAVIORS = ["drawOn", "fadeIn", "blink"] as const;

export interface ReadoutBarProps {
  value: number; // 0..100
  label: string;
  showValue: boolean;
  /** Brand quirk: render 0 as the slashed Ø used across the kit. */
  slashedZero: boolean;
  segments: number;
  barHeight: number;
}

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    readoutBar: ReadoutBarProps;
  }
}

function factory(): ComponentNode<"readoutBar"> {
  return baseNode(
    "readoutBar",
    "Readout Bar",
    { value: 87, label: "SWEEP PROGRESS", showValue: true, slashedZero: true, segments: 24, barHeight: 10 },
    { layout: { w: 300, h: 86 } },
  );
}

function Render({ node, animate, color }: RenderProps<"readoutBar">) {
  const { w, h } = node.layout;
  const { value, label, showValue, slashedZero, segments, barHeight } = node.props;
  const primary = color("primary");
  const accent = color("accent");
  const ink = color("ink");

  const pct = Math.max(0, Math.min(100, value));
  const segs = Math.max(1, segments);
  const filled = Math.round((pct / 100) * segs);
  const gap = 3;
  const segW = (w - (segs - 1) * gap) / segs;
  const barY = h - barHeight;
  const text = `${slashedZero ? String(pct).replace(/0/g, "Ø") : pct}%`;

  const behavior = animate ? behaviorOf(node.animation.behavior, READOUT_BEHAVIORS) : null;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
      {behavior === "fadeIn" && <animate attributeName="opacity" {...timing(node.animation, "0", "1")} />}
      {showValue && (
        <text
          x={0}
          y={h - barHeight - 18}
          fontFamily="'IBM Plex Mono', ui-monospace, monospace"
          fontSize={Math.min(48, h * 0.55)}
          fontWeight={600}
          fill={accent}
        >
          {behavior === "blink" && <animate attributeName="opacity" values="1;0.25;1" {...cycle(node.animation)} />}
          {text}
        </text>
      )}
      <text
        x={w}
        y={h - barHeight - 18}
        textAnchor="end"
        fontFamily="'IBM Plex Mono', ui-monospace, monospace"
        fontSize={11}
        letterSpacing={1}
        fill={ink}
      >
        {label.toUpperCase()}
      </text>
      {Array.from({ length: segs }, (_, i) => {
        const on = i < filled;
        return (
          <rect
            key={i}
            x={i * (segW + gap)}
            y={barY}
            width={segW}
            height={barHeight}
            fill={on ? primary : "none"}
            stroke={primary}
            strokeWidth={strokeW(node, 1)}
            opacity={on ? 1 : 0.35}
          >
            {/* Segments switch on one after another, so the bar "fills". */}
            {behavior === "drawOn" && on && (
              <animate
                attributeName="opacity"
                values="0;1"
                keyTimes={`0;${((i / segs) * 0.98).toFixed(4)}`}
                calcMode="discrete"
                dur={`${Math.max(1, node.animation.durationMs + (node.animation.loop ? node.animation.loopDelayMs : 0))}ms`}
                begin={`${Math.max(0, node.animation.delayMs)}ms`}
                {...(node.animation.loop ? { repeatCount: "indefinite" as const } : { fill: "freeze" as const })}
              />
            )}
          </rect>
        );
      })}
    </svg>
  );
}

defineComponent({
  kind: "readoutBar",
  label: "Readout Bar",
  category: "text",
  tags: ["text", "hud"],
  describe: "Large percentage readout over a segmented progress bar (boot/sweep module).",
  factory,
  Render,
  controls: [
    { kind: "number", key: "value", label: "Value", min: 0, max: 100, step: 1 },
    { kind: "text", key: "label", label: "Label" },
    { kind: "number", key: "segments", label: "Segments", min: 1, max: 80, step: 1 },
    { kind: "number", key: "barHeight", label: "Bar height", min: 2, max: 40, step: 1 },
    { kind: "toggle", key: "showValue", label: "Show value" },
    { kind: "toggle", key: "slashedZero", label: "Slashed zero (Ø)", visibleWhen: (p) => Boolean(p.showValue) },
  ],
  animBehaviors: [...READOUT_BEHAVIORS],
  acceptsChildren: false,
});
