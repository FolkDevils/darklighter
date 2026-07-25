/**
 * The target-glyph registry (PLAN.md §4 "PATTERN" from the reference app's
 * `primitives/registry.tsx`, §5.2 `targetGlyph`). Shared between the
 * `targetGlyph` kind and `blipField` (which stamps glyphs at generated
 * positions), so the glyph set only lives in one place.
 *
 * Every glyph is drawn centered on local (0,0); callers wrap the result in
 * a positioning `<g transform="translate(cx,cy)">`.
 */
import type { ReactElement } from "react";

export type GlyphId =
  | "squareDot"
  | "circleX"
  | "plainX"
  | "hexBolt"
  | "bracket"
  | "circle"
  | "squareX";

export const GLYPH_IDS: GlyphId[] = [
  "squareDot",
  "circleX",
  "plainX",
  "hexBolt",
  "bracket",
  "circle",
  "squareX",
];

export const GLYPH_OPTIONS: { value: GlyphId; label: string }[] = [
  { value: "squareDot", label: "Square + dot" },
  { value: "circleX", label: "Circle + X" },
  { value: "plainX", label: "Plain X" },
  { value: "hexBolt", label: "Hex bolt" },
  { value: "bracket", label: "Corner bracket" },
  { value: "circle", label: "Circle" },
  { value: "squareX", label: "Square + X" },
];

interface GlyphProps {
  size: number;
  color: string;
  strokeWidth?: number;
}

/** Render one glyph, centered at local (0,0). */
export function renderGlyph(id: GlyphId, { size, color, strokeWidth = 1.6 }: GlyphProps): ReactElement {
  const s = size;
  const h = s / 2;
  switch (id) {
    case "squareDot":
      return (
        <g>
          <rect x={-h} y={-h} width={s} height={s} fill="none" stroke={color} strokeWidth={strokeWidth} />
          <circle cx={0} cy={0} r={s * 0.14} fill={color} />
        </g>
      );
    case "circleX":
      return (
        <g>
          <circle cx={0} cy={0} r={h} fill="none" stroke={color} strokeWidth={strokeWidth} />
          <path
            d={`M ${-h * 0.6} ${-h * 0.6} L ${h * 0.6} ${h * 0.6} M ${h * 0.6} ${-h * 0.6} L ${-h * 0.6} ${h * 0.6}`}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </g>
      );
    case "plainX":
      return (
        <path
          d={`M ${-h} ${-h} L ${h} ${h} M ${h} ${-h} L ${-h} ${h}`}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      );
    case "hexBolt": {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return `${Math.cos(a) * h},${Math.sin(a) * h}`;
      }).join(" ");
      return (
        <g>
          <polygon points={pts} fill="none" stroke={color} strokeWidth={strokeWidth} />
          <path
            d={`M ${-s * 0.08} ${-h * 0.55} L ${s * 0.14} ${-s * 0.05} L ${-s * 0.03} ${s * 0.05} L ${s * 0.08} ${h * 0.55}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth * 0.85}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
    }
    case "bracket": {
      const c = s * 0.32;
      const corners = [
        [-h, -h, 1, 1],
        [h, -h, -1, 1],
        [-h, h, 1, -1],
        [h, h, -1, -1],
      ] as const;
      return (
        <g fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
          {corners.map(([x, y, dx, dy], i) => (
            <path key={i} d={`M ${x} ${y + dy * c} L ${x} ${y} L ${x + dx * c} ${y}`} />
          ))}
        </g>
      );
    }
    case "circle":
      return <circle cx={0} cy={0} r={h} fill="none" stroke={color} strokeWidth={strokeWidth} />;
    case "squareX":
      return (
        <g>
          <rect x={-h} y={-h} width={s} height={s} fill="none" stroke={color} strokeWidth={strokeWidth} />
          <path
            d={`M ${-h * 0.65} ${-h * 0.65} L ${h * 0.65} ${h * 0.65} M ${h * 0.65} ${-h * 0.65} L ${-h * 0.65} ${h * 0.65}`}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </g>
      );
  }
}
