import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

/**
 * react-rnd bundles react-draggable, which reads `process.env.DRAGGABLE_DEBUG`
 * at runtime — nothing defines `process` in a browser, so the first node mount
 * throws "process is not defined". Two substitutions are needed because they
 * cover different pipelines: `define` handles our source and the production
 * bundle, while dev-mode dependency pre-bundling ignores `define` and uses
 * `optimizeDeps.esbuildOptions.define` instead — which *replaces* Vite's own
 * defaults, hence re-declaring NODE_ENV so React still builds in dev mode.
 */
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    "process.env": {},
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || mode),
        "process.env": "{}",
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    // Sidecar (server/) is wired in Phase 7 — proxy /api once it exists:
    // proxy: { "/api": { target: "http://localhost:8787", changeOrigin: true } },
  },
}));
