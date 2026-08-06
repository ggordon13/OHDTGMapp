// ---------------------------------------------------------------------------
// The Food Track day card — the run's diary, painted onto a <canvas> for
// sharing.
//
// Same approach as the progress card (`lib/shareCardCanvas`): hand-painted so
// the preview and the exported PNG are the same pixels. The difference is that
// this card's height is data-driven — a day with five meals is taller than a
// day with one — so the geometry is computed per render rather than being a
// module constant, and callers size the canvas from {@link foodCardHeight}.
// ---------------------------------------------------------------------------

import {
  FONT,
  drawText,
  ellipsize,
  plate,
  roundRectPath,
  textWidth,
  vGradient,
  type CardAssets,
  type Ctx,
} from "@/lib/canvasDraw";
import { parseDateInputValue } from "@/lib/utils";

export interface FoodShareMeal {
  sprite: string;
  label: string;
  kcal: number;
  protein: number;
}

export interface FoodShareData {
  /** The day being shared, as "YYYY-MM-DD". */
  date: string;
  kcal: number;
  protein: number;
  /** How many diary lines the day holds — the "23 items" line. */
  itemCount: number;
  /** One row per meal that has something in it, in meal order. */
  meals: FoodShareMeal[];
  /** Daily targets, drawn as progress bars when present. */
  goals?: { calories?: number | null; protein?: number | null };
}

// --- Layout -----------------------------------------------------------------

const PAD = 20;
const LOGO_H = 40;
const GAP_LOGO = 14;
const PANEL_PAD = 18;
const TITLE_H = 24;
const DATE_H = 16;
const GAP = 14;
const TILE_H = 78;
const BAR_LABEL_H = 14;
const BAR_GAP = 5;
const BAR_H = 12;
const BAR_ROW = BAR_LABEL_H + BAR_GAP + BAR_H;
const BAR_SPACING = 10;
const MEAL_ROW_H = 30;
const MEAL_GAP = 6;
const FOOTER_H = 14;
const GAP_FOOTER = 12;

export const CARD_WIDTH = 400;

const PANEL_TOP = PAD + LOGO_H + GAP_LOGO;

const INK = "hsl(24, 42%, 16%)";
const MUTED = "hsl(27, 24%, 42%)";
const KCAL = "hsl(6, 62%, 48%)";
const PROTEIN = "hsl(178, 54%, 32%)";

/** How many goal bars this data draws (0, 1 or 2). */
const barCount = (data: FoodShareData) =>
  (data.goals?.calories ? 1 : 0) + (data.goals?.protein ? 1 : 0);

function panelHeight(data: FoodShareData): number {
  const bars = barCount(data);
  let h = PANEL_PAD * 2 + TITLE_H + 4 + DATE_H + GAP + TILE_H;
  if (bars > 0) h += GAP + bars * BAR_ROW + (bars - 1) * BAR_SPACING;
  if (data.meals.length > 0) {
    h += GAP + data.meals.length * MEAL_ROW_H + (data.meals.length - 1) * MEAL_GAP;
  }
  return h;
}

/** Total card height for this data. Callers size the canvas from it. */
export function foodCardHeight(data: FoodShareData): number {
  return PANEL_TOP + panelHeight(data) + GAP_FOOTER + FOOTER_H + PAD;
}

// --- Pieces -----------------------------------------------------------------

/** "Wednesday, 6 August" — the day, in the reader's own locale. */
function friendlyDate(date: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(parseDateInputValue(date));
  } catch {
    return date;
  }
}

/** One of the two headline totals: a coloured plate with a number on it. */
function drawTotalTile(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  unit: string,
  stops: string[],
  rim: string,
) {
  plate(ctx, x, y, w, TILE_H, 14, stops, rim);

  drawText(ctx, label.toUpperCase(), x + w / 2, y + 20, {
    font: `700 10px ${FONT}`,
    color: "rgba(255,255,255,0.9)",
    align: "center",
    tracking: 1.4,
  });

  // The number and its unit are laid out as one centred group so "1,850 kcal"
  // sits on the tile's axis rather than the number alone doing.
  const valueFont = `700 30px ${FONT}`;
  const unitFont = `700 13px ${FONT}`;
  ctx.font = valueFont;
  const valueW = textWidth(ctx, value, 0);
  ctx.font = unitFont;
  const unitW = textWidth(ctx, unit, 0);
  const start = x + (w - (valueW + 4 + unitW)) / 2;
  const mid = y + 50;

  drawText(ctx, value, start, mid, { font: valueFont, color: "#ffffff" });
  drawText(ctx, unit, start + valueW + 4, mid + 6, { font: unitFont, color: "rgba(255,255,255,0.85)" });
}

/** A "1,420 / 2,000 kcal · 71%" progress bar. */
function drawGoalBar(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  label: string,
  value: number,
  goal: number,
  unit: string,
  stops: [string, string],
) {
  const pct = Math.max(0, Math.min(100, Math.round((value / goal) * 100)));
  const labelMid = y + BAR_LABEL_H / 2;

  drawText(ctx, label, x, labelMid, { font: `700 11px ${FONT}`, color: MUTED });
  drawText(ctx, `${value.toLocaleString()} / ${goal.toLocaleString()} ${unit} · ${pct}%`, x + w, labelMid, {
    font: `700 11px ${FONT}`,
    color: stops[1],
    align: "right",
  });

  const barTop = y + BAR_LABEL_H + BAR_GAP;
  plate(ctx, x, barTop, w, BAR_H, BAR_H / 2, "hsl(37, 30%, 80%)", "hsl(33, 30%, 55%)");

  const trackX = x + 2;
  const trackW = w - 4;
  const trackH = BAR_H - 4;
  // Keep a visible nub at 0% rather than a sliver of nothing.
  const fillW = Math.max(trackH, (trackW * pct) / 100);
  ctx.save();
  roundRectPath(ctx, trackX, barTop + 2, trackW, trackH, trackH / 2);
  ctx.clip();
  roundRectPath(ctx, trackX, barTop + 2, fillW, trackH, trackH / 2);
  const fill = ctx.createLinearGradient(trackX, 0, trackX + trackW, 0);
  fill.addColorStop(0, stops[0]);
  fill.addColorStop(1, stops[1]);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

/** One meal's line: sprite and name on the left, what it cost on the right. */
function drawMealRow(ctx: Ctx, x: number, y: number, w: number, meal: FoodShareMeal) {
  plate(ctx, x, y, w, MEAL_ROW_H, 9, "hsl(39, 44%, 82%)", "hsl(33, 30%, 62%)");

  const mid = y + MEAL_ROW_H / 2;
  drawText(ctx, meal.sprite, x + 10, mid, { font: `400 14px ${FONT}`, color: INK });

  const macros = `${meal.kcal.toLocaleString()} kcal · ${meal.protein}g P`;
  const macrosFont = `700 11px ${FONT}`;
  ctx.font = macrosFont;
  const macrosW = textWidth(ctx, macros, 0);

  // The name yields to the numbers: a long meal label is trimmed, never the
  // figure that is the whole reason the row exists.
  const nameFont = `700 12px ${FONT}`;
  const nameX = x + 32;
  const nameRoom = Math.max(24, x + w - 10 - macrosW - 8 - nameX);
  ctx.font = nameFont;
  drawText(ctx, ellipsize(ctx, meal.label, nameRoom), nameX, mid, { font: nameFont, color: INK });
  drawText(ctx, macros, x + w - 10, mid, { font: macrosFont, color: MUTED, align: "right" });
}

// --- The card ---------------------------------------------------------------

/**
 * Paints the card at `scale` device pixels per CSS pixel and sizes the canvas
 * (both its backing store and its CSS box) to match.
 */
export function paintFoodCard(
  canvas: HTMLCanvasElement,
  data: FoodShareData,
  assets: CardAssets,
  scale = 2,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const height = foodCardHeight(data);
  canvas.width = Math.round(CARD_WIDTH * scale);
  canvas.height = Math.round(height * scale);
  canvas.style.width = `${CARD_WIDTH}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, CARD_WIDTH, height);

  const panelH = panelHeight(data);
  const innerX = PAD + PANEL_PAD;
  const innerW = CARD_WIDTH - 2 * (PAD + PANEL_PAD);

  // Card body: dark wood plate with a hard rim.
  roundRectPath(ctx, 1.5, 1.5, CARD_WIDTH - 3, height - 3, 20);
  ctx.fillStyle = vGradient(ctx, 0, height, ["hsl(24, 38%, 26%)", "hsl(23, 40%, 15%)"]);
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
      font: `700 20px ${FONT}`,
      color: "hsl(42, 80%, 70%)",
      align: "center",
      tracking: 1.5,
    });
  }

  // Parchment panel.
  plate(ctx, PAD, PANEL_TOP, CARD_WIDTH - 2 * PAD, panelH, 16, "hsl(39, 52%, 88%)", "hsl(33, 30%, 55%)");

  // Title + date.
  let y = PANEL_TOP + PANEL_PAD;
  drawText(ctx, "🍽️ Today's Food", CARD_WIDTH / 2, y + TITLE_H / 2, {
    font: `700 19px ${FONT}`,
    color: INK,
    align: "center",
  });
  y += TITLE_H + 4;

  const items = `${friendlyDate(data.date)} · ${data.itemCount} item${data.itemCount === 1 ? "" : "s"}`;
  const dateFont = `600 12px ${FONT}`;
  ctx.font = dateFont;
  drawText(ctx, ellipsize(ctx, items, innerW), CARD_WIDTH / 2, y + DATE_H / 2, {
    font: dateFont,
    color: MUTED,
    align: "center",
  });
  y += DATE_H + GAP;

  // Headline totals.
  const tileW = (innerW - 10) / 2;
  drawTotalTile(
    ctx, innerX, y, tileW, "Calories", data.kcal.toLocaleString(), "kcal",
    ["hsl(6, 70%, 62%)", "hsl(6, 62%, 50%)"], "hsl(6, 55%, 34%)",
  );
  drawTotalTile(
    ctx, innerX + tileW + 10, y, tileW, "Protein", String(data.protein), "g",
    ["hsl(178, 48%, 44%)", "hsl(178, 54%, 32%)"], "hsl(178, 50%, 22%)",
  );
  y += TILE_H;

  // Goal bars.
  if (barCount(data) > 0) {
    y += GAP;
    if (data.goals?.calories) {
      drawGoalBar(ctx, innerX, y, innerW, "Calorie goal", data.kcal, data.goals.calories, "kcal", [
        "hsl(6, 70%, 58%)",
        KCAL,
      ]);
      y += BAR_ROW + (data.goals?.protein ? BAR_SPACING : 0);
    }
    if (data.goals?.protein) {
      drawGoalBar(ctx, innerX, y, innerW, "Protein goal", data.protein, data.goals.protein, "g", [
        "hsl(178, 52%, 44%)",
        PROTEIN,
      ]);
      y += BAR_ROW;
    }
  }

  // Per-meal breakdown.
  if (data.meals.length > 0) {
    y += GAP;
    for (const meal of data.meals) {
      drawMealRow(ctx, innerX, y, innerW, meal);
      y += MEAL_ROW_H + MEAL_GAP;
    }
  }

  // Footer.
  drawText(ctx, "GGLVLUP · LEVEL UP YOUR LIFE", CARD_WIDTH / 2, height - PAD - FOOTER_H / 2, {
    font: `700 11px ${FONT}`,
    color: "hsl(42, 80%, 70%)",
    align: "center",
    tracking: 2,
  });
}
