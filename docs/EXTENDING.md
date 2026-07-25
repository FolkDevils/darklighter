# Darklighter — Extending the engine

> Read before adding a component, and before accepting one an AI drafted.
> `npm run conform` enforces most of this. If it passes, you're in the system.

## The three layers (know which one you're touching)

| Layer | What | Who adds it | Where |
| --- | --- | --- | --- |
| **Definition** | `ComponentDef` — code; the grammar | Developers, and promoted AI recipes | `src/components-model/defs/*.tsx` |
| **Instance** | `ComponentNode` — a live thing on the canvas | Anyone, by dragging and dialing | The document tree |
| **Saved entry** | A frozen subtree + approval state | Anyone; a human approves | The Library (`src/lib/library.ts`) |

Most "we need a new component" moments are actually layer 3. **Build an assembly
in the Composer, promote the knobs you care about, and save it** — that's a new
component with no code, and it cannot violate brand logic because it is made of
components that already don't. Only reach for a new definition when you need
geometry the primitives can't express.

---

## Adding a definition — the checklist

Create `src/components-model/defs/<kind>.tsx`, then add a side-effect import to
`defs/index.ts` **after** every kind it composes (`part()` calls
`componentDef()` at module scope, so order is load-bearing).

The file does three things: declare a props interface, augment
`KindPropsRegistry` by declaration merging, and call `defineComponent`.

### 1. Color comes from roles, never from hex

```tsx
// wrong — invisible to every colorway, and to the whole system
<circle stroke="#FE3B1F" />

// right
<circle stroke={color("primary")} />
```

Roles are `primary · accent · ink · field · friendly · hostile · electric`. The
colorway answers (`src/lib/colorway.ts`); the component only asks.
*Gate: no raw hex in a def file, and every hex in rendered output must be a
color some colorway can produce.* Literal black/white are allowed — that's mask
luminance, not paint.

### 2. Every meaningful number is a control

If it changes what the thing looks like, it's a `ControlSpec`, not a constant.
The factory's props object is the full list of what a kind supports — declare
optional props explicitly (`inkRole: undefined`) so the contract is visible.

*Gate: every factory prop has a control, and every control names a real prop.*
Genuinely internal props go in `UNCONTROLLED` in `scripts/conform.tsx`, with a
reason.

### 3. Deterministic — all randomness through `node.seed`

Same node in, same markup out, byte for byte. Use the seeded RNG; never
`Math.random()`, never `Date.now()`, never an id that isn't derived from
`node.id`.

*Gate: two renders of one node are compared.*

### 4. Base attributes equal the FINISHED animation frame

Static export is just `animate: false` — nothing is stripped afterwards. A
component that animates *into* view must render its arrived state without SMIL,
or it exports as nothing. Motion-only decoration (trail ghosts) is gated on
`animate`.

*Gate: static output carries no SMIL and nothing is `opacity="0"` at rest.*

### 5. Declare what makes it findable

`tags` (slot acceptance + AI reasoning), `category` (gallery grouping),
`describe` (one line, surfaced in tooltips and the AI manifest), `label`,
`animBehaviors` (first entry is the default), `acceptsChildren`.

A def without tags can never fill a slot, and the assistant can't reason about
it. *Gate: all present; SMIL of its own requires declared behaviors.*

### 6. Namespace any DOM id you emit

Two copies of a component in one export must not fight over `url(#…)`. Use
`` `mything-${node.id}` `` (see `logoP`).

---

## Before you commit

```sh
npm run check    # typecheck + smoke + conform
npm run shots    # writes .preview/*.svg through the REAL export pipeline
qlmanage -t -s 1000 -o /tmp/shots .preview/*.svg   # look at them
```

Then update `docs/STATUS.md`, and log anything irreversible in
`docs/DECISIONS.md`.

---

## Accepting AI-authored work

Same gate, no exceptions — that's the point of having one. The intended loop
(docs/RECOMMENDATION.md §6):

1. The assistant writes a **recipe**, not code: intent, params, a composition of
   existing kinds, a preview. Stored as data, never registered.
2. You review it in the app and approve it into the library if it's good.
3. A separate developer agent promotes an approved recipe to a real definition
   by writing a def that passes `npm run conform`.

The failure this prevents is specific and worth naming: a plausible-looking new
component that hard-codes its own colors and reuses nothing. It renders fine. It
also turns "the brand is a system" into "the brand is forty one-offs", and no
amount of documentation catches it at 2am. The gate does.
