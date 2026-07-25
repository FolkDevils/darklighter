/**
 * Temporary panel body shown until a later phase builds the real one.
 * Replace the corresponding usage in WindowHost.tsx as each panel lands
 * (Library/Hierarchy/Inspector → Phase 1–3, Assistant → Phase 7, History →
 * Phase 5) — do not delete this component until all five are replaced.
 */
export function PhasePlaceholder({ phase, note }: { phase: string; note: string }) {
  return (
    <div className="phase-placeholder">
      <p className="phase-placeholder-phase">{phase}</p>
      <p className="phase-placeholder-note">{note}</p>
    </div>
  );
}
