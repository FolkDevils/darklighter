/**
 * The promoted knobs of an assembly (components-model/exposed.ts) — rendered
 * exactly like a registered kind's own controls, because to the person using
 * it there is no difference. That's the point: a saved assembly with promoted
 * controls IS a component, authored without code.
 */
import type { ComponentNode } from "@/components-model/types";
import {
  exposedParams,
  readExposed,
  resolveTarget,
  targetPathIds,
  type ExposedParam,
} from "@/components-model/exposed";
import { useDarklighter } from "@/state/store";
import {
  ColorInput,
  Field,
  NumberInput,
  SelectInput,
  Slider,
  TextInput,
  Toggle,
} from "@/components/common/fields";

const COLORWAY_OPTIONS = [
  { value: "alert", label: "Alert" },
  { value: "chrome", label: "Chrome" },
  { value: "custom", label: "Custom" },
];

export function ExposedSection({ node }: { node: ComponentNode }) {
  const setExposedValue = useDarklighter((s) => s.setExposedValue);
  const patchExposed = useDarklighter((s) => s.patchExposed);
  const removeExposed = useDarklighter((s) => s.removeExposed);
  const select = useDarklighter((s) => s.select);
  const selection = useDarklighter((s) => s.selection);

  const params = exposedParams(node);
  if (params.length === 0) return null;

  const control = (p: ExposedParam) => {
    const value = readExposed(node, p);
    const set = (v: unknown) => setExposedValue(node.id, p.id, v);

    switch (p.control.kind) {
      case "number":
        return (
          <div className="insp-num">
            <Slider
              value={Number(value ?? 0)}
              min={p.control.min}
              max={p.control.max}
              step={p.control.step ?? 1}
              onChange={set}
            />
            <NumberInput
              value={Number(value ?? 0)}
              min={p.control.min}
              max={p.control.max}
              step={p.control.step ?? 1}
              onChange={set}
            />
          </div>
        );
      case "toggle":
        return <Toggle checked={Boolean(value)} onChange={set} label="" />;
      case "select":
        return <SelectInput value={String(value ?? "")} options={p.control.options} onChange={set} />;
      case "colorway":
        return <SelectInput value={String(value ?? "alert")} options={COLORWAY_OPTIONS} onChange={set} />;
      case "color":
        return <ColorInput value={String(value ?? "#000000")} onChange={set} />;
      case "labellist":
        return (
          <textarea
            className="insp-lines"
            value={Array.isArray(value) ? (value as string[]).join("\n") : ""}
            rows={3}
            spellCheck={false}
            onChange={(e) => set(e.target.value.split("\n"))}
          />
        );
      default:
        return <TextInput value={String(value ?? "")} onChange={set} />;
    }
  };

  return (
    <>
      {params.map((p) => {
        const target = resolveTarget(node, p.path);
        // A knob whose target no longer exists (a part was deleted) says so
        // rather than silently doing nothing.
        const orphan = !target;
        return (
          <div key={p.id} className={`exposed-row${orphan ? " orphan" : ""}`}>
            <Field
              label={p.label}
              hint={orphan ? "This part no longer exists — remove the control." : (p.hint ?? `Drives ${target?.name}`)}
            >
              {orphan ? <p className="insp-empty-note">Target missing</p> : control(p)}
            </Field>
            <div className="exposed-tools">
              <button
                type="button"
                className="mini"
                title="Rename this control"
                onClick={() => {
                  const label = window.prompt("Control name", p.label);
                  if (label) patchExposed(node.id, p.id, { label });
                }}
              >
                ✎
              </button>
              {target && (
                <button
                  type="button"
                  className="mini"
                  title={`Select ${target.name}`}
                  onClick={() =>
                    select([
                      ...selection.slice(0, selection.indexOf(node.id) + 1),
                      ...targetPathIds(node, p.path),
                    ])
                  }
                >
                  →
                </button>
              )}
              <button
                type="button"
                className="mini"
                title="Remove this control (the underlying part keeps its value)"
                onClick={() => removeExposed(node.id, p.id)}
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
