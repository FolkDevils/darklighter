/**
 * Pure, immutable helpers for operating on the ComponentNode tree
 * (src/components-model/types.ts). Not a §5.3 contract file — this is
 * implementation plumbing the Phase 1 store builds on to satisfy
 * `src/state/contract.ts`'s "ids are unique across the whole tree" rule
 * without duplicating tree-walking logic in every action.
 *
 * A node lives in exactly one of three places: the canvas roots array, a
 * parent's `children` array, or a parent's `slots[name]`. `NodeLocation`
 * captures which, so callers can mutate/remove/reorder without re-deriving
 * that context.
 */
import type { ComponentNode } from "@/components-model/types";

export type NodeRef =
  | { kind: "root"; index: number }
  | { kind: "child"; index: number }
  | { kind: "slot"; name: string };

export interface NodeLocation {
  node: ComponentNode;
  /** null when the node is a canvas root. */
  parent: ComponentNode | null;
  /** ids from a root down to and including this node. */
  path: string[];
  ref: NodeRef;
}

function searchWithin(host: ComponentNode, id: string, path: string[]): NodeLocation | null {
  for (let i = 0; i < host.children.length; i++) {
    const c = host.children[i];
    const p = [...path, c.id];
    if (c.id === id) return { node: c, parent: host, path: p, ref: { kind: "child", index: i } };
    const hit = searchWithin(c, id, p);
    if (hit) return hit;
  }
  if (host.slots) {
    for (const [name, val] of Object.entries(host.slots)) {
      if (!val) continue;
      const p = [...path, val.id];
      if (val.id === id) return { node: val, parent: host, path: p, ref: { kind: "slot", name } };
      const hit = searchWithin(val, id, p);
      if (hit) return hit;
    }
  }
  return null;
}

/** Locate a node anywhere in the tree by id, with parent + path context. */
export function findNode(roots: ComponentNode[], id: string): NodeLocation | null {
  for (let i = 0; i < roots.length; i++) {
    const r = roots[i];
    const p = [r.id];
    if (r.id === id) return { node: r, parent: null, path: p, ref: { kind: "root", index: i } };
    const hit = searchWithin(r, id, p);
    if (hit) return hit;
  }
  return null;
}

export function nodeExists(roots: ComponentNode[], id: string): boolean {
  return findNode(roots, id) !== null;
}

/**
 * The nodes from the canvas root down to `id` inclusive — what the inspector
 * breadcrumb walks, and how the animation section finds the ancestor a node
 * inherits its timing from. Empty when the id isn't in the tree.
 */
export function nodeChain(roots: ComponentNode[], id: string): ComponentNode[] {
  const loc = findNode(roots, id);
  if (!loc) return [];
  const chain: ComponentNode[] = [];
  for (const stepId of loc.path) {
    const hit = findNode(roots, stepId);
    if (hit) chain.push(hit.node);
  }
  return chain;
}

/**
 * Nearest ancestor whose animation cascades — the node whose timing this one
 * follows when `animation.inherit` is set (types.ts AnimationConfig).
 */
export function cascadeSource(roots: ComponentNode[], id: string): ComponentNode | null {
  const chain = nodeChain(roots, id);
  for (let i = chain.length - 2; i >= 0; i--) {
    if (chain[i].animation.cascade) return chain[i];
  }
  return null;
}

/** Replace the node with `id` (wherever it lives) by applying `fn` to it. Structural no-op if not found. */
export function mapNode(
  roots: ComponentNode[],
  id: string,
  fn: (n: ComponentNode) => ComponentNode,
): ComponentNode[] {
  const mapOne = (n: ComponentNode): ComponentNode => {
    if (n.id === id) return fn(n);
    const children = n.children.map(mapOne);
    let slots = n.slots;
    if (n.slots) {
      const next: Record<string, ComponentNode | null> = {};
      for (const [k, v] of Object.entries(n.slots)) next[k] = v ? mapOne(v) : v;
      slots = next;
    }
    return { ...n, children, slots };
  };
  return roots.map(mapOne);
}

/** Remove a node (wherever it lives) from the tree. Slot removal empties the slot (sets it null) rather than deleting the declared slot key. */
export function removeNode(
  roots: ComponentNode[],
  id: string,
): { roots: ComponentNode[]; removed: ComponentNode | null } {
  let removed: ComponentNode | null = null;

  const stripOne = (n: ComponentNode): ComponentNode => {
    const children = stripList(n.children);
    let slots = n.slots;
    if (n.slots) {
      const next: Record<string, ComponentNode | null> = {};
      for (const [k, v] of Object.entries(n.slots)) {
        if (v && v.id === id) {
          removed = v;
          next[k] = null;
        } else {
          next[k] = v ? stripOne(v) : v;
        }
      }
      slots = next;
    }
    return { ...n, children, slots };
  };

  const stripList = (list: ComponentNode[]): ComponentNode[] => {
    const kept: ComponentNode[] = [];
    for (const n of list) {
      if (n.id === id) {
        removed = n;
        continue;
      }
      kept.push(stripOne(n));
    }
    return kept;
  };

  return { roots: stripList(roots), removed };
}

export function insertRoot(roots: ComponentNode[], node: ComponentNode, index?: number): ComponentNode[] {
  const at = index ?? roots.length;
  const next = [...roots];
  next.splice(clampIndex(at, next.length), 0, node);
  return next;
}

export function insertChild(
  roots: ComponentNode[],
  parentId: string,
  node: ComponentNode,
  index?: number,
): ComponentNode[] {
  return mapNode(roots, parentId, (parent) => {
    const at = index ?? parent.children.length;
    const children = [...parent.children];
    children.splice(clampIndex(at, children.length), 0, node);
    return { ...parent, children };
  });
}

export function setSlot(
  roots: ComponentNode[],
  hostId: string,
  slotName: string,
  node: ComponentNode | null,
): ComponentNode[] {
  return mapNode(roots, hostId, (host) => ({
    ...host,
    slots: { ...(host.slots ?? {}), [slotName]: node },
  }));
}

/** Deep-clone a subtree, assigning a fresh id (via `genId`) to every node, including slot contents. */
export function cloneWithNewIds(node: ComponentNode, genId: () => string): ComponentNode {
  const clone: ComponentNode = {
    ...node,
    id: genId(),
    children: node.children.map((c) => cloneWithNewIds(c, genId)),
  };
  if (node.slots) {
    const slots: Record<string, ComponentNode | null> = {};
    for (const [k, v] of Object.entries(node.slots)) slots[k] = v ? cloneWithNewIds(v, genId) : null;
    clone.slots = slots;
  }
  return clone;
}

/** The array a node currently lives in (roots, or its parent's children) — null for slot-held nodes. */
export function siblingsOf(roots: ComponentNode[], loc: NodeLocation): ComponentNode[] | null {
  if (loc.ref.kind === "root") return roots;
  if (loc.ref.kind === "child") return loc.parent!.children;
  return null;
}

function clampIndex(i: number, len: number): number {
  return Math.max(0, Math.min(i, len));
}
