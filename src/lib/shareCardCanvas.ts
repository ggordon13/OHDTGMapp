// ---------------------------------------------------------------------------
// The shareable progress card, painted straight onto a <canvas>.
//
// This used to be a DOM node rasterised with html2canvas, which re-implements
// layout badly: centred text drifted off its baseline, the rank plate collided
// with the label above it, and the pip disappeared. Painting the card by hand
// means the preview and the exported PNG are the same pixels, every time.
//
// All geometry is in CSS pixels; `scale` is the device-pixel multiplier.
// ---------------------------------------------------------------------------

import { getRank } from "@/lib/ranks";

export interface ShareCardData {
  name: string;
  level: number;
  streak: number;
  day: number;
  totalDays: number;
  pct: number;
}

// --- Layout -----------------------------------------------------------------

const PAD = 20; // card padding
const LOGO_H = 44;
const GAP_LOGO = 16;
const PANEL_PAD = 20;
const TITLE_H = 24;
const MEDAL = 84;
const STREAK_H = 44;
const LABEL_H = 16;
const BAR_GAP = 6;
const BAR_H = 14;
const ROW_GAP = 16;
const FOOTER_H = 16;
const GAP_FOOTER = 14;

const PANEL_TOP = PAD + LOGO_H + GAP_LOGO;
const PANEL_H =
  PANEL_PAD * 2 + TITLE_H + ROW_GAP + MEDAL + ROW_GAP + STREAK_H + ROW_GAP + LABEL_H + BAR_GAP + BAR_H;

export const CARD_WIDTH = 400;
export const CARD_HEIGHT = PANEL_TOP + PANEL_H + GAP_FOOTER + FOOTER_H + PAD;

const FONT = "Fredoka, sans-serif";
const INK = "hsl(24, 42%, 16%)";
const MUTED = "hsl(27, 24%, 42%)";

// --- Assets -----------------------------------------------------------------

export interface ShareCardAssets {
  /** null when the logo can't be loaded — the card falls back to a wordmark. */
  logo: HTMLImageElement | null;
}

let assetsPromise: Promise<ShareCardAssets> | null = null;

const loadLogo = () =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/logo.png";
  });

/** Web fonts and the logo, so the first paint isn't drawn in a fallback face. */
export function prepareShareCard(): Promise<ShareCardAssets> {
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

// --- Drawing helpers --------------------------------------------------------

type Ctx = CanvasRenderingContext2D;

/** roundRect() by hand — Safari 15 and jsdom don't have the built-in. */
function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
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
function vGradient(ctx: Ctx, y: number, h: number, stops: string[]): CanvasGradient {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  stops.forEach((c, i) => g.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), c));
  return g;
}

function circle(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
}

/** Width of `text` at the context's current font, including letter tracking. */
function textWidth(ctx: Ctx, text: string, tracking: number): number {
  if (tracking === 0) return ctx.measureText(text).width;
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + tracking;
  return Math.max(0, w - tracking);
}

interface TextOpts {
  font: string;
  color: string;
  align?: "left" | "center" | "right";
  /** Extra space between glyphs, mirroring Tailwind's `tracking-*`. */
  tracking?: number;
}

/** Draws `text` with `y` as its vertical centre. Returns the width drawn. */
function drawText(ctx: Ctx, text: string, x: number, y: number, o: TextOpts): number {
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

/** Largest size in [min, max] that fits `maxW`, so long nicknames still fit. */
function fitFont(ctx: Ctx, text: string, maxW: number, max: number, min: number): string {
  let size = max;
  while (size > min) {
    ctx.font = `700 ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxW) break;
    size -= 1;
  }
  return `700 ${size}px ${FONT}`;
}

/** Trims to fit, with an ellipsis. Assumes the caller already set the font. */
function ellipsize(ctx: Ctx, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

function drawStar(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  const inner = r * 0.47;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Flame silhouette, `h` tall and centred on (cx, cy). */
function drawFlame(ctx: Ctx, cx: number, cy: number, h: number, color: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(h, h);
  ctx.beginPath();
  ctx.moveTo(0, -0.5);
  ctx.bezierCurveTo(0.1, -0.3, 0.39, -0.16, 0.39, 0.1);
  ctx.bezierCurveTo(0.39, 0.33, 0.21, 0.5, 0, 0.5);
  ctx.bezierCurveTo(-0.21, 0.5, -0.39, 0.33, -0.39, 0.1);
  ctx.bezierCurveTo(-0.39, -0.06, -0.26, -0.15, -0.16, -0.3);
  ctx.bezierCurveTo(-0.1, -0.16, -0.02, -0.26, 0, -0.5);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

// --- The card ---------------------------------------------------------------

/**
 * Paints the card at `scale` device pixels per CSS pixel and sizes the canvas
 * (both its backing store and its CSS box) to match.
 */
export function paintShareCard(
  canvas: HTMLCanvasElement,
  data: ShareCardData,
  assets: ShareCardAssets,
  scale = 2,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = Math.round(CARD_WIDTH * scale);
  canvas.height = Math.round(CARD_HEIGHT * scale);
  canvas.style.width = `${CARD_WIDTH}px`;
  canvas.style.height = `${CARD_HEIGHT}px`;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const rank = getRank(data.level);
  const innerX = PAD + PANEL_PAD;
  const innerW = CARD_WIDTH - 2 * (PAD + PANEL_PAD);

  // Card body: dark wood plate with a hard rim.
  roundRectPath(ctx, 1.5, 1.5, CARD_WIDTH - 3, CARD_HEIGHT - 3, 20);
  ctx.fillStyle = vGradient(ctx, 0, CARD_HEIGHT, ["hsl(24, 38%, 26%)", "hsl(23, 40%, 15%)"]);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "hsl(22, 45%, 12%)";
  ctx.stroke();

  // Logo.
  if (assets.logo && assets.logo.naturalHeight > 0) {
    const w = (assets.logo.naturalWidth / assets.logo.naturalHeight) * LOGO_H;
    ctx.drawImage(assets.logo, (CARD_WIDTH - w) / 2, PAD, w, LOGO_H);
  } else {
    drawText(ctx, "GGLVLUP", CARD_WIDTH / 2, PAD + LOGO_H / 2, {
      font: `700 22px ${FONT}`,
      color: "hsl(42, 80%, 70%)",
      align: "center",
      tracking: 1.5,
    });
  }

  // Parchment panel.
  roundRectPath(ctx, PAD + 1, PANEL_TOP + 1, CARD_WIDTH - 2 * PAD - 2, PANEL_H - 2, 16);
  ctx.fillStyle = "hsl(39, 52%, 88%)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "hsl(33, 30%, 55%)";
  ctx.stroke();

  // Title.
  const titleY = PANEL_TOP + PANEL_PAD + TITLE_H / 2;
  const suffix = "’s progress";
  let title = `${data.name}${suffix}`;
  const titleFont = fitFont(ctx, title, innerW, 19, 14);
  ctx.font = titleFont;
  if (ctx.measureText(title).width > innerW) {
    // Trim the nickname, never the "…’s progress" that makes it a sentence.
    const room = Math.max(24, innerW - ctx.measureText(suffix).width);
    title = `${ellipsize(ctx, data.name, room)}${suffix}`;
  }
  drawText(ctx, title, CARD_WIDTH / 2, titleY, {
    font: titleFont,
    color: INK,
    align: "center",
  });

  // --- Medal + rank plate, centred as one group ---
  const rowTop = PANEL_TOP + PANEL_PAD + TITLE_H + ROW_GAP;
  const levelLabel = `LEVEL ${data.level}`;
  const rankName = rank.name.toUpperCase();
  const labelFont = `700 12px ${FONT}`;
  const rankFont = `700 12px ${FONT}`;

  ctx.font = labelFont;
  const labelW = textWidth(ctx, levelLabel, 1.6);
  ctx.font = rankFont;
  const rankTextW = textWidth(ctx, rankName, 1.2);

  const PLATE_H = 26;
  const PIP = 7;
  const plateW = 12 + PIP + 7 + rankTextW + 12;
  const blockW = Math.max(labelW, plateW);
  const groupX = (CARD_WIDTH - (MEDAL + 14 + blockW)) / 2;

  // Medal: hard bottom rim, then the coin, then star + level.
  const cx = groupX + MEDAL / 2;
  const cy = rowTop + MEDAL / 2;
  circle(ctx, cx, cy + 5, MEDAL / 2);
  ctx.fillStyle = "hsl(33, 75%, 28%)";
  ctx.fill();
  circle(ctx, cx, cy, MEDAL / 2 - 2);
  ctx.fillStyle = vGradient(ctx, rowTop, MEDAL, ["hsl(42, 95%, 62%)", "hsl(36, 85%, 46%)"]);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "hsl(33, 75%, 28%)";
  ctx.stroke();
  drawStar(ctx, cx, cy - 16, 9, "hsl(26, 50%, 18%)");
  drawText(ctx, String(data.level), cx, cy + 12, {
    font: `700 28px ${FONT}`,
    color: "hsl(26, 50%, 18%)",
    align: "center",
  });

  // Rank block: label above the plate, vertically centred against the medal.
  const blockX = groupX + MEDAL + 14;
  const blockTop = rowTop + (MEDAL - (LABEL_H + 8 + PLATE_H)) / 2;
  drawText(ctx, levelLabel, blockX, blockTop + LABEL_H / 2, {
    font: labelFont,
    color: MUTED,
    tracking: 1.6,
  });

  const plateTop = blockTop + LABEL_H + 8;
  roundRectPath(ctx, blockX + 1, plateTop + 1, plateW - 2, PLATE_H - 2, (PLATE_H - 2) / 2);
  ctx.fillStyle = vGradient(ctx, plateTop, PLATE_H, rank.colors.stops ?? [rank.colors.from, rank.colors.to]);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = rank.colors.rim;
  ctx.stroke();
  circle(ctx, blockX + 12 + PIP / 2, plateTop + PLATE_H / 2, PIP / 2);
  ctx.fillStyle = rank.colors.pip;
  ctx.fill();
  drawText(ctx, rankName, blockX + 12 + PIP + 7, plateTop + PLATE_H / 2, {
    font: rankFont,
    color: rank.colors.text,
    tracking: 1.2,
  });

  // --- Streak banner ---
  const streakTop = rowTop + MEDAL + ROW_GAP;
  roundRectPath(ctx, innerX + 1, streakTop + 1, innerW - 2, STREAK_H - 2, 14);
  ctx.fillStyle = vGradient(ctx, streakTop, STREAK_H, ["hsl(6, 70%, 62%)", "hsl(6, 62%, 50%)"]);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "hsl(6, 55%, 40%)";
  ctx.stroke();

  const streakText = `${data.streak}-DAY STREAK`;
  const streakFont = `700 19px ${FONT}`;
  ctx.font = streakFont;
  const streakTextW = textWidth(ctx, streakText, 0.8);
  const flameH = 22;
  const streakStart = innerX + (innerW - (flameH * 0.78 + 8 + streakTextW)) / 2;
  const streakMid = streakTop + STREAK_H / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
  ctx.shadowOffsetY = 1.5;
  drawFlame(ctx, streakStart + (flameH * 0.78) / 2, streakMid, flameH, "#ffffff");
  drawText(ctx, streakText, streakStart + flameH * 0.78 + 8, streakMid, {
    font: streakFont,
    color: "#ffffff",
    tracking: 0.8,
  });
  ctx.restore();

  // --- 100-day progress ---
  const labelTop = streakTop + STREAK_H + ROW_GAP;
  const labelMid = labelTop + LABEL_H / 2;
  drawText(ctx, `Day ${data.day} of ${data.totalDays}`, innerX, labelMid, {
    font: `700 12px ${FONT}`,
    color: "hsl(27, 24%, 40%)",
  });
  drawText(ctx, `${data.pct}%`, innerX + innerW, labelMid, {
    font: `700 12px ${FONT}`,
    color: "hsl(178, 52%, 32%)",
    align: "right",
  });

  const barTop = labelTop + LABEL_H + BAR_GAP;
  roundRectPath(ctx, innerX + 1, barTop + 1, innerW - 2, BAR_H - 2, (BAR_H - 2) / 2);
  ctx.fillStyle = "hsl(37, 30%, 80%)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "hsl(33, 30%, 55%)";
  ctx.stroke();

  const trackX = innerX + 2;
  const trackW = innerW - 4;
  const trackH = BAR_H - 4;
  const pct = Math.max(0, Math.min(100, data.pct));
  // Keep a visible nub at 0% rather than a sliver of nothing.
  const fillW = Math.max(trackH, (trackW * pct) / 100);
  ctx.save();
  roundRectPath(ctx, trackX, barTop + 2, trackW, trackH, trackH / 2);
  ctx.clip();
  roundRectPath(ctx, trackX, barTop + 2, fillW, trackH, trackH / 2);
  const fill = ctx.createLinearGradient(trackX, 0, trackX + trackW, 0);
  fill.addColorStop(0, "hsl(178, 52%, 44%)");
  fill.addColorStop(1, "hsl(178, 54%, 32%)");
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();

  // --- Footer ---
  drawText(ctx, "GGLVLUP · LEVEL UP YOUR LIFE", CARD_WIDTH / 2, CARD_HEIGHT - PAD - FOOTER_H / 2, {
    font: `700 11px ${FONT}`,
    color: "hsl(42, 80%, 70%)",
    align: "center",
    tracking: 2,
  });
}

/** Convenience wrapper: wait for the assets, then paint. */
export async function drawShareCard(canvas: HTMLCanvasElement, data: ShareCardData, scale = 2) {
  paintShareCard(canvas, data, await prepareShareCard(), scale);
}
