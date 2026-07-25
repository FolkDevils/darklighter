# Darklighter — Mission

Darklighter turns Protora’s visual language into a programmable system of modular parts that can generate endless static and animated graphics, HUDs, symbols, charts, and data visualizations—all built from the same brand logic.

Its mission is to make the brand itself usable: a living visual engine that can be directed by people or AI to create new, consistent expressions without starting from scratch.

---

> Full build recommendation for getting there: **`docs/RECOMMENDATION.md`** (the
> three-layer model, the Library, the Composer, and the guardrails that keep new
> work inside the brand system).

## How to optimize toward this mission

Ranked by how much they close the gap between “component studio that can hit the reference kit” and “living brand engine.”

### 1. Make generation the default loop (not editing alone)

Today the app is strongest at *assembling and dialing* a scene. The mission wants *endless new expressions*.

- Ship **variations** next (PLAN Phase 5): n-up over seed / colorway / density / speed, with one-click apply.
- Add **Shuffle** at the scene level (composite re-seed), not only on leaf parts that use a seed.
- Treat every gallery item as a **starting recipe**, not a finished sticker — protected presets + “return to approved” so people explore without losing the brand base.

### 2. Finish the “usable brand” surface

A living engine needs save, recall, and branch — not just export.

- **Protected presets** for `logoP`, classic `radarScope`, `markLockup` (and later chart/HUD recipes).
- **Snapshot history** with favorite / reject / notes — that preference signal is what an AI director later learns from.
- Keep `.dkl.json` as the brand artifact format: config is the source; SVG/PNG are renders.

### 3. Grow the language, don’t grow the sticker pile

Mission scope includes HUDs, symbols, charts, and data viz — still from *the same brand logic*, not a second product.

- Extend via **new primitives + composites** from `ELEMENTS.md` §G (flight HUD, apogee plot, badges) and then chart primitives (readout bars, scales, sparklines, polar plots) that reuse colorways, mono type, stroke rules, and animation behaviors.
- Never import scene SVGs as flat art. Reference files stay targets; registry components stay the only path into the canvas.
- Retire or rewrite docs that still read like an asset drop folder (`ELEMENTS.md` “when to use this SVG”; PLAN static-import lists). Point them at “rebuild as kinds.”

### 4. Put AI on the critical path of the mission (plumbing first)

“Directed by people or AI” is half the mission sentence — not a Phase-7 nice-to-have.

- Build the **manifest + executor + mock turns** against the existing `patchSchema` so direction is ops on the component tree, not chat that hopes.
- Expose **freedom modes** early (parameter-only → composer → experimental) so AI stays inside brand logic.
- Wire AI to the same store actions humans use — one mutation path keeps undo, export, and determinism honest.

### 5. Align the docs so every session steers the same way

- Make **this file** the mission; keep `NORTH_STAR.md` as the engineering invariants (programmatic / adjustable / moving / no flat scene imports).
- Update PLAN onboarding: Mission → North Star → Status → Elements.
- Resolve naming once: **Protora** is the brand; PROTON-only wording in catalogs should die.
- Soften the old “not a chart builder” line: charts are in scope *when they speak Protora* (tokens, roles, mono HUD type, seeded determinism) — not generic BI chrome.

### 6. Keep the quality bar that makes the engine trustworthy

These already match the mission; don’t trade them away for speed:

- Semantic color roles through colorways — never hard-coded hex in components.
- Seeded determinism — same config, same bytes.
- Base frame = static export; motion is real tracking, not texture flicker.
- Registry-driven gallery / inspector / export / AI — one new `ComponentDef` lights up the whole engine.

---

## Success test (mission-shaped)

A person (or mock AI turn) can: open a protected Protora base → generate a grid of variations → pick one → swap a symbol or chart module → export static and animated → reopen the `.dkl` and get the same graphic.

If that loop feels faster than opening Figma and starting from a Group SVG, the mission is landing.
