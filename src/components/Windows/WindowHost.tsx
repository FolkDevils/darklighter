import "./WindowHost.css";
import type { ReactNode } from "react";
import { useDarklighter, type WindowId } from "@/state/store";
import { useElementSize } from "@/lib/useElementSize";
import { FloatingWindow } from "./FloatingWindow";
import { PhasePlaceholder } from "./PhasePlaceholder";
import { LibraryPanel } from "@/components/Library/LibraryPanel";
import { HierarchyPanel } from "@/components/Hierarchy/HierarchyPanel";
import { InspectorPanel } from "@/components/Inspector/InspectorPanel";

/**
 * Adapted from the reference app's WindowHost (PLAN.md §4 "PORT"). Panel
 * bodies are placeholders until their phase lands — swap each `body` for the
 * real component as it's built (see PhasePlaceholder.tsx). Library/
 * Hierarchy/Inspector land in Phase 1 (this pass); Assistant/History stay
 * placeholders until Phase 7/5.
 */
interface WinDef {
  id: WindowId;
  title: string;
  width: number;
  body: ReactNode;
  anchor: (w: number, h: number, width: number) => { x: number; y: number };
}

const WINDOWS: WinDef[] = [
  {
    id: "library",
    title: "Library",
    width: 280,
    body: <LibraryPanel />,
    anchor: () => ({ x: 16, y: 16 }),
  },
  {
    id: "hierarchy",
    title: "Hierarchy",
    width: 260,
    body: <HierarchyPanel />,
    anchor: () => ({ x: 16, y: 340 }),
  },
  {
    id: "inspector",
    title: "Inspector",
    width: 324,
    body: <InspectorPanel />,
    anchor: (w, _h, width) => ({ x: Math.max(16, w - width - 16), y: 16 }),
  },
  {
    id: "assistant",
    title: "Assistant",
    width: 360,
    body: (
      <PhasePlaceholder
        phase="Phase 7"
        note="AI creative partner — manifest, patch ops, freedom modes, recipes."
      />
    ),
    anchor: (w, h, width) => ({ x: Math.max(16, w - width - 16), y: Math.max(16, h - 420) }),
  },
  {
    id: "history",
    title: "History",
    width: 280,
    body: (
      <PhasePlaceholder
        phase="Phase 5"
        note="Snapshot timeline — branch, favorite/reject, notes, compare, restore."
      />
    ),
    anchor: (_w, h) => ({ x: 16, y: Math.max(16, h - 320) }),
  },
];

export function WindowHost() {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const windows = useDarklighter((s) => s.windows);

  return (
    <div className="window-host" ref={ref}>
      {WINDOWS.map((def) =>
        windows[def.id].open && size.width > 0 ? (
          <FloatingWindow
            key={def.id}
            id={def.id}
            title={def.title}
            width={def.width}
            defaultPos={def.anchor(size.width, size.height, def.width)}
            bounds={{ w: size.width, h: size.height }}
          >
            {def.body}
          </FloatingWindow>
        ) : null,
      )}
    </div>
  );
}
