import gsap from "gsap";

// ---------------------------------------------------------------------------
// Imperative GSAP effects for the game UI. Everything here is fire-and-forget:
// helpers spawn their own fixed-position DOM, animate, and clean up after
// themselves, so components can call them from event handlers without state.
// ---------------------------------------------------------------------------

const CONFETTI_COLORS = ["#e05b4d", "#2fa7a3", "#a4b73c", "#f2b53c", "#8e5bc0", "#f3e5cd"];

/** Punchy scale-in for an element that just appeared or changed. */
export function pop(el: Element | null, scale = 1.18) {
  if (!el) return;
  gsap.fromTo(el, { scale }, { scale: 1, duration: 0.5, ease: "back.out(2.5)", overwrite: "auto", clearProps: "scale" });
}

/** Attention pulse (XP bar receiving points, streak ticking up). */
export function pulse(el: Element | null) {
  if (!el) return;
  gsap.fromTo(
    el,
    { scale: 1 },
    { scale: 1.06, duration: 0.14, yoyo: true, repeat: 1, ease: "power2.out", overwrite: "auto", clearProps: "scale" },
  );
}

/** Error wiggle. */
export function shake(el: Element | null) {
  if (!el) return;
  gsap.fromTo(el, { x: 0 }, { x: 7, duration: 0.07, repeat: 5, yoyo: true, ease: "power1.inOut", clearProps: "x" });
}

/** Tween a number displayed inside an element (grouped with toLocaleString). */
export function countUp(el: Element | null, to: number, opts?: { duration?: number; decimals?: number }) {
  if (!el) return;
  const decimals = opts?.decimals ?? 0;
  const proxy = { v: 0 };
  gsap.to(proxy, {
    v: to,
    duration: opts?.duration ?? 0.9,
    ease: "power2.out",
    onUpdate: () => {
      el.textContent = proxy.v.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    },
  });
}

function centerOf(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Fly a chunky "+N XP" sticker from `fromEl` to `toEl` along a curved path,
 * then pulse the target. `onArrive` fires when the sticker lands (a good
 * moment to bump the visible XP number).
 */
export function xpFly(fromEl: Element, toEl: Element | null, amount: number, onArrive?: () => void) {
  const from = centerOf(fromEl);
  const to = toEl ? centerOf(toEl) : { x: window.innerWidth / 2, y: 24 };

  const sticker = document.createElement("div");
  sticker.textContent = `+${amount} XP`;
  Object.assign(sticker.style, {
    position: "fixed",
    left: "0",
    top: "0",
    zIndex: "9999",
    pointerEvents: "none",
    fontFamily: "var(--font-display)",
    fontWeight: "700",
    fontSize: "22px",
    color: "#f2b53c",
    textShadow:
      "-1.5px -1.5px 0 #3a2413, 1.5px -1.5px 0 #3a2413, -1.5px 1.5px 0 #3a2413, 1.5px 1.5px 0 #3a2413, 0 3px 0 #3a2413",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(sticker);

  // Quadratic bezier through a raised control point for a tossed-coin arc.
  const ctrl = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 110 };
  const proxy = { t: 0 };
  gsap.set(sticker, { x: from.x, y: from.y, xPercent: -50, yPercent: -50, scale: 0 });

  const tl = gsap.timeline({
    onComplete: () => {
      sticker.remove();
      if (toEl) pulse(toEl);
      onArrive?.();
    },
  });
  tl.to(sticker, { scale: 1.25, duration: 0.28, ease: "back.out(3)" })
    .to(sticker, { scale: 1, duration: 0.15 }, ">-0.05")
    .to(
      proxy,
      {
        t: 1,
        duration: 0.75,
        ease: "power1.in",
        onUpdate: () => {
          const t = proxy.t;
          const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * ctrl.x + t * t * to.x;
          const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * ctrl.y + t * t * to.y;
          gsap.set(sticker, { x, y });
        },
      },
      ">0.1",
    )
    .to(sticker, { scale: 0.35, opacity: 0.9, duration: 0.75 }, "<");
}

/** Confetti burst from an element (or screen top if none). */
export function confettiBurst(originEl?: Element | null, count = 26) {
  const origin = originEl ? centerOf(originEl) : { x: window.innerWidth / 2, y: window.innerHeight * 0.35 };
  const container = document.createElement("div");
  Object.assign(container.style, {
    position: "fixed",
    inset: "0",
    zIndex: "9998",
    pointerEvents: "none",
    overflow: "hidden",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(container);

  let remaining = count;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    const size = 6 + Math.random() * 8;
    Object.assign(p.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: `${size}px`,
      height: `${size * (Math.random() > 0.5 ? 1 : 0.5)}px`,
      background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      borderRadius: Math.random() > 0.6 ? "50%" : "2px",
    } satisfies Partial<CSSStyleDeclaration>);
    container.appendChild(p);

    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
    const velocity = 240 + Math.random() * 340;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;
    const duration = 1.3 + Math.random() * 0.8;

    gsap.set(p, { x: origin.x, y: origin.y, rotation: Math.random() * 360 });
    gsap.to(p, {
      duration,
      ease: "none",
      rotation: `+=${(Math.random() - 0.5) * 720}`,
      opacity: 0,
      modifiers: {},
      onUpdate: function () {
        const t = this.time();
        gsap.set(p, { x: origin.x + vx * t, y: origin.y + vy * t + 480 * t * t });
      },
      onComplete: () => {
        p.remove();
        if (--remaining === 0) container.remove();
      },
    });
  }
}

/** Ring of star sparkles around an element (badge/achievement unlock). */
export function sparkle(el: Element | null, count = 8) {
  if (!el) return;
  const c = centerOf(el);
  const r = el.getBoundingClientRect();
  const radius = Math.max(r.width, r.height) * 0.75;

  for (let i = 0; i < count; i++) {
    const star = document.createElement("div");
    star.textContent = "✦";
    Object.assign(star.style, {
      position: "fixed",
      left: "0",
      top: "0",
      zIndex: "9999",
      pointerEvents: "none",
      fontSize: `${10 + Math.random() * 10}px`,
      color: i % 2 ? "#f2b53c" : "#fff6e0",
      textShadow: "0 0 6px rgba(242,181,60,.8)",
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(star);

    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    gsap.set(star, { x: c.x, y: c.y, xPercent: -50, yPercent: -50, scale: 0 });
    gsap
      .timeline({ onComplete: () => star.remove() })
      .to(star, {
        x: c.x + Math.cos(angle) * radius,
        y: c.y + Math.sin(angle) * radius,
        scale: 1.2,
        duration: 0.4,
        ease: "power2.out",
      })
      .to(star, { scale: 0, opacity: 0, duration: 0.3, ease: "power1.in" }, ">-0.05");
  }
}

/** One-off glossy shine sweep across an element (claim rows, banners). */
export function shine(el: HTMLElement | null) {
  if (!el) return;
  const prevPosition = el.style.position;
  const prevOverflow = el.style.overflow;
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  el.style.overflow = "hidden";

  const gleam = document.createElement("div");
  Object.assign(gleam.style, {
    position: "absolute",
    top: "0",
    bottom: "0",
    width: "45%",
    left: "-50%",
    background: "linear-gradient(105deg, transparent, rgba(255,250,230,.65), transparent)",
    pointerEvents: "none",
  } satisfies Partial<CSSStyleDeclaration>);
  el.appendChild(gleam);

  gsap.to(gleam, {
    left: "125%",
    duration: 0.7,
    ease: "power2.inOut",
    onComplete: () => {
      gleam.remove();
      el.style.position = prevPosition;
      el.style.overflow = prevOverflow;
    },
  });
}
