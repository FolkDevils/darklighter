import "./App.css";
import { Toolbar } from "@/components/Toolbar/Toolbar";
import { Canvas } from "@/components/Canvas/Canvas";
import { ComposerBar } from "@/components/Composer/ComposerBar";
import { SideRail } from "@/components/Windows/SideRail";
import { WindowHost } from "@/components/Windows/WindowHost";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import { useDarklighter } from "@/state/store";

/**
 * App shell. Layout mirrors the reference app (PLAN.md §6): toolbar on top,
 * a left side-rail of toggleable floating panels, canvas fills the rest.
 *
 * Two modes share all of it. Composer mode adds one bar and reframes the
 * canvas; every panel below keeps working because both modes edit the same
 * `nodes` array through the same actions (docs/RECOMMENDATION.md §3).
 */
export default function App() {
  useKeyboardShortcuts();
  const mode = useDarklighter((s) => s.mode);

  return (
    <div className={`app${mode === "composer" ? " composing" : ""}`}>
      <Toolbar />
      {mode === "composer" && <ComposerBar />}
      <div className="app-body">
        <SideRail />
        <div className="workspace">
          <Canvas />
          <WindowHost />
        </div>
      </div>
    </div>
  );
}
