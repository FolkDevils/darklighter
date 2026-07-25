import "./HierarchyPanel.css";
import type { AnimationConfig, ComponentNode } from "@/components-model/types";
import { componentDef } from "@/components-model/registry";
import { resolveAnimation } from "@/components-model/animResolve";
import { findNode } from "@/lib/nodeTree";
import { useDarklighter } from "@/state/store";

function Row({
  node,
  depth,
  path,
  slotLabel,
  inherited,
}: {
  node: ComponentNode;
  depth: number;
  path: string[];
  slotLabel?: string;
  /** Timing offered by the nearest cascading ancestor — same value the renderer sees. */
  inherited: AnimationConfig | null;
}) {
  const select = useDarklighter((s) => s.select);
  const setHidden = useDarklighter((s) => s.setHidden);
  const setLocked = useDarklighter((s) => s.setLocked);
  const selection = useDarklighter((s) => s.selection);
  const isSelected = selection[selection.length - 1] === node.id;
  const onPath = !isSelected && selection.includes(node.id);
  const childPath = [...path, node.id];
  const slotEntries = node.slots ? Object.entries(node.slots).filter(([, v]) => v) : [];

  // Resolved exactly the way RenderNode resolves it, so the badge can't claim
  // motion that isn't happening (playing=true here: this reports the document,
  // not the transport).
  const { running, passDown } = resolveAnimation(node.animation, inherited, true);
  const inheritsTiming = node.animation.inherit && inherited !== null;

  return (
    <>
      <div
        className={`hierarchy-row${isSelected ? " selected" : ""}${onPath ? " on-path" : ""}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => select(childPath)}
      >
        {slotLabel && <span className="hierarchy-slot" title="Slot content">{slotLabel}</span>}
        <span className="hierarchy-name">{node.name}</span>
        <span className="hierarchy-kind">{node.kind}</span>
        {running && (
          <span
            className={`hierarchy-anim${inheritsTiming ? " inherited" : ""}`}
            title={
              inheritsTiming
                ? `Animates on the parent's timing: ${node.animation.behavior ?? "default"}`
                : `Animates on its own timing: ${node.animation.behavior ?? "default"}`
            }
          >
            {inheritsTiming ? "▹" : "▸"}
          </span>
        )}
        <button
          type="button"
          className="hierarchy-btn"
          title={node.hidden ? "Show" : "Hide"}
          onClick={(e) => {
            e.stopPropagation();
            setHidden(node.id, !node.hidden);
          }}
        >
          {node.hidden ? "hidden" : "shown"}
        </button>
        <button
          type="button"
          className="hierarchy-btn"
          title={node.locked ? "Unlock" : "Lock"}
          onClick={(e) => {
            e.stopPropagation();
            setLocked(node.id, !node.locked);
          }}
        >
          {node.locked ? "locked" : "unlocked"}
        </button>
      </div>
      {node.children.map((c) => (
        <Row key={c.id} node={c} depth={depth + 1} path={childPath} inherited={passDown} />
      ))}
      {slotEntries.map(([name, v]) => (
        <Row
          key={name}
          node={v as ComponentNode}
          depth={depth + 1}
          path={childPath}
          slotLabel={name}
          inherited={passDown}
        />
      ))}
    </>
  );
}

/**
 * The node tree panel (PLAN.md §6): read/select/visibility/lock plus the
 * structural actions that belong to a selection rather than to the gallery —
 * grouping is something you DO to nodes, not an object you place.
 * Reorder/reparent-by-drag is still Phase 3.
 */
export function HierarchyPanel() {
  const nodes = useDarklighter((s) => s.nodes);
  const selection = useDarklighter((s) => s.selection);
  const groupSelection = useDarklighter((s) => s.groupSelection);
  const ungroupSelection = useDarklighter((s) => s.ungroupSelection);
  const duplicateNode = useDarklighter((s) => s.duplicateNode);
  const removeNode = useDarklighter((s) => s.removeNode);
  const reorder = useDarklighter((s) => s.reorder);

  const selectedId = selection[selection.length - 1];
  const selected = selectedId ? findNode(nodes, selectedId)?.node : undefined;
  const canUngroup = Boolean(
    selected && componentDef(selected.kind).acceptsChildren && selected.children.length > 0,
  );

  if (nodes.length === 0) {
    return <p className="hierarchy-empty">No components yet — add one from the Library panel.</p>;
  }

  return (
    <div className="hierarchy-panel">
      <div className="hierarchy-actions">
        <button type="button" className="btn" disabled={!selected} title="Group (⌘G)" onClick={groupSelection}>
          Group
        </button>
        <button type="button" className="btn" disabled={!canUngroup} title="Ungroup" onClick={ungroupSelection}>
          Ungroup
        </button>
        <button
          type="button"
          className="btn"
          disabled={!selected}
          title="Duplicate (⌘D)"
          onClick={() => selectedId && duplicateNode(selectedId)}
        >
          Duplicate
        </button>
        <button
          type="button"
          className="btn"
          disabled={!selected}
          title="Bring forward"
          onClick={() => selectedId && reorder(selectedId, 1)}
        >
          ↑
        </button>
        <button
          type="button"
          className="btn"
          disabled={!selected}
          title="Send backward"
          onClick={() => selectedId && reorder(selectedId, -1)}
        >
          ↓
        </button>
        <button
          type="button"
          className="btn danger"
          disabled={!selected}
          title="Delete (⌫)"
          onClick={() => selectedId && removeNode(selectedId)}
        >
          Delete
        </button>
      </div>
      {nodes.map((n) => (
        <Row key={n.id} node={n} depth={0} path={[]} inherited={null} />
      ))}
      <p className="hierarchy-hint">
        Double-click on the canvas to get inside a scene, then drag the part itself. ↩ steps in, esc
        steps out. ⌘G groups, ⇧⌘G ungroups. Space plays.
      </p>
    </div>
  );
}
