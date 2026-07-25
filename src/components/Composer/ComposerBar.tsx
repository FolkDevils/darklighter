/**
 * The Composer's own bar — visible only in composer mode.
 *
 * Why the Composer exists (docs/RECOMMENDATION.md §3): editing a part buried
 * inside a scene means clicking past siblings and tuning a 300px thing in the
 * corner of a 1600px stage. Worse, `groupSelection` groups a SINGLE node —
 * there is no marquee or ⌘-click — so assembling eight parts into one saveable
 * HUD is impossible on the stage. Here the whole stage IS the artifact, so
 * assembly needs no selection model at all.
 *
 * It is a MODE over the same store, not a second canvas: entering stashes the
 * stage document and swaps `nodes`, so the inspector, hierarchy, animation and
 * export paths are the ones already proven on the stage. A forked renderer is
 * how WYSIWYG quietly dies.
 */
import "./ComposerBar.css";
import { useDarklighter } from "@/state/store";

export function ComposerBar() {
  const composer = useDarklighter((s) => s.composer);
  const nodes = useDarklighter((s) => s.nodes);
  const library = useDarklighter((s) => s.library);
  const setComposerName = useDarklighter((s) => s.setComposerName);
  const composerSave = useDarklighter((s) => s.composerSave);
  const composerLoad = useDarklighter((s) => s.composerLoad);
  const composerPlaceOnStage = useDarklighter((s) => s.composerPlaceOnStage);
  const exitComposer = useDarklighter((s) => s.exitComposer);
  const openWindow = useDarklighter((s) => s.openWindow);

  if (!composer) return null;

  const empty = nodes.length === 0;
  const open = composer.entryId ? library.find((e) => e.id === composer.entryId) : undefined;

  const confirmDiscard = (verb: string) =>
    !composer.dirty || window.confirm(`Unsaved changes to “${composer.name}”. ${verb} anyway?`);

  return (
    <div className="composer-bar">
      <span className="composer-tag">COMPOSER</span>

      <input
        className="input composer-name"
        value={composer.name}
        placeholder="Untitled part"
        onChange={(e) => setComposerName(e.target.value)}
      />

      <span className="composer-state">
        {empty
          ? "Empty — add parts from the Library"
          : `${nodes.length} ${nodes.length === 1 ? "root" : "roots"}${nodes.length > 1 ? " → saved as one assembly" : ""}`}
        {composer.dirty && <em className="composer-dirty" title="Unsaved changes"> ●</em>}
      </span>

      <button className="btn" title="Open the Library to add parts" onClick={() => openWindow("library")}>
        Add
      </button>
      <button
        className="btn"
        disabled={empty}
        title="Drop a copy of this onto the stage without leaving the composer"
        onClick={() => composerPlaceOnStage()}
      >
        Place on stage
      </button>
      <button
        className="btn primary"
        disabled={empty}
        title={open ? `Update “${open.name}” in the library` : "Save to the library as a new entry"}
        onClick={() => composerSave()}
      >
        {open ? "Save" : "Save to Library"}
      </button>
      {open && (
        <button
          className="btn"
          disabled={empty}
          title="Save as a separate library entry, leaving the original alone"
          onClick={() => composerSave({ asNew: true })}
        >
          Save as new
        </button>
      )}
      <button
        className="btn ghost"
        title="Start over with a blank composer"
        onClick={() => confirmDiscard("Clear") && composerLoad(null)}
      >
        Clear
      </button>
      <button
        className="btn ghost"
        title="Return to the stage — your stage document is exactly as you left it"
        onClick={() => confirmDiscard("Leave") && exitComposer()}
      >
        Back to stage
      </button>
    </div>
  );
}
