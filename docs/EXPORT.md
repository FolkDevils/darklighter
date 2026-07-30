# Darklighter — Export

> Everything about getting art out of the app: copy, download, PNG, `.dkl.json`.
> Read this before changing anything under `src/lib/svg/`.

## The one thing to understand

**Export serializes the MODEL, not the canvas DOM.**

The reference app (`23andme-org-datavis`) clones the live `<svg>` element out of
the page, because one graphic there is one `<svg>`. Darklighter can't: a node
tree is composed with nested absolutely-positioned `<div>`s so parent transforms
never distort child stroke widths (PLAN.md §5.1). Cloning a group's DOM would
hand you HTML with sibling `<svg>`s inside — markup no other tool opens.

So `src/lib/flattenSvg.tsx` re-composes any subtree as one group tree, and
export renders that through `renderToStaticMarkup`. One clean document, whether
the target is one part, a group, a scene, or the whole canvas.

**Composition is `<g transform>`, never a nested `<svg>`.** A nested viewport is
the natural translation of a positioned div and browsers render it correctly,
but Figma's importer does not implement nested viewports: it discards the inner
`viewBox` scale and clips to the frame, so pasted marks arrived cropped and
undersized — worst on the fixed art, whose renderers draw into a native viewBox
much larger than their box. `flattenSvg` now resolves x/y, `viewBox` and
`preserveAspectRatio` into an explicit transform itself, including inside a
component's own render output, so nothing but the root element is an `<svg>`.

WYSIWYG is guaranteed **by construction, not by inspection**: flatten and canvas
call the same `def.Render` and the same `resolveAnimation`. Static export is
simply the paused frame (`animate: false`) — nothing is stripped after the fact,
because base attributes already equal the finished frame (invariant #4).

## Files

| Path | Role |
| --- | --- |
| `src/lib/flattenSvg.tsx` | Tree → one pure-SVG group tree. The serialization source of truth. |
| `src/lib/svg/serialize.tsx` | React tree → SVG string. Root frame, background, `xmlns`, XML declaration, rotated-bounds framing. |
| `src/lib/svg/download.ts` | Blobs out: file downloads, rich multi-MIME clipboard, `slugify`. Ported from the reference. |
| `src/lib/svg/export.ts` | What the UI calls: targets, filenames, PNG rasterizing, `.dkl.json` build/parse/pick. |
| `src/components/Export/ExportActions.tsx` | The only export UI. Rendered by both surfaces below. |
| `src/components/Export/ExportMenu.tsx` | Toolbar popover — holds the Selection/Canvas scope switch. |
| `src/components/Inspector/InspectorPanel.tsx` | "Export" section for the selected node (same component). |

## What a user can do

Scope is either **a node** (part, group, scene — all the same thing) or **the
canvas**. From the toolbar popover or the inspector's Export section:

| | Download | Copy |
| --- | --- | --- |
| Animated SVG | ✅ SMIL intact, replays when opened | ✅ SMIL intact; supported motion becomes Figma Timeline keyframes |
| Static SVG | ✅ resting frame — the Figma-safe one | ✅ vector markup |
| PNG | ✅ 1× / 2× / 4×, transparent unless background is on | ✅ 2× as pixels |
| `.dkl.json` | ✅ reopens with every knob/seed/animation | ✅ as text |

Plus: **⇧⌘C** copies the selection as SVG (animated while playing, static while
paused), and the toolbar's **Open** loads a `.dkl.json` back onto the canvas.

Node exports are framed to the node's own box with 24px padding, so a file
starts at the graphic rather than wherever it sat on the canvas. Canvas exports
keep the full 1600×1200 stage so layer positions survive.

## Invariants this pipeline depends on

1. **Base attributes = finished frame.** A component that animates *into* view
   must render its resting state without SMIL, or static export shows nothing.
   Motion-only decoration (drift trail ghosts) must be gated on `animate`.
2. **No DOM ids that can collide.** Anything emitting `id=`/`url(#…)` namespaces
   it per node (`logoP` uses `logop-mask-${node.id}`). Two copies of a component
   in one canvas export must not fight over an id.
3. **Colors resolve to hex.** No CSS variables reach a component's output; a
   file has no stylesheet to inherit from.
4. **Determinism.** Same node, same seed → byte-identical markup. `npm run smoke`
   asserts a `.dkl.json` round-trip produces the identical document.

## Known limits (deliberate, documented so nobody re-discovers them)

- **PNG is always the static frame.** An `<img>` runs its own SMIL clock that
  can't be seeked, so an animated source would rasterize an arbitrary moment.
- **PNG fonts:** the SVG decodes in an isolated context, so only font families
  installed on the machine resolve. Text-heavy exports are safer as SVG. Fixing
  this needs `@font-face` with base64 woff2 embedded into the document.
- **Raster ceiling:** scale is clamped so `w×h ≤ 16M px` (Safari's canvas limit);
  a 4× canvas PNG comes out closer to 2.3×, and the filename records the real
  scale.
- **Figma Timeline imports supported SMIL, but its transform model differs.**
  Figma converts supported animation into native keyframes and rotates around
  the imported layer frame rather than preserving an SVG `animateTransform`
  pivot. Rotating components therefore need explicit, invisible motion bounds
  centered on that pivot (`sweep` is the reference implementation). Unsupported
  SVG features may still fall back to their resting frame; **Copy static**
  remains the dependable no-motion route.
- **`mask-type: luminance`** is emitted as a style attribute on `logoP`'s mask.
  Browsers and QuickLook honour it; unusual renderers may not.
- **No multi-select export.** The store's selection is a single path today
  (marquee/⌘-click is still open) — group first (⌘G), then export the group.
- **No PDF/EPS, no video.** An animated SVG is the motion deliverable; a GIF/MP4
  would need a headless browser or a frame-by-frame rasterizer.

## Adding another output format

1. Build the bytes in `src/lib/svg/export.ts` (reuse `buildSvg`; don't reach into
   the DOM).
2. Add the download/copy verb to `src/lib/svg/download.ts` if the MIME type is
   new.
3. Add one button to `ExportActions.tsx` — both surfaces pick it up automatically.
4. Add an assertion to `scripts/smoke.tsx` (every kind must serialize; static
   must stay SMIL-free).
5. Note anything surprising in the limits list above and in `docs/DECISIONS.md`.

## Checking it without a browser

```sh
npm run smoke   # every kind serializes; static has no SMIL; .dkl.json round-trips
npm run shots   # writes .preview/<kind>.svg THROUGH the real export pipeline
qlmanage -t -s 1000 -o /tmp/shots .preview/*.svg   # renders them outside the app
```

`npm run shots` uses `serializeNode`, so a preview file *is* what Export → Static
produces. QuickLook rendering them correctly is a genuine third-party check.
