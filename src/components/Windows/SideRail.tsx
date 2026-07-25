import "./SideRail.css";
import { useDarklighter, type WindowId } from "@/state/store";

interface RailItem {
  id: WindowId;
  label: string;
  icon: JSX.Element;
}

const ICON = {
  library: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </svg>
  ),
  hierarchy: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
      <path d="M12 3 21 8l-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" opacity="0.5" />
    </svg>
  ),
  inspector: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M19 18h1" />
      <circle cx="16" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="16.5" cy="18" r="2" />
    </svg>
  ),
  assistant: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a7 7 0 0 0-4 12.7V19a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.3A7 7 0 0 0 12 3Z" />
      <path d="M9 22h6" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  ),
};

const ITEMS: RailItem[] = [
  { id: "library", label: "Library", icon: ICON.library },
  { id: "hierarchy", label: "Hierarchy", icon: ICON.hierarchy },
  { id: "inspector", label: "Inspector", icon: ICON.inspector },
  { id: "assistant", label: "Assistant", icon: ICON.assistant },
  { id: "history", label: "History", icon: ICON.history },
];

/**
 * Adapted from the reference app's SideRail (PLAN.md §4 "PORT") — same
 * toggle-a-floating-panel pattern, Darklighter's panel set (§6).
 */
export function SideRail() {
  const windows = useDarklighter((s) => s.windows);
  const toggle = useDarklighter((s) => s.toggleWindow);

  return (
    <div className="side-rail">
      {ITEMS.map((it) => (
        <button
          key={it.id}
          className={`rail-btn${windows[it.id].open ? " active" : ""}`}
          title={it.label}
          aria-label={it.label}
          aria-pressed={windows[it.id].open}
          onClick={() => toggle(it.id)}
        >
          {it.icon}
          <span className="rail-tip">{it.label}</span>
        </button>
      ))}
    </div>
  );
}
