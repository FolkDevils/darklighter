# Elements — SVG asset catalog

Quick-read index for AIs building apps with this kit. **Do not open every SVG** — use this file first, then open only the 1–3 files you need.

**Location:** `/elements` (21 SVGs, Figma-exported path art; almost no live `<text>` — letterforms are outlined paths.)

**Brand:** **PROTON** (wordmark + radar mark) and **PROTORA™** (product/system wordmark appearing in HUD composites). Visual language = tactical HUD / radar / telemetry: concentric range rings, sweep arcs, target glyphs, monospaced status copy, aircraft/drone silhouettes.

---

## Design system (shared across files)

### Official brand palette (from approved swatch board, 2026-07-24)

Primary: **Blimp White** `#F0EEDF` (default background) · **Red Alert** `#FE3B1F` · **Burnt Drone Brown** `#330000`
Secondary ("in theatre"): **Desert Sand** `#E9D3BC` · **Army Green** `#5E6532` · **Blood Red** `#780606` · **Teal Sky** `#9BCCC7` · **Electronic Ice Blue** `#00FFFF`

The asset-observed hexes below map onto these: `#450810` HUD chrome ≈ Blood Red family, hot-red variants ≈ Red Alert, lime `#5CC11A` role superseded by Army Green, cream = Blimp White, cyan = Electronic Ice Blue.

### Palette (as observed in the SVG files)

| Token | Hex | Role |
| --- | --- | --- |
| Ink / deep | `#330000` | Logos, dark fills, some craft silhouettes |
| HUD chrome | `#450810` | Default UI stroke/fill for most Group 319–344 assets |
| Signal red | `#FE3B1F`, `#FF1C3A`, `#FF400C`, `#FF1C00`, `#FF1D25` | Hot accents, blips, “alert” variants |
| Mid reds | `#7A0D1C`, `#A81127` | Layered glow / screen-blend blips |
| Cyan | `#00FFFF` | Outer range ring accent (full radar scene) |
| Lime | `#5CC11A` | Friendly / alternate target marks |
| Teal grid | `#5C7A76` | Polar grid behind wordmark |
| Cream | `#F0EEDF` | Soft field in full mark+radar lockup |
| Soft teal | `#9BCCC7` | Occasional secondary HUD accent |

**Two color “skins” for the same motifs:**

1. **Hot red** (`#FE3B1F` family) — brighter, demo/alert energy  
2. **Dark maroon** (`#450810`) — quieter chrome for dense UI  

Near-duplicates below are often the same composition in these two skins.

### Recurring motifs (building blocks)

- **Range rings** — concentric circles, often labeled `2NM` / `4NM` / … / `10NM`
- **Sweep / signal arcs** — nested quarter-arcs ending in arrowheads; sometimes a dashed outer sweep
- **Target glyphs** — square+dot, circle, circle+X, plain X, hex “bolt”, corner brackets around blips
- **Reticles** — crosshair + small concentric circles at cardinal points
- **Status copy** — monospaced all-caps; common strings: `TELEMETRY`, `SYSTEM`, `CONFIG TARGET SUCCESSFUL`, `UNITS AQUIRED`, `DATA_042`, `WASPS IN FORMATION… AQUIRED`, `STANDBY - ID: 3B-19`
- **Craft** — delta-wing / stealth planform; MQ-9–like Reaper; small “wasp” formation craft
- **Blend modes** — `screen`, `color-dodge`, `multiply`, `luminosity` used for glow blips and layered radar (especially `Frame (3)`, `Group 322`, `markwithAccentRadar`)

Spelling note: several assets intentionally use **`AQUIRED`** (one C) and **`ARITIFICIAL`** — preserve if matching the kit.

---

## Consolidated catalog

### A. Brand / logos (start here for identity)

| File | What it is | When to use |
| --- | --- | --- |
| `logoMain.svg` | Horizontal **PROTON** wordmark only (`#330000`). Wide, clean. | Nav, splash, headers |
| `logo_01SmallMinimized.svg` | Icon mark: bold **P** with white radar reticle (rings + crosshair) punched through the bowl; small secondary glyphs at bottom. | App icon, favicon, avatar |
| `Markwith acentleftsmalle accent.svg` | Compact lockup: circular radar mark (rings + sweep arm + blips) **left** + wordmark **right**. Lightest of the lockups (~12KB). | Inline brand, toolbar |
| `markwithAccentRadar.svg` | Full lockup: **PROTON** wordmark with large red radar fan / polar grid / blips behind the right side of the type. Heaviest file (~255KB); many opacity + blend layers + gradient. | Hero, marketing, splash — prefer simpler lockups for UI chrome |

**AI tip:** Prefer `logoMain` + `logo_01SmallMinimized` / `Markwith acentleftsmalle accent` for product UI. Reach for `markwithAccentRadar` only when you need the cinematic radar fan.

---

### B. Full radar / HUD scenes

| File | What it is | Notes |
| --- | --- | --- |
| `Group 81 (1).svg` | Complete polar radar on `#330000` field: 5 rings (inner red, outer **cyan**), NM labels `2`–`10`, mixed target set (white squares with drop lines, X marks in lime + red). | Best “whole scope” reference scene |
| `Frame (3).svg` | Atmospheric HUD: dark bg, large glowing orange-red ring, soft **screen-blend** blips, corner-bracket locks, hex + dashed vector + white glyph cluster. | Mood / hero background; not a clean component sheet |

---

### C. Telemetry radar modules (near-duplicates)

Same idea: small 2NM/4NM scope + framing reticles + corner labels (`TELEMETRY`, `UNITS AQUIRED :15`, vertical `SYSTEM`, `CONFIG TARGET SUCCESSFUL`, `*** DATA_042`).

| Hot red | Dark maroon | Prefer |
| --- | --- | --- |
| `Group 145.svg` | `Group 325.svg` | Same layout; pick by skin. `325` is monochrome `#450810`. |

Also related:

| File | Diff |
| --- | --- |
| `Group 322.svg` | Expanded telemetry **component sheet**: large circle, PROTORA label, hex bolts labeled `DR:090`, crosshairs, dotted vector — more icon inventory than a single panel. Uses screen/color-dodge layers like `Frame (3)`. |

---

### D. Sweep / boot / status modules (near-duplicates)

Nested signal arcs + `%` readout + terminal boot lines (`SYSTEM >>> ***ACTIVATED***`, `INITIATING SWEEP`, etc.).

| Hot red | Dark maroon | Diff |
| --- | --- | --- |
| `Group 143.svg` | `Group 324.svg` | `324` adds **PROTORA™** wordmark; both share the arc + `87%` + log block |

Related arc motif:

| File | What it is |
| --- | --- |
| `Group 344.svg` | Bidirectional concentric arcs (nodes L/R, inward arrowheads at apex) + standby status row + PROTORA™. Good “focus / handshake” graphic. |

---

### E. Launch / aircraft / formation kits (near-duplicates)

Trajectory arcs, timestamp + coords (`07:43:30 GMT-8`, `051.4700° N` / `000.4543° W`), aircraft silhouette, `TELEMETRY` pill, standby status, nav arrow buttons, X/box glyphs.

| Hot / multi | Dark maroon | Diff |
| --- | --- | --- |
| `Group 147.svg` | `Group 328.svg` | Same kit; `328` also includes **four small “wasp” formation silhouettes** + a textured range/progress bar |

---

### F. Craft & vehicle

| File | What it is |
| --- | --- |
| `Group 276.svg` | Stealth/delta craft silhouette (`#330000`) inside concentric **red** ping rings; small upward marker below. Strong “ownship / tracked unit” icon. |
| `Group 278.svg` | Top-down **Reaper**-style drone (`#330000`) + caption block: “Reaper”, eye + skull icons, “Military Surveillance / Attack”, operator country codes, Arabic line. Spec-card asset, not abstract HUD chrome. |

---

### G. Flight HUD / plots / system badges

| File | What it is |
| --- | --- |
| `Group 319.svg` | Cockpit-style HUD fragment: heading tape, airspeed/altitude boxes, pitch ladder, flight-path marker, `M 0.55`, `ATC`, struck-through `ACQ`. |
| `Group 320.svg` | Dual bell-curve plot over “APOGEE CALCULATED” + lat/lon + `ALT: 29,5000`. Trajectory/orbit readout. |
| `Group 321.svg` | **ML** map-pin badge with circuit nodes + “PROTORA ADVANCED MACHINE LEARNING” plaque (`FIRST-WATCH TECH`, `AGILE & SWIFT`, formation warning lines). Brand/module badge. |
| `Group 323.svg` | Mission-log sheet: dual coord columns, MLRS-like launcher icon, stars, `DOMIRA — DECODING // ACCESS GRANTED`, `EXPORT PACKAGE` pill, vertical `DRK` / `LTR`. |
| `Group 326.svg` | **AI.** display type (star in A) + intelligence status lines + binary `ACTIVATED` stream. AI-module branding. |

---

## Suggested picks for an app (minimal set)

If you only need a few files:

| Need | Open |
| --- | --- |
| Wordmark | `logoMain.svg` |
| App icon | `logo_01SmallMinimized.svg` |
| Compact brand | `Markwith acentleftsmalle accent.svg` |
| Full radar scene | `Group 81 (1).svg` |
| Telemetry panel | `Group 325.svg` (or `145` for hot red) |
| Sweep / loading | `Group 324.svg` (or `143`) |
| Aircraft + status | `Group 328.svg` (or `147`) |
| Ownship ping | `Group 276.svg` |
| Atmospheric bg | `Frame (3).svg` |
| Hero lockup | `markwithAccentRadar.svg` |

Skip the rest unless you need that specific module (HUD tape, apogee plot, ML badge, Reaper card, AI badge, Domira log).

---

## Implementation notes for AIs

1. **Treat filenames as opaque** — Figma “Group NNN” names are not semantic; this catalog is the source of truth.
2. **Colors are baked into paths** — recolor by search-replace hex values or CSS `currentColor` only after simplifying; many files use multiple fills.
3. **No editable text** — copy is outlined. To make live data, recreate labels in app UI fonts and keep glyphs/rings as SVG.
4. **Large files** — `markwithAccentRadar.svg` (~255KB) and dense Groups (`323`, `326`, `328`, `147`) are expensive; cache/rasterize for lists.
5. **Blend modes** need a dark or compositing backdrop to look correct (`Frame (3)`, `Group 322`, parts of the full lockup).
6. **Transparent backgrounds** — most Groups sit on white artboards in export; place on dark `#330000` / `#450810` for on-brand UI.

---

## Flat file index

| File | Size (approx) | Category |
| --- | --- | --- |
| `logoMain.svg` | 4KB | Brand — wordmark |
| `logo_01SmallMinimized.svg` | 3KB | Brand — P + reticle icon |
| `Markwith acentleftsmalle accent.svg` | 12KB | Brand — mark + wordmark |
| `markwithAccentRadar.svg` | 255KB | Brand — full radar lockup |
| `Group 81 (1).svg` | 25KB | Scene — full NM radar |
| `Frame (3).svg` | 38KB | Scene — glowing HUD atmosphere |
| `Group 143.svg` | 41KB | Sweep module (hot) |
| `Group 324.svg` | 45KB | Sweep module (maroon) + PROTORA |
| `Group 145.svg` | 47KB | Telemetry radar (hot) |
| `Group 325.svg` | 47KB | Telemetry radar (maroon) |
| `Group 322.svg` | 68KB | Telemetry component sheet |
| `Group 147.svg` | 75KB | Launch / aircraft kit (hot) |
| `Group 328.svg` | 75KB | Launch / aircraft kit (maroon) + wasps |
| `Group 344.svg` | 39KB | Focus arcs + status + PROTORA |
| `Group 276.svg` | 32KB | Craft + ping rings |
| `Group 278.svg` | 53KB | Reaper vehicle card |
| `Group 319.svg` | 25KB | Flight HUD |
| `Group 320.svg` | 25KB | Apogee plot |
| `Group 321.svg` | 52KB | ML / PROTORA badge |
| `Group 323.svg` | 104KB | Mission log / Domira |
| `Group 326.svg` | 86KB | AI. module badge |
