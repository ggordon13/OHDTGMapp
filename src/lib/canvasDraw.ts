// ---------------------------------------------------------------------------
// Shared 2D-canvas primitives for the app's hand-painted share cards.
//
// The cards are painted rather than rasterised from the DOM (see
// `lib/shareCardCanvas` for why), which means every rounded rect, gradient and
// tracked heading has to be drawn by hand. These are those hands. Two cards use
// them now — the progress card and the Food Track day card — and they agree on
// typeface, geometry and text metrics because they share this file.
// ---------------------------------------------------------------------------

export type Ctx = CanvasRenderingContext2D;

/** The app's display face. Loaded up front by {@link prepareCardAssets}. */
export const FONT = "Fredoka, sans-serif";

// --- Assets -----------------------------------------------------------------

export interface CardAssets {
  /** null when the logo can't be loaded — cards fall back to a wordmark. */
  logo: HTMLImageElement | null;
}

let assetsPromise: Promise<CardAssets> | null = null;

const loadLogo = () =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/logo.png";
  });

/**
 * Web fonts and the logo, so the first paint isn't drawn in a fallback face.
 * Memoised — every card in a session shares the one load.
 */
export function prepareCardAssets(): Promise<CardAssets> {
  assetsPromise ??= (async () => {
    if (typeof document !== "undefined" && document.fonts) {
      // A single size is enough — it loads the whole face.
      await Promise.all([
        document.fonts.load(`700 16px ${FONT}`),
        document.fonts.load(`600 16px ${FONT}`),
      ]).catch(() => undefined);
    }
    return { logo: await loadLogo() };
  })();
  return assetsPromise;
}

// --- Shapes -----------------------------------------------------------------

/** roundRect() by hand — Safari 15 and jsdom don't have the built-in. */
export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Top-to-bottom gradient across [y, y + h]. */
export function vGradient(ctx: Ctx, y: number, h: number, stops: string[]): CanvasGradient {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  stops.forEach((c, i) => g.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), c));
  return g;
}

export function circle(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
}

/**
 * A rounded plate: gradient face, hard rim. The 1px inset means the 2px stroke
 * lands inside the box rather than straddling its edge, which is what keeps
 * everything provably within the card's bounds.
 */
export function plate(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | string[],
  rim: string,
  lineWidth = 2,
) {
  roundRectPath(ctx, x + 1, y + 1, w - 2, h - 2, r);
  ctx.fillStyle = Array.isArray(fill) ? vGradient(ctx, y, h, fill) : fill;
  ctx.fill();
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = rim;
  ctx.stroke();
}

// --- Text -------------------------------------------------------------------

/** Width of `text` at the context's current font, including letter tracking. */
export function textWidth(ctx: Ctx, text: string, tracking: number): number {
  if (tracking === 0) return ctx.measureText(text).width;
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + tracking;
  return Math.max(0, w - tracking);
}

export interface TextOpts {
  font: string;
  color: string;
  align?: "left" | "center" | "right";
  /** Extra space between glyphs, mirroring Tailwind's `tracking-*`. */
  tracking?: number;
}

/** Draws `text` with `y` as its vertical centre. Returns the width drawn. */
export function drawText(ctx: Ctx, text: string, x: number, y: number, o: TextOpts): number {
  ctx.font = o.font;
  ctx.fillStyle = o.color;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const tracking = o.tracking ?? 0;
  const w = textWidth(ctx, text, tracking);
  let cursor = o.align === "center" ? x - w / 2 : o.align === "right" ? x - w : x;
  if (tracking === 0) {
    ctx.fillText(text, cursor, y);
    return w;
  }
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + tracking;
  }
  return w;
}

/** Largest size in [min, max] that fits `maxW`, so long names still fit. */
export function fitFont(ctx: Ctx, text: string, maxW: number, max: number, min: number): string {
  let size = max;
  while (size > min) {
    ctx.font = `700 ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxW) break;
    size -= 1;
  }
  return `700 ${size}px ${FONT}`;
}

/** Trims to fit, with an ellipsis. Assumes the caller already set the font. */
export function ellipsize(ctx: Ctx, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}
