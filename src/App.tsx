import "./App.css";
import { Toolbar } from "@/components/Toolbar/Toolbar";
import { Canvas } from "@/components/Canvas/Canvas";
import { SideRail } from "@/components/Windows/SideRail";
import { WindowHost } from "@/components/Windows/WindowHost";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";

/**
 * App shell. Layout mirrors the reference app (PLAN.md §6): toolbar on top,
 * a left side-rail of toggleable floating panels, canvas fills the rest.
 * Undo/redo, duplicate, delete, ⌘G and arrow-nudge are wired here; marquee
 * select and the rest of the selection UX land in Phase 3.
 */
export default function App() {
  useKeyboardShortcuts();

  return (
    <div className="app">
      <Toolbar />
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
