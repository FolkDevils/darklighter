/**
 * The n-up variation picker (PLAN.md §8, docs/RECOMMENDATION.md §7 step 4).
 *
 * The engine is fully parametric, so "give me twelve of these" costs nothing
 * but a grid — and it is the difference between a tool you edit with and one
 * you generate with. Everything here is deterministic (see lib/variations.ts):
 * the same base, axes and batch always produce the same twelve.
 */
import "./VariationsPanel.css";
import { useMemo, useState } from "react";
import { useDarklighter } from "@/state/store";
import { findNode } from "@/lib/nodeTree";
import { AXIS_LABEL, generateVariations, type VariationAxis } from "@/lib/variations";
import { Thumbnail } from "@/components/Library/Thumbnail";

const AXES: VariationAxis[] = ["seed", "colorway", "density", "speed"];
const COUNTS = [6, 12, 24];

export function VariationsPanel() {
  const nodes = useDarklighter((s) => s.nodes);
  const selection = useDarklighter((s) => s.selection);
  const applyVariation = useDarklighter((s) => s.applyVariation);
  const saveToLibrary = useDarklighter((s) => s.saveToLibrary);

  const [axes, setAxes] = useState<VariationAxis[]>(["seed", "colorway"]);
  const [count, setCount] = useState(12);
  const [batch, setBatch] = useState(0);

  const selectedId = selection[selection.length - 1];
  const node = selectedId ? (findNode(nodes, selectedId)?.node ?? null) : null;

  const variants = useMemo(
    () => (node ? generateVariations(node, count, axes, batch * count) : []),
    [node, count, axes, batch],
  );

  if (!node) {
    return (
      <div className="variations">
        <p className="library-empty">
          Select something on the canvas — then generate a grid of alternatives by seed, colorway,
          density and speed.
        </p>
      </div>
    );
  }

  const toggle = (a: VariationAxis) =>
    setAxes((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));

  return (
    <div className="variations">
      <p className="var-target">
        Varying <strong>{node.name}</strong>
      </p>

      <div className="myparts-filters">
        {AXES.map((a) => (
          <button
            key={a}
            type="button"
            className={`chip sm${axes.includes(a) ? " on" : ""}`}
            onClick={() => toggle(a)}
          >
            {AXIS_LABEL[a]}
          </button>
        ))}
      </div>

      <div className="var-row">
        <div className="myparts-filters">
          {COUNTS.map((c) => (
            <button
              key={c}
              type="button"
              className={`chip sm${count === c ? " on" : ""}`}
              onClick={() => setCount(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn ghost"
          title="The next deterministic batch — not a re-roll, batch 2 is always batch 2"
          onClick={() => setBatch((b) => b + 1)}
        >
          More
        </button>
      </div>

      {axes.length === 0 && <p className="library-empty">Pick at least one axis to vary.</p>}

      <div className="library-grid var-grid">
        {variants.map((v, i) => (
          <div key={`${batch}-${i}`} className="library-card entry">
            <button
              type="button"
              className="entry-place"
              title="Apply this variation to the selected node"
              onClick={() => applyVariation(node.id, v)}
            >
              <Thumbnail kind={v.kind} node={v} />
            </button>
            <div className="entry-actions">
              <button
                type="button"
                className="mini"
                title="Apply to the canvas"
                onClick={() => applyVariation(node.id, v)}
              >
                Apply
              </button>
              <button
                type="button"
                className="mini"
                title="Save this one to the library without touching the canvas"
                onClick={() => saveToLibrary({ node: v, name: `${node.name} v${batch * count + i + 1}` })}
              >
                Keep
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
