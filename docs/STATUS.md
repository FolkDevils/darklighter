# Darklighter — Status

> Handoff file. Update after every phase or significant stop. Keep under ~180 lines.
> Onboarding = **`docs/MISSION.md`, then `docs/NORTH_STAR.md`**, then `PLAN.md`, then
> this file, then `assets/protora/ELEMENTS.md`. Nothing else.
> Deep dives, only when you're touching that area: `docs/EXPORT.md`,
> `docs/EXTENDING.md` (before adding a component), `docs/RECOMMENDATION.md` (why the
> Library and Composer are shaped the way they are).

## Current state

- **Phases 0–3 complete (scaffold, component model, composites/animation/logo, editing model). Phase 6 (export) complete. Phase 5 (library, composer, variations) complete — presets became a Library, see below. Phase 7 (AI) is next and is now the only major piece left.**
- `npm run check` (typecheck + smoke + **conform**), `npm run build` and `npm run shots` are green. Bundle 457 KB (`react-dom/server` is in there on purpose — see the Phase 6 decisions; ~20 KB of that is imported mesh geometry).
- **Session 2 (2026-07-24):** corrected a serious drift (the 21 reference SVGs had been imported as flat art) and rebuilt them as parametric, animated composites — "Phase 2 — the course correction" in `docs/DECISIONS.md`.
- **Session 3 (2026-07-24):** full audit of the selection → inspector → animation → drag path, then fixed what it found. The headline bug: a part's Animate toggle did nothing inside a cascading scene. See "Phase 3 — making every control real" in `docs/DECISIONS.md`.
- **Session 3b (2026-07-24):** contacts now MOVE. `drift` (seeded wander) and `orbit` (formation turn) join the behavior set, with track trails. See "Phase 3b — contacts that move" in `docs/DECISIONS.md`.
- **Session 4 (2026-07-24):** export + copy shipped (Phase 6, out of plan order because it's what makes the tool usable): animated/static SVG, rich-clipboard copy, PNG, `.dkl.json` out and back in, for a part, a group, a scene or the canvas. **`docs/EXPORT.md` is the reference.**
- **Session 5 (2026-07-25):** the mission was written down (`docs/MISSION.md`) and the app audited against it (`docs/RECOMMENDATION.md`). The gap: **the engine had no memory** — nothing a user refined could re-enter the system. Built the Library, the Composer, variations, promoted controls and the `conform` gate. See "Phase 5" in `docs/DECISIONS.md`.

## The three layers (say these words; they prevent most confusion)

| Layer | What | Who authors | Where |
| --- | --- | --- | --- |
| **Definition** | `ComponentDef` — code, the grammar | devs; promoted AI recipes later | `components-model/defs/*` |
| **Instance** | `ComponentNode` on the canvas | anyone, by dragging and dialing | the document tree |
| **Saved entry** | frozen subtree + approval state | anyone; a human approves | the Library (`lib/library.ts`) |

Most "we need a new component" moments are layer 3: build it in the Composer, promote
its knobs, save it. **A saved entry is never registered as a kind** — that would make a
`.dkl.json` reference something that exists only in one browser's localStorage.

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

- **27 registered components**, all live in the gallery with animating thumbnails:
  - *Primitives:* `ringSet`, `sweep`, `polarGrid`, `targetGlyph`, `reticle`, `arcSignal`,
    `blipField`, `statusText`, `labelPill`, `vectorLine`, `craft`, `wireMesh`, `trajectory`,
    `readoutBar`, `cornerFrame`
  - *Generated scenes:* `radarScope` (=Group 81), `telemetryPanel` (=145/325),
    `sweepModule` (=143/324), `launchKit` (=147/328), `focusArcs` (=344),
    `pingCraft` (=276), `signalIntercept`, `markLockup`, `heroLockup`, `logoP`
- **One part is 3D.** `wireMesh` spins an imported model (`WINGWATCHER.glb`) as vector line
  work, with rotation, tilt, perspective, spin axis and five detail levels as controls
  (**Rotation** aims the paused frame, so any attitude in the turn can be exported). Three looks:
  **frame** (the default — stations, stringers and profiles sliced off the full-resolution
  model, i.e. a naval lines plan, which is what a technical illustration draws), **wire**
  (the decimated triangle mesh; gets busier rather than clearer as detail rises) and
  **solid** (filled silhouette). Geometry is imported offline by `npm run mesh` and
  projected per frame at render time, so the paused frame is real geometry that exports as
  one editable path. **Read the Phase 5c decisions before touching it** — the frame-baked
  SMIL is what keeps a 3D part inside the static-export invariant, and the entries record
  which approaches were tried and rejected on this mesh.
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
- **Refined work is keepable.** Inspector ▸ Library ▸ **Save to Library** (or ⌘S) freezes
  any node as a `LibraryEntry`; the gallery's **Saved** tab places it back, marks it
  approved, protects it as a base, duplicates, renames, and exports/imports the whole
  library as `.dkl-library.json` (the portable, agent-readable form — localStorage is the
  fast path, not the source of truth). A protected base's placements fork on first edit and
  **Return to base** restores the pristine tree.
- **Two workspaces, one engine.** The toolbar switches **Stage** (arrange finished pieces)
  and **Composer** (build one part or HUD alone on a blank field, then save it). The
  composer stashes the stage document and swaps `nodes`, so the inspector, hierarchy,
  animation, keyboard and export paths are literally the same code. Its whole stage is the
  artifact — which is how assembly works today despite `groupSelection` still being
  single-node.
- **Assemblies can have their own knobs.** Select a nested part, hit **⤴** beside any
  control, and it becomes a top-level control on the assembly (Inspector ▸ Controls).
  That's a new component authored with no code, and it can't break brand rules because
  it's made of parts that already can't.
- **Variations.** The Variations panel generates 6/12/24 deterministic alternatives over
  seed / colorway / density / speed; Apply swaps the look in place, Keep saves it to the
  library without touching the canvas. "More" walks to the next batch of one infinite
  deterministic sequence — it is not a re-roll.

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
| `scripts/importMesh.mjs` | **Session 6.** `.glb` → decimated point/face list (`npm run mesh`). Dependency-free GLB parse + deterministic vertex clustering; LODs are grid resolutions, tune by reading the printed counts |
| `src/assets/mesh/meshes.ts` | **Session 6.** The hand-written half of the mesh pipeline (type, lookup, option lists), exactly parallel to `assets/brand/assets.ts` |
| `src/lib/mesh3d.ts` | **Session 6.** 3D → SVG projection: one `d` string per rotation step, one path with many subpaths. The header explains why not WebGL |
| `src/components-model/defs/wireMesh.tsx` | **Session 6.** The spinning model part |
| `src/components-model/animResolve.ts` | **Session 3.** The one implementation of enabled/inherit/cascade |
| `src/components-model/introspect.ts` | **Session 3.** Derives a kind's real control surface by running its renderer |
| `src/components/Canvas/ChildHandle.tsx` | **Session 3.** Drag/resize handle for the selected nested part |
| `src/components-model/defs/blipField.tsx` | **Session 3b.** drift/orbit travel + track trails; the reference implementation for a moving field |
| `src/state/store.ts` → `hydrateNode` | **Session 3b.** Props backfilled from the kind's factory, so adding a prop can't break a saved document |
| `docs/EXPORT.md` | **Session 4 — read before changing export.** Pipeline map, option matrix, invariants, known limits, how to add a format |
| `src/lib/svg/*` | **Session 4.** `serialize.tsx` (model → SVG string, rotated-bounds framing), `download.ts` (downloads + rich multi-MIME clipboard), `export.ts` (targets, PNG raster + clamp, `.dkl.json`) |
| `src/components/Export/*` | **Session 4.** The single export UI + the toolbar popover that hosts it |
| `docs/MISSION.md`, `docs/RECOMMENDATION.md` | **Session 5 — read MISSION first.** The objective in two sentences, and the build recommendation everything below implements |
| `src/lib/library.ts` | **Session 5.** `LibraryEntry`, persistence, derive scope/tags, `.dkl-library.json` import/merge. **Entries are DATA — never register one as a kind** (the comment at the top says why) |
| `src/state/store.ts` | **Session 5.** `library` slice + `mode`/`composer`/`stageStash`, `composerArtifact`, `instanceOf`, `applyVariation`, exposed-control actions |
| `src/components/Library/MyPartsTab.tsx` | **Session 5.** The Saved gallery: place, approve, protect, duplicate, rename, export/import |
| `src/components/Composer/ComposerBar.tsx` | **Session 5.** Composer mode's only chrome; the header comment explains why it's a mode and not a second canvas |
| `src/components-model/exposed.ts` | **Session 5.** Promoted knobs. Targets are CHILD-INDEX PATHS, not ids — placement re-ids the tree |
| `src/lib/variations.ts` | **Session 5.** Deterministic n-up over seed/colorway/density/speed, offset-addressed batches |
| `scripts/conform.tsx`, `docs/EXTENDING.md` | **Session 5.** The component contract as a gate (`npm run conform`) and its rulebook. Run before accepting any new component, human or AI |

## Next action

1. **Phase 7 (AI foundation)** — the only major piece left, and everything above is its
   substrate. Manifest from **both** layers (registry defs = grammar, approved library
   entries = vocabulary); executor against the existing `patchSchema.ts`; sidecar with mock
   turns; freedom modes. Add library/composer ops to `patchSchema.ts` as you go. New
   *definitions* stay human-gated: AI writes a recipe, you approve it, a dev agent promotes
   it to a def that passes `npm run conform` (`docs/EXTENDING.md`).
2. **Move the library to the sidecar** — localStorage is invisible to an agent, and approved
   entries are the strongest signal of "what good looks like" that Phase 7 will have.
   `data/darklighter/library/*.json`, same shape as the export file.
3. **Canvas UX leftovers** — marquee + ⌘-click multi-select (`groupSelection` still groups
   the single selection, and export has no multi-select scope for the same reason),
   drag-to-reparent in Hierarchy, snapping/alignment guides. The Composer covers the
   assembly case, which is why this dropped down the list.
4. **Snapshot history panel** (PLAN.md §8) — the store actions and localStorage key exist;
   the panel is still `PhasePlaceholder`. Favorite/reject metadata is training signal for #1.
5. More scenes from `ELEMENTS.md` §G (flight HUD, apogee plot, AI badge) — each is now a
   ~120-line composite, not an import. Chart/data-viz primitives belong here too, built from
   the same tokens and behaviors (`docs/MISSION.md` puts them in scope).

### Known gaps (deliberate, not forgotten)

- Text size in `statusText`/`ringSet` labels doesn't scale with a group resize (fonts and
  strokes are size-independent by design), so shrinking a scene a long way makes labels look
  heavy. A `fontScale` on StyleConfig would fix it if it becomes a real problem.
- `modifiers` and `notes` have store actions and no UI yet (PLAN.md §5.1).
- Forking a `provenance.protected` node on first edit doesn't update the selection to the
  fork's id — reachable now that protected bases exist, so worth fixing next time it bites.
- Library entries are **copies, not links**: editing an entry doesn't update instances
  already on a canvas. `provenance.baseComponent` is recorded on every placement so
  "update instances from library" can be added later without a migration.
- Promoted controls are dropped if the assembly's child order changes (they address targets
  by index path). The inspector shows "Target missing" instead of failing silently.
- The library lives in localStorage; the export/import file is the portable form. Moving it
  behind the sidecar is item 2 under Next action.
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
- **`npm run conform` before adding or accepting a component** (`docs/EXTENDING.md`). It
  will reject a raw hex, an off-palette output color, a prop with no control, a
  non-deterministic render, or a static frame that isn't the resting frame. That list is
  the difference between a brand system and forty one-offs.
- **Composer mode edits the same `nodes` array as the stage** — the stage document is parked
  in `stageStash`. Any new action you write works in both modes for free; anything that
  reaches around the store for "the canvas" will not.
- Promoted controls address their target by child-INDEX path, not by node id, because
  placing a library entry clones the tree with fresh ids. `npm run smoke` proves it.
- `wireMesh` is the one heavy component: markup is `points × frames`, so the default is ~267 KB
  animated against ~15 KB static, and Max detail is roughly four times that. Deliberate, with
  both knobs exposed; don't "fix" it by hard-coding a lower detail. `npm run mesh` regenerates
  the geometry and must stay deterministic — a different mesh would silently redraw every saved
  document using it. The two top detail levels are also what pushed the bundle from 411 KB to
  857 KB; most of that is the triangulated mesh at Ultra/Max, which is the look that benefits
  least from them.
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
deleted, `react-dom/server` in the bundle, PNG always static), and the Phase-5 block (the
three-layer model, entries as data rather than registered kinds, one library instead of two,
no stored thumbnails, the Composer as a mode over the same store, `ComponentNode.exposed`,
deterministic variations, and the `conform` gate).
