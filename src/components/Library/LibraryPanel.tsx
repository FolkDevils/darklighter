import "./LibraryPanel.css";
import { useMemo, useState } from "react";
import { allComponentDefs, componentDef } from "@/components-model/registry";
import type { ComponentKind } from "@/components-model/types";
import { findNode } from "@/lib/nodeTree";
import { useDarklighter } from "@/state/store";
import { BRAND_ASSETS, ASSET_CATEGORY_LABEL, type BrandAssetCategory } from "@/assets/brand/assets";
import { Thumbnail } from "./Thumbnail";
import { MyPartsTab } from "./MyPartsTab";

/**
 * The gallery (PLAN.md §6): every registered component as a live, animating
 * preview card. Click adds to the canvas and selects — the instant-add flow
 * from the reference app.
 *
 * Four tabs mirror how the kit is actually built (docs/NORTH_STAR.md):
 *   Scenes  — generated composites (radar scope, telemetry panel, lockups…),
 *             each one a tree of editable parts, not flat art
 *   Parts   — the primitives those scenes are made of
 *   Brand   — the only fixed marks we import as SVG
 *   Saved   — what YOU (or the AI, once approved) made: the library
 *             (docs/RECOMMENDATION.md §2), stored as data, not as kinds
 *
 * The first three read the registry — code, the grammar. The fourth reads the
 * library — data, the vocabulary. Keeping them in one panel is deliberate:
 * assembling something out of "a ringSet plus my approved Tracking Panel"
 * should not mean visiting two places.
 *
 * `composite` is excluded: grouping is an action on a selection (⌘G / the
 * Hierarchy panel), not an object you place.
 */

type Entry =
  | { type: "component"; key: string; kind: ComponentKind; label: string; describe: string; group: string }
  | { type: "asset"; key: string; assetId: string; label: string; describe: string; group: string };

const COMPONENT_GROUP_LABEL: Record<string, string> = {
  radar: "Radar parts",
  glyphs: "Glyphs",
  craft: "Craft",
  text: "Text",
  logos: "Logos & lockups",
  composites: "Generated scenes",
};

type Tab = "scenes" | "parts" | "brand" | "saved";

const TABS: { id: Tab; label: string }[] = [
  { id: "scenes", label: "Scenes" },
  { id: "parts", label: "Parts" },
  { id: "brand", label: "Brand" },
  { id: "saved", label: "Saved" },
];

/** Scenes tab = the assembled composites and lockups. */
const SCENE_CATEGORIES = ["composites", "logos"];

export function LibraryPanel() {
  const addComponent = useDarklighter((s) => s.addComponent);
  const addAsset = useDarklighter((s) => s.addAsset);
  const nodes = useDarklighter((s) => s.nodes);
  const selection = useDarklighter((s) => s.selection);
  const mode = useDarklighter((s) => s.mode);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("scenes");

  const selectedId = selection[selection.length - 1];
  const selected = selectedId ? findNode(nodes, selectedId)?.node : undefined;
  const parent = selected && componentDef(selected.kind).acceptsChildren ? selected : undefined;

  const entries = useMemo<Entry[]>(() => {
    if (tab === "saved") return [];
    if (tab === "brand") {
      return BRAND_ASSETS.map((a) => ({
        type: "asset",
        key: `asset:${a.id}`,
        assetId: a.id,
        label: a.label,
        describe: a.describe,
        group: ASSET_CATEGORY_LABEL[a.category as BrandAssetCategory] ?? a.category,
      }));
    }
    const wantScenes = tab === "scenes";
    return allComponentDefs()
      .filter((d) => d.kind !== "composite" && d.kind !== "staticAsset")
      .filter((d) => SCENE_CATEGORIES.includes(d.category) === wantScenes)
      .map((d) => ({
        type: "component",
        key: `kind:${d.kind}`,
        kind: d.kind,
        label: d.label,
        describe: d.describe,
        group: COMPONENT_GROUP_LABEL[d.category] ?? d.category,
      }));
  }, [tab]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? entries.filter((e) => `${e.label} ${e.describe}`.toLowerCase().includes(q))
    : entries;

  const groups = new Map<string, Entry[]>();
  for (const e of filtered) {
    const list = groups.get(e.group) ?? [];
    list.push(e);
    groups.set(e.group, list);
  }

  const add = (e: Entry) => {
    const opts = parent ? { parentId: parent.id } : undefined;
    if (e.type === "asset") addAsset(e.assetId, opts);
    else addComponent(e.kind, opts);
  };

  return (
    <div className="library-panel">
      <div className="library-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`chip${tab === t.id ? " on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <input
        className="input library-search"
        type="search"
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <p className="library-target">
        {parent ? (
          <>
            Adding into <strong>{parent.name}</strong>
          </>
        ) : mode === "composer" ? (
          "Adding to the composer"
        ) : (
          "Adding to canvas"
        )}
      </p>

      {tab === "saved" && <MyPartsTab query={query} parentId={parent?.id} />}

      {tab !== "saved" && filtered.length === 0 && (
        <p className="library-empty">Nothing matches “{query}”.</p>
      )}

      {[...groups.entries()].map(([group, items]) => (
        <div key={group} className="library-group">
          <p className="library-group-label">{group}</p>
          <div className="library-grid">
            {items.map((e) => (
              <button key={e.key} type="button" className="library-card" title={e.describe} onClick={() => add(e)}>
                <Thumbnail
                  kind={e.type === "asset" ? "staticAsset" : e.kind}
                  assetId={e.type === "asset" ? e.assetId : undefined}
                />
                <span className="library-card-label">{e.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
