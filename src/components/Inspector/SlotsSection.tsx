/**
 * Slot editor (PLAN.md §5.1 "constrained replacement points"). Slots are the
 * mechanism that makes the P mark extensible rather than fixed: the bowl
 * accepts any component tagged `radar`, so the same logo can hold the
 * approved reticle, a full radar scope, or a polar grid — and animate with
 * whichever it holds.
 *
 * Candidates come from the registry by tag, so a newly registered radar
 * component shows up here automatically.
 */
import type { ComponentKind, ComponentNode } from "@/components-model/types";
import { componentDef, kindsForSlot } from "@/components-model/registry";
import { findNode } from "@/lib/nodeTree";
import { useDarklighter } from "@/state/store";
import { Field, SelectInput } from "@/components/common/fields";

export function SlotsSection({ node }: { node: ComponentNode }) {
  const nodes = useDarklighter((s) => s.nodes);
  const replaceSlot = useDarklighter((s) => s.replaceSlot);
  const select = useDarklighter((s) => s.select);
  const def = componentDef(node.kind);
  // Read the host's real path out of the tree rather than trusting the current
  // selection to end at the host — it doesn't when the user arrived from the
  // hierarchy panel.
  const hostPath = findNode(nodes, node.id)?.path ?? [node.id];
  const slots = def.slots ?? [];

  if (slots.length === 0) return null;

  return (
    <>
      {slots.map((slot) => {
        const current = node.slots?.[slot.name] ?? null;
        const options = [
          { value: "", label: "— empty —" },
          ...kindsForSlot(slot.accepts).map((d) => ({ value: d.kind, label: d.label })),
        ];
        return (
          <Field
            key={slot.name}
            label={slot.name}
            hint={`${slot.mode === "knockout" ? "Punched through the host" : "Drawn over the host"} · accepts ${slot.accepts.join(", ")}`}
          >
            <div className="insp-num">
              <SelectInput
                value={current?.kind ?? ""}
                options={options}
                onChange={(v) => replaceSlot(node.id, slot.name, v === "" ? null : (v as ComponentKind))}
              />
              <button
                type="button"
                className="btn"
                disabled={!current}
                title="Select the slot content so you can edit its own props and timing"
                onClick={() => current && select([...hostPath, current.id])}
              >
                Edit
              </button>
            </div>
          </Field>
        );
      })}
    </>
  );
}
