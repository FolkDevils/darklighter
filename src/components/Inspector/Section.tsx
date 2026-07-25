import { useState, type ReactNode } from "react";

/**
 * Collapsible inspector section (ported pattern from the reference app's
 * Inspector/Section.tsx — PLAN.md §4 "PORT"). Open state is local: sections
 * are UI chrome, not document state, so it stays out of the store and out of
 * undo history.
 */
export function Section({
  title,
  children,
  defaultOpen = true,
  count,
  badge,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Optional badge, e.g. how many controls a kind exposes. */
  count?: number;
  /**
   * Current state in a few characters ("240×240", "rotate", "alert"), so a
   * collapsed section still says what it's holding.
   */
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`insp-section${open ? " open" : ""}`}>
      <button type="button" className="insp-section-head" onClick={() => setOpen((v) => !v)}>
        <span className="insp-section-chevron" aria-hidden>
          {open ? "−" : "+"}
        </span>
        <span className="insp-section-title">{title}</span>
        {badge && <span className="insp-section-badge">{badge}</span>}
        {count !== undefined && <span className="insp-section-count">{count}</span>}
      </button>
      {open && <div className="insp-section-body">{children}</div>}
    </div>
  );
}
