/**
 * Where you are in the tree. Editing a scene means editing its parts, and
 * without this the inspector is a wall of controls with no indication of which
 * of five near-identical rings you're actually changing.
 *
 * Each crumb selects that level, which is also the quickest way back out of a
 * group (Escape does the same thing).
 */
import type { ComponentNode } from "@/components-model/types";
import { useDarklighter } from "@/state/store";

export function Breadcrumb({ chain }: { chain: ComponentNode[] }) {
  const select = useDarklighter((s) => s.select);
  if (chain.length < 2) return null;

  return (
    <nav className="insp-crumbs" aria-label="Selected layer">
      {chain.map((n, i) => {
        const last = i === chain.length - 1;
        return (
          <span key={n.id}>
            {i > 0 && <span className="insp-crumb-sep" aria-hidden>›</span>}
            <button
              type="button"
              className={`insp-crumb${last ? " current" : ""}`}
              disabled={last}
              title={last ? undefined : `Select ${n.name}`}
              onClick={() => select(chain.slice(0, i + 1).map((c) => c.id))}
            >
              {n.name}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
