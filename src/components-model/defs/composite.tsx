/**
 * `composite` — the trivial free-form grouping host (⌘G result, PLAN.md
 * §5.2). No geometry of its own; it just carries `children`. The resting
 * frame is visually empty (an unstroked viewBox), matching the WYSIWYG
 * export invariant — nothing extra to strip for static export.
 */
import type { CompositeProps } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode } from "@/components-model/defaults";

function factory() {
  return baseNode("composite", "Group", {} satisfies CompositeProps, {
    layout: { w: 320, h: 320 },
  });
}

function Render({ node }: RenderProps<"composite">) {
  const { w, h } = node.layout;
  return <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" />;
}

defineComponent({
  kind: "composite",
  label: "Group",
  category: "composites",
  tags: ["composite"],
  describe: "Free-form group of children with no geometry of its own (⌘G result).",
  factory,
  Render,
  controls: [],
  animBehaviors: [],
  acceptsChildren: true,
});
