/**
 * THE COMPONENT CONTRACT, ENFORCED — `npm run conform`.
 *
 * `npm run smoke` asks "does it render?". This asks "is it part of the
 * system?". Those are different questions, and the second one is the mission
 * (docs/MISSION.md): the value of Darklighter is that every graphic comes out
 * of ONE brand logic. A component that hard-codes its own colors, hides a
 * magic number behind no control, or renders differently on each call is a
 * one-off wearing a component's clothes — it renders fine and quietly makes
 * the engine a pile of unrelated art.
 *
 * This is a gate, not advice, because discipline doesn't scale: the next
 * author may be a model that never read a doc. Anything AI-drafted has to pass
 * exactly what a human's work passes (docs/EXTENDING.md).
 *
 *   npx vite build --ssr scripts/conform.tsx --outDir .conform && node .conform/conform.js
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import "@/components-model/defs";
import type { ColorRole, ComponentNode } from "@/components-model/types";
import { allComponentDefs, type ComponentDef } from "@/components-model/registry";
import { RenderNode } from "@/components-model/RenderNode";
import { resolveColor } from "@/lib/colorway";
import { serializeNode } from "@/lib/svg/serialize";

const DEFS_DIR = "src/components-model/defs";

const failures: string[] = [];
const fail = (kind: string, rule: string, detail: string) =>
  failures.push(`${kind.padEnd(16)} ${rule.padEnd(22)} ${detail}`);

/* ------------------------------------------------------------------ */
/* Rule 1 — no raw hex in a def file                                   */
/*                                                                     */
/* Color must arrive through `color(role)` so a colorway swap reaches  */
/* every component. A literal here is invisible to the whole system.   */
/* ------------------------------------------------------------------ */

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
/** Mask math, not paint: a luminance mask needs literal black and white. */
const MASK_LITERALS = new Set(["#fff", "#ffffff", "#000", "#000000", "#FFF", "#FFFFFF"]);

for (const file of readdirSync(DEFS_DIR).filter((f) => /\.tsx?$/.test(f))) {
  const src = readFileSync(join(DEFS_DIR, file), "utf8");
  for (const [i, line] of src.split("\n").entries()) {
    // A comment may legitimately cite a source hex from the reference kit.
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    for (const hex of line.match(HEX) ?? []) {
      if (MASK_LITERALS.has(hex)) continue;
      fail(file.replace(/\.tsx?$/, ""), "raw hex in source", `${hex} on line ${i + 1}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Per-kind rules                                                      */
/* ------------------------------------------------------------------ */

const ALL_ROLES: ColorRole[] = ["primary", "accent", "ink", "field", "friendly", "hostile", "electric"];

/** Every hex a colorway could legitimately produce for this node. */
function brandPalette(node: ComponentNode): Set<string> {
  const ok = new Set<string>([...MASK_LITERALS]);
  for (const colorway of ["alert", "chrome"] as const) {
    for (const role of ALL_ROLES) {
      ok.add(resolveColor({ ...node.style, colorway }, role).toLowerCase());
    }
  }
  return ok;
}

const propKeys = (def: ComponentDef): string[] =>
  Object.keys((def.factory().props ?? {}) as Record<string, unknown>);

const controlKeys = (def: ComponentDef): string[] =>
  def.controls.flatMap((c) => ("key" in c ? [c.key] : []));

/**
 * Props with no control on purpose. Anything not listed here MUST be
 * adjustable — an unreachable number is the "magic constant" this gate exists
 * to catch. Add to this list only with a reason.
 */
const UNCONTROLLED: Record<string, string[]> = {
  // Identifies imported brand art; chosen at drop time, not tuned afterwards.
  staticAsset: ["assetId"],
  // Set by ⌘G / slot clipping, never typed by hand.
  composite: ["clipPathData"],
};

for (const def of allComponentDefs()) {
  const node = def.factory();

  /* Rule 2 — the registry metadata that makes a kind findable. Without tags
     it can never fill a slot; without a description the AI manifest and the
     gallery tooltip have nothing to say. */
  if (def.tags.length === 0) fail(def.kind, "no tags", "unreachable by slots and AI");
  if (def.describe.trim().length < 12) fail(def.kind, "no description", "one line, please");
  if (!def.label.trim()) fail(def.kind, "no label", "gallery card would be blank");

  /* Rule 3 — controls must match real props, both ways. */
  const props = propKeys(def);
  const controls = controlKeys(def);
  for (const k of controls) {
    if (!props.includes(k)) fail(def.kind, "control has no prop", `controls "${k}", factory doesn't set it`);
  }
  for (const k of props) {
    if (controls.includes(k)) continue;
    if ((UNCONTROLLED[def.kind] ?? []).includes(k)) continue;
    fail(def.kind, "prop has no control", `"${k}" can't be adjusted by anyone`);
  }

  /* Rule 4 — determinism. Same node, same markup, byte for byte. */
  const once = renderToStaticMarkup(<RenderNode node={node} animate={false} />);
  const twice = renderToStaticMarkup(<RenderNode node={node} animate={false} />);
  if (once !== twice) fail(def.kind, "not deterministic", "two renders of one node differ");

  /* Rule 5 — every color in the output is a brand color. Stronger than the
     source grep: it catches computed and interpolated hexes too. */
  const palette = brandPalette(node);
  const strays = new Set(
    (once.match(HEX) ?? []).map((h) => h.toLowerCase()).filter((h) => !palette.has(h)),
  );
  for (const hex of strays) fail(def.kind, "off-palette color", `${hex} is not in any colorway`);

  /* Rule 6 — the static frame is the resting frame (docs/EXPORT.md
     invariant #1). A component that animates INTO view exports as nothing. */
  const still = serializeNode(node, { animated: false, padding: 8 });
  if (/<animate|<set\b/.test(still)) fail(def.kind, "static carries SMIL", "static export would move");
  if (/opacity="0"|display="none"/.test(still)) {
    fail(def.kind, "invisible at rest", "base attrs must equal the FINISHED frame");
  }

  /* Rule 7 — if it moves, it says which behaviors it supports, so the
     inspector can offer them instead of guessing. Only THIS def's own output
     counts: a pure container (a lockup) legitimately shows SMIL that belongs
     to its children. */
  const own = renderToStaticMarkup(
    def.Render({ node, animate: true, color: (role) => resolveColor(node.style, role) }),
  );
  if (/<animate/.test(own) && def.animBehaviors.length === 0) {
    fail(def.kind, "undeclared animation", "emits SMIL of its own with animBehaviors: []");
  }
}

console.log(`conform: ${allComponentDefs().length} components checked`);
if (failures.length === 0) {
  console.log("OK — every component is part of the system");
  process.exit(0);
}
console.log(`\n${failures.length} violation(s):\n`);
for (const f of failures) console.log(`  ${f}`);
console.log("\nSee docs/EXTENDING.md for what each rule protects.");
process.exit(1);
