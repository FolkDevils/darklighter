/**
 * The target-glyph registry (PLAN.md §4 "PATTERN" from the reference app's
 * `primitives/registry.tsx`, §5.2 `targetGlyph`). Shared between the
 * `targetGlyph` kind and `blipField` (which stamps glyphs at generated
 * positions), so the glyph set only lives in one place.
 *
 * Composable, not one enum per combination: a container `shape` (square,
 * circle, hex, corner bracket, or none) pairs with any center `icon` (dot, X,
 * bolt, sparkle, loader arc, or none) — what used to be fixed pairs
 * (`squareDot`, `circleX`, `hexBolt`…) are now just one shape + one icon, so
 * every shape can carry every icon instead of needing a new named id for each
 * combination. `filled` switches shape+icon between the stroked-outline and
 * solid-fill treatment, the same idiom `labelPill` already uses: a filled
 * container reads its icon in the `field` role for contrast, like knockout
 * text on a filled pill.
 *
 * Every glyph is drawn centered on local (0,0); callers wrap the result in
 * a positioning `<g transform="translate(cx,cy)">`.
 */
import type { ReactElement } from "react";

export type GlyphShape = "none" | "square" | "circle" | "hex" | "bracket";
export type GlyphIcon = "none" | "dot" | "x" | "bolt" | "sparkle" | "loader";

export const GLYPH_SHAPE_OPTIONS: { value: GlyphShape; label: string }[] = [
  { value: "none", label: "None" },
  { value: "square", label: "Square" },
  { value: "circle", label: "Circle" },
  { value: "hex", label: "Hexagon" },
  { value: "bracket", label: "Corner bracket" },
];

export const GLYPH_ICON_OPTIONS: { value: GlyphIcon; label: string }[] = [
  { value: "none", label: "None" },
  { value: "dot", label: "Dot" },
  { value: "x", label: "X" },
  { value: "bolt", label: "Bolt" },
  { value: "sparkle", label: "Sparkle" },
  { value: "loader", label: "Loader arc" },
];

interface GlyphProps {
  size: number;
  color: string;
  /** Contrast color for a filled container's icon (labelPill's `field` idiom). Falls back to `color` (icon-only, nothing to contrast against). */
  fieldColor?: string;
  strokeWidth?: number;
  /** Solid fill vs stroked outline, for both shape and icon — see file header. */
  filled?: boolean;
}

function shapeNode(shape: GlyphShape, h: number, color: string, strokeWidth: number, filled: boolean): ReactElement | null {
  const fill = filled ? color : "none";
  switch (shape) {
    case "none":
      return null;
    case "square":
      return <rect x={-h} y={-h} width={h * 2} height={h * 2} fill={fill} stroke={color} strokeWidth={strokeWidth} />;
    case "circle":
      return <circle cx={0} cy={0} r={h} fill={fill} stroke={color} strokeWidth={strokeWidth} />;
    case "hex": {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return `${Math.cos(a) * h},${Math.sin(a) * h}`;
      }).join(" ");
      return <polygon points={pts} fill={fill} stroke={color} strokeWidth={strokeWidth} />;
    }
    case "bracket": {
      // Corner ticks only — there's no interior to fill, so `filled` is a
      // no-op here (matches `bolt`/`x`/`loader`: line marks stay line marks).
      const c = h * 0.64;
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
  }
}

function iconNode(icon: GlyphIcon, h: number, s: number, color: string, strokeWidth: number, filled: boolean): ReactElement | null {
  switch (icon) {
    case "none":
      return null;
    case "dot":
      return filled ? (
        <circle cx={0} cy={0} r={h * 0.34} fill={color} />
      ) : (
        <circle cx={0} cy={0} r={h * 0.34} fill="none" stroke={color} strokeWidth={strokeWidth * 0.85} />
      );
    case "x":
      // A line mark either way — nothing to fill, so `filled` doesn't change it.
      return (
        <path
          d={`M ${-h * 0.6} ${-h * 0.6} L ${h * 0.6} ${h * 0.6} M ${h * 0.6} ${-h * 0.6} L ${-h * 0.6} ${h * 0.6}`}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      );
    case "bolt":
      // Also a line mark — a zigzag has no clean fillable interior.
      return (
        <path
          d={`M ${-s * 0.08} ${-h * 0.55} L ${s * 0.14} ${-s * 0.05} L ${-s * 0.03} ${s * 0.05} L ${s * 0.08} ${h * 0.55}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth * 0.85}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "sparkle": {
      // Four-point twinkle: two perpendicular pinched diamonds, one path.
      const tip = h * 0.62;
      const waist = tip * 0.32;
      const d = `M 0 ${-tip} Q ${waist} ${-waist} ${tip} 0 Q ${waist} ${waist} 0 ${tip} Q ${-waist} ${waist} ${-tip} 0 Q ${-waist} ${-waist} 0 ${-tip} Z`;
      return filled ? (
        <path d={d} fill={color} />
      ) : (
        <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth * 0.8} strokeLinejoin="round" />
      );
    }
    case "loader":
      // A gapped ring, meant to be spun via the `rotate` behavior — the gap
      // is what reads as motion instead of a static circle turning in place.
      // Always a stroke: filling in the gap would defeat the point of it.
      return (
        <circle
          cx={0}
          cy={0}
          r={h * 0.62}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="0.3 0.7"
        />
      );
  }
}

/** Render one shape+icon glyph, centered at local (0,0). */
export function renderGlyph(
  shape: GlyphShape,
  icon: GlyphIcon,
  { size, color, fieldColor, strokeWidth = 1.6, filled = false }: GlyphProps,
): ReactElement {
  const h = size / 2;
  const hasShape = shape !== "none";
  // A filled container needs its icon to read against the fill instead of
  // disappearing into it — same contrast idiom as labelPill's filled text.
  const iconColor = filled && hasShape ? (fieldColor ?? color) : color;
  // The icon shrinks to sit inside a drawn container; icon-alone (no shape)
  // gets the full size.
  const iconScale = hasShape ? 0.62 : 1;
  return (
    <g>
      {shapeNode(shape, h, color, strokeWidth, filled)}
      {iconNode(icon, h * iconScale, size * iconScale, iconColor, strokeWidth, filled)}
    </g>
  );
}
