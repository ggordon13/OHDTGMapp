// ---------------------------------------------------------------------------
// Cartoon art for the Food Track game.
//
// The six protein families are hand-drawn SVG critters so they can *react* —
// every animatable feature is tagged with a data-part attribute that ChoiceCard
// grabs with GSAP (eyes go wide, sweat beads up, the body shivers) when you
// hover the thing you're about to eat. Everything else uses a big emoji, which
// is already colourful, weightless and consistent across platforms.
// ---------------------------------------------------------------------------

import { cn } from "@/lib/utils";

export type CritterKind = "chicken" | "cow" | "pig" | "fish" | "egg" | "plant";

const INK = "#3f2a1a";

/** Shared eye pair: white with a pupil, both tagged for the panic tween. */
const Eyes = ({ x1, x2, y, r = 6 }: { x1: number; x2: number; y: number; r?: number }) => (
  <>
    {[x1, x2].map((cx) => (
      <g key={cx} data-part="eye">
        <circle cx={cx} cy={y} r={r} fill="#fff" stroke={INK} strokeWidth={2.5} />
        <circle cx={cx} cy={y + 0.5} r={r * 0.42} fill={INK} data-part="pupil" />
      </g>
    ))}
  </>
);

/** Bead of sweat, hidden until the critter realises what's happening. */
const Sweat = ({ x, y }: { x: number; y: number }) => (
  <path
    data-part="sweat"
    d={`M${x} ${y} q4 5 4 8 a4 4 0 0 1-8 0 q0-3 4-8z`}
    fill="#7fd4f5"
    stroke={INK}
    strokeWidth={1.8}
    opacity={0}
  />
);

const Chicken = () => (
  <g data-part="body">
    <path d="M28 42 Q18 34 22 26 Q28 30 30 36z" fill="#f4f0e4" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <ellipse cx="50" cy="66" rx="27" ry="24" fill="#fdf8ec" stroke={INK} strokeWidth={3.2} />
    <path d="M40 62 Q50 54 62 62 Q56 76 44 74z" fill="#eee5d0" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
    <circle cx="52" cy="34" r="17" fill="#fdf8ec" stroke={INK} strokeWidth={3.2} />
    <g fill="#e0503f" stroke={INK} strokeWidth={2.4}>
      <circle cx="46" cy="17" r="5.5" />
      <circle cx="54" cy="14" r="6" />
      <circle cx="61" cy="18" r="5" />
    </g>
    <path d="M68 34 L80 38 L68 42z" fill="#f2ae32" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
    <path d="M62 44 q3 8-2 11" fill="#e0503f" stroke={INK} strokeWidth={2.4} />
    <Eyes x1={52} x2={65} y={31} r={5.5} />
    <g stroke="#f2ae32" strokeWidth={4} strokeLinecap="round">
      <path d="M42 88 v8 M42 96 l-6 4 M42 96 l6 4" />
      <path d="M58 88 v8 M58 96 l-6 4 M58 96 l6 4" />
    </g>
    <Sweat x={72} y={22} />
  </g>
);

const Cow = () => (
  <g data-part="body">
    <ellipse cx="50" cy="70" rx="30" ry="22" fill="#fdfaf3" stroke={INK} strokeWidth={3.2} />
    <ellipse cx="34" cy="66" rx="9" ry="7" fill={INK} opacity={0.85} />
    <ellipse cx="66" cy="76" rx="7" ry="6" fill={INK} opacity={0.85} />
    <path d="M24 30 q-9-6-6-14 q9 1 12 9z" fill="#fdfaf3" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <path d="M76 30 q9-6 6-14 q-9 1-12 9z" fill="#fdfaf3" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <path d="M32 22 q-6-10 2-12 q4 5 3 11z" fill="#e8d9b8" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
    <path d="M68 22 q6-10-2-12 q-4 5-3 11z" fill="#e8d9b8" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
    <ellipse cx="50" cy="38" rx="25" ry="22" fill="#fdfaf3" stroke={INK} strokeWidth={3.2} />
    <ellipse cx="38" cy="26" rx="8" ry="6" fill={INK} opacity={0.8} />
    <ellipse cx="50" cy="50" rx="16" ry="11" fill="#f0aeb4" stroke={INK} strokeWidth={2.8} />
    <ellipse cx="44" cy="49" rx="2.6" ry="3.4" fill={INK} data-part="nostril" />
    <ellipse cx="56" cy="49" rx="2.6" ry="3.4" fill={INK} data-part="nostril" />
    <Eyes x1={41} x2={60} y={31} />
    <Sweat x={78} y={20} />
  </g>
);

const Pig = () => (
  <g data-part="body">
    <ellipse cx="50" cy="70" rx="29" ry="21" fill="#f7b8c4" stroke={INK} strokeWidth={3.2} />
    <path d="M28 26 q-4-12 6-12 q6 4 5 13z" fill="#f2a3b3" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <path d="M72 26 q4-12-6-12 q-6 4-5 13z" fill="#f2a3b3" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <ellipse cx="50" cy="40" rx="26" ry="22" fill="#f9c3ce" stroke={INK} strokeWidth={3.2} />
    <ellipse cx="50" cy="52" rx="14" ry="11" fill="#ef94a8" stroke={INK} strokeWidth={2.8} />
    <ellipse cx="45" cy="52" rx="2.8" ry="3.8" fill={INK} data-part="nostril" />
    <ellipse cx="55" cy="52" rx="2.8" ry="3.8" fill={INK} data-part="nostril" />
    <Eyes x1={40} x2={60} y={33} />
    <path d="M79 72 q10 2 8 10" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" data-part="tail" />
    <Sweat x={76} y={22} />
  </g>
);

const Fish = () => (
  <g data-part="body">
    <path d="M22 50 L4 34 q-2 16 0 32z" fill="#f2913c" stroke={INK} strokeWidth={3} strokeLinejoin="round" data-part="tail" />
    <ellipse cx="54" cy="50" rx="34" ry="24" fill="#f6a94f" stroke={INK} strokeWidth={3.2} />
    <path d="M46 28 q10-14 20-4 q-10 2-14 6z" fill="#e8802c" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
    <path d="M44 62 q10 12 22 6" fill="#e8802c" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
    <path d="M40 32 q6 18 0 36" fill="none" stroke={INK} strokeWidth={2.4} opacity={0.5} />
    <Eyes x1={70} x2={70} y={44} r={7} />
    <path d="M78 60 q6-4 10 0" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
    <circle cx="92" cy="26" r="5" fill="#bfe9ff" stroke={INK} strokeWidth={2} opacity={0.7} data-part="bubble" />
    <Sweat x={58} y={22} />
  </g>
);

const Egg = () => (
  <g data-part="body">
    <path d="M50 10 q26 22 26 46 a26 30 0 0 1-52 0 q0-24 26-46z" fill="#fdf6e6" stroke={INK} strokeWidth={3.2} />
    <path d="M30 44 l8-6 l6 8 l8-7 l6 8" fill="none" stroke={INK} strokeWidth={2.2} opacity={0.35} data-part="crack" />
    <Eyes x1={41} x2={59} y={58} />
    <path d="M43 72 q7 7 14 0" fill="none" stroke={INK} strokeWidth={2.8} strokeLinecap="round" data-part="mouth" />
    <Sweat x={72} y={44} />
  </g>
);

const Plant = () => (
  <g data-part="body">
    <path d="M50 92 V46" fill="none" stroke="#4f8f38" strokeWidth={5} strokeLinecap="round" />
    <path d="M50 60 Q26 56 20 34 Q46 32 50 58z" fill="#79c05a" stroke={INK} strokeWidth={3} strokeLinejoin="round" data-part="leaf" />
    <path d="M50 54 Q74 50 80 28 Q54 26 50 52z" fill="#8fd06a" stroke={INK} strokeWidth={3} strokeLinejoin="round" data-part="leaf" />
    <circle cx="50" cy="34" r="18" fill="#a9dd85" stroke={INK} strokeWidth={3.2} />
    <Eyes x1={43} x2={57} y={32} r={5.5} />
    <path d="M45 44 q5 5 10 0" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" data-part="mouth" />
    <Sweat x={72} y={22} />
  </g>
);

const CRITTERS: Record<CritterKind, () => JSX.Element> = {
  chicken: Chicken,
  cow: Cow,
  pig: Pig,
  fish: Fish,
  egg: Egg,
  plant: Plant,
};

export const isCritter = (kind: string): kind is CritterKind => kind in CRITTERS;

interface FoodSpriteProps {
  /** A critter key (drawn as SVG) or any emoji (rendered as text). */
  sprite: string;
  className?: string;
  /** Tailwind text size for the emoji path. */
  size?: string;
}

/**
 * Renders a choice's artwork. Critter keys become the reactive SVG animals;
 * anything else is treated as an emoji.
 */
const FoodSprite = ({ sprite, className, size = "text-5xl" }: FoodSpriteProps) => {
  if (isCritter(sprite)) {
    const Critter = CRITTERS[sprite];
    return (
      <svg viewBox="0 0 100 100" className={cn("h-full w-full overflow-visible", className)} aria-hidden="true">
        <Critter />
      </svg>
    );
  }
  return (
    <span className={cn("select-none leading-none", size, className)} aria-hidden="true">
      {sprite}
    </span>
  );
};

export default FoodSprite;
