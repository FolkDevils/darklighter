/**
 * Where refined work re-enters the system (docs/RECOMMENDATION.md §2). Without
 * this the engine has no memory: every session restarts from factory defaults
 * and nothing a user tunes can be reused.
 *
 * Three verbs, all on the selected node:
 *   Save to Library  — freeze this subtree as a new entry
 *   Update           — overwrite the entry it came from
 *   Return to approved — throw away a fork and restore the protected base
 */
import { useEffect, useState } from "react";
import type { ComponentNode } from "@/components-model/types";
import { useDarklighter } from "@/state/store";

export function LibrarySection({ node }: { node: ComponentNode }) {
  // Saving is instant and silent otherwise — with no dialog to dismiss, the
  // only signal that anything happened would be a card appearing in a panel
  // that may well be closed.
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2200);
    return () => clearTimeout(t);
  }, [flash]);

  const library = useDarklighter((s) => s.library);
  const saveToLibrary = useDarklighter((s) => s.saveToLibrary);
  const updateLibraryNode = useDarklighter((s) => s.updateLibraryNode);
  const returnToApproved = useDarklighter((s) => s.returnToApproved);
  const editInComposer = useDarklighter((s) => s.editInComposer);
  const mode = useDarklighter((s) => s.mode);

  const baseId = node.provenance.baseComponent;
  const origin = baseId ? library.find((e) => e.id === baseId) : undefined;

  return (
    <div className="insp-library">
      {flash && <p className="insp-flash">{flash}</p>}
      <div className="insp-row-2">
        <button
          type="button"
          className="btn primary"
          title={`Freeze “${node.name}” and everything inside it as a reusable library entry (⌘S)`}
          onClick={() => {
            saveToLibrary({ nodeId: node.id, name: node.name });
            setFlash(`Saved “${node.name}” — Library ▸ Saved`);
          }}
        >
          Save to Library
        </button>
        {origin ? (
          <button
            type="button"
            className="btn"
            title={`Overwrite “${origin.name}” with this node's current state`}
            onClick={() => {
              if (window.confirm(`Update “${origin.name}” to match this node?`)) {
                updateLibraryNode(origin.id, node.id);
                setFlash(`Updated “${origin.name}”`);
              }
            }}
          >
            Update base
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            disabled={mode === "composer"}
            title="Open a copy of this node alone on a blank stage"
            onClick={() => editInComposer(node.id)}
          >
            Edit in Composer
          </button>
        )}
      </div>

      {origin && (
        <>
          <p className="insp-note">
            From <strong>{origin.name}</strong>
            {origin.status === "approved" ? " (approved)" : " (draft)"}
            {node.provenance.protected && " · protected — your first edit will fork it"}
          </p>
          <div className="insp-row-2">
            <button
              type="button"
              className="btn"
              disabled={mode === "composer"}
              title="Open a copy of this node alone on a blank stage"
              onClick={() => editInComposer(node.id)}
            >
              Edit in Composer
            </button>
            <button
              type="button"
              className="btn"
              title={`Discard changes and restore “${origin.name}” exactly as saved`}
              onClick={() => {
                if (window.confirm(`Restore “${origin.name}”? Changes to this node are discarded.`)) {
                  returnToApproved(node.id);
                }
              }}
            >
              Return to base
            </button>
          </div>
        </>
      )}
    </div>
  );
}
