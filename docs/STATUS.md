# Darklighter — Status

> Handoff file. Update after every phase or significant stop. Keep under ~150 lines.
> Onboarding = **`docs/NORTH_STAR.md` first**, then `PLAN.md`, then this file, then
> `assets/protora/ELEMENTS.md`. Nothing else.
> Deep dives, only when you're touching that area: `docs/EXPORT.md`.

## Current state

- **Phase 0 (scaffold) — complete. Phase 1 (component model) — complete. Phase 2 (composites, animation, logo) — complete. Phase 3 (editing model) — complete. Phase 6 (export) — complete.**
- `npm run typecheck`, `npm run build`, `npm run smoke` and `npm run shots` are green. Bundle 385 KB (`react-dom/server` is in there on purpose — see the Phase 6 decisions).
- **Session 2 (2026-07-24):** corrected a serious drift (the 21 reference SVGs had been imported as flat art) and rebuilt them as parametric, animated composites — "Phase 2 — the course correction" in `docs/DECISIONS.md`.
- **Session 3 (2026-07-24):** full audit of the selection → inspector → animation → drag path, then fixed what it found. The headline bug: a part's Animate toggle did nothing inside a cascading scene. See "Phase 3 — making every control real" in `docs/DECISIONS.md`.
- **Session 3b (2026-07-24):** contacts now MOVE. `drift` (seeded wander) and `orbit` (formation turn) join the behavior set, with track trails. See "Phase 3b — contacts that move" in `docs/DECISIONS.md`.
- **Session 4 (2026-07-24):** export + copy shipped (Phase 6, out of plan order because it's what makes the tool usable): animated/static SVG, rich-clipboard copy, PNG, `.dkl.json` out and back in, for a part, a group, a scene or the canvas. **`docs/EXPORT.md` is the reference.**

## Editing model (read this before touching the canvas or inspector)

- **Animation has three states, not two** (`types.ts` AnimationConfig, resolved in
  `components-model/animResolve.ts` — the only implementation, shared by the renderer and
  the panels): `enabled` is absolute per node; `inherit` picks whether timing comes from
  the nearest cascading ancestor or from the node itself; `cascade` offers a node's timing
  to descendants and, when the node is off, silences the ones that inherit. `npm run smoke`
  asserts all four rules.
- **Resizing a container scales its parts** (`scaleSubtree`, store). Stroke widths don't
  scale by design — that's `style.strokeScale`.
- **Nested parts are directly editable.** Double-click enters a scene; plain clicks then
  pick sibling parts; the selected part gets its own drag/resize handle
  (`Canvas/ChildHandle.tsx`, positioned from the model); locked parts are stepped over;
  esc/↩ step out and in. Root dragging stands down while a part is selected.
- **The inspector shows only controls that do something.** `components-model/introspect.ts`
  derives each kind's used color roles, stroke usage and seed sensitivity by calling its own
  `Render` with a spying `color()`. Never hand-annotate that; never add a control that has
  no effect for the selected kind.

## What the app does now

- **25 registered components**, all live in the gallery with animating thumbnails:
  - *Primitives:* `ringSet`, `sweep`, `polarGrid`, `targetGlyph`, `reticle`, `arcSignal`,
    `blipField`, `statusText`, `labelPill`, `vectorLine`, `craft`, `trajectory`,
    `readoutBar`, `cornerFrame`
  - *Generated scenes:* `radarScope` (=Group 81), `telemetryPanel` (=145/325),
    `sweepModule` (=143/324), `launchKit` (=147/328), `focusArcs` (=344),
    `pingCraft` (=276), `markLockup`, `heroLockup`, `logoP`
  - *Hosts:* `composite` (⌘G result), `staticAsset` (the wordmark, and only the wordmark)
- **Everything animates.** SMIL only, emitted exclusively when playing, so the resting
  frame always equals the static export (verified by `npm run smoke`, which fails if any
  component emits SMIL with `animate=false`). Behaviors: drawOn, rotate, ping, pulse,
  blink, march, typewriter, drift, orbit, fadeIn. Toolbar has Play/Pause + Replay
  (Space / R); per-node behavior, duration, delay, stagger, easing, loop, reverse and
  cascade live in the inspector's Animation section.
- **Contacts travel, not just flicker.** `drift` wanders each element around its home
  position along a seeded closed route; `orbit` turns a whole blip formation with the glyphs
  staying upright. Both come from `wanderPath`/`speedOf` in `src/lib/anim.ts`, shared by
  `blipField`, `craft` and `targetGlyph`. `blipField` adds Movement props (wander radius,
  route legs, track trail); speed stays in the Animation section. Routes are closed loops
  starting at the origin, so the paused frame equals the layout the user arranged.
- **Everything is adjustable.** ControlSpec-driven inspector: kind props, Slots,
  Geometry, Style (colorway + role overrides + stroke scale + opacity), Animation, and a
  raw-JSON escape hatch. Composite scenes are trees — select a child in Hierarchy (or
  double-click on canvas) and edit it directly.
- **`logoP` is the extensible mark.** Its bowl is a `radarFill` slot in knockout mode:
  swap in any component tagged `radar`/`glyph`/`hud` from the inspector and it is punched
  through the letterform, animating in place. Default content reproduces the approved
  reticle exactly from `src/assets/brand/logoP.ts`.
- **The lockups are pure containers.** Both draw nothing and expose no props: the radar is
  one `composite` group (drag/scale as a unit, edit any ring inside it) and the baseline
  rule is a `vectorLine` child.
- **Everything exports.** Any node (part, group, scene) or the whole canvas → animated SVG,
  static SVG, rich-clipboard copy of either, PNG 1×/2×/4× (or copied as pixels), and
  `.dkl.json` that reopens via the toolbar's **Open**. ⇧⌘C copies the selection.
  Export serializes the MODEL through `flattenSvg`, never the canvas DOM — **read
  `docs/EXPORT.md` before touching `src/lib/svg/`.**

## Key files added/changed this session

| Path | What |
| --- | --- |
| `docs/NORTH_STAR.md` | **NEW — read first.** The objective, the asset policy, the success test |
| `src/lib/anim.ts` | SMIL timing helpers (`timing`, `cycle`, `stagger`, `behaviorOf`, `DRAW_BASE`) — loop pauses are baked into keyTimes. **Session 3b:** travel helpers `wanderPath` (seeded closed route for `animateMotion`) + `speedOf` (per-element speed spread) |
| `src/components-model/scenes.ts` | `part()` — how composite factories assemble children from registry factories |
| `src/components-model/defs/*` | 13 new/rewritten defs (4 primitives, 9 composites); every def gained real SMIL |
| `src/components-model/RenderNode.tsx` | Animation cascade + knockout-slot skip |
| `src/components/{Hierarchy,Inspector}/*` | Group/Ungroup/Duplicate/z-order/Delete as selection actions; slot swapping with registry-resolved candidates; Breadcrumb selection path |
| `src/lib/flattenSvg.tsx` | Tree → one pure-SVG tree (nested `<svg>`, no divs). **The serialization source of truth** for preview + export |
| `scripts/smoke.tsx`, `scripts/preview.tsx` | `npm run smoke` (headless render + invariant check), `npm run shots` (writes `.preview/*.svg`) |
| `scripts/importAssets.mjs` | Catalog cut from 21 files to 1 (`logoMain.svg`) — read the comment above `CATALOG` before adding anything |
| `src/state/store.ts` → `seedStarterDoc()` | Opening doc (heroLockup + radarScope + sweepModule). Called from `main.tsx` after registration, never from the store initializer |
| `src/components-model/animResolve.ts` | **Session 3.** The one implementation of enabled/inherit/cascade |
| `src/components-model/introspect.ts` | **Session 3.** Derives a kind's real control surface by running its renderer |
| `src/components/Canvas/ChildHandle.tsx` | **Session 3.** Drag/resize handle for the selected nested part |
| `src/components-model/defs/blipField.tsx` | **Session 3b.** drift/orbit travel + track trails; the reference implementation for a moving field |
| `src/state/store.ts` → `hydrateNode` | **Session 3b.** Props backfilled from the kind's factory, so adding a prop can't break a saved document |
| `docs/EXPORT.md` | **Session 4 — read before changing export.** Pipeline map, option matrix, invariants, known limits, how to add a format |
| `src/lib/svg/*` | **Session 4.** `serialize.tsx` (model → SVG string, rotated-bounds framing), `download.ts` (downloads + rich multi-MIME clipboard), `export.ts` (targets, PNG raster + clamp, `.dkl.json`) |
| `src/components/Export/*` | **Session 4.** The single export UI + the toolbar popover that hosts it |

## Next action

1. **Presets + variations (PLAN.md §8, Phase 5)** — `generateVariations(node, n, axes)` over
   seed / colorway / density / speed as an n-up picker, plus shipped protected presets and
   the snapshot history panel. The engine is parametric enough that this pays off
   immediately; scene-level re-seeding (Shuffle on a composite, which today only appears on
   parts that actually use a seed) belongs here. `.dkl.json` save/load already exists —
   presets are that plus protection and a picker.
2. **Canvas UX leftovers** — marquee + ⌘-click multi-select (`groupSelection` still groups
   the single selection, and export has no multi-select scope for the same reason),
   drag-to-reparent in Hierarchy, snapping/alignment guides.
3. More scenes from `ELEMENTS.md` §G (flight HUD, apogee plot, AI badge) — each is now a
   ~120-line composite, not an import.
4. **Phase 7 (AI foundation)** — manifest from the registry, executor against the existing
   `patchSchema.ts`, sidecar with mock turns.

### Known gaps (deliberate, not forgotten)

- Text size in `statusText`/`ringSet` labels doesn't scale with a group resize (fonts and
  strokes are size-independent by design), so shrinking a scene a long way makes labels look
  heavy. A `fontScale` on StyleConfig would fix it if it becomes a real problem.
- `modifiers` and `notes` have store actions and no UI yet (PLAN.md §5.1).
- Forking a `provenance.protected` node on first edit doesn't update the selection to the
  fork's id. Only reachable once presets ship (Phase 5).
- Export limits (all listed in `docs/EXPORT.md`): PNG is always the still frame, PNG fonts
  resolve only if installed locally (no `@font-face` embedding yet), raster scale is clamped
  to 16M px, and there's no multi-select scope — group first, then export the group.

## Known facts / gotchas (so you don't rediscover them)

- **Never import a scene SVG.** See `docs/NORTH_STAR.md`. This mistake was already made
  and reverted once.
- A child's own `<svg viewBox>` clips it — a composite part positioned partly outside its
  box gets cut flat, not bled. Size the box, don't overflow it.
- `part()` calls `componentDef()`, so `defs/index.ts` must register every primitive
  before the composites that use them (it does; keep the order).
- Reference app: `/Users/andreweaton/23andme-org-datavis/` (read-only). Port map in
  `PLAN.md` §4.
- Brand hexes live in `src/data/brand/tokens.ts`; never re-type a hex. Roles resolve
  through `src/lib/colorway.ts`.
- P-logo internals are in `src/assets/brand/logoP.ts` — never re-derive from the SVG.
- Headless visual check: `npm run shots`, then
  `qlmanage -t -s 800 -o /tmp/shots .preview/*.svg` renders PNGs you can actually look at.
  `shots` now runs the REAL export pipeline, so a preview file is exactly what Export →
  Static produces, and QuickLook opening it is a genuine third-party check. (`qlmanage`
  needs to run outside the sandbox: `required_permissions: ["all"]`.)
- Export never reads the DOM. If you find yourself reaching for `document` to build a file,
  re-read `docs/EXPORT.md` — the canvas is divs, and the model is the source.
- Dev server: Vite auto-increments off 5173 if the port is busy — check the printed port.
- `git` still has **no commits**.

## Deviations from plan

See `docs/DECISIONS.md`: 7 Phase-0 entries, the Phase-2 course-correction block (asset
policy reversal, `march` behavior, reticle/ringSet/arcSignal prop additions,
`alert.accent` retune, `addAsset`/`ungroupSelection` store extensions, knockout-slot
rendering ownership, two lockup kinds instead of one), and the Phase-3 block (the
`AnimationConfig.inherit` contract addition, container resize scaling, the nested-part
handle, registry introspection, `vectorLine` origin/fitBox), the Phase-3b block (the
`drift` behavior, `visibleWhen` receiving the node, factory prop backfill in `hydrateNode`),
and the Phase-6 block (model-based serialization instead of DOM cloning, `svgRegistry.ts`
deleted, `react-dom/server` in the bundle, PNG always static).
