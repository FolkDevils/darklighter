/**
 * Getting bytes out of the browser: file downloads and clipboard writes.
 * Ported from the reference app (`src/lib/svg/download.ts`, PLAN.md §4 "PORT")
 * and extended with raster/blob variants for PNG.
 *
 * The clipboard part is the fiddly one and the reason this is a shared module:
 * design tools only accept a vector paste if the clipboard carries the right
 * MIME types, and browsers disagree about which ones they'll take.
 */

/** Trigger a browser download for any blob. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on a later tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(filename: string, text: string, mime: string): void {
  downloadBlob(filename, new Blob([text], { type: `${mime};charset=utf-8` }));
}

export const downloadSVG = (filename: string, svg: string): void =>
  downloadText(ext(filename, "svg"), svg, "image/svg+xml");

export const downloadJSON = (filename: string, json: string): void =>
  downloadText(filename, json, "application/json");

const ext = (name: string, e: string) => (name.endsWith(`.${e}`) ? name : `${name}.${e}`);

/**
 * Copy SVG as rich clipboard content, so a design tool receives an actual
 * vector asset (defs, masks and all) rather than a wall of XML text.
 *
 * Three representations are offered at once and browsers pick: Chromium takes
 * `image/svg+xml` directly, some WebKit builds reject it and need HTML, and
 * `text/plain` is what a code editor pastes. `richSvg` may be a static,
 * design-tool-safe counterpart of animated `svg`: Figma consumes the rich
 * vector while a code editor still receives the complete animated XML.
 * Falls back progressively rather than failing outright.
 */
export async function copySvg(svg: string, richSvg = svg): Promise<boolean> {
  const inline = richSvg.replace(/^<\?xml[^>]*>\s*/i, "");
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      const plain = new Blob([svg], { type: "text/plain" });
      const html = new Blob([`<div>${inline}</div>`], { type: "text/html" });
      const vector = new Blob([richSvg], { type: "image/svg+xml" });
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/svg+xml": vector, "text/html": html, "text/plain": plain }),
        ]);
        return true;
      } catch {
        await navigator.clipboard.write([new ClipboardItem({ "text/html": html, "text/plain": plain })]);
        return true;
      }
    }
    await navigator.clipboard.writeText(svg);
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText(svg);
      return true;
    } catch {
      return false;
    }
  }
}

/** Copy plain text (used for `.dkl.json`, where markup semantics are wrong). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy a raster image — what Slack, Keynote and Figma paste as pixels.
 *
 * Takes a *pending* blob on purpose: Safari only honours a clipboard write
 * inside the gesture that triggered it, and rasterizing takes an image decode
 * plus a `toBlob`. `ClipboardItem` accepts a promise, so the write is claimed
 * immediately and the bytes arrive late.
 */
export async function copyImage(blob: Blob | Promise<Blob>, type = "image/png"): Promise<boolean> {
  try {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return false;
    await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

/** Filename-safe slug of a node/document name. */
export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "darklighter";
