/**
 * PHASE 1 STORE — implements `DarklighterStore` from `src/state/contract.ts`
 * (the §5.3 contract) exactly, plus the window-chrome state Phase 0 already
 * had. Modeled on the reference app's store (23andme-org-datavis/src/state/
 * store.ts, PLAN.md §4 "ADAPT"): action-only mutation, undo/redo via a
 * before/after doc-snapshot stack. The one real difference is the state
 * shape — a tree, not a flat list — so every mutator goes through the
 * tree-aware helpers in `src/lib/nodeTree.ts` instead of `Array.map`.
 *
 * Binding rules from contract.ts, enforced here:
 *  - Tree ops address nodes by id, found anywhere in the tree (roots,
 *    children, or slots) via `findNode`.
 *  - Actions on `locked` nodes are no-ops (`patchNode` checks this).
 *  - Structural/patch changes to `provenance.protected` nodes fork first
 *    (`resolveMutableId` — deep-clones with fresh ids, swaps in place).
 */
import { create } from "zustand";
import { nanoid } from "nanoid";
import type { AnimationConfig, ComponentNode, PresetFile, StyleConfig } from "@/components-model/types";
import type { DarklighterActions, DarklighterState, SnapshotEntry } from "@/state/contract";
import { componentDef } from "@/components-model/registry";
import {
  cloneWithNewIds,
  findNode,
  insertChild,
  insertRoot,
  mapNode,
  removeNode as removeNodeFromTree,
  setSlot,
} from "@/lib/nodeTree";
import { loadJSON, saveJSON } from "@/lib/persist";
import { CANVAS_H, CANVAS_W } from "@/lib/constants";
import { assetPlacementSize, brandAsset } from "@/assets/brand/assets";

/* ------------------------------------------------------------------ */
/* Floating windows (ported pattern, PLAN.md §4 "PORT") — unchanged     */
/* shape from the Phase 0 scaffold.                                     */
/* ------------------------------------------------------------------ */

export type WindowId = "library" | "hierarchy" | "inspector" | "assistant" | "history";

export interface WindowState {
  open: boolean;
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
  z: number;
}

const initialWindows = (): Record<WindowId, WindowState> => ({
  library: { open: false, x: null, y: null, w: null, h: null, z: 0 },
  hierarchy: { open: false, x: null, y: null, w: null, h: null, z: 1 },
  inspector: { open: false, x: null, y: null, w: null, h: null, z: 2 },
  assistant: { open: false, x: null, y: null, w: null, h: null, z: 3 },
  history: { open: false, x: null, y: null, w: null, h: null, z: 4 },
});

/* ------------------------------------------------------------------ */
/* Undo-history + tree-mutation helpers                                */
/* ------------------------------------------------------------------ */

interface DocSnapshot {
  nodes: ComponentNode[];
  background: { color: string };
}

const HISTORY_CAP = 100;

/**
 * Basic factory-hydration on load (invariant #4 — old files stay
 * loadable): fills in fields a legacy/partial file might be missing.
 * Kind-specific default *values* (e.g. a ringSet's default count) are not
 * re-derived here — that's each kind's `factory()`, which only runs for
 * brand-new nodes. This just guarantees shape, not on-brand defaults.
 *
 * Exported so the `.dkl.json` round-trip check in `npm run smoke` hydrates a
 * loaded document exactly the way `loadDoc` does.
 */
export function hydrateNode(n: ComponentNode): ComponentNode {
  // Cast to Partial: incoming data is untrusted JSON (old/hand-edited files),
  // even though ComponentNode's own type says these fields are required.
  const style = (n.style ?? {}) as Partial<StyleConfig>;
  const animation = (n.animation ?? {}) as Partial<AnimationConfig>;
  // Props are backfilled from the kind's own factory, so a document saved
  // before a kind grew a prop still renders — the file keeps what it set and
  // picks up today's defaults for everything it never knew about.
  let props = n.props;
  try {
    props = { ...(componentDef(n.kind).factory().props as object), ...(n.props ?? {}) };
  } catch {
    // Unknown kind (a file from a newer build): leave its props untouched.
  }
  return {
    ...n,
    props,
    modifiers: n.modifiers ?? [],
    children: (n.children ?? []).map(hydrateNode),
    slots: n.slots
      ? Object.fromEntries(Object.entries(n.slots).map(([k, v]) => [k, v ? hydrateNode(v) : null]))
      : n.slots,
    locked: n.locked ?? false,
    hidden: n.hidden ?? false,
    style: { colorway: "alert", strokeScale: 1, opacity: 1, ...style },
    animation: {
      enabled: true,
      inherit: true,
      behavior: null,
      durationMs: 1200,
      delayMs: 0,
      staggerMs: 90,
      easing: "easeOut",
      loop: true,
      loopDelayMs: 900,
      direction: "normal",
      cascade: true,
      ...animation,
    },
    provenance: n.provenance ?? { source: "import" },
  };
}

/**
 * Scale a child subtree by the factors its parent's box just changed by.
 * Geometry inside each node is derived from its own w/h, so scaling the boxes
 * is all it takes — and stroke widths deliberately stay put (PLAN.md §5.1:
 * "parent transforms don't distort child stroke widths"); `style.strokeScale`
 * is the control for that.
 */
function scaleSubtree(node: ComponentNode, fx: number, fy: number): ComponentNode {
  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    ...node,
    layout: {
      ...node.layout,
      x: round(node.layout.x * fx),
      y: round(node.layout.y * fy),
      w: Math.max(1, round(node.layout.w * fx)),
      h: Math.max(1, round(node.layout.h * fy)),
    },
    children: node.children.map((c) => scaleSubtree(c, fx, fy)),
  };
}

/** Place a freshly created node in the middle of the box it's being added to. */
function centered(node: ComponentNode, boxW: number, boxH: number, offset: number): ComponentNode {
  return {
    ...node,
    layout: {
      ...node.layout,
      x: Math.max(0, Math.round((boxW - node.layout.w) / 2)) + offset,
      y: Math.max(0, Math.round((boxH - node.layout.h) / 2)) + offset,
    },
  };
}

/**
 * Shared insert path for every "add a new node" action: into a named slot,
 * into a parent's children, or onto the canvas root. Returns the state patch
 * so the caller stays inside a single `withHistory` (one undo step per add).
 */
function placeNode(
  s: DarklighterStoreState,
  node: ComponentNode,
  opts?: { parentId?: string; slot?: string },
): Partial<DarklighterStoreState> {
  if (opts?.slot && opts.parentId) {
    const hostLoc = findNode(s.nodes, opts.parentId);
    if (!hostLoc || hostLoc.node.locked) return {};
    const slotDef = componentDef(hostLoc.node.kind).slots?.find((sd) => sd.name === opts.slot);
    if (!slotDef || !slotDef.accepts.some((t) => componentDef(node.kind).tags.includes(t))) return {};
    const framed: ComponentNode = { ...node, layout: { ...node.layout, ...slotDef.frame } };
    return {
      nodes: setSlot(s.nodes, opts.parentId, opts.slot, framed),
      selection: [...hostLoc.path, framed.id],
    };
  }
  if (opts?.parentId) {
    const parentLoc = findNode(s.nodes, opts.parentId);
    if (!parentLoc || parentLoc.node.locked) return {};
    if (!componentDef(parentLoc.node.kind).acceptsChildren) return {};
    return {
      nodes: insertChild(
        s.nodes,
        opts.parentId,
        centered(node, parentLoc.node.layout.w, parentLoc.node.layout.h, 0),
      ),
      selection: [...parentLoc.path, node.id],
    };
  }
  // Cascade successive additions so a run of gallery clicks doesn't stack
  // every node on the same coordinates.
  const cascade = (s.nodes.length % 6) * 32;
  return {
    nodes: insertRoot(s.nodes, centered(node, CANVAS_W, CANVAS_H, cascade)),
    selection: [node.id],
  };
}

/** Deep-clone a subtree with fresh ids and non-protected provenance, swapped in place. */
function forkNode(nodes: ComponentNode[], id: string): { nodes: ComponentNode[]; newId: string } {
  const loc = findNode(nodes, id);
  if (!loc) return { nodes, newId: id };
  const clone = cloneWithNewIds(loc.node, () => nanoid(10));
  const forked: ComponentNode = {
    ...clone,
    provenance: {
      ...loc.node.provenance,
      baseComponent: loc.node.provenance.baseComponent ?? id,
      protected: false,
    },
  };
  return { nodes: mapNode(nodes, id, () => forked), newId: forked.id };
}

/** If `id` names a protected node, fork it first and redirect to the clone's id. */
function resolveMutableId(nodes: ComponentNode[], id: string): { nodes: ComponentNode[]; id: string } {
  const loc = findNode(nodes, id);
  if (!loc || !loc.node.provenance.protected) return { nodes, id };
  const { nodes: next, newId } = forkNode(nodes, id);
  return { nodes: next, id: newId };
}

/** Shared guard for every single-node patch: fork-if-protected, no-op-if-locked. */
function patchNode(
  nodes: ComponentNode[],
  id: string,
  fn: (n: ComponentNode) => ComponentNode,
): ComponentNode[] {
  const { nodes: resolved, id: targetId } = resolveMutableId(nodes, id);
  const loc = findNode(resolved, targetId);
  if (!loc || loc.node.locked) return resolved;
  return mapNode(resolved, targetId, fn);
}

/* ------------------------------------------------------------------ */
/* Store type                                                           */
/* ------------------------------------------------------------------ */

export type DarklighterStoreState = DarklighterState &
  DarklighterActions & {
    /**
     * Extension beyond the §5.3 contract (logged in docs/DECISIONS.md): drops
     * an imported brand asset as a `staticAsset` node carrying the right
     * assetId and natural aspect ratio in ONE undo step. The contract's
     * `addComponent(kind, opts)` has no props channel, so the alternative was
     * add-then-patch, which costs two history entries per gallery click.
     */
    addAsset: (assetId: string, opts?: { parentId?: string; slot?: string }) => string | null;

    /**
     * Extension beyond the §5.3 contract (logged in docs/DECISIONS.md): the
     * inverse of `groupSelection`. Grouping is an action on a selection, so
     * ungrouping has to be one too — otherwise a group is a one-way door.
     * Lifts a composite's children into its parent, keeping world position,
     * then deletes the emptied group.
     */
    ungroupSelection: () => void;

    historyPast: DocSnapshot[];
    historyFuture: DocSnapshot[];
    lastRestoredSnapshotId: string | null;
    /** Bumped by `replay()`; canvas layers key off it to restart SMIL. */
    playNonce: number;

    windows: Record<WindowId, WindowState>;
    windowZTop: number;
    toggleWindow: (id: WindowId) => void;
    openWindow: (id: WindowId) => void;
    closeWindow: (id: WindowId) => void;
    focusWindow: (id: WindowId) => void;
    moveWindow: (id: WindowId, x: number, y: number) => void;
    resizeWindow: (id: WindowId, w: number, h: number) => void;
  };

export const useDarklighter = create<DarklighterStoreState>((set, get) => {
  /**
   * Apply an undoable document mutation: snapshot {nodes,background} before
   * running `producer`, push it to history, clear redo. Producers that
   * determine their action was a no-op should return `{}`. Nothing is
   * recorded unless the document itself actually changed identity, so
   * cancelled ops and guard-blocked ops (locked nodes) never pollute undo.
   */
  const withHistory = (producer: (s: DarklighterStoreState) => Partial<DarklighterStoreState>) => {
    set((s) => {
      const next = producer(s);
      const docChanged =
        (next.nodes !== undefined && next.nodes !== s.nodes) ||
        (next.background !== undefined && next.background !== s.background);
      if (!docChanged) return next;
      const snap: DocSnapshot = { nodes: s.nodes, background: s.background };
      return { ...next, historyPast: [...s.historyPast, snap].slice(-HISTORY_CAP), historyFuture: [] };
    });
  };

  return {
    nodes: [],
    background: { color: "blimpWhite" },
    selection: [],
    playing: true,
    snapshots: loadJSON<SnapshotEntry[]>("snapshots", []),

    historyPast: [],
    historyFuture: [],
    lastRestoredSnapshotId: null,
    playNonce: 0,

    windows: initialWindows(),
    windowZTop: 10,

    /* -- tree CRUD ---------------------------------------------------- */

    addComponent: (kind, opts) => {
      const node = componentDef(kind).factory();
      withHistory((s) => placeNode(s, node, opts));
      return node.id;
    },

    addAsset: (assetId, opts) => {
      const asset = brandAsset(assetId);
      if (!asset) return null;
      const node = componentDef("staticAsset").factory();
      const assetNode: ComponentNode = {
        ...node,
        name: asset.label,
        props: { assetId },
        layout: { ...node.layout, ...assetPlacementSize(asset) },
        provenance: { source: "import", baseComponent: assetId },
      };
      withHistory((s) => placeNode(s, assetNode, opts));
      return assetNode.id;
    },

    removeNode: (id) =>
      withHistory((s) => {
        const { nodes, id: targetId } = resolveMutableId(s.nodes, id);
        const loc = findNode(nodes, targetId);
        if (!loc || loc.node.locked) return {};
        const { roots } = removeNodeFromTree(nodes, targetId);
        return { nodes: roots, selection: s.selection.includes(id) || s.selection.includes(targetId) ? [] : s.selection };
      }),

    duplicateNode: (id) => {
      let newId = id;
      withHistory((s) => {
        const loc = findNode(s.nodes, id);
        if (!loc) return {};
        const clone = cloneWithNewIds(loc.node, () => nanoid(10));
        const positioned: ComponentNode = {
          ...clone,
          name: `${loc.node.name} copy`,
          layout: { ...clone.layout, x: clone.layout.x + 24, y: clone.layout.y + 24 },
          provenance: { ...clone.provenance, protected: false },
        };
        newId = positioned.id;
        if (loc.ref.kind === "root") {
          return {
            nodes: insertRoot(s.nodes, positioned, loc.ref.index + 1),
            selection: [positioned.id],
          };
        }
        if (loc.ref.kind === "child") {
          return {
            nodes: insertChild(s.nodes, loc.parent!.id, positioned, loc.ref.index + 1),
            selection: [...loc.path.slice(0, -1), positioned.id],
          };
        }
        // Slot-held node: a slot holds exactly one value, so "duplicate" adds
        // the copy as a free child of the host instead of the (single) slot.
        return {
          nodes: insertChild(s.nodes, loc.parent!.id, positioned),
          selection: [...loc.path.slice(0, -1), positioned.id],
        };
      });
      return newId;
    },

    reparent: (id, newParentId, index) =>
      withHistory((s) => {
        const { nodes, id: targetId } = resolveMutableId(s.nodes, id);
        const loc = findNode(nodes, targetId);
        if (!loc || loc.node.locked) return {};
        if (newParentId) {
          const parentLoc = findNode(nodes, newParentId);
          if (!parentLoc || parentLoc.node.locked) return {};
          if (!componentDef(parentLoc.node.kind).acceptsChildren) return {};
          if (parentLoc.path.includes(targetId)) return {}; // can't reparent into own descendant
        }
        const { roots: withoutNode, removed } = removeNodeFromTree(nodes, targetId);
        if (!removed) return {};
        const nextNodes = newParentId
          ? insertChild(withoutNode, newParentId, removed, index)
          : insertRoot(withoutNode, removed, index);
        return { nodes: nextNodes };
      }),

    reorder: (id, dir) =>
      withHistory((s) => {
        const loc = findNode(s.nodes, id);
        if (!loc || loc.node.locked || loc.ref.kind === "slot") return {};
        const siblings = loc.ref.kind === "root" ? s.nodes : loc.parent!.children;
        const idx = loc.ref.index;
        const j = idx + dir;
        if (j < 0 || j >= siblings.length) return {};
        const arr = [...siblings];
        [arr[idx], arr[j]] = [arr[j], arr[idx]];
        if (loc.ref.kind === "root") return { nodes: arr };
        return { nodes: mapNode(s.nodes, loc.parent!.id, (p) => ({ ...p, children: arr })) };
      }),

    groupSelection: () => {
      let newId: string | null = null;
      withHistory((s) => {
        const targetId = s.selection[0];
        if (!targetId) return {};
        const loc = findNode(s.nodes, targetId);
        if (!loc || loc.node.locked || loc.ref.kind === "slot") return {};
        const group = componentDef("composite").factory();
        group.layout = { ...loc.node.layout };
        group.name = "Group";
        // The group takes over the child's frame *and* its rotation, so the
        // child sits at the group origin unrotated — otherwise it would spin twice.
        const childInGroup: ComponentNode = {
          ...loc.node,
          layout: { ...loc.node.layout, x: 0, y: 0, rotation: 0 },
        };
        group.children = [childInGroup];
        newId = group.id;
        if (loc.ref.kind === "root") {
          const withoutOriginal = s.nodes.filter((n) => n.id !== targetId);
          return {
            nodes: insertRoot(withoutOriginal, group, loc.ref.index),
            selection: [group.id, childInGroup.id],
          };
        }
        const nodes = mapNode(s.nodes, loc.parent!.id, (p) => ({
          ...p,
          children: p.children.map((c) => (c.id === targetId ? group : c)),
        }));
        return { nodes, selection: [...loc.path.slice(0, -1), group.id, childInGroup.id] };
      });
      return newId;
    },

    ungroupSelection: () =>
      withHistory((s) => {
        const targetId = s.selection[s.selection.length - 1];
        if (!targetId) return {};
        const loc = findNode(s.nodes, targetId);
        if (!loc || loc.node.locked || loc.ref.kind === "slot") return {};
        if (!componentDef(loc.node.kind).acceptsChildren || loc.node.children.length === 0) return {};

        // Children are positioned inside the group, so lifting them out means
        // adding the group's own offset back in.
        const lifted = loc.node.children.map((c) => ({
          ...c,
          layout: {
            ...c.layout,
            x: c.layout.x + loc.node.layout.x,
            y: c.layout.y + loc.node.layout.y,
            rotation: c.layout.rotation + loc.node.layout.rotation,
          },
        }));

        const at = loc.ref.index;
        if (loc.ref.kind === "root") {
          const next = [...s.nodes];
          next.splice(at, 1, ...lifted);
          return { nodes: next, selection: lifted.length ? [lifted[0].id] : [] };
        }
        const nodes = mapNode(s.nodes, loc.parent!.id, (p) => {
          const children = [...p.children];
          children.splice(at, 1, ...lifted);
          return { ...p, children };
        });
        return { nodes, selection: lifted.length ? [...loc.path.slice(0, -1), lifted[0].id] : [] };
      }),

    replaceSlot: (hostId, slot, kind) => {
      let resultId: string | null = null;
      withHistory((s) => {
        const { nodes, id: targetHostId } = resolveMutableId(s.nodes, hostId);
        const loc = findNode(nodes, targetHostId);
        if (!loc || loc.node.locked) return {};
        const slotDef = componentDef(loc.node.kind).slots?.find((sd) => sd.name === slot);
        if (!slotDef) return {};
        if (kind === null) return { nodes: setSlot(nodes, targetHostId, slot, null) };
        const kindDef = componentDef(kind);
        if (!slotDef.accepts.some((t) => kindDef.tags.includes(t))) return {};
        const fresh = kindDef.factory();
        // Slot content is positioned RELATIVE to the slot frame (the host or
        // RenderNode supplies the frame's own offset), so new content starts
        // at the frame origin and fills it.
        fresh.layout = { ...fresh.layout, x: 0, y: 0, w: slotDef.frame.w, h: slotDef.frame.h };
        resultId = fresh.id;
        return { nodes: setSlot(nodes, targetHostId, slot, fresh) };
      });
      return resultId;
    },

    /* -- patches -------------------------------------------------------- */

    patchLayout: (id, patch) =>
      withHistory((s) => ({
        nodes: patchNode(s.nodes, id, (n) => {
          const layout = { ...n.layout, ...patch };
          // Resizing a container resizes what's in it. A group's box IS the
          // frame of its parts, so leaving children at fixed coordinates would
          // make width/height a dead control on every scene and lockup.
          const fx = layout.w / n.layout.w;
          const fy = layout.h / n.layout.h;
          const resized = Number.isFinite(fx) && Number.isFinite(fy) && (fx !== 1 || fy !== 1);
          const children = resized && n.children.length > 0 ? n.children.map((c) => scaleSubtree(c, fx, fy)) : n.children;
          return { ...n, layout, children };
        }),
      })),

    patchProps: (id, patch) =>
      withHistory((s) => ({ nodes: patchNode(s.nodes, id, (n) => ({ ...n, props: { ...n.props, ...patch } })) })),

    patchStyle: (id, patch) =>
      withHistory((s) => ({ nodes: patchNode(s.nodes, id, (n) => ({ ...n, style: { ...n.style, ...patch } })) })),

    patchAnimation: (id, patch) =>
      withHistory((s) => ({
        nodes: patchNode(s.nodes, id, (n) => ({ ...n, animation: { ...n.animation, ...patch } })),
      })),

    setName: (id, name) => withHistory((s) => ({ nodes: patchNode(s.nodes, id, (n) => ({ ...n, name })) })),
    setHidden: (id, hidden) => withHistory((s) => ({ nodes: patchNode(s.nodes, id, (n) => ({ ...n, hidden })) })),
    setSeed: (id, seed) => withHistory((s) => ({ nodes: patchNode(s.nodes, id, (n) => ({ ...n, seed })) })),
    setNotes: (id, notes) => withHistory((s) => ({ nodes: patchNode(s.nodes, id, (n) => ({ ...n, notes })) })),

    // Bypasses the lock guard on purpose — otherwise a locked node could never be unlocked.
    setLocked: (id, locked) => withHistory((s) => ({ nodes: mapNode(s.nodes, id, (n) => ({ ...n, locked })) })),

    /* -- modifiers -------------------------------------------------------- */

    addModifier: (id, defId, params) =>
      withHistory((s) => ({
        nodes: patchNode(s.nodes, id, (n) => ({
          ...n,
          modifiers: [...n.modifiers, { defId, params: params ?? {}, enabled: true }],
        })),
      })),

    patchModifier: (id, index, params) =>
      withHistory((s) => ({
        nodes: patchNode(s.nodes, id, (n) => ({
          ...n,
          modifiers: n.modifiers.map((m, i) => (i === index ? { ...m, params: { ...m.params, ...params } } : m)),
        })),
      })),

    removeModifier: (id, index) =>
      withHistory((s) => ({
        nodes: patchNode(s.nodes, id, (n) => ({ ...n, modifiers: n.modifiers.filter((_, i) => i !== index) })),
      })),

    toggleModifier: (id, index) =>
      withHistory((s) => ({
        nodes: patchNode(s.nodes, id, (n) => ({
          ...n,
          modifiers: n.modifiers.map((m, i) => (i === index ? { ...m, enabled: !m.enabled } : m)),
        })),
      })),

    reorderModifier: (id, index, dir) =>
      withHistory((s) => ({
        nodes: patchNode(s.nodes, id, (n) => {
          const mods = [...n.modifiers];
          const j = index + dir;
          if (j < 0 || j >= mods.length) return n;
          [mods[index], mods[j]] = [mods[j], mods[index]];
          return { ...n, modifiers: mods };
        }),
      })),

    /* -- selection ------------------------------------------------------ */

    select: (path) => set({ selection: path }),

    descendInto: (id) =>
      set((s) => {
        const loc = findNode(s.nodes, id);
        return loc ? { selection: loc.path } : {};
      }),

    /* -- protected/fork -------------------------------------------------- */

    forkProtected: (id) => {
      let newId = id;
      withHistory((s) => {
        const r = forkNode(s.nodes, id);
        newId = r.newId;
        return newId === id ? {} : { nodes: r.nodes };
      });
      return newId;
    },

    /* -- documents / presets / history ----------------------------------- */

    loadDoc: (doc) =>
      set({
        nodes: doc.nodes.map(hydrateNode),
        background: { ...doc.background },
        selection: [],
        historyPast: [],
        historyFuture: [],
      }),

    exportDoc: () => {
      const s = get();
      return {
        format: "darklighter",
        version: 1,
        name: "Untitled Darklighter Document",
        background: s.background,
        nodes: s.nodes,
      };
    },

    savePreset: (name, nodeId) => {
      const s = get();
      let nodes: ComponentNode[];
      if (nodeId) {
        const loc = findNode(s.nodes, nodeId);
        nodes = loc ? [loc.node] : [];
      } else {
        nodes = s.nodes;
      }
      const presetId = `preset_${nanoid(10)}`;
      const file: PresetFile = {
        format: "darklighter",
        version: 1,
        name,
        background: s.background,
        nodes,
        presetId,
      };
      const all = loadJSON<PresetFile[]>("presets", []);
      saveJSON("presets", [...all, file]);
      return presetId;
    },

    loadPreset: (presetId) => {
      const all = loadJSON<PresetFile[]>("presets", []);
      const file = all.find((p) => p.presetId === presetId);
      if (!file) return;
      set({
        nodes: file.nodes.map(hydrateNode),
        background: { ...file.background },
        selection: [],
        historyPast: [],
        historyFuture: [],
      });
    },

    takeSnapshot: (name, note) => {
      const s = get();
      const id = `snap_${nanoid(10)}`;
      const entry: SnapshotEntry = {
        id,
        name: name ?? `Snapshot ${s.snapshots.length + 1}`,
        at: Date.now(),
        doc: {
          format: "darklighter",
          version: 1,
          name: name ?? "Untitled",
          background: s.background,
          nodes: s.nodes,
        },
        parentSnapshotId: s.lastRestoredSnapshotId ?? undefined,
        note,
      };
      const snapshots = [...s.snapshots, entry];
      set({ snapshots });
      saveJSON("snapshots", snapshots);
      return id;
    },

    restoreSnapshot: (snapshotId) => {
      const s = get();
      const entry = s.snapshots.find((sn) => sn.id === snapshotId);
      if (!entry) return;
      set({
        nodes: entry.doc.nodes.map(hydrateNode),
        background: { ...entry.doc.background },
        selection: [],
        historyPast: [],
        historyFuture: [],
        lastRestoredSnapshotId: snapshotId,
      });
    },

    patchSnapshot: (snapshotId, patch) =>
      set((s) => {
        const snapshots = s.snapshots.map((sn) => (sn.id === snapshotId ? { ...sn, ...patch } : sn));
        saveJSON("snapshots", snapshots);
        return { snapshots };
      }),

    /* -- global ----------------------------------------------------------- */

    setBackgroundColor: (token) => withHistory(() => ({ background: { color: token } })),
    setPlaying: (v) => set({ playing: v }),
    replay: () => set((s) => ({ playNonce: s.playNonce + 1 })),

    undo: () =>
      set((s) => {
        const prev = s.historyPast[s.historyPast.length - 1];
        if (!prev) return {};
        const current: DocSnapshot = { nodes: s.nodes, background: s.background };
        return {
          nodes: prev.nodes,
          background: prev.background,
          historyPast: s.historyPast.slice(0, -1),
          historyFuture: [current, ...s.historyFuture].slice(0, HISTORY_CAP),
        };
      }),

    redo: () =>
      set((s) => {
        const nextSnap = s.historyFuture[0];
        if (!nextSnap) return {};
        const current: DocSnapshot = { nodes: s.nodes, background: s.background };
        return {
          nodes: nextSnap.nodes,
          background: nextSnap.background,
          historyPast: [...s.historyPast, current].slice(-HISTORY_CAP),
          historyFuture: s.historyFuture.slice(1),
        };
      }),

    /* -- floating windows (UI-only, not undoable) -------------------------- */

    toggleWindow: (id) =>
      set((s) => {
        const willOpen = !s.windows[id].open;
        const z = willOpen ? s.windowZTop + 1 : s.windows[id].z;
        return {
          windowZTop: willOpen ? z : s.windowZTop,
          windows: { ...s.windows, [id]: { ...s.windows[id], open: willOpen, z } },
        };
      }),
    openWindow: (id) =>
      set((s) => {
        const z = s.windowZTop + 1;
        return { windowZTop: z, windows: { ...s.windows, [id]: { ...s.windows[id], open: true, z } } };
      }),
    closeWindow: (id) =>
      set((s) => ({ windows: { ...s.windows, [id]: { ...s.windows[id], open: false } } })),
    focusWindow: (id) =>
      set((s) => {
        const z = s.windowZTop + 1;
        return { windowZTop: z, windows: { ...s.windows, [id]: { ...s.windows[id], z } } };
      }),
    moveWindow: (id, x, y) =>
      set((s) => ({ windows: { ...s.windows, [id]: { ...s.windows[id], x, y } } })),
    resizeWindow: (id, w, h) =>
      set((s) => ({ windows: { ...s.windows, [id]: { ...s.windows[id], w, h } } })),
  };
});

/**
 * Opening document: a lockup and two scopes, so a new session lands on
 * something moving and editable instead of an empty stage. Real factory
 * output — every child is selectable and one keystroke deletes any of it.
 * Called from `main.tsx` AFTER the defs module registers the kinds; not done
 * in the initializer above, which runs before any def exists.
 */
export function seedStarterDoc() {
  if (useDarklighter.getState().nodes.length > 0) return;
  const at = (node: ComponentNode, x: number, y: number): ComponentNode => ({
    ...node,
    layout: { ...node.layout, x, y },
  });
  useDarklighter.setState({
    nodes: [
      at(componentDef("heroLockup").factory(), 140, 80),
      at(componentDef("radarScope").factory(), 180, 440),
      at(componentDef("sweepModule").factory(), 820, 470),
    ],
  });
}
