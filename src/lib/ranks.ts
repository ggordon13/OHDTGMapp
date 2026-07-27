// ---------------------------------------------------------------------------
// Ranks — the title carried alongside the level.
//
// XP and levels are permanent and only ever grow (they survive a 100-day
// restart), so the rank is a pure function of the level: cross a threshold and
// the title is yours for good. Each tier reads as a visible step up from the
// last — earthier plates early on, brighter metals in the middle, glowing
// jewel tones at the top.
// ---------------------------------------------------------------------------

export interface Rank {
  key: string;
  /** Display name, e.g. "Pathfinder". */
  name: string;
  /** Lowest level that carries this title. */
  minLevel: number;
  /** Plate face + rim + text, as literal Tailwind classes. */
  className: string;
  /** Colour of the pip drawn to the left of the name. */
  pipClassName: string;
  /** Extra glow for the late-game tiers; empty for the early ones. */
  glowClassName: string;
}

/**
 * Every rank, ordered by threshold. The last entry has no upper bound — level
 * 30 and beyond is Mythic.
 */
export const RANKS: Rank[] = [
  {
    key: "newcomer",
    name: "Newcomer",
    minLevel: 1,
    className: "border-[hsl(30,12%,42%)] bg-gradient-to-b from-[hsl(32,12%,72%)] to-[hsl(30,10%,56%)] text-[hsl(30,25%,18%)]",
    pipClassName: "bg-[hsl(30,10%,40%)]",
    glowClassName: "",
  },
  {
    key: "recruit",
    name: "Recruit",
    minLevel: 3,
    className: "border-[hsl(22,55%,26%)] bg-gradient-to-b from-[hsl(26,58%,58%)] to-[hsl(22,54%,40%)] text-[hsl(28,50%,14%)]",
    pipClassName: "bg-[hsl(24,60%,28%)]",
    glowClassName: "",
  },
  {
    key: "adventurer",
    name: "Adventurer",
    minLevel: 6,
    className: "border-[hsl(88,50%,20%)] bg-gradient-to-b from-[hsl(84,48%,52%)] to-[hsl(88,52%,34%)] text-[hsl(90,55%,12%)]",
    pipClassName: "bg-[hsl(88,55%,20%)]",
    glowClassName: "",
  },
  {
    key: "pathfinder",
    name: "Pathfinder",
    minLevel: 9,
    className: "border-[hsl(178,55%,18%)] bg-gradient-to-b from-[hsl(176,50%,50%)] to-[hsl(180,55%,32%)] text-[hsl(180,60%,10%)]",
    pipClassName: "bg-[hsl(180,60%,16%)]",
    glowClassName: "",
  },
  {
    key: "veteran",
    name: "Veteran",
    minLevel: 12,
    className: "border-[hsl(224,60%,18%)] bg-gradient-to-b from-[hsl(220,58%,58%)] to-[hsl(226,60%,38%)] text-white",
    pipClassName: "bg-[hsl(210,80%,80%)]",
    glowClassName: "",
  },
  {
    key: "champion",
    name: "Champion",
    minLevel: 15,
    className: "border-[hsl(212,25%,32%)] bg-gradient-to-b from-[hsl(210,22%,86%)] to-[hsl(212,18%,60%)] text-[hsl(215,35%,18%)]",
    pipClassName: "bg-[hsl(212,30%,36%)]",
    glowClassName: "shadow-[0_0_10px_hsl(210,30%,70%,0.45)]",
  },
  {
    key: "elite",
    name: "Elite",
    minLevel: 18,
    className: "border-[hsl(33,78%,26%)] bg-gradient-to-b from-[hsl(44,95%,66%)] to-[hsl(36,88%,48%)] text-[hsl(28,60%,16%)]",
    pipClassName: "bg-[hsl(33,80%,26%)]",
    glowClassName: "shadow-[0_0_12px_hsl(42,95%,60%,0.5)]",
  },
  {
    key: "hero",
    name: "Hero",
    minLevel: 21,
    className: "border-[hsl(12,70%,26%)] bg-gradient-to-b from-[hsl(24,92%,60%)] to-[hsl(12,82%,46%)] text-white",
    pipClassName: "bg-[hsl(40,100%,78%)]",
    glowClassName: "shadow-[0_0_14px_hsl(20,90%,55%,0.55)]",
  },
  {
    key: "legend",
    name: "Legend",
    minLevel: 24,
    className: "border-[hsl(272,60%,24%)] bg-gradient-to-b from-[hsl(276,62%,64%)] to-[hsl(268,58%,42%)] text-white",
    pipClassName: "bg-[hsl(286,90%,82%)]",
    glowClassName: "shadow-[0_0_16px_hsl(274,65%,58%,0.6)]",
  },
  {
    key: "ancient",
    name: "Ancient",
    minLevel: 27,
    className: "border-[hsl(348,65%,22%)] bg-gradient-to-b from-[hsl(348,72%,56%)] to-[hsl(340,68%,34%)] text-white",
    pipClassName: "bg-[hsl(350,95%,80%)]",
    glowClassName: "shadow-[0_0_18px_hsl(346,72%,52%,0.65)]",
  },
  {
    key: "mythic",
    name: "Mythic",
    minLevel: 30,
    className:
      "border-[hsl(190,80%,22%)] bg-[linear-gradient(110deg,hsl(316,80%,62%),hsl(268,72%,60%),hsl(196,85%,56%),hsl(160,70%,52%),hsl(46,95%,62%))] text-[hsl(250,50%,12%)]",
    pipClassName: "bg-white",
    glowClassName: "shadow-[0_0_22px_hsl(300,80%,62%,0.7)]",
  },
];

/** The rank carried at a given level. Levels below 1 are treated as level 1. */
export function getRank(level: number): Rank {
  const l = Math.max(1, Math.floor(level));
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (l >= rank.minLevel) current = rank;
    else break;
  }
  return current;
}

/** The next rank up, or null once the player is Mythic. */
export function getNextRank(level: number): Rank | null {
  const l = Math.max(1, Math.floor(level));
  return RANKS.find((r) => r.minLevel > l) ?? null;
}
