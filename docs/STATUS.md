# Darklighter — Status

> Handoff file. Update after every phase or significant stop. Keep under ~150 lines.
> Onboarding = **`docs/NORTH_STAR.md` first**, then `PLAN.md`, then this file, then
> `assets/protora/ELEMENTS.md`. Nothing else.

## Current state

- **Phase 0 (scaffold) — complete. Phase 1 (component model) — complete. Phase 2 (composites, animation, logo) — complete. Phase 3 (editing model) — complete.**
- `npm run typecheck`, `npm run build` and `npm run smoke` are green. Bundle 302 KB.
- **Session 2 (2026-07-24):** corrected a serious drift (the 21 reference SVGs had been imported as flat art) and rebuilt them as parametric, animated composites — "Phase 2 — the course correction" in `docs/DECISIONS.md`.
- **Session 3 (2026-07-24):** full audit of the selection → inspector → animation → drag path, then fixed what it found. The headline bug: a part's Animate toggle did nothing inside a cascading scene. See "Phase 3 — making every control real" in `docs/DECISIONS.md`.
- **Session 3b (2026-07-24):** contacts now MOVE. `drift` (seeded wander) and `orbit` (formation turn) join the behavior set, with track trails. See "Phase 3b — contacts that move" in `docs/DECISIONS.md`.

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
  position along a seeded closed route; `orbit` turns a whole blip formation around the
  middle of its field with the glyphs staying upright. Both come from `wanderPath`/`speedOf`
  in `src/lib/anim.ts`, so `blipField`, `craft` and `targetGlyph` share one implementation
  and any future kind is ~6 lines away. `blipField` adds Movement props (wander radius,
  route legs, track trail — ghost copies of the same route, animation-only); speed stays in
  the Animation section. Routes are closed loops starting at the origin, which is what keeps
  the paused frame and the export equal to the layout the user arranged.
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

## Key files added/changed this session

| Path | What |
| --- | --- |
| `docs/NORTH_STAR.md` | **NEW — read first.** The objective, the asset policy, the success test |
| `src/lib/anim.ts` | SMIL timing helpers (`timing`, `cycle`, `stagger`, `behaviorOf`, `DRAW_BASE`) — loop pauses are baked into keyTimes. **Session 3b:** travel helpers `wanderPath` (seeded closed route for `animateMotion`) + `speedOf` (per-element speed spread) |
| `src/components-model/scenes.ts` | `part()` — how composite factories assemble children from registry factories |
| `src/components-model/defs/*` | 13 new/rewritten defs (4 primitives, 9 composites); every existing def gained real SMIL |
| `src/components-model/RenderNode.tsx` | Animation cascade + knockout-slot skip |
| `src/lib/flattenSvg.tsx` | Tree → one pure-SVG tree (nested `<svg>`, no divs). Preview today, export pipeline tomorrow |
| `scripts/smoke.tsx`, `scripts/preview.tsx` | `npm run smoke` (headless render + invariant check), `npm run shots` (writes `.preview/*.svg`) |
| `scripts/importAssets.mjs` | Catalog cut from 21 files to 1 (`logoMain.svg`) — read the comment above `CATALOG` before adding anything |
| `src/components/Hierarchy/HierarchyPanel.tsx` | Group / Ungroup / Duplicate / z-order / Delete as selection actions |
| `src/components/Inspector/SlotsSection.tsx` | Slot swapping UI, candidates resolved from the registry by tag |
| `src/state/store.ts` → `seedStarterDoc()` | Opening doc (heroLockup + radarScope + sweepModule). Called from `main.tsx` after registration, never from the store initializer |
| `src/components-model/animResolve.ts` | **Session 3.** The one implementation of enabled/inherit/cascade |
| `src/components-model/introspect.ts` | **Session 3.** Derives a kind's real control surface by running its renderer |
| `src/components/Canvas/ChildHandle.tsx` | **Session 3.** Drag/resize handle for the selected nested part |
| `src/components/Inspector/Breadcrumb.tsx` | **Session 3.** Selection path, each crumb selectable |
| `src/components-model/defs/blipField.tsx` | **Session 3b.** drift/orbit travel + track trails; the reference implementation for a moving field |
| `src/state/store.ts` → `hydrateNode` | **Session 3b.** Props are backfilled from the kind's factory, so adding a prop can't break a saved document |

## Next action

1. **Export (PLAN.md §8)** — `flattenSvg.tsx` already produces the correct tree; wire
   Toolbar → animated SVG / static SVG (render with `animate=false`) / PNG.
2. **Variations (§10)** — `generateVariations(node, n, axes)` over seed / colorway /
   density / speed, as an n-up picker. The engine is parametric enough for this to pay off
   immediately, and scene-level re-seeding (Shuffle on a composite, which currently only
   appears on the parts that actually use a seed) belongs here.
3. **Canvas UX leftovers** — marquee + ⌘-click multi-select (`groupSelection` still groups
   the single selection), drag-to-reparent in Hierarchy, snapping/alignment guides.
4. More scenes from `ELEMENTS.md` §G (flight HUD, apogee plot, AI badge) — each is now a
   ~120-line composite, not an import.

### Known gaps (deliberate, not forgotten)

- Text size in `statusText`/`ringSet` labels doesn't scale with a group resize (fonts and
  strokes are size-independent by design), so shrinking a scene a long way makes labels look
  heavy. A `fontScale` on StyleConfig would fix it if it becomes a real problem.
- `modifiers` and `notes` have store actions and no UI yet (PLAN.md §5.1).
- Forking a `provenance.protected` node on first edit doesn't update the selection to the
  fork's id. Only reachable once presets ship (Phase 5).

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
  `qlmanage -t -s 800 -o .preview .preview/*.svg` renders PNGs you can actually look at
  (QuickLook can't do `foreignObject`, which is why previews go through `flattenSvg`).
- Dev server: Vite auto-increments off 5173 if the port is busy — check the printed port.
- `git` still has **no commits**.

## Deviations from plan

See `docs/DECISIONS.md`: 7 Phase-0 entries, the Phase-2 course-correction block (asset
policy reversal, `march` behavior, reticle/ringSet/arcSignal prop additions,
`alert.accent` retune, `addAsset`/`ungroupSelection` store extensions, knockout-slot
rendering ownership, two lockup kinds instead of one), and the Phase-3 block (the
`AnimationConfig.inherit` contract addition, container resize scaling, the nested-part
handle, registry introspection, `vectorLine` origin/fitBox), and the Phase-3b block (the
`drift` behavior, `visibleWhen` receiving the node, factory prop backfill in `hydrateNode`).
