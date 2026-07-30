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
import { serializeCanvas, serializeNode } from "@/lib/svg/serialize";
import { buildClipboardSvgs, buildDoc, docJson, parseDoc } from "@/lib/svg/export";
import { composerArtifact, hydrateNode } from "@/state/store";
import { entryFromNode, libraryFile, mergeLibraries, parseLibraryFile } from "@/lib/library";
import { childIndexPath, readExposed, resolveTarget } from "@/components-model/exposed";
import { generateVariations } from "@/lib/variations";
import { cloneWithNewIds, findNode } from "@/lib/nodeTree";
import { resolveColor, surfaceOf } from "@/lib/colorway";
import { brandHex } from "@/data/brand/tokens";

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

/* ------------------------------------------------------------------ */
/* Export pipeline (PLAN.md §9 / docs/EXPORT.md): every kind must      */
/* serialize to a standalone document, static must carry no SMIL, and  */
/* a .dkl.json round-trip must reproduce byte-identical markup.        */
/* ------------------------------------------------------------------ */

for (const def of allComponentDefs()) {
  const node = def.factory();
  const still = serializeNode(node, { animated: false, declaration: true, padding: 24 });
  const moving = serializeNode(node, { animated: true, padding: 24 });

  check(`${def.kind}: static export carries no animation`, !/<animate|<set\b/.test(still));
  check(
    `${def.kind}: export is a standalone SVG document`,
    still.startsWith('<?xml version="1.0" encoding="UTF-8"?>') &&
      /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 [\d.]+ [\d.]+" width="[\d.]+" height="[\d.]+"/.test(
        still.slice(still.indexOf("<svg")),
      ),
  );
  check(
    `${def.kind}: no HTML leaks into the file`,
    !/<div|<foreignObject|data-node-id/.test(still) && !/<div|<foreignObject/.test(moving),
  );
  check(
    `${def.kind}: exported groups carry no canvas-only absolute positioning`,
    !/position:absolute|(?:left|top):-\d/.test(moving),
  );
  const ids = [...moving.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const refs = [...moving.matchAll(/url\(#([^)]+)\)/g)].map((match) => match[1]);
  check(`${def.kind}: exported SVG ids are unique per instance`, new Set(ids).size === ids.length);
  check(`${def.kind}: every exported url(#id) resolves`, refs.every((id) => ids.includes(id)));
  if (def.animBehaviors.length > 0) {
    check(`${def.kind}: animated export keeps its SMIL`, /<animate/.test(moving));
  }
}

{
  const blips = componentDef("blipField").factory();
  const driftingBlips = {
    ...blips,
    animation: { ...blips.animation, behavior: "drift" as const },
  };
  const moving = serializeNode(driftingBlips, { animated: true, padding: 0 });
  check(
    "motion-bleed viewport offsets cancel instead of shifting animated art",
    /^<svg[^>]*><g><g>/.test(moving),
  );
}

{
  const sweep = componentDef("sweep").factory();
  const target = { scope: "node" as const, node: sweep };
  const clipboard = buildClipboardSvgs(target, { animated: true, padding: 0 });
  check("animated clipboard text keeps SMIL", /<animateTransform/.test(clipboard.plain));
  check("animated clipboard rich vector keeps Figma Timeline motion", clipboard.rich === clipboard.plain);
  check(
    "animated sweep exports full-box bounds for Figma's rotation pivot",
    clipboard.rich.includes(
      `<rect width="${sweep.layout.w}" height="${sweep.layout.h}" fill="`,
    ) && clipboard.rich.includes(`data-motion-bounds="sweep"`),
  );
  check(
    "sweep arm starts at the radar center",
    clipboard.rich.includes(`<line x1="${sweep.layout.w / 2}" y1="${sweep.layout.h / 2}"`),
  );
}

{
  const canvasNodes = [componentDef("radarScope").factory(), componentDef("logoP").factory()];
  const canvas = serializeCanvas(canvasNodes, { animated: true, background: "burntDroneBrown" });
  check("canvas export frames the full stage", /viewBox="0 0 1600 1200"/.test(canvas));
  check("canvas export paints the background token as a hex", /<rect x="0" y="0".*fill="#/.test(canvas));

  // The determinism check from PLAN.md §11 Phase 6: export → reopen → identical.
  const target = { scope: "canvas" as const, nodes: canvasNodes, name: "canvas" };
  const doc = buildDoc(target, { color: "blimpWhite" });
  const reopened = parseDoc(docJson(doc));
  check(".dkl.json parses back", reopened !== null);
  check(
    ".dkl.json round-trips to identical markup",
    reopened !== null &&
      serializeCanvas(reopened.nodes.map(hydrateNode), { animated: true, background: "burntDroneBrown" }) ===
        canvas,
  );
  check("a foreign file is rejected", parseDoc('{"format":"sketch","nodes":[]}') === null);
}

/* ------------------------------------------------------------------ */
/* Library, Composer, exposed controls and variations.                 */
/* These are the pieces that let refined work re-enter the system      */
/* (docs/RECOMMENDATION.md), so their invariants get asserted too.     */
/* ------------------------------------------------------------------ */

{
  const scope = componentDef("radarScope").factory();

  /* -- Composer: the whole scratch stage is one artifact -------------- */

  const a = componentDef("ringSet").factory();
  const b = componentDef("statusText").factory();
  const spread = [
    { ...a, layout: { ...a.layout, x: 100, y: 50, w: 200, h: 200 } },
    { ...b, layout: { ...b.layout, x: 400, y: 150, w: 150, h: 100 } },
  ];
  const one = composerArtifact([spread[0]], "Solo");
  check("a single composer root is saved as itself, not wrapped", one?.kind === "ringSet");

  const many = composerArtifact(spread, "Assembly");
  check("multiple composer roots become one composite", many?.kind === "composite");
  check(
    "the wrapper is framed to the union box of what's on the composer stage",
    !!many && many.layout.x === 100 && many.layout.y === 50 && many.layout.w === 450 && many.layout.h === 200,
  );
  check(
    "children are rebased into the wrapper, so the assembly renders where it was built",
    !!many && many.children[0].layout.x === 0 && many.children[1].layout.x === 300,
  );
  check("hidden roots are left out of the artifact", composerArtifact([{ ...spread[0], hidden: true }], "x") === null);

  /* -- Library: an entry survives the trip to disk and back ----------- */

  const entry = entryFromNode(scope, { name: "Saved Scope" });
  check("an assembly is detected as an assembly", entry.scope === "assembly");
  check("a leaf part is detected as a part", entryFromNode(a).scope === "part");
  check("entry tags include the tags of everything inside", entry.tags.includes("radar"));
  const reloaded = parseLibraryFile(JSON.stringify(libraryFile([entry])));
  check("a library file parses back", reloaded !== null && reloaded.length === 1);
  check(
    "a library round-trip reproduces identical markup",
    !!reloaded &&
      serializeNode(hydrateNode(reloaded[0].node), { animated: true, padding: 24 }) ===
        serializeNode(hydrateNode(entry.node), { animated: true, padding: 24 }),
  );
  check("a foreign library file is rejected", parseLibraryFile('{"format":"figma","entries":[]}') === null);
  const newer = { ...entry, name: "Renamed", updatedAt: entry.updatedAt + 1000 };
  check(
    "importing merges by id and the newer entry wins",
    mergeLibraries([entry], [newer]).length === 1 && mergeLibraries([entry], [newer])[0].name === "Renamed",
  );

  /* -- Exposed controls: index paths survive cloning, ids don't ------- */
  /* This is the whole reason knobs address targets by child index:      */
  /* placing a library entry re-ids the tree.                            */

  const targetChild = scope.children[1];
  const path = childIndexPath(scope, targetChild.id);
  check("a descendant's index path is found", path !== null && path.length > 0);
  const placed = cloneWithNewIds(scope, () => `n${Math.random().toString(36).slice(2, 10)}`);
  check("cloning really does change every id", placed.children[1].id !== targetChild.id);
  check(
    "an exposed control still finds its target after the tree is cloned",
    resolveTarget(placed, path!)?.kind === targetChild.kind,
  );
  check("id lookup would NOT have survived", findNode([placed], targetChild.id) === null);

  const withKnob: ComponentNode = {
    ...scope,
    exposed: [
      { id: "xp1", label: "Test", path: path!, channel: "style", key: "colorway", control: { kind: "colorway" } },
    ],
  };
  check("a knob reads the live value off its target", readExposed(withKnob, withKnob.exposed![0]) === targetChild.style.colorway);

  /* -- Variations: deterministic, distinct, and still renderable ------ */

  const axes = ["seed", "colorway", "density", "speed"] as const;
  const grid = generateVariations(scope, 6, [...axes]);
  check("the grid has the requested size", grid.length === 6);
  check(
    "variations are deterministic — same base, same batch, same output",
    JSON.stringify(generateVariations(scope, 6, [...axes])) === JSON.stringify(grid),
  );
  check(
    "each variation differs from the base and from its neighbour",
    JSON.stringify(grid[0]) !== JSON.stringify(scope) && JSON.stringify(grid[0]) !== JSON.stringify(grid[1]),
  );
  check(
    "a later batch is a different window on the same sequence",
    JSON.stringify(generateVariations(scope, 6, [...axes], 6)) !== JSON.stringify(grid),
  );
  check("no axes means no guesses", generateVariations(scope, 6, []).length === 0);
  for (const v of grid) {
    check(
      `a variation still exports as a valid standalone SVG`,
      serializeNode(v, { animated: false, padding: 8 }).includes("<svg"),
    );
  }
  check(
    "a colorway variation repaints the whole subtree, not just the root",
    grid.some((v) => v.children.every((c) => c.style.colorway === v.style.colorway)),
  );
}

/* ------------------------------------------------------------------ */
/* Light/dark surface: ink and field reverse with the page so a mark   */
/* never disappears into its own background (lib/colorway.ts).         */
/* ------------------------------------------------------------------ */

{
  const style = componentDef("logoP").factory().style;
  const WHITE = brandHex("blimpWhite").toLowerCase();
  const BROWN = brandHex("burntDroneBrown").toLowerCase();

  check("a light brand token reads as a light page", surfaceOf("blimpWhite") === "light");
  check("a dark brand token reads as a dark page", surfaceOf("burntDroneBrown") === "dark");
  check("a raw hex is judged by luminance, not by a token list", surfaceOf("#101010") === "dark");
  check("no background at all means a light page", surfaceOf(null) === "light");

  check(
    "ink on a dark page resolves to what field was on a light one",
    resolveColor(style, "ink", "dark") === resolveColor(style, "field", "light"),
  );
  check(
    "and field reverses the other way",
    resolveColor(style, "field", "dark") === resolveColor(style, "ink", "light"),
  );
  check(
    "signal roles never reverse — a hostile is Blood Red on any page",
    resolveColor(style, "hostile", "dark") === resolveColor(style, "hostile", "light"),
  );
  check(
    "an explicit override is never reversed — pinning a role means pinning it",
    resolveColor({ ...style, overrides: { ink: "#123456" } }, "ink", "dark") === "#123456",
  );

  // The point of all of the above: the P mark has to stay visible when the
  // canvas flips, and it has to do so in an EXPORTED file too, not just on
  // screen — the two go through different composition paths.
  const mark = componentDef("logoP").factory();
  const onLight = serializeNode(mark, { animated: false, surface: "light" }).toLowerCase();
  const onDark = serializeNode(mark, { animated: false, surface: "dark" }).toLowerCase();
  check("the P mark is inked dark on a light page", onLight.includes(BROWN) && !onLight.includes(WHITE));
  check("the P mark reverses to light on a dark page", onDark.includes(WHITE) && !onDark.includes(BROWN));
  check(
    "a painted dark backdrop implies the reversal without being told",
    serializeNode(mark, { animated: false, background: "burntDroneBrown" }).toLowerCase().includes(WHITE),
  );

  // The wordmark reaches its color by a different route than the P mark — a
  // string rewrite over imported markup (defs/staticAsset.tsx) rather than a
  // fill on a path — so it gets its own check instead of an assumption.
  const hero = componentDef("heroLockup").factory();
  check(
    "the PROTORA wordmark is dark on a light page",
    serializeNode(hero, { animated: false, surface: "light" }).toLowerCase().includes(BROWN),
  );
  check(
    "the PROTORA wordmark reverses to light on a dark page",
    serializeNode(hero, { animated: false, surface: "dark" }).toLowerCase().includes(WHITE),
  );

  // The scope no longer paints its own backdrop, so it composes onto any page.
  // Its OWN render, not the subtree: the rings and reticle inside it draw
  // plenty of circles, and the claim here is only that the scope itself adds
  // nothing behind them.
  const scope2 = componentDef("radarScope").factory();
  check(
    "the radar scope draws no backdrop of its own",
    !renderToStaticMarkup(
      componentDef("radarScope").Render({ node: scope2, animate: false, color: () => "#000000" }),
    ).includes("<circle"),
  );
  check(
    "and the scope re-inks with the page like everything else",
    serializeNode(scope2, { animated: false, surface: "dark" }).toLowerCase().includes(WHITE),
  );
}

if (warnings.length) {
  console.log(`\n${warnings.length} React warning(s):`);
  for (const w of [...new Set(warnings)]) console.log(`  ${w.slice(0, 300)}`);
}
console.log(failures === 0 && warnings.length === 0 ? "\nOK" : `\n${failures} failure(s)`);
process.exit(failures === 0 && warnings.length === 0 ? 0 : 1);
