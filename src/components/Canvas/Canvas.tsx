import "./Canvas.css";
import { useDarklighter } from "@/state/store";
import { brandHex, isHexLiteral, type BrandTokenId } from "@/data/brand/tokens";
import { surfaceOf } from "@/lib/colorway";
import { CANVAS_H, CANVAS_W } from "@/lib/constants";
import { useElementSize } from "@/lib/useElementSize";
import { NodeLayer } from "./NodeLayer";

const PADDING = 48;

/**
 * Renders the node tree (PLAN.md §11 Phase 1 step 3): a fixed-size stage,
 * scaled to fit the viewport, with each canvas-root ComponentNode as a
 * draggable/resizable `NodeLayer`. Pan/zoom, marquee select, and grid
 * toggle are Phase 3 (full editor UI); clicking empty stage deselects.
 */
export function Canvas() {
  const background = useDarklighter((s) => s.background);
  const nodes = useDarklighter((s) => s.nodes);
  const selection = useDarklighter((s) => s.selection);
  const playing = useDarklighter((s) => s.playing);
  const select = useDarklighter((s) => s.select);
  const mode = useDarklighter((s) => s.mode);
  const { ref, size } = useElementSize<HTMLDivElement>();

  const scale =
    size.width > 0
      ? Math.min(
          (size.width - PADDING * 2) / CANVAS_W,
          (size.height - PADDING * 2) / CANVAS_H,
          1,
        )
      : 1;

  const bg = isHexLiteral(background.color) ? background.color : brandHex(background.color as BrandTokenId);
  // Light or dark page: reverses ink/field everywhere below, so switching the
  // canvas actually re-inks the artwork instead of hiding it (lib/colorway.ts).
  const surface = surfaceOf(background.color);
  const onDark = surface === "dark";

  // In the composer the whole stage is one artifact, so outline the box it
  // will be saved and exported at — otherwise the edges of the thing you're
  // building are invisible on an empty field.
  const visible = nodes.filter((n) => !n.hidden);
  const frame =
    mode === "composer" && visible.length > 0
      ? (() => {
          const x = Math.min(...visible.map((n) => n.layout.x));
          const y = Math.min(...visible.map((n) => n.layout.y));
          return {
            x,
            y,
            w: Math.max(...visible.map((n) => n.layout.x + n.layout.w)) - x,
            h: Math.max(...visible.map((n) => n.layout.y + n.layout.h)) - y,
          };
        })()
      : null;

  return (
    // The page colour runs edge to edge rather than sitting in a card: you are
    // judging a graphic against its background, and a light rectangle floating
    // in a dark room tells you nothing about how it will actually look. The
    // artboard's own edge is deliberately undrawn — see Canvas.css.
    <div className={`canvas-viewport${onDark ? " on-dark" : ""}`} ref={ref} style={{ background: bg }}>
      <div
        className="canvas-stage"
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `scale(${scale})`,
        }}
        onMouseDown={(e) => {
          if (!(e.target as Element).closest(".node-rnd")) select([]);
        }}
      >
        {nodes.length === 0 && (
          <p className="canvas-empty-note">
            {mode === "composer"
              ? "Blank composer — add parts from the Library, then Save to Library"
              : "Empty canvas — add a component from the Library"}
          </p>
        )}
        {mode === "composer" && frame && (
          <div
            className="composer-frame"
            data-size={`${Math.round(frame.w)} × ${Math.round(frame.h)}`}
            style={{ left: frame.x, top: frame.y, width: frame.w, height: frame.h }}
          />
        )}
        {nodes.map((node) => (
          <NodeLayer
            key={node.id}
            node={node}
            scale={scale}
            selected={selection[0] === node.id}
            deepSelectedId={selection[0] === node.id && selection.length > 1 ? selection[selection.length - 1] : undefined}
            animate={playing}
            surface={surface}
          />
        ))}
      </div>
    </div>
  );
}
