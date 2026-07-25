/**
 * Side-effect import barrel — every `defs/<kind>.tsx` calls `defineComponent`
 * at module scope, so importing this file once (see `src/main.tsx`) is
 * enough to populate the whole registry.
 *
 * Order matters: composite scene factories call `componentDef(...)` for their
 * parts, so every primitive must be registered before the composites below.
 */
import "./composite";
import "./staticAsset";

// Primitives
import "./ringSet";
import "./sweep";
import "./polarGrid";
import "./targetGlyph";
import "./reticle";
import "./arcSignal";
import "./blipField";
import "./statusText";
import "./labelPill";
import "./vectorLine";
import "./craft";
import "./trajectory";
import "./readoutBar";
import "./cornerFrame";

// Composites — generated scenes, rebuilt from the primitives above
import "./radarScope";
import "./telemetryPanel";
import "./sweepModule";
import "./launchKit";
import "./focusArcs";
import "./pingCraft";
import "./markLockup";
import "./logoP";
