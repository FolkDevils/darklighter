/**
 * `statusText` — monospaced HUD text block (PLAN.md §5.2), source geometry
 * family: `Group 143/147/321/323/326.svg`. Live editable text stands in
 * for the outlined-path copy baked into the source SVGs (ELEMENTS.md
 * "no editable text" note) — preserves brand quirks (`AQUIRED`, `1ØØ%`)
 * only when the author types them; nothing is auto-corrected.
 */
import type { ComponentNode } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode, COLOR_ROLE_OPTIONS } from "@/components-model/defaults";
import { behaviorOf, cycle, stagger, timing } from "@/lib/anim";
import type { ColorRole } from "@/components-model/types";

const TEXT_BEHAVIORS = ["typewriter", "fadeIn", "blink"] as const;

export interface StatusTextProps {
  lines: string[];
  align: "left" | "center" | "right";
  uppercase: boolean;
  fontSize: number;
  roleColor: ColorRole;
}

declare module "@/components-model/types" {
  interface KindPropsRegistry {
    statusText: StatusTextProps;
  }
}

function factory(): ComponentNode<"statusText"> {
  return baseNode(
    "statusText",
    "Status Text",
    {
      lines: ["SYSTEM >>> ***ACTIVATED***", "INITIATING SWEEP", "UNITS AQUIRED :15"],
      align: "left",
      uppercase: true,
      fontSize: 12,
      roleColor: "primary",
    },
    { layout: { w: 260, h: 90 } },
  );
}

function Render({ node, animate, color }: RenderProps<"statusText">) {
  const { w, h } = node.layout;
  const { lines, align, uppercase, fontSize, roleColor } = node.props;
  const fill = color(roleColor);
  const lineHeight = fontSize * 1.5;
  const x = align === "left" ? 4 : align === "right" ? w - 4 : w / 2;
  const anchor = align === "left" ? "start" : align === "right" ? "end" : "middle";
  const text = (line: string) => (uppercase ? line.toUpperCase() : line);

  const behavior = animate ? behaviorOf(node.animation.behavior, TEXT_BEHAVIORS) : null;
  const anim = node.animation;

  // Typewriter reveals one character at a time. Every tspan runs the same
  // full-length discrete animation and simply flips on at its own keyTime —
  // that way the resting attribute stays opacity:1 (correct static export)
  // instead of relying on staggered `begin` times that would leave text
  // visible before their turn.
  const totalChars = Math.max(1, lines.reduce((n, l) => n + text(l).length, 0));
  const cycleMs = anim.durationMs + (anim.loop ? Math.max(0, anim.loopDelayMs) : 0);
  const typeFrac = anim.durationMs / Math.max(1, cycleMs);
  const typeTiming = {
    dur: `${Math.max(1, cycleMs)}ms`,
    begin: `${Math.max(0, anim.delayMs)}ms`,
    calcMode: "discrete" as const,
    ...(anim.loop ? { repeatCount: "indefinite" as const } : { fill: "freeze" as const }),
  };
  let charCursor = 0;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
      {lines.map((line, i) => {
        const content = text(line);
        return (
          <text
            key={i}
            x={x}
            y={fontSize + i * lineHeight}
            textAnchor={anchor}
            fontFamily="'IBM Plex Mono', ui-monospace, monospace"
            fontSize={fontSize}
            letterSpacing={0.5}
            fill={fill}
            xmlSpace="preserve"
          >
            {behavior === "fadeIn" && (
              <animate attributeName="opacity" {...timing(anim, "0", "1", stagger(anim, i, lines.length))} />
            )}
            {behavior === "blink" && (
              <animate attributeName="opacity" values="1;0.15;1" {...cycle(anim, stagger(anim, i, lines.length))} />
            )}
            {behavior === "typewriter"
              ? Array.from(content, (ch) => {
                  const at = ((charCursor++ / totalChars) * typeFrac).toFixed(4);
                  return (
                    <tspan key={charCursor}>
                      <animate attributeName="opacity" values="0;1" keyTimes={`0;${at}`} {...typeTiming} />
                      {ch}
                    </tspan>
                  );
                })
              : content}
          </text>
        );
      })}
    </svg>
  );
}

defineComponent({
  kind: "statusText",
  label: "Status Text",
  category: "text",
  tags: ["text", "hud"],
  describe: "Monospaced all-caps HUD status block, one line at a time.",
  factory,
  Render,
  controls: [
    { kind: "labellist", key: "lines", label: "Lines" },
    {
      kind: "select",
      key: "align",
      label: "Align",
      options: [
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
        { value: "right", label: "Right" },
      ],
    },
    { kind: "toggle", key: "uppercase", label: "Uppercase" },
    { kind: "number", key: "fontSize", label: "Font size", min: 6, max: 40, step: 1 },
    { kind: "select", key: "roleColor", label: "Color role", options: COLOR_ROLE_OPTIONS },
  ],
  animBehaviors: [...TEXT_BEHAVIORS],
  acceptsChildren: false,
});
