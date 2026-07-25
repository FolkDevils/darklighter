/**
 * The saved-parts gallery — the "memory" half of the library (docs/
 * RECOMMENDATION.md §2). One list, not two: a refined single part and a
 * finished multi-part HUD are the same object (a node subtree), so they share
 * a store, a card and a set of actions, and differ only by a derived `scope`
 * filter. Two parallel libraries would fracture the taxonomy and give the AI
 * phase two APIs for one idea.
 *
 * Cards render the STORED tree through the same `RenderNode` the canvas uses,
 * so a preview can't drift from what placing it produces.
 */
import { useMemo, useState } from "react";
import { useDarklighter } from "@/state/store";
import { countParts, libraryFile, parseLibraryFile, type LibraryEntry } from "@/lib/library";
import { downloadJSON, slugify } from "@/lib/svg/download";
import { Thumbnail } from "./Thumbnail";

type Filter = "all" | "approved" | "part" | "assembly";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "approved", label: "Approved" },
  { id: "part", label: "Parts" },
  { id: "assembly", label: "Assemblies" },
];

const matches = (e: LibraryEntry, f: Filter) =>
  f === "all" ? true : f === "approved" ? e.status === "approved" : e.scope === f;

function pickLibraryFile(): Promise<LibraryEntry[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? parseLibraryFile(await file.text()) : null);
    };
    input.click();
  });
}

export function MyPartsTab({ query, parentId }: { query: string; parentId?: string }) {
  const library = useDarklighter((s) => s.library);
  const placeFromLibrary = useDarklighter((s) => s.placeFromLibrary);
  const patchLibraryEntry = useDarklighter((s) => s.patchLibraryEntry);
  const deleteLibraryEntry = useDarklighter((s) => s.deleteLibraryEntry);
  const duplicateLibraryEntry = useDarklighter((s) => s.duplicateLibraryEntry);
  const importLibraryEntries = useDarklighter((s) => s.importLibraryEntries);
  const enterComposer = useDarklighter((s) => s.enterComposer);
  const mode = useDarklighter((s) => s.mode);

  const [filter, setFilter] = useState<Filter>("all");
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const entries = useMemo(
    () =>
      library
        .filter((e) => matches(e, filter))
        .filter((e) => (q ? `${e.name} ${e.kindHint} ${e.tags.join(" ")}`.toLowerCase().includes(q) : true))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [library, filter, q],
  );

  return (
    <div className="myparts">
      <div className="myparts-filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`chip sm${filter === f.id ? " on" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {library.length === 0 && (
        <p className="library-empty">
          Nothing saved yet. Refine any part or scene and hit <strong>Save to Library</strong> in the
          inspector — or build one in the <strong>Composer</strong> and save it from there.
        </p>
      )}
      {library.length > 0 && entries.length === 0 && (
        <p className="library-empty">Nothing matches this filter.</p>
      )}

      <div className="library-grid">
        {entries.map((e) => (
          <div key={e.id} className={`library-card entry${e.status === "approved" ? " approved" : ""}`}>
            <button
              type="button"
              className="entry-place"
              title={`Place “${e.name}” (${countParts(e.node)} components)`}
              onClick={() => placeFromLibrary(e.id, parentId ? { parentId } : undefined)}
            >
              <Thumbnail kind={e.node.kind} node={e.node} />
            </button>

            <div className="entry-meta">
              <span className="library-card-label" title={e.name}>
                {e.name}
              </span>
              <span className="entry-badges">
                {e.status === "approved" && <em className="badge ok" title="Approved">✓</em>}
                {e.protectedBase && <em className="badge" title="Protected base — edits fork">◆</em>}
                {e.source === "ai" && <em className="badge ai" title="Proposed by AI">AI</em>}
                <em className="badge dim">{e.scope === "assembly" ? `${countParts(e.node)}` : "1"}</em>
              </span>
            </div>

            <div className="entry-actions">
              <button
                type="button"
                className="mini"
                title="Open in Composer"
                onClick={() => enterComposer(e.id)}
              >
                Edit
              </button>
              <button
                type="button"
                className="mini"
                title={e.status === "approved" ? "Move back to draft" : "Mark approved"}
                onClick={() =>
                  patchLibraryEntry(e.id, { status: e.status === "approved" ? "draft" : "approved" })
                }
              >
                {e.status === "approved" ? "Unapprove" : "Approve"}
              </button>
              <button
                type="button"
                className="mini"
                title="More"
                onClick={() => setMenuFor(menuFor === e.id ? null : e.id)}
              >
                ⋯
              </button>
            </div>

            {menuFor === e.id && (
              <div className="entry-menu">
                <button
                  type="button"
                  onClick={() => {
                    const name = window.prompt("Name", e.name);
                    if (name) patchLibraryEntry(e.id, { name });
                    setMenuFor(null);
                  }}
                >
                  Rename…
                </button>
                <button
                  type="button"
                  onClick={() => {
                    duplicateLibraryEntry(e.id);
                    setMenuFor(null);
                  }}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  title="Placements are protected: the first edit forks, and Return to approved restores this tree."
                  onClick={() => {
                    patchLibraryEntry(e.id, { protectedBase: !e.protectedBase });
                    setMenuFor(null);
                  }}
                >
                  {e.protectedBase ? "Unprotect base" : "Make protected base"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadJSON(
                      `${slugify(e.name)}.dkl-library.json`,
                      JSON.stringify(libraryFile([e]), null, 2),
                    );
                    setMenuFor(null);
                  }}
                >
                  Export entry…
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    if (window.confirm(`Delete “${e.name}” from the library?`)) deleteLibraryEntry(e.id);
                    setMenuFor(null);
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="myparts-io">
        <button
          type="button"
          className="btn ghost"
          title="Write the whole library to a file — the portable, agent-readable form"
          disabled={library.length === 0}
          onClick={() =>
            downloadJSON("darklighter.dkl-library.json", JSON.stringify(libraryFile(library), null, 2))
          }
        >
          Export library
        </button>
        <button
          type="button"
          className="btn ghost"
          title="Merge a library file in — newer entries win"
          onClick={async () => {
            const incoming = await pickLibraryFile();
            if (incoming) importLibraryEntries(incoming);
          }}
        >
          Import…
        </button>
        {mode === "stage" && (
          <button type="button" className="btn" title="Build a new part from scratch" onClick={() => enterComposer()}>
            New in Composer
          </button>
        )}
      </div>
    </div>
  );
}
