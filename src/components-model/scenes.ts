/**
 * Scene assembly helpers — how composite factories build their children.
 *
 * The rule from docs/NORTH_STAR.md: the reference SVG scenes are REBUILT
 * from primitives, never imported. A composite's factory assembles child
 * nodes through the same registry factories the gallery uses, so every part
 * of a generated scene stays individually selectable, adjustable, re-seedable
 * and animatable. Nothing here is a one-off drawing.
 */
import type {
  AnimationConfig,
  ComponentKind,
  ComponentNode,
  KindPropsRegistry,
  LayoutConfig,
  StyleConfig,
} from "./types";
import { componentDef } from "./registry";

export interface ChildOverrides {
  name?: string;
  animation?: Partial<AnimationConfig>;
  style?: Partial<StyleConfig>;
  seed?: number;
  children?: ComponentNode[];
}

/**
 * Build one child of a scene: start from the kind's own factory (so the node
 * is fully hydrated exactly like a gallery-added one), then override layout,
 * props and timing.
 */
export function part<K extends ComponentKind>(
  kind: K,
  layout: Partial<LayoutConfig>,
  props: Partial<KindPropsRegistry[K]> = {},
  over: ChildOverrides = {},
): ComponentNode<K> {
  const node = componentDef(kind).factory();
  return {
    ...node,
    name: over.name ?? node.name,
    layout: { ...node.layout, ...layout },
    props: { ...node.props, ...props },
    style: { ...node.style, ...over.style },
    animation: { ...node.animation, ...over.animation },
    children: over.children ?? node.children,
    ...(over.seed !== undefined ? { seed: over.seed } : {}),
  };
}

/**
 * Scene children lead into each other rather than all firing at once: this
 * turns a plain index into a staged `delayMs` so a composite plays as one
 * choreographed boot sequence.
 */
export const beat = (index: number, step = 220): Partial<AnimationConfig> => ({
  delayMs: index * step,
});
