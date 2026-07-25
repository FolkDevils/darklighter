/**
 * PROTORA "P" LOGO — EXTRACTED GEOMETRY (AUTHORITATIVE)
 * -----------------------------------------------------
 * Extracted by the planning model from the approved original:
 *   assets/protora/logo_01SmallMinimized.svg  (do not modify that file — moved
 *   from elements/ to assets/protora/ in Phase 0, see docs/STATUS.md)
 *
 * How the approved original composes (verified against the source):
 *   A luminance mask = black canvas + WHITE P shell path + BLACK-stroked
 *   radar (4 rings + a crosshair that breaks at the innermost ring). The
 *   mask is applied to a full-canvas Burnt Drone Brown rect. Result: a dark
 *   P with the radar strokes punched out (transparent).
 *
 * The `logoP` component (Phase 2) generalizes this: the P shell is the host,
 * and the radar is slot "radarFill" (accepts tag "radar") rendered in
 * "knockout" mode — ANY radar component's white-on-black render can be
 * punched out of the P the same way. `defaultContent` rebuilds the approved
 * reticle below from APPROVED_RADAR so the protected preset is pixel-true.
 */

/** Source viewBox: 0 0 608 639. All coordinates below live in this space. */
export const LOGO_P_VIEWBOX = { w: 608, h: 639 } as const;

/**
 * The P shell outline (the WHITE path in the source mask).
 * Rounded-square bowl 608 wide × 433.88 tall, leg 0→164 wide down to y=638.
 */
export const P_SHELL_PATH =
  "M96.6279 0H435.72C577.009 0 608 88.4016 608 216.021C608 343.641 577.009 " +
  "433.881 435.72 433.881H164.079V638.072H0V98.4422C0 30.072 37.3787 0 96.6279 0Z";

/**
 * Approved radar treatment (the BLACK strokes in the source mask).
 * strokeWidth 4, stroke-linecap round, no fill.
 */
export const APPROVED_RADAR = {
  center: { cx: 291.22, cy: 214.135 },
  /** 4 concentric rings; spacing is exactly 25.125 between radii. */
  ringRadii: [77.66, 102.785, 127.91, 153.035],
  strokeWidth: 4,
  /**
   * Crosshair segments — the lines run from outside the ring set INTO the
   * innermost ring's edge and STOP (the center stays clean). Values are the
   * source's exact endpoints; note top segment starts above the viewBox
   * (y=-5.139) and is clipped by the canvas.
   */
  crosshair: {
    horizontal: [
      { x1: 71.943, y1: 214.135, x2: 213.558, y2: 214.135 }, // left → inner ring
      { x1: 368.877, y1: 214.135, x2: 510.491, y2: 214.135 }, // inner ring → right
    ],
    vertical: [
      { x1: 291.221, y1: -5.139, x2: 291.221, y2: 136.475 }, // top → inner ring
      { x1: 291.221, y1: 291.794, x2: 291.221, y2: 433.409 }, // inner ring → bottom
    ],
  },
} as const;

/**
 * Slot frame for "radarFill" — square around the radar center, sized to the
 * crosshair extents so replacement radar components land where the approved
 * reticle sits. Content is additionally clipped to P_SHELL_PATH.
 */
export const RADAR_SLOT_FRAME = { x: 71.9, y: -5.1, w: 438.6, h: 438.6 } as const;

/**
 * "TM" glyphs from the approved lockup (outlined paths, Burnt Drone Brown
 * fill, sits under the leg at y≈607–632). Rendered by logoP behind an
 * inspector toggle (`props.showTm`, default true to match the approved mark).
 */
export const TM_PATHS = [
  // T
  "M197.641 632.094V609.985H187.602V607.28H210.995V609.985H200.956V632.094H197.664H197.641Z",
  // M
  "M230.696 629.552C229.996 631.278 229.389 632.397 227.685 632.397C225.98 632.397 " +
    "225.35 631.301 224.626 629.552L217.249 611.151C217.109 610.801 216.852 610.382 " +
    "216.618 610.382C216.338 610.382 216.152 610.731 216.152 611.081L216.222 632.094H212.93" +
    "V609.799C212.93 608.003 214.144 607 216.081 607C218.206 607 218.953 608.213 219.63 " +
    "609.845L227.054 628.2C227.241 628.666 227.381 629.039 227.685 629.039C227.965 629.039 " +
    "228.152 628.643 228.315 628.2L235.739 609.845C236.37 608.213 237.117 607 239.241 607C" +
    "241.202 607 242.44 608.003 242.44 609.799V632.094H239.148L239.218 611.081C239.218 " +
    "610.452 238.891 610.382 238.751 610.382C238.494 610.382 238.261 610.801 238.121 " +
    "611.151L230.696 629.552Z",
] as const;

/**
 * Reference render recipe for the knockout mode (what the logoP Render must
 * produce — same structure as the approved source):
 *
 *   <svg viewBox="0 0 608 639">
 *     <mask id={maskId} maskUnits="userSpaceOnUse" style="mask-type:luminance">
 *       <rect width A LL black />
 *       <path d={P_SHELL_PATH} fill="white" />
 *       <g>{slot content rendered INK-ON-BLACK, i.e. strokes/fills black}</g>
 *     </mask>
 *     <rect width="608" height="638.122" fill={color("ink")} mask={maskId} />
 *     {props.showTm && TM_PATHS with fill={color("ink")}}
 *   </svg>
 *
 * In "overlay" slot mode (non-approved explorations), skip the mask: render
 * the P as a plain fill and the slot content on top in its own colors.
 */
export const LOGO_P_MASK_RECIPE = "see comment above — implement in defs/logoP.tsx";
