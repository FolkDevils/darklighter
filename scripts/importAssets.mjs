/**
 * Brand asset import pipeline (PLAN.md §11 Phase 2 step 2).
 *
 * Reads the untouched Figma exports in assets/protora/ and emits sanitized,
 * normalized modules into src/assets/brand/generated/. Run with `npm run assets`
 * after adding or replacing a source SVG.
 *
 * Sanitizing does three things and deliberately nothing else — geometry and
 * colors are preserved byte-faithfully so an imported asset looks exactly like
 * the delivered file:
 *   1. strips the XML prolog, comments, <title>/<desc>, and the root element
 *      (we supply our own <svg> so layout controls the box),
 *   2. namespaces every id (Figma reuses `clip0_1_2` across files, which
 *      collides the moment two assets are on the canvas together) and rewrites
 *      every url(#…) / href="#…" reference to match,
 *   3. records the palette, mapping each hex onto the nearest brand token so
 *      later phases can recolor without re-parsing the markup.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = join(ROOT, "assets/protora");
const OUT_DIR = join(ROOT, "src/assets/brand/generated");

/** Brand tokens, duplicated here because this script runs outside the TS build. */
const BRAND_TOKENS = {
  blimpWhite: "#F0EEDF",
  redAlert: "#FE3B1F",
  burntDroneBrown: "#330000",
  desertSand: "#E9D3BC",
  armyGreen: "#5E6532",
  bloodRed: "#780606",
  tealSky: "#9BCCC7",
  electronicIceBlue: "#00FFFF",
  hudChrome: "#450810",
  gridTeal: "#5C7A76",
};

/**
 * WHAT GETS IMPORTED — read docs/NORTH_STAR.md before adding to this list.
 *
 * Only FIXED MARKS are imported: the wordmark and the named drone
 * silhouettes in assets/protora/drones/. Everything else in assets/protora/
 * (the radar scopes, telemetry panels, sweep modules, launch kits, craft
 * cards) is a TARGET the engine must generate from primitives — those live
 * as composite ComponentDefs in src/components-model/defs/, not as flat art.
 * Importing a scene here would ship a one-off graphic the user can't vary,
 * which is the opposite of the product.
 *
 * The P mark is deliberately absent: its geometry is extracted in
 * src/assets/brand/logoP.ts and rebuilt by defs/logoP.tsx so its radar bowl
 * can hold live components. The drones ARE imported: each is a single-ink
 * planform the `craft` component swaps by name (defs/craft.tsx).
 *
 * Labels transcribed from assets/protora/ELEMENTS.md (the "Group NNN"
 * filenames are not semantic) and from the drone filenames themselves.
 */
const CATALOG = [
  ["logoMain.svg", "protoraWordmark", "PROTORA Wordmark", "brand", "Horizontal PROTORA wordmark, single ink."],
  ["drones/X47C.svg", "x47c", "X47C", "craft", "X-47C flying-wing drone planform."],
  ["drones/nEUROn.svg", "nEUROn", "nEUROn", "craft", "nEUROn stealth UCAV planform."],
  ["drones/X45C.svg", "x45c", "X45C", "craft", "X-45C unmanned combat air vehicle planform."],
  ["drones/Sentinel.svg", "sentinel", "Sentinel", "craft", "Sentinel high-altitude UAV planform."],
  ["drones/mobile_01.svg", "mobile01", "Mobile 01", "craft", "Mobile 01 ground unit planform."],
];

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Nearest brand token within a tolerance, so near-miss reds still map home. */
function nearestToken(hex) {
  const [r, g, b] = hexToRgb(hex);
  let best = null;
  let bestDist = Infinity;
  for (const [id, tokenHex] of Object.entries(BRAND_TOKENS)) {
    const [tr, tg, tb] = hexToRgb(tokenHex);
    const dist = Math.hypot(r - tr, g - tg, b - tb);
    if (dist < bestDist) {
      bestDist = dist;
      best = id;
    }
  }
  return bestDist <= 72 ? best : null;
}

function sanitize(raw, slug) {
  let svg = raw
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<title>[\s\S]*?<\/title>/g, "")
    .replace(/<desc>[\s\S]*?<\/desc>/g, "")
    .trim();

  const openTag = svg.match(/<svg\b[^>]*>/);
  if (!openTag) throw new Error(`no <svg> root in ${slug}`);

  const viewBoxAttr = openTag[0].match(/viewBox="([^"]+)"/);
  const widthAttr = openTag[0].match(/width="([\d.]+)"/);
  const heightAttr = openTag[0].match(/height="([\d.]+)"/);
  let w;
  let h;
  if (viewBoxAttr) {
    const [, , vw, vh] = viewBoxAttr[1].trim().split(/[\s,]+/).map(Number);
    w = vw;
    h = vh;
  } else if (widthAttr && heightAttr) {
    w = Number(widthAttr[1]);
    h = Number(heightAttr[1]);
  } else {
    throw new Error(`no viewBox or width/height in ${slug}`);
  }

  let markup = svg.slice(openTag.index + openTag[0].length, svg.lastIndexOf("</svg>"));

  // Namespace ids so two assets on one canvas can't fight over `clip0_1_2`.
  const ids = [...new Set([...markup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))];
  for (const id of ids) {
    const safe = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    markup = markup
      .replace(new RegExp(`(\\sid=")${safe}(")`, "g"), `$1${slug}_${id}$2`)
      .replace(new RegExp(`url\\(#${safe}\\)`, "g"), `url(#${slug}_${id})`)
      .replace(new RegExp(`((?:xlink:)?href=")#${safe}(")`, "g"), `$1#${slug}_${id}$2`);
  }

  const palette = [...new Set([...markup.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase()))]
    .sort()
    .map((hex) => ({ hex, token: nearestToken(hex) }));

  return { w, h, markup: markup.trim(), palette };
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const header = (file) =>
  `/* GENERATED by scripts/importAssets.mjs from assets/protora/${file} — do not edit. */\n`;

const index = [];
for (const [file, slug, label, category, describe] of CATALOG) {
  const { w, h, markup, palette } = sanitize(readFileSync(join(SRC_DIR, file), "utf8"), slug);
  const escaped = markup.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
  writeFileSync(
    join(OUT_DIR, `${slug}.ts`),
    `${header(file)}export const markup = \`${escaped}\`;\n`,
    "utf8",
  );
  index.push({ slug, label, category, describe, w, h, palette, file });
  console.log(`${slug.padEnd(20)} ${String(w).padStart(5)}×${String(h).padEnd(5)} ${palette.length} colors`);
}

const indexSource = `/* GENERATED by scripts/importAssets.mjs — do not edit. */
import type { BrandAsset } from "../assets";
${index.map((a) => `import { markup as ${a.slug} } from "./${a.slug}";`).join("\n")}

export const GENERATED_ASSETS: BrandAsset[] = [
${index
  .map(
    (a) => `  {
    id: "${a.slug}",
    label: ${JSON.stringify(a.label)},
    category: "${a.category}",
    describe: ${JSON.stringify(a.describe)},
    source: ${JSON.stringify(a.file)},
    viewBox: { w: ${a.w}, h: ${a.h} },
    palette: [${a.palette.map((p) => `{ hex: "${p.hex}", token: ${p.token ? `"${p.token}"` : "null"} }`).join(", ")}],
    markup: ${a.slug},
  },`,
  )
  .join("\n")}
];
`;
writeFileSync(join(OUT_DIR, "index.ts"), indexSource, "utf8");
console.log(`\n${index.length} assets written to src/assets/brand/generated/`);
