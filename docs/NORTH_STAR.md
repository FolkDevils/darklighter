# Darklighter — North Star

> **Read this before touching anything. Re-read it whenever a session starts,
> resumes, or feels ambiguous.** PLAN.md says *how*; this says *what for*, and
> it overrides any plan step that drifts from it.

## The one sentence

Darklighter is an **animated brand-graphic generating machine** for the Protora
radar/tactical-HUD language — the same kind of tool as the reference app
(`/Users/andreweaton/23andme-org-datavis/`), but for radar art instead of
data-viz: pick parts from a gallery, arrange them, turn knobs, and get an
endless supply of on-brand animated graphics.

## The assets are the TARGET, not the product

`assets/protora/*.svg` are 21 hand-built Figma scenes. They are **reference
photographs of the destination**. They are what the engine must be able to
*generate*, not content to import.

| File | What we do with it |
| --- | --- |
| `logo_01SmallMinimized.svg` | **The one real logo.** Geometry already extracted to `src/assets/brand/logoP.ts` → built as the `logoP` component, whose radar bowl is a **slot** that accepts any live radar component. The logo is the fixed mark; things get added *into* it. |
| `logoMain.svg` | Wordmark — a fixed mark too. Imported once as a `staticAsset`. |
| **Everything else** (`Group 81`, `145`, `325`, `143`, `324`, `147`, `328`, `344`, `276`, `Frame (3)`, lockups…) | **REBUILD as parametric composites.** Never import as flat art. They are circles, arcs, dots, ticks and mono text — all programmable. |

If you catch yourself importing a scene SVG so it can be dropped on the canvas:
**stop, you have drifted.** That mistake was already made once (2026-07-24) and
reverted.

## Three properties everything must have

1. **Programmatic** — built from primitives (`ringSet`, `sweep`, `blipField`,
   `reticle`, `arcSignal`, `statusText`, `vectorLine`, `polarGrid`,
   `labelPill`, `targetGlyph`) composed into composites. Nothing is a one-off.
2. **Adjustable** — every meaningful number is a `ControlSpec` knob in the
   inspector: counts, spacing, angles, density, colorway, stroke, seed. The
   user rearranges and re-mixes; that's the whole point. One radarScope should
   yield a hundred variations.
3. **Moving** — motion is not a finishing touch, it is the deliverable. Sweeps
   rotate, rings draw on, arcs sweep, text types on, and **contacts travel**:
   blips drift and orbit with track trails, because a scope whose dots only
   flicker is a texture, not something tracking movement. Animation style is
   itself adjustable per node (behavior, duration, delay, stagger, easing, loop).

## Success test

> Generate a `radarScope` that reads as `Group 81 (1).svg`, then keep going
> where the static file can't: change the ring count, re-seed the blips, swap
> the colorway, slow the sweep, and export it animated.

Repeat for `telemetryPanel` (=`145`/`325`), `sweepModule` (=`143`/`324`),
`launchKit` (=`147`/`328`), `markLockup`, and `logoP`.

## Non-negotiable invariants (from PLAN.md §4)

1. Store actions are the only mutators (undo + AI edit log depend on it).
2. Colors are semantic roles resolved through a colorway — never hard-coded hex
   in a component.
3. All randomness flows through `node.seed` — same node, same SVG, byte-for-byte.
4. Base SVG attributes always equal the **finished** animation frame, so
   stripping SMIL yields a correct static export.
5. Registry-driven everything: registering a `ComponentDef` lights up the
   gallery, inspector, canvas, export and AI manifest with no switch statements
   anywhere.

## Reference parity checklist (what makes it feel good)

Ported from the reference app, and the bar for "done":

- [x] Live SVG thumbnails in the gallery, rendered from the real component at
      factory defaults, animating on hover.
- [x] Click-to-add, auto-select.
- [x] ControlSpec-driven inspector — declare `controls`, get real sliders,
      toggles, selects, color pickers, groups and conditional visibility.
- [x] Geometry / Style / Animation sections on every node for free.
- [x] SMIL animation with resting-frame-first + global play/pause/replay.
- [x] Composites that match the reference scenes.
- [x] Export + copy: animated SVG, static SVG, PNG, `.dkl.json` — for a part, a group, a
      scene or the canvas (`docs/EXPORT.md`).
- [ ] Variations: n-up seed/colorway picker.
- [ ] Presets with protected bases and "return to approved".
