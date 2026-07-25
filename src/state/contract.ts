/**
 * DARKLIGHTER STORE CONTRACT — AUTHORITATIVE
 * ------------------------------------------
 * The Zustand store implemented in Phase 1 must satisfy these interfaces.
 * Model the implementation on the reference app's store
 * (23andme-org-datavis/src/state/store.ts): action-only mutation, undo/redo
 * snapshots, edit logging. Only the STATE SHAPE differs (tree, not flat list).
 *
 * Rules:
 *  - Every mutation is an action here. UI and the AI executor both call
 *    these — nothing else touches state. (This is what keeps undo/redo and
 *    the AI patch-op vocabulary 1:1 and correct.)
 *  - Tree ops address nodes by id (ids are unique across the whole tree —
 *    maintain a flat id→path index internally).
 *  - Actions on `locked` nodes are no-ops; structural changes to
 *    `provenance.protected` nodes must fork first (see forkProtected).
 */
import type {
  AnimationConfig,
  ComponentKind,
  ComponentNode,
  DarklighterDoc,
  LayoutConfig,
  SelectionPath,
  StyleConfig,
} from "@/components-model/types";

export type EditActor = "user" | "ai";

export interface DarklighterState {
  nodes: ComponentNode[];            // canvas roots (render order)
  background: { color: string };     // brand token id
  selection: SelectionPath;
  /** Global animation playback. */
  playing: boolean;
  /** Named macro-history snapshots (Phase 5); undo/redo is separate micro-history. */
  snapshots: SnapshotEntry[];
}

export interface SnapshotEntry {
  id: string;
  name: string;
  at: number;                        // epoch ms
  doc: DarklighterDoc;
  parentSnapshotId?: string;         // branching
  starred?: boolean;                 // favorites
  rejected?: boolean;
  note?: string;
}

export interface DarklighterActions {
  /* -- tree CRUD ---------------------------------------------------- */
  /** Add a library component. Returns new node id. parentId omitted = canvas root. */
  addComponent: (
    kind: ComponentKind,
    opts?: { parentId?: string; slot?: string; actor?: EditActor },
  ) => string;
  removeNode: (id: string) => void;
  duplicateNode: (id: string) => string;
  /** Move a node under a new parent (must accept children) at index. */
  reparent: (id: string, newParentId: string | null, index?: number) => void;
  /** Z-order among siblings. */
  reorder: (id: string, dir: 1 | -1) => void;
  /** Group current multi-selection into a new composite (⌘G). */
  groupSelection: () => string | null;
  /**
   * Replace a named slot's content with a fresh `kind` (or null to empty).
   * Validates the kind's tags against the slot's `accepts`.
   */
  replaceSlot: (hostId: string, slot: string, kind: ComponentKind | null) => string | null;

  /* -- patches (all partial, all undo-aware) ------------------------- */
  patchLayout: (id: string, patch: Partial<LayoutConfig>) => void;
  patchProps: (id: string, patch: Record<string, unknown>) => void;
  patchStyle: (id: string, patch: Partial<StyleConfig>) => void;
  patchAnimation: (id: string, patch: Partial<AnimationConfig>) => void;
  setName: (id: string, name: string) => void;
  setHidden: (id: string, hidden: boolean) => void;
  setLocked: (id: string, locked: boolean) => void;
  setSeed: (id: string, seed: number) => void;
  setNotes: (id: string, notes: string) => void;

  /* -- modifiers ------------------------------------------------------ */
  addModifier: (id: string, defId: string, params?: Record<string, unknown>) => void;
  patchModifier: (id: string, index: number, params: Record<string, unknown>) => void;
  removeModifier: (id: string, index: number) => void;
  toggleModifier: (id: string, index: number) => void;
  reorderModifier: (id: string, index: number, dir: 1 | -1) => void;

  /* -- selection ------------------------------------------------------ */
  select: (path: SelectionPath) => void;
  /** Descend one level at a canvas point (double-click). */
  descendInto: (id: string) => void;

  /* -- protected/fork -------------------------------------------------- */
  /**
   * Called automatically by any structural action targeting a protected
   * node: deep-clones the subtree with fresh ids, provenance
   * { source, baseComponent: <original preset id>, protected: false },
   * swaps it in place, returns the clone's id. The pristine protected
   * preset remains restorable via loadPreset.
   */
  forkProtected: (id: string) => string;

  /* -- documents / presets / history ----------------------------------- */
  loadDoc: (doc: DarklighterDoc) => void;      // factory-hydrated
  exportDoc: () => DarklighterDoc;
  savePreset: (name: string, nodeId?: string) => string;
  loadPreset: (presetId: string) => void;
  takeSnapshot: (name?: string, note?: string) => string;
  restoreSnapshot: (snapshotId: string) => void; // records branch parentage
  patchSnapshot: (snapshotId: string, patch: Partial<Pick<SnapshotEntry, "name" | "starred" | "rejected" | "note">>) => void;

  /* -- global ----------------------------------------------------------- */
  setBackgroundColor: (token: string) => void;
  setPlaying: (v: boolean) => void;
  replay: () => void;
  undo: () => void;
  redo: () => void;
}

export type DarklighterStore = DarklighterState & DarklighterActions;
