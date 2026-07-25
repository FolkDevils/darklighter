# Darklighter — Mission-Alignment Recommendation

> Companion to `docs/MISSION.md`. This is the "how do we get there" for the manual
> (pre-AI) phase, written so a fresh session can pick it up and not drift.
>
> **Status (2026-07-25): steps 1–6 of §7 are BUILT.** The Library, the Composer,
> approval/lineage, variations, parameterized presets and the `conform` gate all
> ship. Step 7 (AI) is next and is the only major piece left. `docs/STATUS.md` has
> the current state; the reasoning below is kept because it is why the code looks
> the way it does.

## The gap, in one paragraph

The engine works: 25 registry-driven kinds, every knob real, everything animates,
everything exports. What's missing is **memory**. Nothing the user makes can become
part of the system. You can refine a `blipField` into exactly the right tracked-contact
field, and the only way to keep it is to export a file or leave it sitting on the stage.
The mission says "a living visual engine… without starting from scratch," but today
every session starts from factory defaults. **Closing that loop — human-refined work
re-entering the library as reusable material — is the single highest-value thing to
build next**, and it is also the exact substrate the AI phase needs.

---

## 1. The three-layer model (adopt this vocabulary)

Most of the confusion ahead comes from conflating these. Name them and the rest falls out.

| Layer | What it is | Who authors it | Where it lives |
| --- | --- | --- | --- |
| **Definition** | `ComponentDef` — code. The grammar: what a `ringSet` *is*, its controls, its render, its animation behaviors. | Developers today; promoted AI recipes later. | `src/components-model/defs/*.tsx` |
| **Instance** | `ComponentNode` — a live thing on the canvas with props, seed, style, children. | The user, by dragging and dialing. | The document tree |
| **Saved entry** | A frozen `ComponentNode` subtree + metadata. A "refined part" or a "finished HUD". | Human or AI, approved by human. | The **Library** (new) |

Everything you described maps onto this cleanly:

- "Save refined versions of parts" → **saved entries**, source `user`.
- "A gallery of finalized/approved ones" → saved entries with `status: "approved"`.
- "AI makes something, I approve it, it joins" → saved entries with `source: "ai"`, promoted `draft → approved` by you.
- "AI creates whole new components as a line item I can later turn real" → a **recipe**, i.e. a proposal to add a *definition*. Different layer, different pipeline, later phase.

**The critical rule: a saved entry is DATA, never a registered definition.** It will be
tempting to `defineComponent()` each saved part at runtime so it appears in the gallery
like any other kind. Don't. The moment a document references a kind that only exists in
one person's localStorage, `.dkl.json` stops being portable, `npm run smoke` can't
enumerate the registry, and determinism claims get soft. Saved entries **inline their
node tree** on placement — a copy, not a link.

---

## 2. Build the Library (highest priority)

Good news: it's half-plumbed already. `savePreset` / `loadPreset` exist as store actions,
and `darklighter:presets` is already a persisted key in `src/lib/persist.ts` — there is
simply no UI and no metadata. Upgrade that into a real thing.

### Data shape

```ts
interface LibraryEntry {
  id: string;
  name: string;
  kindHint: ComponentKind;      // root kind, for filtering/icons
  scope: "part" | "assembly";   // derived, not authored — see below
  tags: ComponentTag[];         // reuses the existing tag vocabulary
  status: "draft" | "approved";
  source: NodeSource;           // "user" | "ai" | "library"
  node: ComponentNode;          // the frozen subtree — the whole payload
  thumbnail?: string;           // static SVG string from the real export pipeline
  notes?: string;
  lineage?: { parentEntryId?: string; baseComponent?: string };
  createdAt: number;
  updatedAt: number;
}
```

### Design calls to make now

- **One library, not two.** You described saving refined *parts* and saving composed
  *HUDs* as if they were different systems. In this model they're identical — a part, a
  group, and a scene are all just a node subtree. Give them one store, one save action,
  one gallery, and filter by `scope`/`tags`. Two parallel libraries would fracture the
  taxonomy and hand the AI two APIs for one idea.
- **Derive `scope`, don't ask for it.** `node.children.length > 0 || node.kind === "composite"`
  → assembly, else part. Nobody should have to categorize their own work.
- **Thumbnails come free.** `flattenSvg` + `serializeNode` already produce a correct
  static SVG for any subtree. Store the string; the gallery renders it inline. Same
  pipeline as export means the thumbnail can never lie about what you'll get.
- **Persist to a file, not just localStorage.** localStorage is invisible to an agent.
  Keep it as the fast path, but make the library exportable/importable as
  `library.dkl-library.json`, and plan for the Phase-7 sidecar to own
  `data/darklighter/library/*.json`. **The AI phase is only as good as its ability to read
  what you approved** — that's the whole learning substrate.
- **Provenance on placement.** When a saved entry is dropped on the stage, set
  `provenance = { source, baseComponent: entryId }`. That costs nothing now and is what
  makes "update instances from library" or "push changes back" possible later without a
  migration.

### UI

A fourth tab in the existing Library panel next to Scenes / Parts / Brand: **My Parts**
(or *Approved*). Filter chips for draft/approved and part/assembly. Actions per entry:
Place, Open in Composer, Duplicate, Approve, Rename, Delete, Export. The panel already
reads the registry to build cards — this is the same card component fed from a different
source.

Add **Save to Library** in three places that all call one action: inspector header for
the selection, right-click on the canvas, and the Composer's save button.

---

## 3. The Composer — yes, build it (with one correction)

Your instinct is right and the reason is concrete: **editing a part that lives inside a
scene is genuinely worse than editing it alone.** You're clicking through siblings, the
child handle is fighting overlapping geometry, and the thing you're tuning is 300px wide
in the corner of a 1600px stage. That's a real workflow defect, not a preference.

There's a second, sharper argument you didn't make: `groupSelection` today groups a
*single* node — there is no marquee or ⌘-click multi-select. So "assemble eight parts
into one HUD and save it" is currently **impossible on the main stage**. The Composer
dodges that entirely, because in Composer *everything on the scratch stage is the
artifact* — you save the whole thing, no selection needed. That makes the Composer
cheaper to build than multi-select and it delivers the same capability sooner.

### The correction: two modes, one engine — not two apps

Do **not** build a second canvas, a second renderer, or a second document format. The
Composer is a mode over the same store, the same `RenderNode`, the same inspector, the
same export path. If it forks any of those, WYSIWYG and determinism start drifting
immediately and you'll be debugging "why does it look different in the Composer" forever.

Concretely:

```ts
// store
mode: "stage" | "composer";
composer: { entryId: string | null; root: ComponentNode; dirty: boolean } | null;
```

- The Composer holds **one root node** (usually a `composite`) on a blank field, framed
  to its own bounds, centered, no siblings, no distance.
- Canvas renders `mode === "stage" ? nodes : [composer.root]`. Same component.
- Inspector, Hierarchy, Animation, Export all bind to whichever tree is active — they
  read from the store, so they need almost no change.
- **Undo must cover both.** The history stack currently snapshots the doc; extend the
  snapshot to include composer state, or the first ⌘Z in Composer will wipe your stage.
  This is the one place to be careful.

### Flow

`New` (blank) or `Open` (a library entry, or "Edit in Composer" from a stage selection)
→ add parts from the same gallery → tune → **Save to Library** (new entry or update
existing) → `Clear`, or `Place on Stage` which inlines a copy.

### Keep on-stage editing too

Yes, keep it. Removing it would make quick tweaks require a round trip, and the mission
is about fluency. Frame it as: **stage for composition and context, Composer for
construction**. "Edit in Composer" is the escape hatch when nesting gets deep, and
"Save to Library" is available from both.

*(Naming note: PLAN §10 already uses "Component Composer" for an AI freedom mode. Rename
that mode — "Assembly" — so the workspace tab owns the word.)*

---

## 4. Parameterized presets — the bridge you'll want next

This is the idea worth planting now even though it comes after the Library and Composer.

Once you can save an assembly, the next thing you'll want is a saved assembly with **its
own knobs** — a "Tracking Panel" where `contactCount`, `colorway`, and `sweepSpeed` are
exposed at the top level instead of buried three children deep. That's a
`PresetControlSpec`: a small mapping from a new control name to a child node's prop path,
authored by picking a control in the inspector and hitting "Promote".

Why it matters to the mission: a parameterized preset is **a new component authored
entirely in the UI, with zero code, that cannot possibly violate brand logic** — because
it's built from existing defs, resolves color through the same roles, and inherits the
same determinism. It's the ladder rung between "saved thing" and "real definition", and
it's the safest possible surface to eventually hand an AI.

---

## 5. Guardrails — how to stop the "lame one-off" you described

You named the failure exactly: a new component that hard-codes its own colors and reuses
nothing. Make that mechanically impossible rather than a matter of discipline, because
the next author might be a model that has never read this file.

**Add `npm run conform`** (extend `scripts/smoke.tsx`) asserting, for every registered def:

1. **No raw hex** in `src/components-model/defs/**` — color must come through `color(role)`.
   A grep-level check; brutal and effective.
2. **Every visual choice is a control.** Cross-check `introspect.ts` usage against declared
   `controls` — a def that renders with a magic number nobody can change fails.
3. **Deterministic.** Render twice with the same seed, assert byte-identical markup.
4. **Static output is SMIL-free** and equals the resting frame (already asserted).
5. **Declares `tags`, `category`, `describe`, and `animBehaviors`** — these are what make
   it findable by the gallery, by slots, and by the future AI manifest. A def without tags
   is invisible to the system even if it renders.

Then write **`docs/EXTENDING.md`** as a hard checklist ("adding a component: these 5
things or it doesn't merge") and make `conform` the gate. Any AI-authored contribution,
now or later, has to pass the same test a human does. That is what keeps the engine an
engine.

---

## 6. Where AI plugs in (design for it now, build it later)

You're right to finish the manual loop first. But build the manual loop *in the shape the
AI will need*, which costs nothing extra:

- **The Library is the AI's memory.** Approved entries are the strongest possible signal
  of "what good looks like" — far better training context than the raw component registry.
  This is why it must be file-backed.
- **The manifest reads both layers.** Registry defs (grammar) + approved library entries
  (vocabulary). "Make me a tracking panel" should resolve against things you approved.
- **Every action you build should already exist as a patch op.** `savePreset` and
  `snapshot` are already in `src/lib/ai/patchSchema.ts`. Add library/composer ops there as
  you build them, even before an executor exists — then AI capability is a matter of
  wiring, not redesign.
- **New definitions stay a human-gated pipeline.** AI writes a *recipe*
  (`data/darklighter/recipes/*.json`: intent, params, composition, preview SVG, status),
  never a registered def. You review, and a separate dev agent promotes it by writing a
  real def that passes `conform`. Exactly the two-agent loop you described — and the
  `conform` gate is what makes it safe to say yes.

---

## 7. Recommended sequence

Ordered by unblocking power, manual-phase first.

| # | Work | Why here | |
| --- | --- | --- | --- |
| 1 | **Library**: `LibraryEntry` type, store slice, persistence + file export, My Parts tab, Save/Place/Approve | Nothing else matters until refined work can be kept. Half-plumbed already. | ✅ |
| 2 | **Composer mode**: store mode + scratch root, canvas branch, Save/Open/Clear/Place, undo covering both | Makes assemblies buildable at all (sidesteps the multi-select gap) | ✅ |
| 3 | **Approval + lineage**: draft/approved, protected bases, "return to approved", entry duplication | Turns a pile of saves into a curated system | ✅ |
| 4 | **Variations** (`generateVariations` + n-up picker, scene-level shuffle) | The "endless" half of the mission; trivial once the engine is parametric, which it is | ✅ |
| 5 | **Parameterized presets** ("Promote to control") | UI-authored components; the safest AI surface | ✅ |
| 6 | **`conform` gate + `docs/EXTENDING.md`** | Do before handing anything to a model, not after | ✅ |
| 7 | **AI plumbing**: manifest (registry + library), executor against `patchSchema`, mock turns, recipe storage | Everything above is its substrate | next |

Deliberately deprioritized: marquee/⌘-click multi-select (the Composer covers the need),
drag-to-reparent, snapping guides. Real polish, but they don't move the mission.

---

## 8. What I'd push back on

- **Two separate galleries for parts vs assemblies** — one library, filtered. Same object.
- **Registering saved entries as live component kinds** — breaks portability and
  determinism (§1). Inline the tree instead.
- **A standalone Composer document/app** — same store or WYSIWYG erodes (§3).
- **Letting AI write component code before `conform` exists** — the gate is the only thing
  standing between "the brand is a system" and "the brand is 40 one-offs" (§5).

Everything else in your plan I'd build as described.
