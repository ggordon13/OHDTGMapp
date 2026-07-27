// Cosmetic themes — a premium perk.
//
// A theme re-skins the "table" the game panels sit on by overriding a handful of
// CSS variables (the wooden table + page background). Parchment panels, accents
// and gameplay colors stay constant, so every theme stays readable and on-brand.
//
// Free users get the basic palettes; the rest are premium. A premium theme falls
// back to the default at render time when the user isn't premium — so a theme
// chosen during a trial reverts automatically the moment the trial ends.

export type ThemeTier = "free" | "premium";

export interface Theme {
  key: string;
  name: string;
  tier: ThemeTier;
  /** HSL triples ("H S% L%") plugged into the themed CSS variables. */
  vars: {
    background: string;
    wood: string;
    woodDark: string;
    woodLight: string;
  };
}

export const DEFAULT_THEME_KEY = "oak";

/** The catalog. `oak` reproduces the app's original look exactly. */
export const THEMES: Theme[] = [
  // ---- Free ----------------------------------------------------------------
  {
    key: "oak",
    name: "Classic Oak",
    tier: "free",
    vars: { background: "22 42% 10%", wood: "24 38% 26%", woodDark: "23 40% 16%", woodLight: "26 36% 34%" },
  },
  {
    key: "walnut",
    name: "Dark Walnut",
    tier: "free",
    vars: { background: "18 45% 9%", wood: "16 40% 24%", woodDark: "14 42% 14%", woodLight: "18 38% 32%" },
  },
  // ---- Premium -------------------------------------------------------------
  {
    key: "midnight",
    name: "Midnight Blue",
    tier: "premium",
    vars: { background: "222 45% 8%", wood: "222 34% 22%", woodDark: "224 40% 13%", woodLight: "222 32% 30%" },
  },
  {
    key: "forest",
    name: "Deep Forest",
    tier: "premium",
    vars: { background: "150 35% 7%", wood: "150 30% 20%", woodDark: "152 36% 12%", woodLight: "148 28% 28%" },
  },
  {
    key: "rosewood",
    name: "Rosewood",
    tier: "premium",
    vars: { background: "340 34% 8%", wood: "345 30% 22%", woodDark: "345 38% 13%", woodLight: "342 28% 30%" },
  },
  {
    key: "amethyst",
    name: "Amethyst",
    tier: "premium",
    vars: { background: "270 34% 9%", wood: "268 28% 24%", woodDark: "270 34% 14%", woodLight: "266 26% 32%" },
  },
  {
    key: "obsidian",
    name: "Obsidian",
    tier: "premium",
    vars: { background: "220 12% 7%", wood: "220 10% 20%", woodDark: "220 12% 11%", woodLight: "220 8% 28%" },
  },
];

const THEME_BY_KEY = new Map(THEMES.map((t) => [t.key, t]));

/** The theme for a key, or the default when the key is unknown/empty. */
export function getTheme(key?: string | null): Theme {
  return (key && THEME_BY_KEY.get(key)) || THEME_BY_KEY.get(DEFAULT_THEME_KEY)!;
}

export function isThemePremium(key?: string | null): boolean {
  return getTheme(key).tier === "premium";
}

/**
 * The theme actually applied: the chosen one, unless it's premium and the user
 * isn't premium — then the default. This is the "reverts when the trial ends"
 * rule, evaluated fresh on every render.
 */
export function effectiveTheme(selectedKey: string | null | undefined, isPremium: boolean): Theme {
  const chosen = getTheme(selectedKey);
  return chosen.tier === "premium" && !isPremium ? getTheme(DEFAULT_THEME_KEY) : chosen;
}

/** CSS gradient for a swatch preview, from a theme's wood tones. */
export function themeSwatch(theme: Theme): string {
  return `linear-gradient(135deg, hsl(${theme.vars.woodLight}) 0%, hsl(${theme.vars.woodDark}) 100%)`;
}

/** Push a theme's variables onto the document root (or clear them). */
export function applyThemeVars(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--background", theme.vars.background);
  root.style.setProperty("--wood", theme.vars.wood);
  root.style.setProperty("--wood-dark", theme.vars.woodDark);
  root.style.setProperty("--wood-light", theme.vars.woodLight);
}
