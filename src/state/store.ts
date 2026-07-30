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
import type {
  AnimationConfig,
  ComponentNode,
  PresetFile,
  SelectionPath,
  StyleConfig,
} from "@/components-model/types";
import type { DarklighterActions, DarklighterState, SnapshotEntry } from "@/state/contract";
import { componentDef, fitToAspect, nativeAspect } from "@/components-model/registry";
import {
  childIndexPath,
  isPromoted,
  resolveTarget,
  type ExposedParam,
} from "@/components-model/exposed";
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
import {
  deriveScope,
  deriveTags,
  entryFromNode,
  loadLibrary,
  mergeLibraries,
  persistLibrary,
  type LibraryEntry,
  type LibraryStatus,
} from "@/lib/library";
import { CANVAS_H, CANVAS_W } from "@/lib/constants";
import { assetPlacementSize, brandAsset } from "@/assets/brand/assets";

/* ------------------------------------------------------------------ */
/* Floating windows (ported pattern, PLAN.md §4 "PORT") — unchanged     */
/* shape from the Phase 0 scaffold.                                     */
/* ------------------------------------------------------------------ */

export type WindowId =
  | "library"
  | "hierarchy"
  | "inspector"
  | "variations"
  | "assistant"
  | "history";

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
  variations: { open: false, x: null, y: null, w: null, h: null, z: 3 },
  assistant: { open: false, x: null, y: null, w: null, h: null, z: 4 },
  history: { open: false, x: null, y: null, w: null, h: null, z: 5 },
});

/* ------------------------------------------------------------------ */
/* Undo-history + tree-mutation helpers                                */
/* ------------------------------------------------------------------ */

interface DocSnapshot {
  nodes: ComponentNode[];
  background: { color: string };
}

/** The stage document, parked verbatim while the composer is open. */
interface StageStash extends DocSnapshot {
  selection: SelectionPath;
  historyPast: DocSnapshot[];
  historyFuture: DocSnapshot[];
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
 *
 * Fixed-aspect art is the exception: it takes the smaller factor uniformly and
 * sits centred in the space it would otherwise have filled, so squashing a
 * group can never squash a mark inside it.
 */
function scaleSubtree(node: ComponentNode, fx: number, fy: number): ComponentNode {
  const round = (v: number) => Math.round(v * 100) / 100;
  const { x, y, w, h } = node.layout;
  const aspect = nativeAspect(node);
  const [sx, sy] = aspect === null ? [fx, fy] : [Math.min(fx, fy), Math.min(fx, fy)];
  const nw = Math.max(1, round(w * sx));
  const nh = Math.max(1, round(h * sy));
  return {
    ...node,
    layout: {
      ...node.layout,
      x: round(x * fx + (w * fx - nw) / 2),
      y: round(y * fy + (h * fy - nh) / 2),
      w: nw,
      h: nh,
    },
    children: node.children.map((c) => scaleSubtree(c, fx, fy)),
  };
}

/** Top-left corner that centers a `w`×`h` box inside `boxW`×`boxH`. */
function centerIn(w: number, h: number, boxW: number, boxH: number, offset = 0) {
  return {
    x: Math.max(0, Math.round((boxW - w) / 2)) + offset,
    y: Math.max(0, Math.round((boxH - h) / 2)) + offset,
  };
}

/** Same, against the full stage — where composer artifacts and placements land. */
const centeredBox = (w: number, h: number, offset = 0) => centerIn(w, h, CANVAS_W, CANVAS_H, offset);

/** Place a freshly created node in the middle of the box it's being added to. */
function centered(node: ComponentNode, boxW: number, boxH: number, offset: number): ComponentNode {
  return {
    ...node,
    layout: { ...node.layout, ...centerIn(node.layout.w, node.layout.h, boxW, boxH, offset) },
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

/* ------------------------------------------------------------------ */
/* Composer helpers                                                     */
/* ------------------------------------------------------------------ */

/** The union box of a set of roots, in stage coordinates. */
function boundsOf(nodes: ComponentNode[]): { x: number; y: number; w: number; h: number } {
  if (nodes.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const x = Math.min(...nodes.map((n) => n.layout.x));
  const y = Math.min(...nodes.map((n) => n.layout.y));
  const r = Math.max(...nodes.map((n) => n.layout.x + n.layout.w));
  const b = Math.max(...nodes.map((n) => n.layout.y + n.layout.h));
  return { x, y, w: r - x, h: b - y };
}

/**
 * What the composer is currently building, as ONE node.
 *
 * The composer's whole stage is the artifact, which is what lets it assemble
 * many parts into one saveable thing without the multi-select the stage still
 * lacks. A single root is taken as-is; several roots are wrapped in a
 * composite framed to their union box, with children rebased into it.
 */
export function composerArtifact(nodes: ComponentNode[], name: string): ComponentNode | null {
  const visible = nodes.filter((n) => !n.hidden);
  if (visible.length === 0) return null;
  if (visible.length === 1) return { ...visible[0], name };
  const box = boundsOf(visible);
  const group = componentDef("composite").factory();
  return {
    ...group,
    name,
    layout: { ...group.layout, ...box, rotation: 0 },
    children: visible.map((n) => ({
      ...n,
      layout: { ...n.layout, x: n.layout.x - box.x, y: n.layout.y - box.y },
    })),
  };
}

/** Drop a subtree onto a stage centered, with fresh ids and library provenance. */
function instanceOf(entry: LibraryEntry, opts?: { protectedBase?: boolean }): ComponentNode {
  const clone = cloneWithNewIds(hydrateNode(entry.node), () => nanoid(10));
  return {
    ...clone,
    name: entry.name,
    provenance: {
      source: entry.source === "ai" ? "ai" : "library",
      baseComponent: entry.id,
      protected: opts?.protectedBase ?? entry.protectedBase ?? false,
    },
  };
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

    /* -- the Library (docs/RECOMMENDATION.md §2) ------------------------- */

    /**
     * User- and AI-authored saved parts. Extension beyond the §5.3 contract:
     * `savePreset`/`loadPreset` there replace the WHOLE document, which makes
     * them a save-file mechanism, not a library. These keep entries as
     * placeable subtrees with approval state instead.
     */
    library: LibraryEntry[];
    /**
     * Freeze a subtree into the library. Source, in order: an explicit `node`
     * (a generated variation that was never on the canvas), a `nodeId` from the
     * current tree, or — in composer mode — whatever the composer is building.
     * Returns the entry id.
     */
    saveToLibrary: (opts?: {
      node?: ComponentNode;
      nodeId?: string;
      name?: string;
      status?: LibraryStatus;
      notes?: string;
    }) => string | null;
    /** Inline a fresh-id copy of an entry. Same placement rules as `addComponent`. */
    placeFromLibrary: (entryId: string, opts?: { parentId?: string }) => string | null;
    /** Overwrite an entry's tree with a node's current state (the "update" half of save). */
    updateLibraryNode: (entryId: string, nodeId: string) => void;
    patchLibraryEntry: (
      entryId: string,
      patch: Partial<Pick<LibraryEntry, "name" | "status" | "notes" | "protectedBase">>,
    ) => void;
    deleteLibraryEntry: (entryId: string) => void;
    duplicateLibraryEntry: (entryId: string) => string | null;
    importLibraryEntries: (entries: LibraryEntry[]) => number;
    /** Restore a node from the approved base it was forked from. */
    returnToApproved: (nodeId: string) => void;

    /* -- Composer mode --------------------------------------------------- */

    /**
     * Stage vs Composer. Both edit the SAME `nodes` array through the same
     * actions — entering the composer stashes the stage document and swaps in
     * the artifact, so every existing action, panel and export path works
     * unchanged. A second tree would have meant a second copy of all of it.
     */
    mode: "stage" | "composer";
    composer: { entryId: string | null; name: string; dirty: boolean } | null;
    enterComposer: (entryId?: string) => void;
    /** Take a copy of a stage node into the composer to work on it in isolation. */
    editInComposer: (nodeId: string) => void;
    exitComposer: () => void;
    /** Replace the composer's contents (Open another entry / New). */
    composerLoad: (entryId: string | null) => void;
    setComposerName: (name: string) => void;
    /** Save the artifact to the library — updates the open entry, or creates one. */
    composerSave: (opts?: { asNew?: boolean }) => string | null;
    /** Drop the artifact onto the stage without leaving the composer. */
    composerPlaceOnStage: () => string | null;

    /* -- variations --------------------------------------------------------- */

    /** Swap a node's look for a generated variant, keeping its identity and box. */
    applyVariation: (id: string, variant: ComponentNode) => void;

    /* -- exposed controls -------------------------------------------------- */

    /** Lift a descendant's control onto `hostId` as one of its own knobs. */
    promoteControl: (
      hostId: string,
      childId: string,
      param: Omit<ExposedParam, "id" | "path">,
    ) => void;
    setExposedValue: (hostId: string, paramId: string, value: unknown) => void;
    patchExposed: (hostId: string, paramId: string, patch: Partial<Pick<ExposedParam, "label" | "hint">>) => void;
    removeExposed: (hostId: string, paramId: string) => void;

    stageStash: StageStash | null;

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
      return {
        ...next,
        // One place to notice unsaved composer work: every doc mutation runs
        // through here, so the flag can't drift from what's on screen.
        composer: s.composer ? { ...s.composer, dirty: true } : s.composer,
        historyPast: [...s.historyPast, snap].slice(-HISTORY_CAP),
        historyFuture: [],
      };
    });
  };

  /** Commit a library change to state and localStorage in one step. */
  const writeLibrary = (entries: LibraryEntry[]) => {
    persistLibrary(entries);
    set({ library: entries });
  };

  return {
    nodes: [],
    background: { color: "blimpWhite" },
    selection: [],
    playing: true,
    snapshots: loadJSON<SnapshotEntry[]>("snapshots", []),

    library: loadLibrary(),
    mode: "stage",
    composer: null,
    stageStash: null,

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
          let layout = { ...n.layout, ...patch };
          // Fixed art can't restate itself at a new ratio, so the box is held
          // on the ratio instead of letting the art letterbox inside it
          // (registry.nativeAspect). Whichever edge the user actually moved
          // leads; when a corner moves both, width leads.
          const aspect = nativeAspect(n);
          if (aspect !== null && (layout.w !== n.layout.w || layout.h !== n.layout.h)) {
            const drive = layout.w !== n.layout.w ? "w" : "h";
            layout = { ...layout, ...fitToAspect(layout.w, layout.h, aspect, drive) };
          }
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
      withHistory((s) => ({
        nodes: patchNode(s.nodes, id, (n) => {
          const next = { ...n, props: { ...n.props, ...patch } };
          // A prop can change the art's shape (staticAsset's `assetId`), so the
          // box follows it — otherwise swapping a 7:1 wordmark for a square
          // silhouette strands the new art in the old frame.
          const aspect = nativeAspect(next);
          return aspect === null || aspect === nativeAspect(n)
            ? next
            : { ...next, layout: { ...next.layout, ...fitToAspect(next.layout.w, next.layout.h, aspect, "w") } };
        }),
      })),

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

    /* -- the Library ------------------------------------------------------ */

    saveToLibrary: (opts) => {
      const s = get();
      const node =
        opts?.node ??
        (opts?.nodeId !== undefined
          ? (findNode(s.nodes, opts.nodeId)?.node ?? null)
          : s.mode === "composer"
            ? composerArtifact(s.nodes, opts?.name ?? s.composer?.name ?? "Untitled part")
            : null);
      if (!node) return null;
      // Frozen with fresh ids so the entry can never share identity with the
      // node still on the canvas — editing one must not touch the other.
      const frozen = cloneWithNewIds(node, () => nanoid(10));
      const entry = entryFromNode(
        { ...frozen, name: opts?.name?.trim() || node.name },
        { status: opts?.status, notes: opts?.notes, source: "user" },
      );
      writeLibrary([entry, ...s.library]);
      return entry.id;
    },

    placeFromLibrary: (entryId, opts) => {
      const entry = get().library.find((e) => e.id === entryId);
      if (!entry) return null;
      const node = instanceOf(entry);
      withHistory((s) => placeNode(s, node, opts));
      return node.id;
    },

    updateLibraryNode: (entryId, nodeId) => {
      const s = get();
      const loc = findNode(s.nodes, nodeId);
      if (!loc) return;
      const frozen = cloneWithNewIds(loc.node, () => nanoid(10));
      writeLibrary(
        s.library.map((e) =>
          e.id === entryId
            ? {
                ...e,
                node: frozen,
                scope: deriveScope(frozen),
                tags: deriveTags(frozen),
                updatedAt: Date.now(),
              }
            : e,
        ),
      );
    },

    patchLibraryEntry: (entryId, patch) =>
      writeLibrary(
        get().library.map((e) =>
          e.id === entryId ? { ...e, ...patch, updatedAt: Date.now() } : e,
        ),
      ),

    deleteLibraryEntry: (entryId) => writeLibrary(get().library.filter((e) => e.id !== entryId)),

    duplicateLibraryEntry: (entryId) => {
      const s = get();
      const entry = s.library.find((e) => e.id === entryId);
      if (!entry) return null;
      // A duplicate is always a draft: approval is a judgement about one
      // specific tree, and this one is about to be changed.
      const copy = entryFromNode(cloneWithNewIds(entry.node, () => nanoid(10)), {
        name: `${entry.name} copy`,
        source: entry.source,
        notes: entry.notes,
        lineage: { parentEntryId: entry.id, baseComponent: entry.lineage?.baseComponent },
      });
      writeLibrary([copy, ...s.library]);
      return copy.id;
    },

    importLibraryEntries: (entries) => {
      const merged = mergeLibraries(get().library, entries);
      writeLibrary(merged);
      return entries.length;
    },

    returnToApproved: (nodeId) =>
      withHistory((s) => {
        const loc = findNode(s.nodes, nodeId);
        if (!loc) return {};
        const baseId = loc.node.provenance.baseComponent;
        const entry = baseId ? s.library.find((e) => e.id === baseId) : undefined;
        if (!entry) return {};
        // The pristine tree, put back where the edited one sat — restoring the
        // art shouldn't also move it.
        const restored: ComponentNode = {
          ...instanceOf(entry),
          layout: { ...loc.node.layout },
        };
        return { nodes: mapNode(s.nodes, nodeId, () => restored), selection: [...loc.path.slice(0, -1), restored.id] };
      }),

    /* -- Composer --------------------------------------------------------- */

    enterComposer: (entryId) => {
      const s = get();
      if (s.mode !== "composer") {
        set({
          mode: "composer",
          stageStash: {
            nodes: s.nodes,
            background: s.background,
            selection: s.selection,
            historyPast: s.historyPast,
            historyFuture: s.historyFuture,
          },
        });
      }
      get().composerLoad(entryId ?? null);
    },

    editInComposer: (nodeId) => {
      const s = get();
      const loc = findNode(s.nodes, nodeId);
      if (!loc || s.mode === "composer") return;
      // A copy, not the node itself: the composer is a workshop, and the thing
      // on the stage should not silently change while you experiment.
      const copy = cloneWithNewIds(loc.node, () => nanoid(10));
      set({
        mode: "composer",
        stageStash: {
          nodes: s.nodes,
          background: s.background,
          selection: s.selection,
          historyPast: s.historyPast,
          historyFuture: s.historyFuture,
        },
        composer: {
          entryId: s.library.some((e) => e.id === loc.node.provenance.baseComponent)
            ? loc.node.provenance.baseComponent!
            : null,
          name: loc.node.name,
          dirty: false,
        },
        nodes: [{ ...copy, layout: { ...copy.layout, ...centeredBox(copy.layout.w, copy.layout.h), rotation: 0 } }],
        selection: [copy.id],
        historyPast: [],
        historyFuture: [],
      });
    },

    exitComposer: () => {
      const s = get();
      if (s.mode !== "composer" || !s.stageStash) return;
      set({
        mode: "stage",
        composer: null,
        stageStash: null,
        nodes: s.stageStash.nodes,
        background: s.stageStash.background,
        selection: s.stageStash.selection,
        historyPast: s.stageStash.historyPast,
        historyFuture: s.stageStash.historyFuture,
      });
    },

    composerLoad: (entryId) => {
      const s = get();
      const entry = entryId ? s.library.find((e) => e.id === entryId) : undefined;
      // Opening a library entry gives you the entry's own tree to edit —
      // unprotected, because that's the point of opening it here.
      const node = entry
        ? { ...instanceOf(entry, { protectedBase: false }), layout: { ...hydrateNode(entry.node).layout } }
        : null;
      const placed = node
        ? [{ ...node, layout: { ...node.layout, ...centeredBox(node.layout.w, node.layout.h) } }]
        : [];
      set({
        composer: { entryId: entry?.id ?? null, name: entry?.name ?? "Untitled part", dirty: false },
        nodes: placed,
        selection: placed.length ? [placed[0].id] : [],
        historyPast: [],
        historyFuture: [],
      });
    },

    setComposerName: (name) =>
      set((s) => (s.composer ? { composer: { ...s.composer, name } } : {})),

    composerSave: (opts) => {
      const s = get();
      if (!s.composer) return null;
      const artifact = composerArtifact(s.nodes, s.composer.name);
      if (!artifact) return null;
      const frozen = cloneWithNewIds(artifact, () => nanoid(10));
      const existing = !opts?.asNew && s.composer.entryId
        ? s.library.find((e) => e.id === s.composer!.entryId)
        : undefined;

      if (existing) {
        writeLibrary(
          s.library.map((e) =>
            e.id === existing.id
              ? {
                  ...e,
                  name: s.composer!.name,
                  node: frozen,
                  scope: deriveScope(frozen),
                  tags: deriveTags(frozen),
                  updatedAt: Date.now(),
                }
              : e,
          ),
        );
        set({ composer: { ...s.composer, dirty: false } });
        return existing.id;
      }

      const entry = entryFromNode(frozen, {
        name: s.composer.name,
        source: "user",
        lineage: s.composer.entryId ? { parentEntryId: s.composer.entryId } : undefined,
      });
      writeLibrary([entry, ...s.library]);
      set({ composer: { entryId: entry.id, name: entry.name, dirty: false } });
      return entry.id;
    },

    composerPlaceOnStage: () => {
      const s = get();
      if (!s.composer || !s.stageStash) return null;
      const artifact = composerArtifact(s.nodes, s.composer.name);
      if (!artifact) return null;
      const node = cloneWithNewIds(artifact, () => nanoid(10));
      const positioned: ComponentNode = {
        ...node,
        provenance: {
          source: "user",
          baseComponent: s.composer.entryId ?? undefined,
        },
        layout: { ...node.layout, ...centeredBox(node.layout.w, node.layout.h, (s.stageStash.nodes.length % 6) * 32) },
      };
      // The stage isn't the live document right now, so this writes straight
      // into the stash — and lands in the stage's undo history, not the
      // composer's, which is where a user would look for it.
      set({
        stageStash: {
          ...s.stageStash,
          nodes: insertRoot(s.stageStash.nodes, positioned),
          historyPast: [
            ...s.stageStash.historyPast,
            { nodes: s.stageStash.nodes, background: s.stageStash.background },
          ].slice(-HISTORY_CAP),
          historyFuture: [],
          selection: [positioned.id],
        },
      });
      return positioned.id;
    },

    /* -- variations -------------------------------------------------------- */

    applyVariation: (id, variant) =>
      withHistory((s) => ({
        // Identity and placement belong to the canvas, not to the variant:
        // picking a variation changes how a thing looks, not which thing it is
        // or where it sits.
        nodes: patchNode(s.nodes, id, (n) => ({
          ...variant,
          id: n.id,
          name: n.name,
          layout: n.layout,
          locked: n.locked,
          hidden: n.hidden,
          provenance: n.provenance,
        })),
      })),

    /* -- exposed controls (components-model/exposed.ts) -------------------- */

    promoteControl: (hostId, childId, param) =>
      withHistory((s) => {
        const host = findNode(s.nodes, hostId)?.node;
        if (!host) return {};
        const path = childIndexPath(host, childId);
        if (!path) return {};
        if (isPromoted(host, path, param.channel, param.key)) return {};
        const next: ExposedParam = { ...param, id: `xp_${nanoid(8)}`, path };
        return {
          nodes: patchNode(s.nodes, hostId, (n) => ({ ...n, exposed: [...(n.exposed ?? []), next] })),
        };
      }),

    setExposedValue: (hostId, paramId, value) =>
      withHistory((s) => {
        const host = findNode(s.nodes, hostId)?.node;
        const param = host?.exposed?.find((p) => p.id === paramId);
        if (!host || !param) return {};
        const target = resolveTarget(host, param.path);
        if (!target) return {};
        // Writes land on the target node through the normal patch guard, so a
        // knob on an assembly is indistinguishable from editing the child by
        // hand — same undo entry, same protected-fork behavior.
        return {
          nodes: patchNode(s.nodes, target.id, (n) => {
            switch (param.channel) {
              case "props":
                return { ...n, props: { ...n.props, [param.key]: value } };
              case "style":
                return { ...n, style: { ...n.style, [param.key]: value } };
              case "animation":
                return { ...n, animation: { ...n.animation, [param.key]: value } };
              case "layout":
                return { ...n, layout: { ...n.layout, [param.key]: value } };
            }
          }),
        };
      }),

    patchExposed: (hostId, paramId, patch) =>
      withHistory((s) => ({
        nodes: patchNode(s.nodes, hostId, (n) => ({
          ...n,
          exposed: (n.exposed ?? []).map((p) => (p.id === paramId ? { ...p, ...patch } : p)),
        })),
      })),

    removeExposed: (hostId, paramId) =>
      withHistory((s) => ({
        nodes: patchNode(s.nodes, hostId, (n) => ({
          ...n,
          exposed: (n.exposed ?? []).filter((p) => p.id !== paramId),
        })),
      })),

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

