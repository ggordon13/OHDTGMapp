import { describe, expect, it } from "vitest";
import { CARD_HEIGHT, CARD_WIDTH, paintShareCard, type ShareCardData } from "@/lib/shareCardCanvas";
import { makeRecorder, recordingCanvas } from "./canvasRecorder";

function paint(data: ShareCardData) {
  const rec = makeRecorder();
  paintShareCard(recordingCanvas(rec.ctx), data, { logo: null });
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
