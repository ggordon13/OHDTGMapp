import { describe, expect, it } from "vitest";
import { CARD_HEIGHT, CARD_WIDTH, paintShareCard, type ShareCardData } from "@/lib/shareCardCanvas";

// A recording 2D context. jsdom has no canvas backend, so we stub just enough
// of the API to capture every point the card paints and check it lands inside
// the card — the failure mode a long nickname or a four-digit streak would hit.

interface Point {
  x: number;
  y: number;
}

function makeRecorder() {
  const points: Point[] = [];
  const texts: { text: string; x: number; y: number; width: number }[] = [];
  // Only translate/scale are used, so a scalar transform stack is enough.
  let t = { x: 0, y: 0, s: 1 };
  const stack: (typeof t)[] = [];

  const fontSize = () => Number(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1] ?? 16);
  const width = (text: string) => text.length * fontSize() * 0.58;
  const mark = (x: number, y: number) => {
    points.push({ x: t.x + x * t.s, y: t.y + y * t.s });
  };

  const ctx = {
    font: "16px sans-serif",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    textAlign: "left",
    textBaseline: "alphabetic",
    shadowColor: "",
    shadowOffsetY: 0,
    shadowBlur: 0,
    setTransform: () => undefined,
    clearRect: () => undefined,
    save: () => stack.push({ ...t }),
    restore: () => {
      t = stack.pop() ?? t;
    },
    translate: (x: number, y: number) => {
      t = { ...t, x: t.x + x * t.s, y: t.y + y * t.s };
    },
    scale: (s: number) => {
      t = { ...t, s: t.s * s };
    },
    beginPath: () => undefined,
    closePath: () => undefined,
    moveTo: mark,
    lineTo: mark,
    arcTo: (x1: number, y1: number, x2: number, y2: number) => {
      mark(x1, y1);
      mark(x2, y2);
    },
    arc: (x: number, y: number, r: number) => {
      mark(x - r, y - r);
      mark(x + r, y + r);
    },
    bezierCurveTo: (a: number, b: number, c: number, d: number, x: number, y: number) => {
      mark(a, b);
      mark(c, d);
      mark(x, y);
    },
    fill: () => undefined,
    stroke: () => undefined,
    clip: () => undefined,
    drawImage: (_img: unknown, x: number, y: number, w: number, h: number) => {
      mark(x, y);
      mark(x + w, y + h);
    },
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    measureText: (text: string) => ({ width: width(text) }),
    fillText: (text: string, x: number, y: number) => {
      texts.push({ text, x, y, width: width(text) });
      mark(x, y);
      mark(x + width(text), y);
    },
  } as unknown as CanvasRenderingContext2D;

  return { ctx, points, texts };
}

function paint(data: ShareCardData) {
  const rec = makeRecorder();
  const canvas = { width: 0, height: 0, style: {}, getContext: () => rec.ctx } as unknown as HTMLCanvasElement;
  paintShareCard(canvas, data, { logo: null });
  return rec;
}

const base: ShareCardData = { name: "Gords", level: 6, streak: 72, day: 72, totalDays: 100, pct: 72 };

describe("share card", () => {
  it("keeps everything it paints inside the card", () => {
    const { points } = paint(base);
    expect(points.length).toBeGreaterThan(0);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(-2);
      expect(p.x).toBeLessThanOrEqual(CARD_WIDTH + 2);
      expect(p.y).toBeGreaterThanOrEqual(-2);
      expect(p.y).toBeLessThanOrEqual(CARD_HEIGHT + 2);
    }
  });

  it("shrinks or trims a long nickname instead of overflowing", () => {
    const { texts } = paint({ ...base, name: "Bartholomew Maximilian the Third" });
    const title = texts.find((t) => t.text.includes("progress"));
    expect(title).toBeDefined();
    expect(title!.width).toBeLessThanOrEqual(CARD_WIDTH - 2 * (20 + 20));
  });

  it("stays in bounds at the extremes", () => {
    const extremes: ShareCardData[] = [
      { ...base, level: 100, streak: 3650, day: 100, pct: 100 },
      { ...base, level: 1, streak: 0, day: 1, pct: 0 },
      { ...base, level: 30, streak: 365, day: 99, pct: 99 },
    ];
    for (const data of extremes) {
      for (const p of paint(data).points) {
        expect(p.x).toBeGreaterThanOrEqual(-2);
        expect(p.x).toBeLessThanOrEqual(CARD_WIDTH + 2);
        expect(p.y).toBeGreaterThanOrEqual(-2);
        expect(p.y).toBeLessThanOrEqual(CARD_HEIGHT + 2);
      }
    }
  });
});
