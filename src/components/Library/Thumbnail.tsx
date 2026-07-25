/**
 * Live WYSIWYG preview of a library entry — the same node/render path the
 * canvas uses, at factory defaults, letterboxed into a card by its own
 * viewBox (ported from the reference app's Gallery/GraphicThumbnail.tsx).
 * There is no thumbnail pipeline: register a component and its card draws
 * itself, animation included.
 *
 * Two guards keep a gallery of live SVGs cheap: cards only mount once they
 * scroll near the viewport, and they only animate while hovered.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentKind, ComponentNode } from "@/components-model/types";
import { componentDef } from "@/components-model/registry";
import { RenderNode } from "@/components-model/RenderNode";
import { brandAsset } from "@/assets/brand/assets";
import { useElementSize } from "@/lib/useElementSize";

/**
 * A preview node is throwaway: fixed id/seed so previews never re-render
 * randomly. Size is left ALONE and the card scales with a CSS transform —
 * shrinking `layout` would leave a composite's children at their original
 * coordinates and blow them out of the frame.
 */
function previewNode(node: ComponentNode): ComponentNode {
  return {
    ...node,
    id: `preview_${node.kind}`,
    seed: 7,
    layout: { ...node.layout, x: 0, y: 0, rotation: 0 },
  };
}

export function Thumbnail({ kind, assetId }: { kind: ComponentKind; assetId?: string }) {
  const { ref: boxRef, size } = useElementSize<HTMLDivElement>();
  const seenRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const el = seenRef.current;
    if (!el || mounted) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted]);

  const node = useMemo(() => {
    const base = componentDef(kind).factory();
    if (!assetId) return previewNode(base);
    const asset = brandAsset(assetId);
    if (!asset) return previewNode(base);
    const { w, h } = asset.viewBox;
    return previewNode({ ...base, props: { assetId }, layout: { ...base.layout, w, h } });
  }, [kind, assetId]);

  const scale =
    size.width > 0
      ? Math.min((size.width * 0.9) / node.layout.w, (size.height * 0.9) / node.layout.h, 1)
      : 0;

  return (
    <div
      ref={seenRef}
      className="lib-thumb"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div ref={boxRef} className="lib-thumb-box">
        {mounted && scale > 0 ? (
          <div
            className="lib-thumb-inner"
            style={{ width: node.layout.w, height: node.layout.h, transform: `scale(${scale})` }}
            aria-hidden
          >
            <RenderNode node={node} animate={hover} />
          </div>
        ) : (
          <div className="lib-thumb-skel" aria-hidden />
        )}
      </div>
    </div>
  );
}
