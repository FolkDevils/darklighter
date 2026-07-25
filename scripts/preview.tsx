/**
 * Dumps every registered component to .preview/<kind>.svg so the generated
 * scenes can be eyeballed (and compared against the reference files in
 * assets/protora/) without opening the app.
 *
 * These files come out of the REAL export pipeline (`src/lib/svg/serialize`),
 * so looking at a preview is also a check on what a user would get from
 * Export → Static, and `npm run shots` doubles as an export smoke test.
 *
 *   npx vite build --ssr scripts/preview.tsx --outDir .preview-build \
 *     && node .preview-build/preview.js
 */
import { mkdirSync, writeFileSync } from "node:fs";
import "@/components-model/defs";
import { allComponentDefs } from "@/components-model/registry";
import { serializeNode } from "@/lib/svg/serialize";

const OUT = ".preview";
mkdirSync(OUT, { recursive: true });

for (const def of allComponentDefs()) {
  const node = def.factory();
  // Resting frame, not the animated one: a still rasterizer would freeze an
  // animated tree at t=0 (everything mid-reveal), and the resting frame is
  // what static export must look like anyway.
  const svg = serializeNode(node, {
    animated: false,
    background: "blimpWhite",
    padding: 24,
    declaration: false,
  });
  writeFileSync(`${OUT}/${def.kind}.svg`, svg, "utf8");
  console.log(`${OUT}/${def.kind}.svg  ${node.layout.w}×${node.layout.h}  ${svg.length} bytes`);
}
