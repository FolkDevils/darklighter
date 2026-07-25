/**
 * THE LIBRARY — user- and AI-authored parts, kept as DATA.
 *
 * The three layers this app runs on (docs/RECOMMENDATION.md §1):
 *
 *   Definition   `ComponentDef`  — code; the grammar. Only devs add these.
 *   Instance     `ComponentNode` — a live thing on the canvas.
 *   Saved entry  `LibraryEntry`  — a frozen node subtree + metadata. THIS FILE.
 *
 * A saved entry is never registered as a component kind. Registering one would
 * make a `.dkl.json` reference a kind that exists only in one browser's
 * localStorage, so the file would open nowhere else and `npm run smoke` could
 * not enumerate it. Placing an entry INLINES a fresh-id copy of its tree
 * instead — copy semantics, with `provenance.baseComponent` recording where it
 * came from so a future "update from library" has something to key on.
 *
 * There is deliberately no thumbnail field: cards render the stored node
 * through the same `RenderNode` the canvas uses, so a preview can never go
 * stale and the library stays small enough for localStorage.
 */
import { nanoid } from "nanoid";
import type {
  ComponentKind,
  ComponentNode,
  ComponentTag,
  NodeSource,
} from "@/components-model/types";
import { componentDef } from "@/components-model/registry";
import { loadJSON, saveJSON } from "@/lib/persist";

export type LibraryStatus = "draft" | "approved";

/** Derived from the tree, never authored: a part is one component, an assembly has parts inside. */
export type LibraryScope = "part" | "assembly";

export interface LibraryEntry {
  id: string;
  name: string;
  /** Root kind — for icons, filtering and the future AI manifest. */
  kindHint: ComponentKind;
  scope: LibraryScope;
  /** Union of the subtree's kind tags; drives search and slot reasoning. */
  tags: ComponentTag[];
  status: LibraryStatus;
  /**
   * An approved base: placements are marked `provenance.protected`, so the
   * first edit forks and "Return to approved" can always restore this tree.
   */
  protectedBase?: boolean;
  source: NodeSource;
  /** The payload: a complete subtree, hydrated on placement. */
  node: ComponentNode;
  notes?: string;
  lineage?: { parentEntryId?: string; baseComponent?: string };
  createdAt: number;
  updatedAt: number;
}

/**
 * The portable form. Separate from `.dkl.json` (a document) on purpose — this
 * is a collection with approval state, and Phase 7's sidecar will own it as
 * files under `data/darklighter/library/` so an agent can read what you
 * approved. localStorage is the fast path, not the source of truth.
 */
export interface LibraryFile {
  format: "darklighter-library";
  version: 1;
  exportedAt: number;
  entries: LibraryEntry[];
}

const STORE_KEY = "library";

export const loadLibrary = (): LibraryEntry[] => loadJSON<LibraryEntry[]>(STORE_KEY, []);
export const persistLibrary = (entries: LibraryEntry[]): void => saveJSON(STORE_KEY, entries);

/* ------------------------------------------------------------------ */
/* Deriving metadata from the tree                                      */
/* ------------------------------------------------------------------ */

export const deriveScope = (node: ComponentNode): LibraryScope =>
  node.children.length > 0 || node.kind === "composite" ? "assembly" : "part";

/** Every tag any kind in the subtree carries — an assembly is findable by its contents. */
export function deriveTags(node: ComponentNode): ComponentTag[] {
  const seen = new Set<ComponentTag>();
  const walk = (n: ComponentNode) => {
    try {
      for (const t of componentDef(n.kind).tags) seen.add(t);
    } catch {
      // Unknown kind (a file from a newer build) — contributes no tags.
    }
    n.children.forEach(walk);
    if (n.slots) for (const v of Object.values(n.slots)) if (v) walk(v);
  };
  walk(node);
  return [...seen];
}

/** How many components are inside, including the root. Shown on cards. */
export function countParts(node: ComponentNode): number {
  let n = 1;
  for (const c of node.children) n += countParts(c);
  if (node.slots) for (const v of Object.values(node.slots)) if (v) n += countParts(v);
  return n;
}

export function entryFromNode(
  node: ComponentNode,
  opts: {
    name?: string;
    status?: LibraryStatus;
    source?: NodeSource;
    notes?: string;
    lineage?: LibraryEntry["lineage"];
  } = {},
): LibraryEntry {
  const now = Date.now();
  return {
    id: `lib_${nanoid(10)}`,
    name: opts.name?.trim() || node.name,
    kindHint: node.kind,
    scope: deriveScope(node),
    tags: deriveTags(node),
    status: opts.status ?? "draft",
    source: opts.source ?? "user",
    node,
    notes: opts.notes,
    lineage: opts.lineage ?? (node.provenance.baseComponent
      ? { baseComponent: node.provenance.baseComponent }
      : undefined),
    createdAt: now,
    updatedAt: now,
  };
}

/* ------------------------------------------------------------------ */
/* Import / export                                                      */
/* ------------------------------------------------------------------ */

export const libraryFile = (entries: LibraryEntry[]): LibraryFile => ({
  format: "darklighter-library",
  version: 1,
  exportedAt: Date.now(),
  entries,
});

export function parseLibraryFile(text: string): LibraryEntry[] | null {
  try {
    const file = JSON.parse(text) as LibraryFile;
    if (file?.format !== "darklighter-library" || !Array.isArray(file.entries)) return null;
    return file.entries;
  } catch {
    return null;
  }
}

/**
 * Merge an imported set into the current one. Same id = same entry, and the
 * newer `updatedAt` wins, so importing a colleague's file (or re-importing
 * your own backup) can't silently roll your work back.
 */
export function mergeLibraries(current: LibraryEntry[], incoming: LibraryEntry[]): LibraryEntry[] {
  const byId = new Map(current.map((e) => [e.id, e]));
  for (const e of incoming) {
    const existing = byId.get(e.id);
    if (!existing || e.updatedAt >= existing.updatedAt) byId.set(e.id, e);
  }
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}
