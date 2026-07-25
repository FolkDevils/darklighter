/**
 * DARKLIGHTER AI PATCH SCHEMA — AUTHORITATIVE CONTRACT
 * ----------------------------------------------------
 * The validated op vocabulary the AI partner uses to edit a composition.
 * Modeled on the reference app (23andme-org-datavis/src/lib/ai/patchSchema.ts)
 * and extended with tree ops. Implement the EXECUTOR against this file
 * (Phase 7); every op maps 1:1 to a store action in src/state/contract.ts.
 *
 * `$new` aliasing (inherited): an addComponent op in a turn can be referenced
 * by later ops in the SAME turn positionally — "$new1" = first node added
 * this turn, "$new2" = second, etc. The executor resolves aliases as it runs.
 * replaceSlot also yields a $new alias for the node it creates.
 *
 * Executor rules (binding, enforced in executor.ts — not expressible in zod):
 *  1. FREEDOM MODES gate ops — see FREEDOM_MODE_OPS below. An op outside the
 *     active mode is rejected with a user-visible message, never silently
 *     dropped.
 *  2. Ops targeting `locked` nodes are rejected.
 *  3. Structural ops targeting `provenance.protected` nodes trigger
 *     store.forkProtected() first (the op then applies to the fork).
 *  4. replaceSlot validates the new kind's tags against the slot's `accepts`.
 *  5. Every applied op produces a human-readable description (describeOps
 *     pattern) so the assistant can explain what it changed.
 *  6. The executor NEVER registers new component kinds. Mode 4 output is a
 *     recipe document for developer review — see proposeComponent.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Shared fragments                                                     */
/* ------------------------------------------------------------------ */

/** A real node id, or a same-turn positional alias ("$new1", "$new2", …). */
const nodeRef = z.string().min(1);

const record = z.record(z.string(), z.unknown());

const layoutPatch = z
  .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number(), rotation: z.number() })
  .partial();

const stylePatch = z
  .object({
    colorway: z.enum(["alert", "chrome", "custom"]),
    overrides: z.record(z.string(), z.string()), // ColorRole → brand token id
    strokeScale: z.number().positive(),
    opacity: z.number().min(0).max(1),
  })
  .partial();

const animationPatch = z
  .object({
    enabled: z.boolean(),
    behavior: z
      .enum(["drawOn", "rotate", "ping", "pulse", "blink", "orbit", "pathFollow", "typewriter", "fadeIn"])
      .nullable(),
    durationMs: z.number().positive(),
    delayMs: z.number().nonnegative(),
    staggerMs: z.number().nonnegative(),
    easing: z.enum(["linear", "ease", "easeIn", "easeOut", "easeInOut"]),
    loop: z.boolean(),
    loopDelayMs: z.number().nonnegative(),
    direction: z.enum(["normal", "reverse"]),
    cascade: z.boolean(),
  })
  .partial();

/* ------------------------------------------------------------------ */
/* Ops                                                                  */
/* ------------------------------------------------------------------ */
// NOTE: `kind` fields are z.string() here and validated against the live
// component registry at execute time (the registry is open — kinds registered
// by Phase 1/2 must not require schema edits).

const opAddComponent = z.object({
  op: z.literal("addComponent"),
  kind: z.string(),
  parentId: nodeRef.optional(), // omitted = canvas root
  slot: z.string().optional(),
  layout: layoutPatch.optional(),
  props: record.optional(),
  name: z.string().optional(),
});

const opRemoveNode = z.object({ op: z.literal("removeNode"), id: nodeRef });
const opDuplicateNode = z.object({ op: z.literal("duplicateNode"), id: nodeRef });

const opReparent = z.object({
  op: z.literal("reparent"),
  id: nodeRef,
  newParentId: nodeRef.nullable(), // null = move to canvas root
  index: z.number().int().nonnegative().optional(),
});

const opReorder = z.object({
  op: z.literal("reorder"),
  id: nodeRef,
  dir: z.union([z.literal(1), z.literal(-1)]),
});

const opReplaceSlot = z.object({
  op: z.literal("replaceSlot"),
  hostId: nodeRef,
  slot: z.string(),
  kind: z.string().nullable(), // null = empty the slot
});

const opPatchProps = z.object({ op: z.literal("patchProps"), id: nodeRef, patch: record });
const opPatchStyle = z.object({ op: z.literal("patchStyle"), id: nodeRef, patch: stylePatch });
const opPatchLayout = z.object({ op: z.literal("patchLayout"), id: nodeRef, patch: layoutPatch });
const opPatchAnimation = z.object({ op: z.literal("patchAnimation"), id: nodeRef, patch: animationPatch });
const opSetName = z.object({ op: z.literal("setName"), id: nodeRef, name: z.string() });
const opSetHidden = z.object({ op: z.literal("setHidden"), id: nodeRef, hidden: z.boolean() });
const opSetSeed = z.object({ op: z.literal("setSeed"), id: nodeRef, seed: z.number().int() });

const opAddModifier = z.object({
  op: z.literal("addModifier"),
  id: nodeRef,
  defId: z.string(), // validated against the modifier registry at execute time
  params: record.optional(),
});
const opPatchModifier = z.object({
  op: z.literal("patchModifier"),
  id: nodeRef,
  index: z.number().int().nonnegative(),
  params: record,
});
const opRemoveModifier = z.object({
  op: z.literal("removeModifier"),
  id: nodeRef,
  index: z.number().int().nonnegative(),
});
const opToggleModifier = z.object({
  op: z.literal("toggleModifier"),
  id: nodeRef,
  index: z.number().int().nonnegative(),
});

const opGenerateVariations = z.object({
  op: z.literal("generateVariations"),
  id: nodeRef,
  count: z.number().int().min(1).max(200), // executor also enforces the UI cost cap
  /** Axes to vary: prop/style/animation keys with ranges or choice lists. */
  axes: z.array(
    z.object({
      target: z.enum(["props", "style", "animation", "seed"]),
      key: z.string(),
      range: z.tuple([z.number(), z.number()]).optional(),
      choices: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
    }),
  ),
});

const opSavePreset = z.object({
  op: z.literal("savePreset"),
  name: z.string(),
  nodeId: nodeRef.optional(), // omitted = whole canvas
});

const opSnapshot = z.object({
  op: z.literal("snapshot"),
  name: z.string().optional(),
  note: z.string().optional(),
});

/** Mode 3 — attach an experimental recipe to a node (stored via sidecar). */
const opAttachRecipe = z.object({
  op: z.literal("attachRecipe"),
  id: nodeRef,
  recipe: z.object({
    title: z.string(),
    request: z.string(),      // the original user ask, verbatim
    explanation: z.string(),  // AI's short reasoning
    params: record,
    /** Optional generated code (e.g. an SMIL/filter snippet). Sandboxed to
     *  presentation only — recipes NEVER execute arbitrary JS in the app. */
    code: z.string().optional(),
    dependsOn: z.array(z.string()).default([]),
  }),
});

/** Mode 4 — draft a NEW component definition for developer review. The
 *  executor writes this to data/darklighter/recipes/ as status:"proposed";
 *  it is NEVER auto-registered (see docs/EXTENDING.md, Phase 7). */
const opProposeComponent = z.object({
  op: z.literal("proposeComponent"),
  draft: z.object({
    suggestedKind: z.string(),
    label: z.string(),
    describe: z.string(),
    basedOn: z.array(z.string()).default([]), // existing kinds it extends
    propsSketch: record,
    renderSketch: z.string(), // prose or SVG sketch, not executable
    rationale: z.string(),
  }),
});

/* ------------------------------------------------------------------ */
/* Union + turn                                                         */
/* ------------------------------------------------------------------ */

export const patchOp = z.discriminatedUnion("op", [
  opAddComponent, opRemoveNode, opDuplicateNode, opReparent, opReorder,
  opReplaceSlot, opPatchProps, opPatchStyle, opPatchLayout, opPatchAnimation,
  opSetName, opSetHidden, opSetSeed,
  opAddModifier, opPatchModifier, opRemoveModifier, opToggleModifier,
  opGenerateVariations, opSavePreset, opSnapshot,
  opAttachRecipe, opProposeComponent,
]);

export type PatchOp = z.infer<typeof patchOp>;

/** One assistant turn: ordered ops + a short summary shown to the user. */
export const patchTurn = z.object({
  ops: z.array(patchOp).max(50),
  summary: z.string(),
});
export type PatchTurn = z.infer<typeof patchTurn>;

/* ------------------------------------------------------------------ */
/* Freedom modes                                                        */
/* ------------------------------------------------------------------ */

export type FreedomMode = "parameterOnly" | "composer" | "experimental" | "systemExtension";

type OpName = PatchOp["op"];

const PARAMETER_ONLY: OpName[] = [
  "patchProps", "patchStyle", "patchLayout", "patchAnimation",
  "setName", "setHidden", "setSeed",
  "patchModifier", "toggleModifier", "snapshot",
];

const COMPOSER: OpName[] = [
  ...PARAMETER_ONLY,
  "addComponent", "removeNode", "duplicateNode", "reparent", "reorder",
  "replaceSlot", "addModifier", "removeModifier",
  "generateVariations", "savePreset",
];

const EXPERIMENTAL: OpName[] = [...COMPOSER, "attachRecipe"];

const SYSTEM_EXTENSION: OpName[] = [...EXPERIMENTAL, "proposeComponent"];

/** Each mode's allowed ops. Modes are strictly cumulative. */
export const FREEDOM_MODE_OPS: Record<FreedomMode, readonly OpName[]> = {
  parameterOnly: PARAMETER_ONLY,
  composer: COMPOSER,
  experimental: EXPERIMENTAL,
  systemExtension: SYSTEM_EXTENSION,
};

export const opAllowed = (mode: FreedomMode, op: OpName): boolean =>
  FREEDOM_MODE_OPS[mode].includes(op);
