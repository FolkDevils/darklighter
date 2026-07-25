/**
 * Generic layout controls every kind gets for free: position, size, rotation
 * and z-order (PLAN.md §6 inspector spec, ported from the reference app's
 * Inspector/GeometrySection.tsx).
 */
import { useState } from "react";
import type { ComponentNode } from "@/components-model/types";
import { useDarklighter } from "@/state/store";
import { findNode } from "@/lib/nodeTree";
import { Field, NumberInput, Slider, Toggle } from "@/components/common/fields";

export function GeometrySection({ node }: { node: ComponentNode }) {
  const nodes = useDarklighter((s) => s.nodes);
  const patchLayout = useDarklighter((s) => s.patchLayout);
  const reorder = useDarklighter((s) => s.reorder);
  const [lockAspect, setLockAspect] = useState(true);
  const { x, y, w, h, rotation } = node.layout;
  // Slot content is positioned by the host's SlotDef frame, and z-order among
  // siblings doesn't exist for it — so don't offer either.
  const inSlot = findNode(nodes, node.id)?.ref.kind === "slot";
  const scalesContents = node.children.length > 0;

  const setWidth = (next: number) => {
    const nextW = Math.max(1, Math.round(next));
    patchLayout(node.id, lockAspect ? { w: nextW, h: Math.max(1, Math.round(nextW * (h / w))) } : { w: nextW });
  };
  const setHeight = (next: number) => {
    const nextH = Math.max(1, Math.round(next));
    patchLayout(node.id, lockAspect ? { h: nextH, w: Math.max(1, Math.round(nextH * (w / h))) } : { h: nextH });
  };

  if (inSlot) {
    return (
      <>
        <p className="insp-empty-note">
          This part fills its slot, so the host sets its position and size. Its own contents are still
          fully editable.
        </p>
        <Field label="Rotation">
          <div className="insp-num">
            <Slider value={rotation} min={-180} max={180} step={1} onChange={(v) => patchLayout(node.id, { rotation: v })} />
            <NumberInput value={rotation} min={-360} max={360} onChange={(v) => patchLayout(node.id, { rotation: v })} />
          </div>
        </Field>
      </>
    );
  }

  return (
    <>
      <div className="insp-grid">
        <Field label="X">
          <NumberInput value={x} onChange={(v) => patchLayout(node.id, { x: Math.round(v) })} />
        </Field>
        <Field label="Y">
          <NumberInput value={y} onChange={(v) => patchLayout(node.id, { y: Math.round(v) })} />
        </Field>
        <Field label="Width">
          <NumberInput value={w} min={1} onChange={setWidth} />
        </Field>
        <Field label="Height">
          <NumberInput value={h} min={1} onChange={setHeight} />
        </Field>
      </div>

      <div className="insp-toggle-row">
        <Toggle checked={lockAspect} onChange={setLockAspect} label="Lock aspect ratio" />
      </div>

      <Field
        label="Size"
        hint={scalesContents ? `Scales the ${node.children.length} parts inside with the box.` : undefined}
      >
        <div className="insp-num">
          <Slider value={w} min={16} max={1200} step={2} onChange={setWidth} />
          <NumberInput value={w} min={1} onChange={setWidth} />
        </div>
      </Field>

      <Field label="Rotation">
        <div className="insp-num">
          <Slider value={rotation} min={-180} max={180} step={1} onChange={(v) => patchLayout(node.id, { rotation: v })} />
          <NumberInput value={rotation} min={-360} max={360} onChange={(v) => patchLayout(node.id, { rotation: v })} />
        </div>
      </Field>

      <div className="insp-row-actions">
        <button type="button" className="btn" onClick={() => reorder(node.id, 1)}>
          Bring forward
        </button>
        <button type="button" className="btn" onClick={() => reorder(node.id, -1)}>
          Send backward
        </button>
      </div>
    </>
  );
}
