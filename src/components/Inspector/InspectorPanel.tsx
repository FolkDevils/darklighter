import "./InspectorPanel.css";
import { useEffect, useRef, useState } from "react";
import { useDarklighter } from "@/state/store";
import { findNode, nodeChain } from "@/lib/nodeTree";
import { componentDef } from "@/components-model/registry";
import { kindUsage } from "@/components-model/introspect";
import { Field, TextInput, Toggle } from "@/components/common/fields";
import { Section } from "./Section";
import { Breadcrumb } from "./Breadcrumb";
import { PropsSection } from "./PropsSection";
import { GeometrySection } from "./GeometrySection";
import { StyleSection } from "./StyleSection";
import { AnimationSection } from "./AnimationSection";
import { SlotsSection } from "./SlotsSection";
import { ExportActions } from "@/components/Export/ExportActions";

/**
 * Properties panel for the selected node (PLAN.md §6). Every section here is
 * generic: `PropsSection` builds itself from the kind's ControlSpec array, so
 * registering a component is all it takes to get a full editing UI — there is
 * no per-kind inspector code anywhere in the app.
 *
 * What the panel shows is decided per node, not per app: a section that has
 * nothing to say for this kind (no props, no slots, no motion, no seed) is not
 * rendered at all. A control that does nothing is worse than a missing one,
 * and a panel that looks identical on every layer hides which layer you're on.
 */
export function InspectorPanel() {
  const nodes = useDarklighter((s) => s.nodes);
  const selection = useDarklighter((s) => s.selection);
  const patchProps = useDarklighter((s) => s.patchProps);
  const setName = useDarklighter((s) => s.setName);
  const setLocked = useDarklighter((s) => s.setLocked);
  const setHidden = useDarklighter((s) => s.setHidden);
  const setSeed = useDarklighter((s) => s.setSeed);
  const removeNode = useDarklighter((s) => s.removeNode);
  const duplicateNode = useDarklighter((s) => s.duplicateNode);
  const select = useDarklighter((s) => s.select);

  const selectedId = selection[selection.length - 1];
  const node = selectedId ? (findNode(nodes, selectedId)?.node ?? null) : null;

  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const jsonRef = useRef<HTMLTextAreaElement>(null);

  // Re-sync when the selection changes or props change from elsewhere
  // (a control, undo/redo, the AI executor later) — but never while the
  // textarea has focus, so a patch can't clobber what's being typed.
  useEffect(() => {
    if (document.activeElement === jsonRef.current) return;
    setJsonDraft(node ? JSON.stringify(node.props, null, 2) : "");
    setJsonError(null);
  }, [node?.id, node?.props]);

  if (!node) {
    return (
      <div className="inspector-panel">
        <p className="inspector-empty">
          Select something on the canvas to edit it. Double-click to get inside a scene and edit one
          part; Escape steps back out.
        </p>
      </div>
    );
  }

  const def = componentDef(node.kind);
  const usage = kindUsage(node.kind);
  const chain = nodeChain(nodes, node.id);
  const partCount = node.children.length;
  // Container timing still drives the parts inside, so a kind with no motion
  // of its own keeps the animation section as long as it has children.
  const showAnimation = def.animBehaviors.length > 0 || partCount > 0;

  const applyJson = () => {
    try {
      patchProps(node.id, JSON.parse(jsonDraft) as Record<string, unknown>);
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : "Invalid JSON");
    }
  };

  return (
    <div className="inspector-panel">
      <Breadcrumb chain={chain} />

      <div className="inspector-head">
        <TextInput value={node.name} onChange={(v) => setName(node.id, v)} />
        <p className="inspector-kind" title={def.describe}>
          {def.label}
          {partCount > 0 && (
            <button
              type="button"
              className="insp-parts-link"
              title="Select the first part inside (↩)"
              onClick={() => select([...chain.map((c) => c.id), node.children[0].id])}
            >
              {partCount} parts
            </button>
          )}
        </p>
      </div>

      <div className="inspector-row-actions">
        <button type="button" className="btn" onClick={() => duplicateNode(node.id)}>
          Duplicate
        </button>
        <button type="button" className="btn danger" onClick={() => removeNode(node.id)}>
          Delete
        </button>
      </div>
      <div className="insp-toggle-row">
        <Toggle checked={node.locked} onChange={(v) => setLocked(node.id, v)} label="Lock" />
        <Toggle checked={node.hidden} onChange={(v) => setHidden(node.id, v)} label="Hide" />
      </div>

      {def.controls.length > 0 && (
        <Section title={def.label} count={def.controls.length}>
          <PropsSection node={node} />
        </Section>
      )}

      {(def.slots?.length ?? 0) > 0 && (
        <Section title="Slots" count={def.slots!.length}>
          <SlotsSection node={node} />
        </Section>
      )}

      <Section title="Geometry" badge={`${Math.round(node.layout.w)}×${Math.round(node.layout.h)}`}>
        <GeometrySection node={node} />
      </Section>

      <Section title="Style" badge={usage.paintsOwnArt ? node.style.colorway : "group"}>
        <StyleSection node={node} />
      </Section>

      {showAnimation && (
        <Section
          title="Animation"
          badge={
            node.animation.enabled
              ? (node.animation.behavior ?? def.animBehaviors[0] ?? "cascade")
              : "off"
          }
        >
          <AnimationSection node={node} />
        </Section>
      )}

      <Section title="Export" defaultOpen={false} badge={partCount > 0 ? "group" : "part"}>
        <ExportActions target={{ scope: "node", node }} />
      </Section>

      {(usage.usesSeed || def.controls.length > 0) && (
        <Section title="Advanced" defaultOpen={false}>
          {usage.usesSeed && (
            <Field label="Seed" hint="Drives every random placement in this node — same seed, same render.">
              <div className="insp-num">
                <input
                  className="input"
                  type="number"
                  value={node.seed}
                  onChange={(e) => setSeed(node.id, Number(e.target.value))}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => setSeed(node.id, Math.floor(Math.random() * 1_000_000))}
                >
                  Shuffle
                </button>
              </div>
            </Field>
          )}

          {def.controls.length > 0 && (
            <>
              <p className="insp-group-head">Props (raw JSON)</p>
              <textarea
                ref={jsonRef}
                className="inspector-json"
                value={jsonDraft}
                onChange={(e) => setJsonDraft(e.target.value)}
                rows={10}
                spellCheck={false}
              />
              {jsonError && <p className="inspector-json-error">{jsonError}</p>}
              <button type="button" className="btn primary inspector-apply" onClick={applyJson}>
                Apply props
              </button>
            </>
          )}
        </Section>
      )}
    </div>
  );
}
