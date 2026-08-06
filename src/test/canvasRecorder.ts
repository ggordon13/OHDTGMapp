// A recording 2D context. jsdom has no canvas backend, so we stub just enough
// of the API to capture every point a card paints and check it lands inside the
// card — the failure mode a long nickname, a four-digit streak or a five-meal
// day would hit.

export interface Point {
  x: number;
  y: number;
}

export interface RecordedText {
  text: string;
  x: number;
  y: number;
  width: number;
}

export interface Recorder {
  ctx: CanvasRenderingContext2D;
  points: Point[];
  texts: RecordedText[];
}

export function makeRecorder(): Recorder {
  const points: Point[] = [];
  const texts: RecordedText[] = [];
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

/** A canvas stub that hands out the recorder's context. */
export function recordingCanvas(ctx: CanvasRenderingContext2D): HTMLCanvasElement {
  return { width: 0, height: 0, style: {}, getContext: () => ctx } as unknown as HTMLCanvasElement;
}
