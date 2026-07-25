/**
 * Dumps every registered component's frame to .preview/<kind>.svg so the
 * generated scenes can be eyeballed (and compared against the reference files
 * in assets/protora/) without opening the app.
 *
 *   npx vite build --ssr scripts/preview.tsx --outDir .preview-build \
 *     && node .preview-build/preview.js
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import "@/components-model/defs";
import { allComponentDefs } from "@/components-model/registry";
import { flattenNode } from "@/lib/flattenSvg";
import { BRAND_TOKENS } from "@/data/brand/tokens";

const OUT = ".preview";
mkdirSync(OUT, { recursive: true });

const PAD = 24;

for (const def of allComponentDefs()) {
  const node = def.factory();
  const { w, h } = node.layout;
  // Resting frame, not the animated one: a still rasterizer would freeze an
  // animated tree at t=0 (everything mid-reveal), and the resting frame is
  // what static export must look like anyway.
  const inner = renderToStaticMarkup(
    flattenNode({ ...node, layout: { ...node.layout, x: PAD, y: PAD } }, false)!,
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w + PAD * 2}" height="${h + PAD * 2}" viewBox="0 0 ${w + PAD * 2} ${h + PAD * 2}">
<rect width="100%" height="100%" fill="${BRAND_TOKENS.blimpWhite}"/>
${inner}
</svg>`;
  writeFileSync(`${OUT}/${def.kind}.svg`, svg, "utf8");
  console.log(`${OUT}/${def.kind}.svg  ${w}×${h}`);
}
