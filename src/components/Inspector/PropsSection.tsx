/**
 * ControlSpec-driven props editor — the generic renderer that turns a kind's
 * declarative `controls` array into real UI (PLAN.md §11 Phase 3, ported from
 * the reference app's Inspector/DataSection.tsx).
 *
 * Registering a component with a `controls` array is all it takes to get a
 * full inspector: no per-kind UI code anywhere. Controls honor `group`
 * (rendered under a sub-heading) and `visibleWhen` (conditional on the node's
 * current props), and everything writes through `patchProps` so undo/redo and
 * the future AI executor see identical edits.
 */
import { useEffect, useRef, useState } from "react";
import type { ComponentNode } from "@/components-model/types";
import { componentDef } from "@/components-model/registry";
import { controlKey, type ControlSpec } from "@/components-model/controlSpec";
import {
  channelFor,
  childIndexPath,
  isPromoted,
  keyFor,
  toExposedControl,
} from "@/components-model/exposed";
import { findNode } from "@/lib/nodeTree";
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

function LineListInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState(value.join("\n"));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value.join("\n"));
  }, [value]);

  const commit = (text: string) => {
    setDraft(text);
    onChange(text.split("\n"));
  };

  return (
    <textarea
      className="insp-lines"
      value={draft}
      rows={Math.min(8, Math.max(2, draft.split("\n").length))}
      spellCheck={false}
      onFocus={() => (focused.current = true)}
      onBlur={() => (focused.current = false)}
      onChange={(e) => commit(e.target.value)}
    />
  );
}

export function PropsSection({ node }: { node: ComponentNode }) {
  const patchProps = useDarklighter((s) => s.patchProps);
  const patchStyle = useDarklighter((s) => s.patchStyle);
  const promoteControl = useDarklighter((s) => s.promoteControl);
  const nodes = useDarklighter((s) => s.nodes);
  const selection = useDarklighter((s) => s.selection);

  const def = componentDef(node.kind);
  const props = node.props as Record<string, unknown>;
  const set = (key: string, value: unknown) => patchProps(node.id, { [key]: value });

  // Promoting lifts this control onto the assembly the part belongs to — the
  // root of the current selection path, which is the thing that gets saved to
  // the library. A part selected on its own has no assembly, so no button.
  const hostId = selection.length > 1 ? selection[0] : null;
  const host = hostId ? (findNode(nodes, hostId)?.node ?? null) : null;
  const hostPath = host ? childIndexPath(host, node.id) : null;

  const Promote = ({ c }: { c: ControlSpec }) => {
    if (!host || !hostPath) return null;
    const channel = channelFor(c);
    const key = keyFor(c);
    const control = toExposedControl(c);
    if (!control) return null;
    const already = isPromoted(host, hostPath, channel, key);
    return (
      <button
        type="button"
        className={`promote${already ? " on" : ""}`}
        disabled={already}
        title={
          already
            ? `Already a control on “${host.name}”`
            : `Promote to a top-level control on “${host.name}” — so this assembly can be reused with this knob exposed`
        }
        onClick={() =>
          promoteControl(host.id, node.id, {
            label: c.label,
            channel,
            key,
            control,
            hint: c.hint,
          })
        }
      >
        ⤴
      </button>
    );
  };

  const renderField = (c: ControlSpec) => {
    const key = controlKey(c);
    switch (c.kind) {
      case "number": {
        const value = Number(props[c.key] ?? 0);
        // Slider for bounded ranges, with a number box beside it for precision —
        // the reference app's dual binding, which is what makes tweaking feel fast.
        return (
          <Field key={key} label={c.label} hint={c.hint}>
            <div className="insp-num">
              <Slider value={value} min={c.min} max={c.max} step={c.step ?? 1} onChange={(v) => set(c.key, v)} />
              <NumberInput value={value} min={c.min} max={c.max} step={c.step ?? 1} onChange={(v) => set(c.key, v)} />
            </div>
          </Field>
        );
      }
      case "text":
        return (
          <Field key={key} label={c.label} hint={c.hint}>
            <TextInput value={String(props[c.key] ?? "")} onChange={(v) => set(c.key, v)} />
          </Field>
        );
      case "toggle":
        return (
          <div key={key} className="insp-toggle-row">
            <Toggle checked={Boolean(props[c.key])} onChange={(v) => set(c.key, v)} label={c.label} />
          </div>
        );
      case "color":
        return (
          <Field key={key} label={c.label} hint={c.hint}>
            <ColorInput value={String(props[c.key] ?? "#000000")} onChange={(v) => set(c.key, v)} />
          </Field>
        );
      case "select":
        return (
          <Field key={key} label={c.label} hint={c.hint}>
            <SelectInput
              value={String(props[c.key] ?? "")}
              options={c.options}
              onChange={(v) => set(c.key, v)}
            />
          </Field>
        );
      case "labellist":
        return (
          <Field key={key} label={c.label} hint={c.hint}>
            <LineListInput
              value={Array.isArray(props[c.key]) ? (props[c.key] as string[]) : []}
              onChange={(v) => set(c.key, v)}
            />
          </Field>
        );
      case "colorway":
        // Colorway lives on style, not props — it's a node-wide skin.
        return (
          <Field key={key} label={c.label} hint={c.hint}>
            <SelectInput
              value={node.style.colorway}
              options={COLORWAY_OPTIONS}
              onChange={(v) => patchStyle(node.id, { colorway: v as typeof node.style.colorway })}
            />
          </Field>
        );
      case "image":
        return (
          <Field key={key} label={c.label} hint={c.hint}>
            <TextInput value={String(props[c.key] ?? "")} onChange={(v) => set(c.key, v)} />
          </Field>
        );
      default:
        return null;
    }
  };

  const renderControl = (c: ControlSpec) => {
    const field = renderField(c);
    if (!field) return null;
    if (!host || !hostPath) return field;
    return (
      <div key={controlKey(c)} className="ctl-row">
        <div className="ctl-body">{field}</div>
        <Promote c={c} />
      </div>
    );
  };

  const visible = def.controls.filter((c) => !c.visibleWhen || c.visibleWhen(props, node));
  if (visible.length === 0) {
    return <p className="insp-empty-note">This component has no adjustable properties.</p>;
  }

  const ungrouped = visible.filter((c) => !c.group);
  const groups = new Map<string, ControlSpec[]>();
  for (const c of visible) {
    if (!c.group) continue;
    const list = groups.get(c.group) ?? [];
    list.push(c);
    groups.set(c.group, list);
  }

  return (
    <>
      {ungrouped.map(renderControl)}
      {[...groups.entries()].map(([label, controls]) => (
        <div key={label} className="insp-group">
          <p className="insp-group-head">{label}</p>
          {controls.map(renderControl)}
        </div>
      ))}
    </>
  );
}
