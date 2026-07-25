# DARKLIGHTER — Build Plan (v1)

Master plan for building **Darklighter**, a modular brand-graphics engine for the **Protora** brand.
Written by the planning model; to be **executed by a cheaper model** (recommended: **Claude Sonnet 5 thinking**; escalate a single stuck phase to Opus only if needed).

---

## 0. READ THIS FIRST — context protocol (do not skip)

You are the executor. Your job is to burn as few tokens as possible while building. Rules:

1. **Read only three docs to get up to speed:** this `PLAN.md`, `docs/STATUS.md` (current progress), and `assets/protora/ELEMENTS.md` (SVG asset catalog). That is your entire required context.
2. **Do NOT re-explore the reference app.** Section 4 contains a complete file-by-file port map of `/Users/andreweaton/23andme-org-datavis/`. Open a reference file only at the moment you are porting/adapting it.
3. **Do NOT open the 21 Protora SVGs to "understand" them.** `assets/protora/ELEMENTS.md` describes every file. Open an SVG only when extracting specific geometry for a component you are currently building.
4. **After every phase (and any significant mid-phase stop): update `docs/STATUS.md`** — what's done, what's next, any deviations from this plan, and any gotchas discovered. Keep it under ~150 lines; it is a handoff file, not a diary. This is how the next session (or next model) resumes without re-reading code.
5. **Record irreversible decisions in `docs/DECISIONS.md`** (one line each: date, decision, why). Create it in Phase 0.
6. Verify with `npm run typecheck` and `npm run build` after each phase. Don't screenshot-loop a dev server; boot it only for a final eyeball per phase.

### Where everything lives

| Thing | Path |
| --- | --- |
| This repo / app root | `/Users/andreweaton/darklighter/` |
| Protora SVG assets (21 files) | `/Users/andreweaton/darklighter/elements/` → **move to `assets/protora/` in Phase 0** |
| Asset catalog (already written, source of truth) | `elements/ELEMENTS.md` → moves with the folder |
| Reference app (“Helix Studio”, read-only, do not modify) | `/Users/andreweaton/23andme-org-datavis/` |
| Reference app’s own agent playbook (patterns we inherit) | `23andme-org-datavis/ADDING_NEW_GRAPHICS.md` |
| Brand color swatch screenshot | `/Users/andreweaton/.cursor/projects/Users-andreweaton-darklighter/assets/Screenshot_2026-07-24_at_11.14.39_AM-b197d8ee-28b6-4c86-a1eb-6423982e42c1.png` (already sampled; hexes in §3 — you don't need the image) |

---

## 1. What we're building (mission brief)

**Darklighter** is a professional creative tool — a Figma-like canvas + inspector app — where every Protora brand graphic is a **system of reusable, nestable, animatable components** (radar rings, sweeps, grids, blips, target glyphs, craft silhouettes, arcs, labels, particles, reticles…), not flat illustrations.

Core promises:

- Components are independently usable, combinable, nestable, replaceable, animatable, and saveable as presets.
- The **Protora “P” logo with the radar element** ships as a protected base preset where the P shell and the radar inside are **independently controllable** — the radar is a slot that can host any radar-family component.
- Deterministic SVG rendering: same config → same output, always.
- Export: static SVG, animated SVG (SMIL), copyable markup, transparent/high-res PNG, and JSON configs that reopen in Darklighter.
- Architecture is pre-wired for a conversational **AI creative partner** that manipulates the structured component system through validated patch operations, with 4 freedom modes and experimental-recipe storage.

**Not** a generic chart builder. Everything is Protora’s radar/tactical-HUD visual language.

The app's own UI is branded Darklighter (subtle Protora accents only).

---

## 2. Strategy: adapt the Helix Studio architecture, don't reinvent

The reference app (`helix-studio` at `/Users/andreweaton/23andme-org-datavis/`) already solved ~70% of Darklighter's hard problems with a proven, registry-driven, strongly typed architecture:

- **React 18 + TypeScript + Vite + Zustand + react-rnd + zod**, hand-authored SVG with **SMIL** animation.
- **WYSIWYG export invariant:** preview and export use the same SMIL nodes; every element's base attributes equal its finished frame, so stripping `<animate>` nodes yields a correct static SVG for Figma.
- **Registry-driven everything:** graphics, modifiers, mark primitives, layout generators, traits. Toolbar/gallery/inspector/export/AI-manifest all read registries — adding an entry lights up the whole app.
- **Declarative inspector** via `ControlSpec` (typed control descriptors with `hint`, `group`, `visibleWhen`).
- **AI layer:** a zod-validated **patch-op vocabulary** mapping 1:1 to store actions, an auto-generated capability **manifest**, an **executor**, `$new` aliasing for multi-op turns, and a local **sidecar server** with a `off | cheap | studio` cost lever.
- **Store-only mutation invariant** (undo/redo + edit logging stay correct), factory-hydrated serialization (old files stay loadable).

**What Darklighter adds that Helix doesn't have:**

1. **Nested component trees with named slots** (Helix's canvas is a flat layer list). This is the single biggest new engineering task — see §5.
2. Protora component library (radar/HUD primitives) replacing all genetics graphics.
3. Protected base presets (approved originals that can be branched but not overwritten).
4. Variations & branching history UI.
5. Experimental recipes storage + the 4 AI freedom modes as an explicit, user-visible control.

Do **not** copy the repo wholesale (60+ genetics graphics, geo/genetics datasets, research charts — dead weight). Start clean and port per the map in §4.

---

## 3. Brand system (single source of truth for color)

Official palette (sampled from the approved swatch board; normalized against hexes found in the source SVGs). Create as `src/data/brand/tokens.ts` in Phase 0 — **all component colors must resolve through these tokens; never hard-code hexes in components.**

### Primary

| Token | Name | Hex | Usage |
| --- | --- | --- | --- |
| `blimpWhite` | Blimp White | `#F0EEDF` | Default background (the brand explicitly composes on Blimp White) |
| `redAlert` | Red Alert | `#FE3B1F` | Hot accent, active/alert elements, sweeps, blips |
| `burntDroneBrown` | Burnt Drone Brown | `#330000` | Ink — logos, dark fills, dark backdrops |

### Secondary (“in theatre” accents)

| Token | Name | Hex | Usage |
| --- | --- | --- | --- |
| `desertSand` | Desert Sand | `#E9D3BC` | Soft field / fills |
| `armyGreen` | Army Green | `#5E6532` | Friendly/neutral targets |
| `bloodRed` | Blood Red | `#780606` | Deep red chrome, hostile marks |
| `tealSky` | Teal Sky | `#9BCCC7` | Secondary HUD accent |
| `electronicIceBlue` | Electronic Ice Blue | `#00FFFF` | Outer range rings, electric highlights |

### Asset-observed aliases (found in the source SVGs; map to tokens, keep as named aliases for import fidelity)

| Observed hex | Where | Treat as |
| --- | --- | --- |
| `#450810` | Default UI chrome in most `Group 3xx` assets (“dark maroon skin”) | `hudChrome` alias — near `bloodRed`, keep as its own alias since half the asset kit uses it |
| `#FF1C3A` `#FF400C` `#FF1C00` `#FF1D25` | Hot-red variants across assets | variants of `redAlert` |
| `#7A0D1C` `#A81127` `#870112` `#B20018` | Layered glow blips / gradient stops | glow ramp between `bloodRed` and `redAlert` |
| `#5C7A76` | Polar grid behind wordmark | `gridTeal` alias (muted `tealSky`) |
| `#5CC11A` | Lime target marks in full radar scene | map to `armyGreen` role (brand superseded lime) |
| `#9BCCC7` | soft teal accents | = `tealSky` |

**Two color “skins”** exist across the asset kit — hot (`redAlert` family) and chrome (`hudChrome`/`bloodRed`). Model this as two named **colorways** (`alert`, `chrome`) selectable per component, mapping semantic roles (`primary`, `accent`, `ink`, `field`, `friendly`, `hostile`) → tokens.

Typography note: all type in the source SVGs is **outlined paths** (no live text). For editable labels, use a monospaced technical font (e.g. `IBM Plex Mono` or system mono) styled all-caps; keep the outlined wordmarks as imported static assets. Brand quirks to preserve when replicating asset text: `AQUIRED` (one C), slashed-zero `1ØØ%`.

---

## 4. Port map from Helix Studio

Legend: **PORT** = copy nearly verbatim (fix imports/names) · **ADAPT** = copy then modify meaningfully · **PATTERN** = re-implement following its shape, don't copy · **SKIP** = ignore.

### Infrastructure (Phase 0)

| Reference file | Action | Notes |
| --- | --- | --- |
| `vite.config.ts`, `tsconfig*.json`, `index.html` | ADAPT | New names; keep `@/` alias, strict TS |
| `src/graphics/controlSpec.ts` | PORT | The declarative inspector schema — keep `hint`/`group`/`visibleWhen` |
| `src/lib/easing.ts`, `src/lib/math.ts` | PORT | SMIL keySplines mapping + geometry helpers |
| `src/lib/svgRegistry.ts` | PORT | Live map of rendered `<svg>` nodes for export |
| `src/lib/svg/serialize.ts`, `src/lib/svg/download.ts`, `src/lib/exportScene.ts` | ADAPT | Core of static/animated export; adapt to component tree (§5) |
| `src/state/store.ts` | ADAPT | Keep the action-only mutation + undo/redo shape; replace flat `graphics[]` with the node tree; keep viewport/selection/playback/window state patterns |
| `src/components/Windows/*` (FloatingWindow, WindowHost, SideRail) | PORT | Floating panel system — exactly the “contextual panels / expandable inspectors” the brief wants |
| `src/components/common/fields.tsx`, `ControlFields.tsx`, `Menu.tsx` | PORT | Generic inspector field renderers driven by ControlSpec |
| `src/styles/tokens.css`, `global.css` | ADAPT | Reskin to Darklighter UI (dark technical UI, Protora accent) |

### Editor surfaces (Phase 3)

| Reference | Action | Notes |
| --- | --- | --- |
| `src/components/Canvas/*` (Canvas, GraphicRenderer, LayerView) | ADAPT | react-rnd drag/resize on scaled canvas; extend selection to nested nodes |
| `src/components/Layers/LayersPanel.*` | ADAPT | Becomes the **hierarchy tree** panel (nesting, drag-reorder, visibility/lock) |
| `src/components/Inspector/*` (Inspector shell, Section, GeometrySection, AnimationSection, ExportSection, ModifierSection) | ADAPT | Keep section pattern; sections read ControlSpecs from the component registry |
| `src/components/Toolbar/*`, `src/components/Gallery/*` | ADAPT | Component browser/gallery with thumbnails |
| `src/components/ColorBoards/*` | PATTERN | Becomes the brand-colorway picker |

### Extension systems (Phases 1–2, 4)

| Reference | Action | Notes |
| --- | --- | --- |
| `src/graphics/registry.tsx` + `defineGraphic` pattern | PATTERN | Becomes `src/components-model/registry.tsx` with `defineComponent` (§5) |
| `src/graphics/types.ts` | PATTERN | Discriminated-union model — extend with children/slots/constraints |
| `src/graphics/defaults.ts` | PATTERN | Shared animation/stroke/color defaults |
| `src/graphics/shared/AnimatedPath.tsx`, `Marker.tsx` | PORT | SMIL-animated SVG building blocks — the animation workhorses |
| `src/graphics/modifiers/*` (types, registry, defs) | PORT | Per-element pure transforms + effects channel (glow/soften/saturation) — glow is exactly the Frame(3) blip look |
| `src/graphics/primitives/registry.tsx` | PATTERN | Becomes the **target-glyph registry** (square+dot, circle+X, X, hex bolt, bracket…) |
| `src/graphics/generators/registry.ts` + `ParticleLab` | PATTERN | Layout generators (ring scatter, grid, arc distribution) power blip fields & particles |
| `src/graphics/traits/*` | PATTERN | Feature packs (e.g. `rangeRings`, `colorway`, `seeded`, `statusText`) composed into component defs |
| `src/graphics/text/SvgText.tsx`, `measure.ts` | PORT | SVG text with measurement — needed for labels/status blocks |

### AI layer (Phase 7)

| Reference | Action | Notes |
| --- | --- | --- |
| `src/lib/ai/patchSchema.ts` | ADAPT | zod op vocabulary, 1:1 with store actions; add tree ops (`addChild`, `replaceSlot`, `reparent`) |
| `src/lib/ai/manifest.ts` | ADAPT | Auto-generated capability manifest from registries |
| `src/lib/ai/executor.ts`, `describeOps.ts` | ADAPT | Op runner with `$new` aliasing + human-readable change descriptions |
| `server/index.ts` | ADAPT | Local sidecar; keep the `off/cheap/studio` brain-mode lever — it becomes Darklighter's cost control |
| `src/components/Assistant/*` | PATTERN | Panel shell for the future chat UI (build the shell, stub the brain) |
| `HELIX-AI-BUILD-PLAN.md` | Reference only | Read §“swings” if Phase 7 needs background; otherwise skip |

### Skip entirely

All genetics graphics (`Manhattan`, `Globe`, `Research*`, `Ancestry*`, `Chromo*`, etc.), `src/data/genetics/`, `src/data/geo/`, `world-atlas`/`topojson`/`d3-geo` deps, `RESEARCH-CHART-DATA-SOURCES.md`. Keep d3-shape/d3-scale/d3-path.

### Invariants inherited from Helix (binding — copy into docs/DECISIONS.md at Phase 0)

1. **WYSIWYG export:** preview & export share SMIL; base attributes = finished frame.
2. **One source of truth per concern:** colors in `src/data/brand/`, components/modifiers/glyphs/generators in registries. No duplication.
3. **Store actions are the only mutators** — UI and AI both go through them.
4. **Serialization is factory-hydrated;** new fields optional; old files stay loadable.
5. **No model API calls in the app or build** — only the sidecar talks to a model.
6. *(New for Darklighter)* **Deterministic rendering:** all randomness through a seeded RNG stored on the node.
7. *(New)* **Protected presets are never overwritten** — “Save” on a protected preset always forks.

---

## 5. The Darklighter component model (core new design)

### 5.1 Node tree

Replace Helix's flat `graphics: Graphic[]` with a tree of `ComponentNode`s:

```ts
interface ComponentNode {
  id: string;                        // stable nanoid
  kind: ComponentKind;               // discriminated union, from the registry
  name: string;
  layout: { x: number; y: number; w: number; h: number; rotation: number }; // relative to parent
  props: KindPropsMap[kind];         // strongly typed per-kind payload
  style: StyleConfig;                // token/colorway refs, stroke weights, opacity — NOT raw hexes
  animation: AnimationConfig;        // per-node; see §7
  modifiers: ModifierInstance[];     // pure per-node transform stack (ported system)
  children: ComponentNode[];         // free-form nesting (composites)
  slots?: Record<string, SlotValue>; // named, constrained replacement points
  seed: number;                      // determinism for generated content
  locked: boolean; hidden: boolean;
  provenance: { source: "library" | "user" | "ai" | "import"; baseComponent?: string; protected?: boolean };
  notes?: string;
}

interface SlotDef {                  // declared on the component definition
  name: string;                      // e.g. "radarFill"
  accepts: ComponentTag[];           // e.g. ["radar"] — any component tagged "radar" may fill it
  frame: { x; y; w; h };             // where slot content is clipped/placed
  clipPath?: string;                 // e.g. the P-bowl outline
}
```

- `defineComponent({ kind, tags, factory, controls, slots?, traits?, describe })` registers everything; gallery, inspector, canvas, export, and AI manifest read the registry (Helix pattern).
- **Slots vs children:** children = free composition; slots = constrained replaceable regions (the P logo's radar). `replaceSlot(nodeId, slotName, newKind)` swaps content while preserving the host.
- Selection model: click selects top-level node; double-click descends into children (Figma-style). Store keeps `selectedPath: string[]`.
- Rendering: each node renders as a nested `<svg>`/`<g>` with its own viewBox; parent transforms don't distort child stroke widths.

### 5.2 Component library v1 (build in this order)

Primitives (Phase 1) — each maps to geometry documented in `assets/protora/ELEMENTS.md`:

| Kind | Description | Key props | Source asset(s) |
| --- | --- | --- | --- |
| `ringSet` | Concentric range rings | count, spacing (linear/exp), strokeW per-ring, dash, labelFormat (`2NM`…), labeled ring indices | `Group 81 (1).svg` |
| `sweep` | Radar sweep wedge/arm | angle, arcSpan, trailFade, direction | `markwithAccentRadar.svg`, small mark |
| `polarGrid` | Radial spokes + arcs fan | spokeCount, arcCount, sector (full/fan), gradient | `markwithAccentRadar.svg` |
| `blipField` | Generated target dots | count, seed, distribution (ring/cluster/uniform), glyph ref, glow | `Frame (3).svg`, `Group 81` |
| `targetGlyph` | Single mark (registry-swappable) | glyphId: squareDot / circleX / plainX / hexBolt / bracket / circle / squareX | `Group 145/325`, `Group 322` |
| `reticle` | Crosshair + micro-circles | size, axesLength, ringCount | `Group 145/325/322` |
| `arcSignal` | Nested quarter-arcs w/ arrowheads | arcCount, spread, arrowheads, dashedOuter | `Group 143/324` |
| `trajectory` | Curved path arcs w/ anchors | count, curvature, anchors, arrowheads | `Group 147/328` |
| `focusArcs` | Bidirectional converging arcs | arcCount, gap, nodes | `Group 344.svg` |
| `craft` | Aircraft/drone silhouette | variant: delta / reaper / wasp; pingRings toggle | `Group 276/278/328` |
| `statusText` | Monospaced HUD text block | lines[], align, brand-quirk presets | `Group 143/147/321/323/326` |
| `labelPill` | Pill-outline label | text, e.g. `TELEMETRY` | `Group 145/322/323` |
| `vectorLine` | Dashed trajectory/bearing line | dash, angle, endMarker | `Frame (3)`, `Group 322` |
| `particleField` | Ambient particles | generator params, seed | port ParticleLab pattern |

Static imports (Phase 2) — sanitized, viewBox-normalized copies of brand art, registered as `staticAsset` components: `logoMain` (PROTON wordmark), `protoraWordmark` (from `Group 324/344`), craft silhouettes, `AI.` badge, etc. Optimize with svgo but **keep the originals untouched** in `assets/protora/`.

Composites (Phase 2) — built from primitives + slots:

| Kind | Composition |
| --- | --- |
| `radarScope` | ringSet + sweep + blipField + reticle ×4 + rangeLabels — the full `Group 81` scene as one editable composite |
| `telemetryPanel` | radarScope + labelPill + statusText corners — `Group 145/325` |
| `sweepModule` | arcSignal + percentage statusText + boot-log statusText — `Group 143/324` |
| `launchKit` | trajectory + craft + statusText + labelPill — `Group 147/328` |
| **`logoP`** | **The Protora P shell (outlined path from `logo_01SmallMinimized.svg`) with slot `radarFill` (accepts tag `radar`, clipped to the bowl). Default fill = the approved reticle/rings treatment. P shell and radar are independently selectable/controllable.** |
| `markLockup` | circular radar mark + wordmark — `Markwith acentleftsmalle accent.svg` |

**Protected base presets** (Phase 5): `logoP` (approved original), `radarScope` classic, `markLockup` — flagged `provenance.protected: true`; editing always branches; a “Return to approved base” action restores the pristine version.

### 5.3 Pre-built contract files (AUTHORITATIVE — implement against, do not redesign)

The planning model already wrote the load-bearing design decisions as code. These files exist in the repo **before Phase 0**; their imports resolve once the scaffold installs deps. If a change to any of them is unavoidable, log it in `docs/DECISIONS.md` first.

| File | Contains |
| --- | --- |
| `src/components-model/types.ts` | The full node-tree model: `ComponentNode`, `KindPropsRegistry` (open via declaration merging), `StyleConfig`/colorways, `AnimationConfig`/behaviors, `SlotDef` (overlay vs knockout modes), selection path, `.dkl` doc format |
| `src/components-model/registry.tsx` | `defineComponent` / `ComponentDef` contract + registration order for all Phase 1–2 kinds; expects `controlSpec.ts` ported next to it in Phase 0 |
| `src/state/contract.ts` | The exact store interface (`DarklighterState`/`DarklighterActions`), including `forkProtected` semantics and snapshot/branch model |
| `src/assets/brand/logoP.ts` | Extracted P-logo geometry: P shell path, approved radar (ring radii, crosshair segments, stroke spec), slot frame, TM glyphs, and the mask-based knockout render recipe for `defs/logoP.tsx` |
| `src/lib/ai/patchSchema.ts` | Complete zod op vocabulary (incl. tree ops), `PatchTurn`, the four freedom modes as cumulative op allowlists, and the 6 binding executor rules |

---

## 6. App surface (UI spec)

Single-window studio, dark technical UI (Burnt Drone Brown/near-black chrome, Red Alert accent, Blimp White canvas default). Layout mirrors Helix (proven): left rail of toggleable floating panels, center canvas, right inspector.

- **Canvas:** fixed 1600×1200 coordinate space, zoom/pan, grid toggle, drag/resize/rotate via react-rnd, marquee select, double-click to enter composites. Background color picker (default Blimp White; one click to Burnt Drone Brown for dark comps).
- **Library panel:** gallery of components with live SVG thumbnails, grouped: Radar / Glyphs / Craft / Text / Logos / Composites / My presets. Click or drag to add.
- **Hierarchy panel:** the node tree — reorder (z within siblings), reparent by drag, visibility/lock toggles, slot indicators.
- **Inspector (right):** context-sensitive sections driven by ControlSpecs — Geometry, kind-specific props, Style (colorway + token pickers, stroke, opacity), Animation, Modifiers, Export. Collapsible sections; advanced controls only appear when relevant (`visibleWhen`).
- **Toolbar:** add component, presets menu, undo/redo, play/pause all animation, replay, export menu, history panel toggle, AI panel toggle (stub until Phase 7).
- **History panel (Phase 5):** version timeline with named snapshots, branch points, favorites ★ / rejected ✕, notes per entry, side-by-side compare (two canvases), restore/branch buttons.

Keyboard: standard (⌘Z/⇧⌘Z, ⌘D duplicate, delete, arrows nudge, ⌘G group into composite).

---

## 7. Animation system

Port Helix's SMIL approach wholesale — it's what makes animated *and* static export trivially correct.

- `AnimationConfig` per node: `enabled, durationMs, delayMs, staggerMs, easing, loop, loopDelayMs, direction`.
- Kind-specific animation behaviors declared in the component def (each maps to SMIL under the hood):
  - `sweep`: continuous rotation (the radar sweep)
  - `ringSet`: draw-on, or radiating ping (scale+fade loop — see `Group 276` ping rings)
  - `blipField` / `targetGlyph`: blink, pulse, fade-in stagger
  - `arcSignal` / `trajectory` / `vectorLine`: draw-on (stroke-dashoffset)
  - `particleField`: orbit/drift via `animateMotion`
  - `craft`: path-follow via `animateMotion` along an optional path child
  - `statusText`: typewriter reveal (per-line stagger)
- Component-level config cascades to children with per-child overrides (element-level control). Timing offsets via per-child `delayMs`.
- Global playback: play/pause/replay all (Helix store already has this).
- **Invariant:** base attributes = finished frame, so static export = strip SMIL nodes.

---

## 8. Presets, variations, history

- **Preset format:** `.dkl.json` — `{ format: "darklighter", version: 1, name, background, nodes: ComponentNode[] }` (factory-hydrated on load, like Helix's `.helix.json`). Presets saved to localStorage + downloadable file; shipped presets in `src/presets/files/`.
- **Version history:** snapshot ring buffer in the store (undo/redo already gives micro-history; snapshots are named macro-history). Branch = load snapshot as new working state with `parentSnapshot` recorded. Favorites/rejected/notes are snapshot metadata.
- **Variation generation (Phase 5, deterministic — no AI needed):** `generateVariations(node, n, axes)` — axes are parameter ranges (seed, density, colorway, spacing, animation speed…). Renders an n-up grid picker; selecting one applies it, all are kept in history. This same function becomes an AI tool in Phase 7 (“create 20 variations”).

---

## 9. Export

Port + adapt Helix's pipeline (`serialize.ts`, `exportScene.ts`, `download.ts`, `svgRegistry.ts`):

| Output | Mechanism |
| --- | --- |
| Static SVG | Serialize rendered node, strip SMIL nodes |
| Animated SVG | Serialize with SMIL intact (replays on open in browser) |
| Copy SVG markup | Clipboard write of the same serialization |
| Transparent PNG / hi-res PNG | Render SVG → canvas rasterize at 1×/2×/4× (client-side; `@resvg/resvg-js` server-side later if quality demands) |
| Config JSON | The node subtree as `.dkl.json` (reopens in Darklighter) |

Scope: selected node, selected composite, or whole canvas. Note in the export dialog: SMIL doesn't survive Figma import — offer “Static (Figma)” and “Animated (web)” side by side.

---

## 10. AI creative partner (architecture now, brain later)

Phase 7 builds the full plumbing with a **stubbed brain** (mock turns), exactly like Helix's sidecar approach. No API keys required to complete this plan.

- **Manifest** (`src/lib/ai/manifest.ts`): auto-generated from the component registry — every kind, its ControlSpecs (with `hint`s), tags, slots, modifiers, animation behaviors. This is what makes “Replace the aircraft with a different tracking symbol” resolvable.
- **Patch ops** (`src/lib/ai/patchSchema.ts`, zod): Helix's op set + tree ops: `addComponent, patchProps, patchStyle, patchLayout, patchAnimation, addChild, removeNode, reparent, replaceSlot, addModifier, patchModifier, generateVariations, savePreset, snapshot`. Every op maps 1:1 to a store action. `$new` aliasing preserved.
- **Executor** validates → applies via store actions → returns human-readable change descriptions (`describeOps` pattern) so the AI can “explain what it changed.”
- **Context builder:** serialize current selection + canvas summary (compact JSON, not SVG markup) for the model prompt.
- **Freedom modes** (user-visible selector, enforced by the executor — ops outside the mode are rejected):
  1. **Parameter Only** — only `patch*` ops on existing nodes.
  2. **Component Composer** — + add/remove/reparent/replaceSlot/variations.
  3. **Experimental** — + may attach an **experimental recipe** (below) to a node.
  4. **System Extension** — may draft a new component definition as a recipe for developer review. Never auto-registered.
- **Experimental recipes:** stored via sidecar in `data/darklighter/recipes/*.json`: `{ id, title, request, explanation, params, code?, dependsOn, previewSvg, status: "proposed"|"approved"|"rejected", history[] }`. Recipes are reusable in-session; an approved recipe is promoted **manually by a developer** following `docs/EXTENDING.md` (write this doc in Phase 7, modeled on `ADDING_NEW_GRAPHICS.md`).
- **Cost controls (UI):** brain mode `off/cheap/studio` (port the sidecar lever), variation count limit, max iterations per request, confirmation dialog for expensive ops (>N variations or Experimental+ modes).
- **Learning substrate:** approved/rejected snapshot metadata + recipe statuses are the training signal; store them durably (sidecar JSON files) so a future brain can read preference history.

---

## 11. Build phases

Work strictly in order; each phase ends with `npm run typecheck && npm run build` green and a `docs/STATUS.md` update. Estimated relative sizes in parentheses.

### Phase 0 — Scaffold + infrastructure port (M)
1. Reorganize repo: `mkdir -p assets/protora docs && git mv elements/* assets/protora/` (init git first if needed; commit the original SVGs untouched).
2. Scaffold Vite React-TS at repo root. **The repo already contains `src/` contract files (§5.3) — scaffold in a temp dir and merge, or hand-write the config files; never overwrite existing `src/` contents.** Deps: `zustand react-rnd zod d3-shape d3-scale d3-path nanoid`; dev deps + strict TS matching the reference tsconfig. Configure the `@/` path alias (the contracts import via `@/`).
3. Port infrastructure files per §4 table. Port `controlSpec.ts` to `src/components-model/controlSpec.ts` (the registry contract imports it from there).
4. Create `src/data/brand/tokens.ts` (§3 palette + colorways) and `src/lib/colorway.ts` (role→hex resolver injected into renderers per `RenderProps.color`).
5. Create `docs/DECISIONS.md` (seed with §4 invariants). Update `docs/STATUS.md`.
✅ Accept: app boots to empty canvas with toolbar + panel rail; **all §5.3 contract files compile**; typecheck/build green.

### Phase 1 — Component model + primitives (L)
1. `types.ts` and `registry.tsx` **already exist as contracts (§5.3)** — write `defaults.ts` (shared node-field factories) and the seeded RNG util against them. Kind def files follow the pattern documented at the bottom of `registry.tsx` (`defs/<kind>.tsx` + declaration merging + barrel import).
2. Store: implement `src/state/contract.ts` exactly (Zustand, undo-aware, reference store as the pattern).
3. Canvas renders the tree (nested svg pattern); drag/resize top-level nodes.
4. Build primitives from §5.2 table: `ringSet, sweep, polarGrid, targetGlyph (+glyph registry), reticle, arcSignal, blipField, statusText, labelPill, vectorLine` (defer `trajectory, focusArcs, craft, particleField` to Phase 2 if heavy).
✅ Accept: can add each primitive, see it render on-brand, edit its props via a temporary raw-JSON inspector, undo/redo works.

### Phase 2 — Composites, slots, logo (M)
1. Slot system (defs + `replaceSlot` + clip paths + the knockout mask mode from `SlotDef.mode`).
2. Sanitize/import static assets (wordmarks, craft silhouettes) into `src/assets/brand/` as normalized SVG modules; build `staticAsset` kind. **The P-logo geometry is already extracted in `src/assets/brand/logoP.ts` (shell path, approved radar spec, slot frame, TM glyphs, mask render recipe) — build `defs/logoP.tsx` from it; do not re-derive from the SVG.**
3. Remaining primitives (`trajectory, focusArcs, craft, particleField`).
4. Composites: `radarScope, telemetryPanel, sweepModule, launchKit, markLockup`, and **`logoP` with the `radarFill` slot**.
✅ Accept: `logoP` on canvas; select P shell vs inner radar independently; swap the radar slot with `radarScope`/`polarGrid`/`ringSet`; visual match to the approved original.

### Phase 3 — Editor UI (L)
Port/adapt Library gallery (live thumbnails), Hierarchy tree panel, full Inspector (ControlSpec-driven sections: Geometry, Props, Style/colorway, Modifiers), Toolbar, selection UX (double-click descent, marquee, keyboard), background/canvas controls, ⌘G group-into-composite.
✅ Accept: build a telemetry panel from scratch using only the UI in <2 minutes; every §5.2 prop editable without touching JSON.

### Phase 4 — Animation (M)
Port AnimatedPath/Marker; implement per-kind SMIL behaviors (§7); AnimationSection in inspector with cascade + per-child overrides; global play/pause/replay.
✅ Accept: radarScope with rotating sweep + blinking blips + draw-on rings, all speeds/offsets adjustable per element; pausing shows the correct finished frame.

### Phase 5 — Presets, history, variations (M)
`.dkl.json` save/load; shipped protected presets (logoP approved, radarScope classic, markLockup); protected-fork behavior + “Return to approved base”; snapshot history panel with branch/favorite/reject/notes/compare; deterministic `generateVariations` + n-up picker.
✅ Accept: edit logoP → branch created automatically, original restorable; generate 12 seed/colorway variations of radarScope and pick one; history survives reload (localStorage).

### Phase 6 — Export (M)
Port serialize/exportScene/download; static + animated SVG, copy-markup, PNG at 1×/2×/4× with transparency, config JSON; export scopes (node/composite/canvas); Figma note in dialog.
✅ Accept: animated radarScope SVG replays when opened in a browser; static export opens clean in Figma-compatible form; exported `.dkl.json` reopens identically (determinism check: export → reimport → identical serialization).

### Phase 7 — AI foundation (L)
**The patch schema + freedom modes already exist as a contract (`src/lib/ai/patchSchema.ts`, §5.3) — implement the executor against it, including its 6 header rules.** Build: manifest, executor + describeOps, context builder, sidecar (`server/`) with brain modes + recipe storage, Assistant panel shell with **mock turns** (canned `PatchTurn`s prove the pipeline), cost-control UI, `docs/EXTENDING.md`.
✅ Accept: a mock turn like “make the radar more active” executes real ops (speed up sweep, add blips) via the executor and reports what changed; ops outside the selected freedom mode are rejected with a visible message; a recipe JSON round-trips through the sidecar.

### Phase 8 — Polish + docs (S)
UI reskin pass (Darklighter identity), empty states, keyboard cheatsheet, `README.md` (quick start, architecture map, adding-a-component checklist), final `docs/STATUS.md` marking v1 complete.

---

## 12. Executor guidance

- **Model:** Sonnet 5 (thinking) end-to-end. If Phase 1's tree/slot model or Phase 7's executor stalls after two attempts, that specific phase justifies Opus 4.8.
- **One phase per session** is ideal; never start a phase without reading `docs/STATUS.md`.
- Commit per phase (repo may need `git init`): message format `Phase N: <summary>`.
- When this plan conflicts with something you discover in code, prefer the Helix invariant (§4) — then log the deviation in `docs/DECISIONS.md`.
- Don't gold-plate: no auth, no cloud storage, no real AI calls, no tests beyond typecheck+build (per reference convention). Determinism and the invariants are the quality bar.
- The reference app is **read-only**. Never modify `/Users/andreweaton/23andme-org-datavis/`.
