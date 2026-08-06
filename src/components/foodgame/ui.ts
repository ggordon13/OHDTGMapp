// ---------------------------------------------------------------------------
// Food Track — shared sizing tokens.
//
// Every tappable thing in the game is sized from one of the constants below
// rather than from its own contents. A button reading "Next" and one reading
// "Finish & see my day" are the same width; "Fries" and "Cooked Veggies" are
// the same tile. Content-sized controls are what make an arcade UI look like a
// form — a row of five buttons at five different widths reads as an accident,
// and the tiles are grids, so any one of them stretching drags its whole row.
//
// Classes rather than a component: these sit on top of GameButton, ChoiceCard
// and plain buttons alike, and `cn` (tailwind-merge) lets them win against the
// base padding they override.
// ---------------------------------------------------------------------------

/**
 * A footer action — Continue, Back, Save, Share. Full width on a phone so the
 * stack reads as one column, then a fixed width from `sm` up so a row of them
 * is a row of identical buttons whatever the labels say.
 */
export const ACTION_BUTTON = "w-full sm:w-[15rem]";

/** A narrower footer action, for rows of three or more. */
export const ACTION_BUTTON_SM = "w-full sm:w-[11.5rem]";

/** Square icon-only button (edit, remove, back). Overrides GameButton's padding. */
export const ICON_BUTTON = "h-9 w-9 shrink-0 px-0 py-0";

/**
 * Fixed height for the answer tiles. The tallest content is a critter card with
 * a two-line label and a macros line; every other tile pads out to match rather
 * than shrinking, so the grid stays rectangular.
 */
export const CHOICE_TILE = "h-[13rem] sm:h-[14.5rem]";

/** Fixed height for the meal tiles on the level-select screen. */
export const MEAL_TILE = "h-[9.5rem] sm:h-[10.5rem]";

/** One portion button on a plate row. Square, so the five sit in a even strip. */
export const PORTION_BUTTON = "h-14 w-14";
