import "./fields.css";
import { BRAND_SWATCHES } from "@/lib/colorway";

/**
 * Generic inspector field primitives, driven by ControlSpec (Phase 3 wires
 * these to the component registry). Ported from the reference app (src/
 * components/common/fields.tsx, PLAN.md §4 "PORT"), decoupled from Helix's
 * color-board store dependency — Darklighter swatches come straight from
 * the brand token table (src/lib/colorway.ts) since there is no per-project
 * "active board" concept here.
 */
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="field">
      <label title={hint}>
        {label}
        {hint && <span className="field-hint-dot" title={hint} aria-hidden> ⓘ</span>}
      </label>
      {children}
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      className="input"
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
  );
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div className="slider-row">
      <input
        className="slider"
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="slider-val">{Math.round(value * 100) / 100}</span>
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}) {
  return (
    <input
      className="input"
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
    />
  );
}

export function SelectInput<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`toggle ${checked ? "on" : ""}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="knob" />
      <span className="toggle-label">{label}</span>
    </button>
  );
}

export function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="color-field">
      <label className="color-well">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <span style={{ background: value }} />
      </label>
      <input
        className="input mono"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="swatches">
        {BRAND_SWATCHES.map((c) => (
          <button
            key={c}
            className="swatch"
            style={{ background: c }}
            onClick={() => onChange(c)}
            title={c}
          />
        ))}
      </div>
    </div>
  );
}
