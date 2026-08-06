import { Plus, Trophy, X } from "lucide-react";
import { MEALS, type Macros, type MealId } from "@/lib/foodGame/foods";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

/** What the strip can be pointing at: a meal, the summary, or nothing yet. */
export type TabTarget = MealId | "summary";

interface MealTabsProps {
  /** Meals with a draft — i.e. the ones actually in this run. */
  inPlay: MealId[];
  active: TabTarget | null;
  /** Per-meal totals, keyed by meal id. Missing = nothing logged yet. */
  totals: Partial<Record<MealId, Macros>>;
  /** Open a meal, adding it to the run first if it isn't in play. */
  onOpen: (mealId: MealId) => void;
  /** Drop a meal and everything logged against it. */
  onRemove: (mealId: MealId) => void;
  onSummary: () => void;
}

const tabBase = cn(
  "flex h-[3.75rem] w-[5.5rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-1",
  "transition-[transform,filter] duration-150 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-[1px]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(42,95%,68%)]",
);

const activeTab = "border-[hsl(42,95%,68%)] bg-[hsl(28,45%,32%)] text-[hsl(42,95%,78%)] shadow-[0_0_0_2px_hsl(42,95%,68%,0.35)]";
const inPlayTab = "border-[hsl(22,45%,12%)] bg-[hsl(26,36%,26%)] text-[hsl(38,45%,86%)]";
const emptyTab = "border-dashed border-[hsl(28,25%,38%)] bg-[hsl(24,34%,18%)] text-[hsl(38,20%,58%)]";

/**
 * The run's navigation bar: every meal as a tab, always, plus the summary.
 *
 * The game used to be a one-way corridor — meals chosen up front, then played
 * in order, with Back as the only way to revisit anything. That falls apart the
 * moment real life does: you log breakfast at 9am, and at 2pm you need to add
 * the lunch you didn't know about and fix the coffee you forgot. So every meal
 * is reachable from every screen, whether or not it is in the run: tapping one
 * that isn't opens it and adds it, and the tab for one that is shows what it is
 * worth so far, which doubles as an at-a-glance read of the whole day.
 */
const MealTabs = ({ inPlay, active, totals, onOpen, onRemove, onSummary }: MealTabsProps) => (
  <div
    // Scrolls on a phone rather than shrinking the tabs — six identical tabs
    // that run off the edge stay tappable; six squeezed ones don't.
    className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    role="tablist"
    aria-label="Meals"
  >
    {MEALS.map((meal) => {
      const isIn = inPlay.includes(meal.id);
      const isActive = active === meal.id;
      const total = totals[meal.id];

      return (
        <div key={meal.id} className="relative shrink-0">
          <button
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              sfx.claim();
              onOpen(meal.id);
            }}
            className={cn(tabBase, isActive ? activeTab : isIn ? inPlayTab : emptyTab)}
          >
            <span className="text-lg leading-none">{meal.sprite}</span>
            <span className="max-w-full truncate font-display text-[10px] font-bold uppercase tracking-wide">
              {meal.label}
            </span>
            {isIn ? (
              <span className="font-display text-[10px] font-bold leading-none text-[hsl(42,80%,70%)]">
                {total ? `${total.kcal} kcal` : "empty"}
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-[10px] font-bold leading-none">
                <Plus className="h-3 w-3" strokeWidth={3} />
                Add
              </span>
            )}
          </button>

          {/* Sibling, not a child: a button inside a button is invalid markup
              and browsers resolve the click to whichever they feel like. Only
              on the open tab, so a mis-tap can't delete a meal you can't see. */}
          {isIn && isActive && (
            <button
              type="button"
              onClick={() => onRemove(meal.id)}
              title={`Remove ${meal.label}`}
              aria-label={`Remove ${meal.label}`}
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[hsl(6,55%,30%)] bg-[hsl(6,70%,62%)] text-white shadow-[0_1px_0_hsl(6,55%,25%)] transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="h-3 w-3" strokeWidth={4} />
            </button>
          )}
        </div>
      );
    })}

    <button
      type="button"
      role="tab"
      aria-selected={active === "summary"}
      onClick={() => {
        sfx.claim();
        onSummary();
      }}
      className={cn(
        tabBase,
        active === "summary"
          ? activeTab
          : "border-[hsl(33,75%,28%)] bg-gradient-to-b from-[hsl(40,90%,58%)] to-[hsl(36,85%,46%)] text-[hsl(26,50%,18%)]",
      )}
    >
      <Trophy className="h-5 w-5" />
      <span className="font-display text-[10px] font-bold uppercase tracking-wide">Summary</span>
    </button>
  </div>
);

export default MealTabs;
