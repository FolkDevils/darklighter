/**
 * Headless render smoke test. Builds with `vite build --ssr` and runs in node,
 * so every registered component's static AND animated frame is exercised
 * without a browser: crashes, bad SMIL attribute types and React warnings all
 * surface here.
 *
 *   npx vite build --ssr scripts/smoke.tsx --outDir .smoke && node .smoke/smoke.js
 */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "@/components-model/defs";
import type { ComponentNode } from "@/components-model/types";
import { allComponentDefs, componentDef } from "@/components-model/registry";
import { RenderNode } from "@/components-model/RenderNode";

const warnings: string[] = [];
const origError = console.error;
console.error = (...args: unknown[]) => {
  warnings.push(args.map(String).join(" "));
  origError(...args);
};

let failures = 0;
for (const def of allComponentDefs()) {
  for (const animate of [false, true]) {
    try {
      const node = def.factory();
      const html = renderToStaticMarkup(<RenderNode node={node} animate={animate} />);
      const smil = (html.match(/<animate|<animateTransform|<animateMotion/g) ?? []).length;
      if (!animate && smil > 0) {
        failures++;
        console.log(`FAIL ${def.kind}: emitted ${smil} SMIL nodes with animate=false`);
      } else if (animate) {
        console.log(`${def.kind.padEnd(16)} ${String(html.length).padStart(7)} bytes  ${smil} anim nodes`);
      }
    } catch (e) {
      failures++;
      console.log(`FAIL ${def.kind} (animate=${animate}): ${e instanceof Error ? e.message : e}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Animation state rules (types.ts AnimationConfig) — these are the    */
/* semantics the inspector's toggles promise, so they get asserted.    */
/* ------------------------------------------------------------------ */

const smilCount = (el: ReactElement) =>
  (renderToStaticMarkup(el).match(/<animate|<animateTransform|<animateMotion/g) ?? []).length;

/** A scene with at least one animated part, for the cascade assertions. */
const scene = componentDef("radarScope").factory();
const firstPart = scene.children[0];
const patch = (n: ComponentNode, over: Partial<ComponentNode["animation"]>): ComponentNode => ({
  ...n,
  animation: { ...n.animation, ...over },
});
const withFirst = (child: ComponentNode): ComponentNode => ({
  ...scene,
  children: [child, ...scene.children.slice(1)],
});

const check = (label: string, pass: boolean) => {
  if (!pass) {
    failures++;
    console.log(`FAIL ${label}`);
  }
};

const baseline = smilCount(<RenderNode node={scene} animate />);
const partAlone = smilCount(<RenderNode node={firstPart} animate />);

check(
  "a part's own Animate=off stops it even inside a cascading scene",
  smilCount(<RenderNode node={withFirst(patch(firstPart, { enabled: false }))} animate />) <
    baseline,
);
check(
  "turning a cascading scene off silences the parts that inherit from it",
  smilCount(<RenderNode node={patch(scene, { enabled: false, cascade: true })} animate />) === 0,
);
check(
  "a part with its own timing keeps running when the scene is off",
  smilCount(
    <RenderNode
      node={{
        ...patch(scene, { enabled: false }),
        children: [patch(firstPart, { inherit: false }), ...scene.children.slice(1)],
      }}
      animate
    />,
  ) >= partAlone,
);
check("global pause emits no SMIL anywhere", smilCount(<RenderNode node={scene} animate={false} />) === 0);

/* ------------------------------------------------------------------ */
/* Travel behaviors (drift/orbit): contacts must actually move, keep    */
/* their resting position, and stay deterministic across renders.       */
/* ------------------------------------------------------------------ */

const blips = componentDef("blipField").factory();
const asBehavior = (n: ComponentNode, behavior: string): ComponentNode => patch(n, { behavior });
const markup = (n: ComponentNode, animate = true) =>
  renderToStaticMarkup(<RenderNode node={n} animate={animate} />);

const drifting = markup(asBehavior(blips, "drift"));
check("drift moves blips with animateMotion", /<animateMotion/.test(drifting));
const routes = drifting.match(/path="[^"]*"/g) ?? [];
check(
  "drift routes are closed loops from the origin, so a contact returns home",
  routes.length > 0 && routes.every((p) => /^path="M 0 0 C.*Z"$/.test(p)),
);
check(
  "a trail renders one lagging ghost per trail step",
  (drifting.match(/<animateMotion/g) ?? []).length ===
    blips.props.count * (1 + blips.props.trail),
);
check(
  "drift is deterministic — same seed, same routes",
  markup(asBehavior(blips, "drift")) === drifting,
);
check(
  "a different seed wanders differently",
  markup(asBehavior({ ...blips, seed: blips.seed + 1 }, "drift")) !== drifting,
);
check(
  "paused drift emits no motion and leaves blips at their home positions",
  !/<animateMotion/.test(markup(asBehavior(blips, "drift"), false)) &&
    markup(asBehavior(blips, "drift"), false) === markup(asBehavior(blips, "blink"), false),
);
check(
  "orbit turns the formation and counter-turns each glyph so it stays upright",
  (markup(asBehavior(blips, "orbit")).match(/type="rotate"/g) ?? []).length ===
    blips.props.count * (1 + blips.props.trail) * 2,
);
for (const kind of ["craft", "targetGlyph"] as const) {
  check(
    `${kind} can drift too (shared motion helpers)`,
    /<animateMotion/.test(markup(asBehavior(componentDef(kind).factory(), "drift"))),
  );
}

if (warnings.length) {
  console.log(`\n${warnings.length} React warning(s):`);
  for (const w of [...new Set(warnings)]) console.log(`  ${w.slice(0, 300)}`);
}
console.log(failures === 0 && warnings.length === 0 ? "\nOK" : `\n${failures} failure(s)`);
process.exit(failures === 0 && warnings.length === 0 ? 0 : 1);
