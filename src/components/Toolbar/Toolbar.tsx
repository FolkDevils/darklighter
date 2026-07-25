import "./Toolbar.css";
import { useDarklighter } from "@/state/store";

/**
 * Toolbar: background swap (Phase 0) + Add/Undo/Redo/Replay wired against
 * the Phase 1 store. Export menu, history panel toggle, and AI panel
 * toggle stay disabled placeholders until their phases land (§6/§11).
 */
export function Toolbar() {
  const background = useDarklighter((s) => s.background);
  const setBackgroundColor = useDarklighter((s) => s.setBackgroundColor);
  const openWindow = useDarklighter((s) => s.openWindow);
  const undo = useDarklighter((s) => s.undo);
  const redo = useDarklighter((s) => s.redo);
  const replay = useDarklighter((s) => s.replay);
  const playing = useDarklighter((s) => s.playing);
  const setPlaying = useDarklighter((s) => s.setPlaying);
  const historyPast = useDarklighter((s) => s.historyPast);
  const historyFuture = useDarklighter((s) => s.historyFuture);

  const isDark = background.color === "burntDroneBrown";

  return (
    <div className="toolbar">
      <span className="toolbar-brand">DARKLIGHTER</span>
      <span className="toolbar-sep" />
      <button
        className="btn ghost"
        title="Toggle canvas background (Blimp White / Burnt Drone Brown)"
        onClick={() => setBackgroundColor(isDark ? "blimpWhite" : "burntDroneBrown")}
      >
        {isDark ? "Dark canvas" : "Light canvas"}
      </button>
      <span className="toolbar-spacer" />
      <button className="btn" title="Open the component library" onClick={() => openWindow("library")}>
        Add
      </button>
      <button className="btn" disabled={historyPast.length === 0} title="Undo (⌘Z)" onClick={undo}>
        Undo
      </button>
      <button className="btn" disabled={historyFuture.length === 0} title="Redo (⇧⌘Z)" onClick={redo}>
        Redo
      </button>
      <button
        className="btn"
        title={playing ? "Pause animation (shows the resting frame that exports)" : "Play animation"}
        onClick={() => setPlaying(!playing)}
      >
        {playing ? "Pause" : "Play"}
      </button>
      <button className="btn" title="Restart all animation" onClick={replay}>
        Replay
      </button>
      <button className="btn" disabled title="Phase 6 — export pipeline">
        Export
      </button>
    </div>
  );
}
