/**
 * Node-wide styling: colorway skin, stroke weight, opacity, and per-role color
 * overrides (PLAN.md §3 colorways / §6 inspector spec).
 *
 * Overrides are the escape hatch that keeps invariant #2 intact — components
 * only ever ask for semantic roles, so recoloring one node means remapping its
 * roles here rather than hard-coding hexes into geometry.
 */
import type { ColorRole, ComponentNode, ColorwayId } from "@/components-model/types";
import { useDarklighter } from "@/state/store";
import { resolveColor, surfaceOf } from "@/lib/colorway";
import { COLOR_ROLE_OPTIONS } from "@/components-model/defaults";
import { kindUsage } from "@/components-model/introspect";
import { ColorInput, Field, NumberInput, SelectInput, Slider } from "@/components/common/fields";

const COLORWAY_OPTIONS: { value: ColorwayId; label: string }[] = [
  { value: "alert", label: "Alert — Red Alert skin" },
  { value: "chrome", label: "Chrome — dark maroon HUD" },
  { value: "custom", label: "Custom — overrides only" },
];

export function StyleSection({ node }: { node: ComponentNode }) {
  const patchStyle = useDarklighter((s) => s.patchStyle);
  const surface = useDarklighter((s) => surfaceOf(s.background.color));
  const { colorway, strokeScale, opacity, overrides } = node.style;
  // Only the roles this kind actually paints with, so the panel isn't seven
  // swatches deep on a component that draws in one color.
  const usage = kindUsage(node.kind);
  const roleOptions = COLOR_ROLE_OPTIONS.filter(
    (o) => usage.roles.includes(o.value) || Boolean(overrides?.[o.value]),
  );

  const setOverride = (role: ColorRole, hex: string | null) => {
    const next = { ...(overrides ?? {}) };
    if (hex === null) delete next[role];
    else next[role] = hex;
    patchStyle(node.id, { overrides: next });
  };

  // A container draws nothing itself and every part inside resolves its own
  // colors, so its colorway/stroke/role controls would do nothing. Opacity is
  // the exception: it applies to the whole group.
  if (!usage.paintsOwnArt) {
    return (
      <>
        <Field label="Opacity" hint="Fades the whole group, parts included.">
          <div className="insp-num">
            <Slider value={opacity} min={0} max={1} step={0.02} onChange={(v) => patchStyle(node.id, { opacity: v })} />
            <NumberInput value={opacity} min={0} max={1} step={0.05} onChange={(v) => patchStyle(node.id, { opacity: v })} />
          </div>
        </Field>
        <p className="insp-empty-note">
          Colors live on the parts inside — select one to change what it&apos;s painted with.
        </p>
      </>
    );
  }

  return (
    <>
      <Field label="Colorway">
        <SelectInput value={colorway} options={COLORWAY_OPTIONS} onChange={(v) => patchStyle(node.id, { colorway: v })} />
      </Field>

      {usage.usesStroke && (
        <Field label="Stroke weight" hint="Multiplies this kind's default stroke widths.">
          <div className="insp-num">
            <Slider value={strokeScale} min={0.25} max={3} step={0.05} onChange={(v) => patchStyle(node.id, { strokeScale: v })} />
            <NumberInput value={strokeScale} min={0.05} max={8} step={0.05} onChange={(v) => patchStyle(node.id, { strokeScale: v })} />
          </div>
        </Field>
      )}

      <Field label="Opacity">
        <div className="insp-num">
          <Slider value={opacity} min={0} max={1} step={0.02} onChange={(v) => patchStyle(node.id, { opacity: v })} />
          <NumberInput value={opacity} min={0} max={1} step={0.05} onChange={(v) => patchStyle(node.id, { opacity: v })} />
        </div>
      </Field>

      <div className="insp-group">
        <p className="insp-group-head">Colors used here</p>
        {surface === "dark" && (
          <p className="insp-note">
            The canvas is dark, so <strong>ink</strong> and <strong>field</strong> are showing
            reversed. Setting either one pins it and stops it reversing.
          </p>
        )}
        {roleOptions.map(({ value: role, label }) => {
          const overridden = Boolean(overrides?.[role]);
          return (
            <Field key={role} label={label}>
              <div className="insp-role-row">
                {/* Shows what the canvas is actually painting, reversal included. */}
                <ColorInput value={resolveColor(node.style, role, surface)} onChange={(hex) => setOverride(role, hex)} />
                {overridden && (
                  <button type="button" className="btn tiny" title="Back to the colorway default" onClick={() => setOverride(role, null)}>
                    Reset
                  </button>
                )}
              </div>
            </Field>
          );
        })}
      </div>
    </>
  );
}
