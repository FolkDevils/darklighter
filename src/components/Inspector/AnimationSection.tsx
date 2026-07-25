/**
 * Per-node animation controls (PLAN.md §7 / §11 Phase 4). Behaviors on offer
 * come from the kind's own `animBehaviors` list, so a component can never be
 * asked to do a motion it doesn't implement.
 *
 * The three states of AnimationConfig are surfaced literally, because a
 * toggle that silently loses to an inherited cascade is worse than no toggle:
 *   Animate off        → this node rests, whatever its parents say
 *   Timing: Inherited  → duration/stagger/easing come from the parent scene
 *   Timing: Own        → this node's numbers, editable below
 */
import type { AnimBehavior, ComponentNode, EasingName } from "@/components-model/types";
import { componentDef } from "@/components-model/registry";
import { useDarklighter } from "@/state/store";
import { cascadeSource } from "@/lib/nodeTree";
import { Field, NumberInput, SelectInput, Slider, Toggle } from "@/components/common/fields";

const EASING_OPTIONS: { value: EasingName; label: string }[] = [
  { value: "linear", label: "Linear" },
  { value: "ease", label: "Ease" },
  { value: "easeIn", label: "Ease in" },
  { value: "easeOut", label: "Ease out" },
  { value: "easeInOut", label: "Ease in-out" },
];

const BEHAVIOR_LABEL: Record<AnimBehavior, string> = {
  drawOn: "Draw on",
  rotate: "Rotate",
  ping: "Ping",
  pulse: "Pulse",
  blink: "Blink",
  orbit: "Orbit",
  pathFollow: "Follow path",
  typewriter: "Typewriter",
  march: "Marching dashes",
  drift: "Drift — wander/swarm",
  fadeIn: "Fade in",
};

export function AnimationSection({ node }: { node: ComponentNode }) {
  const nodes = useDarklighter((s) => s.nodes);
  const patchAnimation = useDarklighter((s) => s.patchAnimation);
  const replay = useDarklighter((s) => s.replay);
  const def = componentDef(node.kind);
  const a = node.animation;

  const source = cascadeSource(nodes, node.id);
  const inheriting = Boolean(source) && a.inherit;
  const timing = inheriting && source ? source.animation : a;
  const hasKids = node.children.length > 0;
  // A pure container (composite, a lockup) has no motion of its own, but its
  // timing still drives everything inside it — so it keeps the timing fields
  // and loses only the behavior picker.
  const movesItself = def.animBehaviors.length > 0;

  const behaviorOptions = movesItself
    ? [
        { value: "", label: `Default — ${BEHAVIOR_LABEL[def.animBehaviors[0]]}` },
        ...def.animBehaviors.map((b) => ({ value: b, label: BEHAVIOR_LABEL[b] })),
      ]
    : [];

  return (
    <>
      <div className="insp-toggle-row">
        <Toggle
          checked={a.enabled}
          onChange={(v) => patchAnimation(node.id, { enabled: v })}
          label={hasKids && a.cascade ? "Animate (this + scene)" : "Animate"}
        />
        <button type="button" className="btn" onClick={replay}>
          Replay
        </button>
      </div>

      {!a.enabled ? (
        <p className="insp-empty-note">
          Resting frame — exactly what a static export shows.
          {source && " Its parent scene can't override this."}
        </p>
      ) : (
        <>
          {movesItself && (
            <Field label="Behavior">
              <SelectInput
                value={a.behavior ?? ""}
                options={behaviorOptions}
                onChange={(v) => patchAnimation(node.id, { behavior: v === "" ? null : (v as AnimBehavior) })}
              />
            </Field>
          )}

          {source && (
            <Field label="Timing" hint={`"${source.name}" cascades its timing to the parts inside it.`}>
              <SelectInput
                value={a.inherit ? "inherit" : "own"}
                options={[
                  { value: "inherit", label: `Inherited — ${source.name}` },
                  { value: "own", label: "Own — set below" },
                ]}
                onChange={(v) => patchAnimation(node.id, { inherit: v === "inherit" })}
              />
            </Field>
          )}

          {inheriting ? (
            <>
              <p className="insp-empty-note">
                {timing.durationMs}ms · {timing.easing} · {timing.loop ? `loops (+${timing.loopDelayMs}ms)` : "one-shot"}
                {timing.staggerMs > 0 && ` · ${timing.staggerMs}ms stagger`}
              </p>
              <Field label="Delay offset" hint="Added on top of the inherited start time.">
                <div className="insp-num">
                  <Slider value={a.delayMs} min={0} max={4000} step={50} onChange={(v) => patchAnimation(node.id, { delayMs: v })} />
                  <NumberInput value={a.delayMs} min={0} max={20000} step={50} onChange={(v) => patchAnimation(node.id, { delayMs: v })} />
                </div>
              </Field>
            </>
          ) : (
            <>
              <Field label="Duration" hint="Milliseconds for one pass.">
                <div className="insp-num">
                  <Slider value={a.durationMs} min={200} max={6000} step={50} onChange={(v) => patchAnimation(node.id, { durationMs: v })} />
                  <NumberInput value={a.durationMs} min={50} max={20000} step={50} onChange={(v) => patchAnimation(node.id, { durationMs: v })} />
                </div>
              </Field>

              <Field label="Delay" hint="Waits before this node starts.">
                <div className="insp-num">
                  <Slider value={a.delayMs} min={0} max={4000} step={50} onChange={(v) => patchAnimation(node.id, { delayMs: v })} />
                  <NumberInput value={a.delayMs} min={0} max={20000} step={50} onChange={(v) => patchAnimation(node.id, { delayMs: v })} />
                </div>
              </Field>

              <Field label="Stagger" hint="Offset between this node's own elements — rings, blips, characters.">
                <div className="insp-num">
                  <Slider value={a.staggerMs} min={0} max={600} step={10} onChange={(v) => patchAnimation(node.id, { staggerMs: v })} />
                  <NumberInput value={a.staggerMs} min={0} max={2000} step={10} onChange={(v) => patchAnimation(node.id, { staggerMs: v })} />
                </div>
              </Field>

              <Field label="Easing">
                <SelectInput value={a.easing} options={EASING_OPTIONS} onChange={(v) => patchAnimation(node.id, { easing: v })} />
              </Field>

              <div className="insp-toggle-row">
                <Toggle checked={a.loop} onChange={(v) => patchAnimation(node.id, { loop: v })} label="Loop" />
                <Toggle
                  checked={a.direction === "reverse"}
                  onChange={(v) => patchAnimation(node.id, { direction: v ? "reverse" : "normal" })}
                  label="Reverse"
                />
              </div>

              {a.loop && (
                <Field label="Loop pause">
                  <div className="insp-num">
                    <Slider value={a.loopDelayMs} min={0} max={4000} step={50} onChange={(v) => patchAnimation(node.id, { loopDelayMs: v })} />
                    <NumberInput value={a.loopDelayMs} min={0} max={20000} step={50} onChange={(v) => patchAnimation(node.id, { loopDelayMs: v })} />
                  </div>
                </Field>
              )}
            </>
          )}
        </>
      )}

      {hasKids && (
        <div className="insp-toggle-row">
          <Toggle
            checked={a.cascade}
            onChange={(v) => patchAnimation(node.id, { cascade: v })}
            label={`Drive the ${node.children.length} parts inside`}
          />
        </div>
      )}
    </>
  );
}
