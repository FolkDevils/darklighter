import "./ExportActions.css";
import { useState } from "react";
import type { ExportTarget } from "@/lib/svg/export";
import {
  copyDoc,
  copyPng,
  copySvgMarkup,
  downloadDoc,
  downloadPng,
  downloadSvgFile,
  targetName,
  targetSize,
} from "@/lib/svg/export";
import { useDarklighter } from "@/state/store";
import { surfaceOf } from "@/lib/colorway";
import { Toggle } from "@/components/common/fields";

const PNG_SCALES = [1, 2, 4] as const;

type Flash = { text: string; ok: boolean } | null;

/**
 * The one export UI (PLAN.md §9, docs/EXPORT.md). Both the toolbar popover and
 * the inspector section render this, differing only in which `target` they hand
 * it — a part, a group, a whole scene and the canvas are all just a target,
 * because the document is a tree.
 *
 * Animated and static sit side by side on purpose: SMIL replays in a browser
 * and does not survive a Figma paste, so that choice belongs to the user at the
 * moment of export rather than to a preference screen.
 */
export function ExportActions({ target }: { target: ExportTarget }) {
  const background = useDarklighter((s) => s.background);
  const [withBackground, setWithBackground] = useState(target.scope === "canvas");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);

  // `surface` is sent even when the backdrop isn't: a transparent export still
  // has to be inked for the canvas it was designed on.
  const opts = {
    animated: false,
    background: withBackground ? background.color : null,
    surface: surfaceOf(background.color),
  };
  const size = targetSize(target, opts);
  const say = (text: string, ok = true) => {
    setFlash({ text, ok });
    setTimeout(() => setFlash(null), 1600);
  };

  const run = async (label: string, work: () => Promise<boolean> | boolean, whenFailed: string) => {
    setBusy(true);
    try {
      const ok = await work();
      say(ok ? label : whenFailed, ok);
    } finally {
      setBusy(false);
    }
  };
  const copied = (label: string, work: () => Promise<boolean>) =>
    run(label, work, "Clipboard unavailable");

  return (
    <div className="exp" aria-busy={busy}>
      <p className="exp-scope">
        {target.scope === "canvas" ? "Whole canvas" : targetName(target)}
        <span className="exp-scope-kind">
          {size.w}×{size.h}
        </span>
      </p>

      <p className="exp-head">SVG</p>
      <div className="exp-grid">
        <button type="button" className="btn" title="SMIL animation intact — replays when opened in a browser"
          onClick={() => downloadSvgFile(target, { ...opts, animated: true })}>
          ↓ Animated
        </button>
        <button type="button" className="btn" title="Resting frame only — this is the one to open in Figma"
          onClick={() => downloadSvgFile(target, opts)}>
          ↓ Static
        </button>
        <button type="button" className="btn" onClick={() => copied("Copied animated SVG", () => copySvgMarkup(target, { ...opts, animated: true }))}>
          ⧉ Copy animated
        </button>
        <button type="button" className="btn" onClick={() => copied("Copied static SVG", () => copySvgMarkup(target, opts))}>
          ⧉ Copy static
        </button>
      </div>

      <p className="exp-head">PNG <span className="exp-note">still frame</span></p>
      <div className="exp-grid">
        {PNG_SCALES.map((s) => (
          <button key={s} type="button" className="btn" title={`PNG at ${s}× — transparent unless the background is on`}
            onClick={() => run(`Saved PNG @${s}×`, () => downloadPng(target, opts, s), "Couldn't rasterize")}>
            ↓ {s}×
          </button>
        ))}
        <button type="button" className="btn" title="Copy a 2× raster — for Slack, Keynote, anywhere that wants pixels"
          onClick={() => copied("Copied PNG", () => copyPng(target, opts, 2))}>
          ⧉ Copy 2×
        </button>
      </div>

      <p className="exp-head">Editable</p>
      <div className="exp-grid">
        <button type="button" className="btn" title="Reopens in Darklighter with every knob, seed and animation intact"
          onClick={() => downloadDoc(target, background)}>
          ↓ .dkl.json
        </button>
        <button type="button" className="btn" onClick={() => copied("Copied JSON", () => copyDoc(target, background))}>
          ⧉ Copy JSON
        </button>
      </div>

      <div className="exp-foot">
        <Toggle checked={withBackground} onChange={setWithBackground} label="Include background" />
      </div>
      {flash && <p className={`exp-flash${flash.ok ? "" : " bad"}`}>{flash.text}</p>}
    </div>
  );
}
