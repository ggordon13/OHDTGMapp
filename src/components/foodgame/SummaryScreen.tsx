import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Check, Pencil, RotateCcw, Save, Share2, X } from "lucide-react";
import GameButton from "@/components/game/GameButton";
import FoodSprite from "./FoodSprite";
import { ACTION_BUTTON, ACTION_BUTTON_SM } from "./ui";
import { MEALS, totalMacros, type DiaryEntry, type Macros } from "@/lib/foodGame/foods";
import { confettiBurst, countUp, sparkle } from "@/lib/fx";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

interface SummaryScreenProps {
  entries: DiaryEntry[];
  /** The player's daily targets, for the "how did I do" bars. Optional. */
  goals?: { calories?: number | null; protein?: number | null };
  /** Writes the totals onto today's log. Omitted = no save button. */
  onSave?: (totals: Macros) => Promise<void> | void;
  /** Opens the shareable card for the day. */
  onShare: () => void;
  /** Back into the meals to change something — the summary isn't the end. */
  onEdit: () => void;
  /** Wipe the day and start over. */
  onReset: () => void;
  onClose: () => void;
}

/** Stars awarded for how completely the diary was filled in. */
const starsFor = (entries: DiaryEntry[]): number => {
  const meals = new Set(entries.map((e) => e.mealId)).size;
  if (meals >= 4) return 3;
  if (meals >= 2) return 2;
  return 1;
};

/** Progress bar comparing a total against a daily goal. */
const GoalBar = ({ label, value, goal, unit, color }: { label: string; value: number; goal: number; unit: string; color: string }) => {
  const pct = Math.min(100, Math.round((value / goal) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-xs font-bold uppercase tracking-wide text-[hsl(26,40%,32%)]">{label}</span>
        <span className="text-xs font-bold text-[hsl(26,30%,42%)]">
          {value.toLocaleString()} / {goal.toLocaleString()} {unit} · {pct}%
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full border-2 border-[hsl(28,35%,45%)] bg-[hsl(38,30%,80%)]">
        <div
          data-goal-fill
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
};

/**
 * Level-complete screen: stars, the day's totals counting up, then the full
 * diary broken out by meal. This is the payoff the whole run builds toward, so
 * it fires confetti and the finish fanfare on entry.
 */
const SummaryScreen = ({ entries, goals, onSave, onShare, onEdit, onReset, onClose }: SummaryScreenProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const kcalRef = useRef<HTMLSpanElement>(null);
  const proteinRef = useRef<HTMLSpanElement>(null);
  const starsRef = useRef<HTMLDivElement>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [confirmReset, setConfirmReset] = useState(false);

  const totals = totalMacros(entries);
  const stars = starsFor(entries);

  useEffect(() => {
    sfx.finish();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    countUp(kcalRef.current, totals.kcal, { duration: 1.2 });
    countUp(proteinRef.current, totals.protein, { duration: 1.2, decimals: 1 });

    if (reduced) return;

    const ctx = gsap.context(() => {
      gsap
        .timeline()
        .from("[data-complete]", { scale: 0.6, opacity: 0, duration: 0.6, ease: "back.out(2.6)" })
        .from("[data-star]", { scale: 0, rotate: -180, duration: 0.5, stagger: 0.14, ease: "back.out(3)" }, 0.35)
        .from("[data-total]", { y: 24, opacity: 0, duration: 0.45, stagger: 0.1, ease: "power2.out" }, 0.5)
        .from("[data-meal-block]", { y: 26, opacity: 0, duration: 0.4, stagger: 0.08, ease: "power2.out" }, 0.8);
    }, rootRef);

    const t1 = window.setTimeout(() => confettiBurst(starsRef.current, 40), 350);
    const t2 = window.setTimeout(() => sparkle(starsRef.current, 12), 900);

    return () => {
      ctx.revert();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // Runs once — this screen is mounted fresh for each completed run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!onSave || saveState !== "idle") return;
    setSaveState("saving");
    try {
      await onSave(totals);
      setSaveState("saved");
      sfx.levelUp();
    } catch {
      setSaveState("idle");
    }
  };

  const byMeal = MEALS.map((meal) => ({
    meal,
    items: entries.filter((e) => e.mealId === meal.id),
  })).filter((m) => m.items.length > 0);

  return (
    <div ref={rootRef} className="space-y-6 p-5 sm:p-7">
      <div className="text-center">
        <div data-complete className="game-banner game-banner-gold mx-auto text-base sm:text-xl">
          🏆 Level Complete!
        </div>

        <div ref={starsRef} className="mt-4 flex justify-center gap-2">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              data-star
              className={cn(
                "text-3xl leading-none sm:text-4xl",
                n <= stars ? "drop-shadow-[0_3px_0_hsl(33,75%,28%)]" : "opacity-25 grayscale",
              )}
            >
              ⭐
            </span>
          ))}
        </div>

        <p className="mt-3 text-sm font-bold text-[hsl(26,30%,42%)]">
          {entries.length} item{entries.length === 1 ? "" : "s"} logged across {byMeal.length} meal
          {byMeal.length === 1 ? "" : "s"}. Your food diary is built.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div
          data-total
          className="rounded-2xl border-[3px] border-[hsl(6,55%,30%)] bg-gradient-to-b from-[hsl(6,70%,62%)] to-[hsl(6,62%,50%)] p-4 text-center text-white shadow-[0_5px_0_hsl(6,55%,30%)]"
        >
          <div className="font-display text-xs font-bold uppercase tracking-widest opacity-90">Total Calories</div>
          <div className="font-display text-4xl font-bold [text-shadow:0_2px_0_rgba(0,0,0,0.3)] sm:text-5xl">
            <span ref={kcalRef}>0</span>
            <span className="ml-1 text-lg">kcal</span>
          </div>
        </div>

        <div
          data-total
          className="rounded-2xl border-[3px] border-[hsl(178,50%,18%)] bg-gradient-to-b from-[hsl(178,48%,44%)] to-[hsl(178,54%,32%)] p-4 text-center text-white shadow-[0_5px_0_hsl(178,50%,18%)]"
        >
          <div className="font-display text-xs font-bold uppercase tracking-widest opacity-90">Total Protein</div>
          <div className="font-display text-4xl font-bold [text-shadow:0_2px_0_rgba(0,0,0,0.3)] sm:text-5xl">
            <span ref={proteinRef}>0</span>
            <span className="ml-1 text-lg">g</span>
          </div>
        </div>
      </div>

      {(goals?.calories || goals?.protein) && (
        <div className="space-y-3 rounded-2xl border-2 border-[hsl(28,35%,45%)] bg-[hsl(40,40%,90%)] p-4">
          {goals?.calories ? (
            <GoalBar label="Calorie goal" value={totals.kcal} goal={goals.calories} unit="kcal" color="hsl(6,62%,50%)" />
          ) : null}
          {goals?.protein ? (
            <GoalBar label="Protein goal" value={totals.protein} goal={goals.protein} unit="g" color="hsl(178,54%,32%)" />
          ) : null}
        </div>
      )}

      <div className="space-y-3">
        {byMeal.map(({ meal, items }) => {
          const mealTotals = totalMacros(items);
          return (
            <div
              key={meal.id}
              data-meal-block
              className="rounded-2xl border-[3px] border-[hsl(28,35%,45%)] bg-gradient-to-b from-[hsl(42,62%,94%)] to-[hsl(38,48%,86%)] p-3 shadow-[0_4px_0_hsl(24,40%,26%)]"
            >
              <div className="mb-2 flex items-center justify-between gap-2 border-b-2 border-dashed border-[hsl(28,30%,60%)] pb-2">
                <span className="font-display text-sm font-bold text-[hsl(26,50%,20%)]">
                  {meal.sprite} {meal.label}
                </span>
                <span className="font-display text-xs font-bold text-[hsl(26,30%,42%)]">
                  {mealTotals.kcal} kcal · {mealTotals.protein}g P
                </span>
              </div>
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item.key} className="flex items-center gap-2 text-xs font-bold text-[hsl(26,40%,32%)]">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                      <FoodSprite sprite={item.sprite} size="text-lg" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {item.label}
                      {item.methodLabel ? ` (${item.methodLabel})` : ""} — {item.grams}g
                    </span>
                    <span className="shrink-0 text-[hsl(6,62%,45%)]">{item.kcal}</span>
                    <span className="w-12 shrink-0 text-right text-[hsl(178,54%,30%)]">{item.protein}g</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Two rows, each of one width: the things you came here to do, then the
          ways out. Uniform buttons within a row are what stop a five-action
          footer reading as a pile of unrelated links. */}
      <div className="space-y-2 pt-1">
        <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
          {onSave && (
            <GameButton
              color="forest"
              size="lg"
              className={ACTION_BUTTON}
              disabled={saveState !== "idle"}
              onClick={() => void save()}
            >
              {saveState === "saved" ? <Check className="h-5 w-5" /> : <Save className="h-5 w-5" />}
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved to today" : "Save to Today's Data"}
            </GameButton>
          )}
          <GameButton color="teal" size="lg" className={ACTION_BUTTON} onClick={onShare}>
            <Share2 className="h-5 w-5" />
            Share my day
          </GameButton>
        </div>

        <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
          <GameButton color="wood" size="md" className={ACTION_BUTTON_SM} onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Keep editing
          </GameButton>
          <GameButton
            color={confirmReset ? "red" : "wood"}
            size="md"
            className={ACTION_BUTTON_SM}
            onClick={() => {
              if (confirmReset) onReset();
              else setConfirmReset(true);
            }}
          >
            <RotateCcw className="h-4 w-4" />
            {confirmReset ? "Tap to wipe" : "Start over"}
          </GameButton>
          <GameButton color="wood" size="md" className={ACTION_BUTTON_SM} onClick={onClose}>
            <X className="h-4 w-4" />
            Close
          </GameButton>
        </div>
      </div>

      <p className="text-center text-xs font-bold text-[hsl(26,30%,45%)]">
        Your diary is saved — close any time and pick it back up today.
      </p>
    </div>
  );
};

export default SummaryScreen;
