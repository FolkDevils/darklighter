/**
 * The one implementation of AnimationConfig's three states (types.ts):
 * enabled / inherit / cascade. `RenderNode` resolves timing with it while
 * drawing; the hierarchy and inspector resolve the same thing to report what
 * is actually moving. Keeping it here is what stops the panels from claiming
 * a node is animating while the renderer holds it still.
 */
import type { AnimationConfig, ComponentNode } from "./types";

export interface Resolved {
  /** Timing to render with — the ancestor's when inheriting. */
  effective: AnimationConfig;
  /** Is this node actually moving right now? */
  running: boolean;
  /** Timing to offer descendants (`enabled` = "am I live"), or null. */
  passDown: AnimationConfig | null;
}

/**
 * @param own       this node's config
 * @param inherited timing from the nearest cascading ancestor, whose `enabled`
 *                  already means "that ancestor is live"; null at the root
 * @param playing   global transport (the Play/Pause button)
 */
export function resolveAnimation(
  own: AnimationConfig,
  inherited: AnimationConfig | null,
  playing: boolean,
): Resolved {
  const inheriting = own.inherit && inherited !== null;
  // Inherited timing keeps this node's own delay as an offset into the
  // ancestor's sequence, so a cascading composite staggers instead of firing
  // everything at once. Behavior is never inherited — each kind implements
  // its own set.
  const effective: AnimationConfig = inheriting
    ? {
        ...inherited,
        delayMs: inherited.delayMs + own.delayMs,
        behavior: own.behavior,
        cascade: own.cascade,
      }
    : own;
  // `enabled` is absolute for this node; when inheriting, the source has to be
  // live too — that's what makes "off" on a scene mean the whole scene.
  const running = playing && own.enabled && (!inheriting || inherited.enabled);
  return {
    effective,
    running,
    passDown: own.cascade ? { ...effective, enabled: running } : null,
  };
}

/** Resolve down a root→node chain (from `nodeChain`) to what the leaf does. */
export function resolveChain(chain: ComponentNode[], playing: boolean): Resolved | null {
  let inherited: AnimationConfig | null = null;
  let out: Resolved | null = null;
  for (const node of chain) {
    out = resolveAnimation(node.animation, inherited, playing);
    inherited = out.passDown;
  }
  return out;
}
