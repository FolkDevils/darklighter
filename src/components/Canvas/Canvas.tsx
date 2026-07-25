import "./Canvas.css";
import { useDarklighter } from "@/state/store";
import { brandHex, isHexLiteral, type BrandTokenId } from "@/data/brand/tokens";
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

  return (
    <div className="canvas-viewport" ref={ref}>
      <div
        className="canvas-stage"
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `scale(${scale})`,
          background: bg,
        }}
        onMouseDown={(e) => {
          if (!(e.target as Element).closest(".node-rnd")) select([]);
        }}
      >
        {nodes.length === 0 && <p className="canvas-empty-note">Empty canvas — add a component from the Library</p>}
        {nodes.map((node) => (
          <NodeLayer
            key={node.id}
            node={node}
            scale={scale}
            selected={selection[0] === node.id}
            deepSelectedId={selection[0] === node.id && selection.length > 1 ? selection[selection.length - 1] : undefined}
            animate={playing}
          />
        ))}
      </div>
    </div>
  );
}
