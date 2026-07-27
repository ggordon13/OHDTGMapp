import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, Lock, Star, X } from "lucide-react";
import GameButton from "@/components/game/GameButton";
import RunReport from "@/components/RunReport";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateTargets, recommendedTargetRange, targetWeightRange, type GoalType } from "@/lib/profile";
import { ArchivedBadge, RunSummary } from "@/lib/hundredDay";
import { CHALLENGE_DAYS } from "@/lib/access";
import type { RestartPlan } from "@/hooks/useHundredDay";
import { formatDateInputValue, parseDateInputValue } from "@/lib/utils";
import { cn } from "@/lib/utils";

/** Body stats the target maths needs; they carry over from the finished run. */
export interface FinisherBodyStats {
  age: number | null;
  heightCm: number | null;
  gender: string | null;
  activityLevel: string | null;
}

interface HundredDayFinishModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  summary: RunSummary;
  badges: ArchivedBadge[];
  /** Stars already earned — the new one is number `starCount + 1`. */
  starCount: number;
  stats: FinisherBodyStats;
  /** Weight to prefill the next run's baseline with (their latest weigh-in). */
  suggestedStartWeight: number | null;
  /** The goal type the finished run used, carried over as the default. */
  currentGoalType: GoalType;
  busy: boolean;
  /** True once Days 1–100 have been locked in — the modal then skips that gate. */
  locked: boolean;
  /** Days out of 100 that carry a weight, and whether Day 100 itself does. */
  readiness: { daysLogged: number; totalDays: number; finalDayLogged: boolean };
  /** Seal Days 1–100 and score the run. Resolves true on success. */
  onLockIn: () => Promise<boolean>;
  /** Archive the run and re-base the profile. Resolves true on success. */
  onConfirm: (plan: RestartPlan) => Promise<boolean>;
}

/** How far ahead a user may schedule their next Day 1. */
const MAX_START_OFFSET_DAYS = 60;

const shiftDays = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatDateInputValue(d);
};

const pretty = (iso: string): string =>
  parseDateInputValue(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The Day 100 finish line. Stage one hands over the golden star and the report
 * card; stage two sets up the next run — when Day 1 lands, the new baseline
 * weight, and a fresh target. Confirming archives the run: the trophy case
 * empties for the next one while XP and levels carry straight on.
 */
const HundredDayFinishModal = ({
  open,
  onOpenChange,
  userName,
  summary,
  badges,
  starCount,
  stats,
  suggestedStartWeight,
  currentGoalType,
  busy,
  locked,
  readiness,
  onLockIn,
  onConfirm,
}: HundredDayFinishModalProps) => {
  const [stage, setStage] = useState<"lock" | "report" | "restart">(locked ? "report" : "lock");

  const today = formatDateInputValue();
  const [startChoice, setStartChoice] = useState<"today" | "tomorrow" | "custom">("today");
  const [customStart, setCustomStart] = useState(shiftDays(1));

  const defaultWeight = suggestedStartWeight ?? summary.endWeight ?? summary.startWeight;
  const [weightInput, setWeightInput] = useState(defaultWeight != null ? String(round1(defaultWeight)) : "");
  const [goalType, setGoalType] = useState<GoalType>(currentGoalType);
  const [targetInput, setTargetInput] = useState("");
  const [useRecommended, setUseRecommended] = useState(true);

  // Re-arm the form each time the modal is opened, so a dismissed-and-reopened
  // finish never carries stale input.
  useEffect(() => {
    if (!open) return;
    setStage(locked ? "report" : "lock");
    setStartChoice("today");
    setCustomStart(shiftDays(1));
    setWeightInput(defaultWeight != null ? String(round1(defaultWeight)) : "");
    setGoalType(currentGoalType);
    setTargetInput("");
    setUseRecommended(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const newStart = startChoice === "today" ? today : startChoice === "tomorrow" ? shiftDays(1) : customStart;

  const weight = Number(weightInput);
  const hasWeight = weightInput !== "" && !Number.isNaN(weight) && weight > 0;
  const range = hasWeight ? targetWeightRange(weight, goalType) : null;
  const recommended = hasWeight ? recommendedTargetRange(weight, goalType) : null;

  // Snap a manual target back into the allowed band when the goal or the
  // baseline weight moves, so the form can never hold an invalid value.
  useEffect(() => {
    if (!range || targetInput === "") return;
    const t = Number(targetInput);
    if (Number.isNaN(t)) return;
    if (t < range.min) setTargetInput(String(range.min));
    else if (t > range.max) setTargetInput(String(range.max));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalType, weightInput]);

  const target = Number(targetInput);
  const targetValid = useRecommended
    ? recommended != null
    : range != null && targetInput !== "" && !Number.isNaN(target) && target >= range.min && target <= range.max;

  const startValid =
    !!newStart && newStart >= today && newStart <= shiftDays(MAX_START_OFFSET_DAYS);

  const statsReady =
    stats.age != null && stats.heightCm != null && !!stats.gender && !!stats.activityLevel;

  const targets = useMemo(() => {
    if (!statsReady || !hasWeight || !targetValid) return null;
    return calculateTargets(
      stats.age as number,
      stats.heightCm as number,
      weight,
      stats.gender as string,
      stats.activityLevel as string,
      goalType,
      target,
      useRecommended,
    );
  }, [statsReady, hasWeight, targetValid, stats, weight, goalType, target, useRecommended]);

  const canConfirm = !busy && startValid && targets != null;

  const lockIn = async () => {
    if (busy) return;
    if (await onLockIn()) setStage("report");
  };

  const confirm = async () => {
    if (!canConfirm || !targets || !hasWeight) return;
    const resolvedTarget = useRecommended
      ? goalType === "lose"
        ? (recommended as { min: number; max: number }).max
        : weight
      : target;

    const ok = await onConfirm({
      newStartDate: newStart,
      startWeight: weight,
      goalType,
      targetWeight: resolvedTarget,
      targetWeightMin: useRecommended ? (recommended as { min: number }).min : null,
      targetWeightMax: useRecommended ? (recommended as { max: number }).max : null,
      targets,
    });
    if (ok) onOpenChange(false);
  };

  const labelClass = "font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground";

  const startOptions = [
    { value: "today" as const, label: "Today", hint: pretty(today).split(",")[0] },
    { value: "tomorrow" as const, label: "Tomorrow", hint: pretty(shiftDays(1)).split(",")[0] },
    { value: "custom" as const, label: "Pick a date", hint: "Up to 60 days out" },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="game-panel fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto p-6 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {stage === "lock" ? (
            <div className="space-y-5">
              <div className="space-y-2 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-[hsl(6,55%,28%)] bg-gradient-to-b from-[hsl(6,70%,62%)] to-[hsl(6,62%,48%)] shadow-[0_4px_0_hsl(6,55%,28%),0_6px_12px_rgba(0,0,0,0.4),inset_0_2px_0_rgba(255,255,255,0.4)]">
                  <Lock className="h-7 w-7 text-white" />
                </div>
                <Dialog.Title className="font-display text-2xl font-bold text-card-foreground">
                  Lock in Day {CHALLENGE_DAYS}
                </Dialog.Title>
                <Dialog.Description className="text-sm font-bold text-muted-foreground">
                  This closes the books on your challenge and scores it — including Week 15, the final 2 days.
                </Dialog.Description>
              </div>

              <div className="rounded-xl border-2 border-[hsl(6,55%,45%)] bg-[hsl(6,60%,92%)] px-3 py-2.5">
                <p className="flex items-start gap-1.5 text-sm font-bold text-[hsl(6,62%,38%)]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Once you lock in, <strong>Days 1–{CHALLENGE_DAYS} of this challenge become permanent</strong>. You
                    won't be able to change any of that data again — so make sure everything is entered first.
                  </span>
                </p>
              </div>

              {/* Give them the numbers before they commit to them. */}
              <div className="grid grid-cols-2 gap-2">
                <div className="game-tag px-2.5 py-2">
                  <p className="font-display text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                    Days logged
                  </p>
                  <p className="font-display text-sm font-bold text-card-foreground">
                    {readiness.daysLogged}/{readiness.totalDays}
                  </p>
                </div>
                <div className="game-tag px-2.5 py-2">
                  <p className="font-display text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                    Day {CHALLENGE_DAYS} weight
                  </p>
                  <p
                    className={cn(
                      "font-display text-sm font-bold",
                      readiness.finalDayLogged ? "text-[hsl(84,45%,28%)]" : "text-[hsl(6,62%,42%)]",
                    )}
                  >
                    {readiness.finalDayLogged ? "Logged ✓" : "Missing"}
                  </p>
                </div>
              </div>

              {!readiness.finalDayLogged && (
                <div className="rounded-lg border-2 border-[hsl(40,70%,45%)] bg-[hsl(45,82%,88%)] px-3 py-2 text-xs font-bold text-[hsl(30,55%,32%)]">
                  ⚠️ Day {CHALLENGE_DAYS} has no weight yet. Log it before locking in, or your before-and-after will be
                  missing its final number.
                </div>
              )}

              <div className="space-y-2">
                <GameButton color="red" size="lg" className="w-full" disabled={busy} onClick={() => void lockIn()}>
                  <Lock className="h-4 w-4" />
                  {busy ? "Locking in…" : `Lock in Day ${CHALLENGE_DAYS} & see my results`}
                </GameButton>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onOpenChange(false)}
                  className="w-full text-center font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-card-foreground disabled:opacity-50"
                >
                  Wait — I still need to edit something
                </button>
              </div>
            </div>
          ) : stage === "report" ? (
            <div className="space-y-5">
              <div className="space-y-2 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-[4px] border-[hsl(33,75%,28%)] bg-gradient-to-b from-[hsl(44,98%,68%)] to-[hsl(36,88%,46%)] shadow-[0_5px_0_hsl(33,75%,28%),0_0_28px_hsl(42,95%,60%,0.6),inset_0_2px_0_rgba(255,255,255,0.55)]">
                  <Star className="h-10 w-10 fill-[hsl(48,100%,86%)] text-[hsl(26,50%,18%)] drop-shadow-[0_2px_0_rgba(0,0,0,0.3)]" />
                </div>
                <Dialog.Title className="font-display text-2xl font-bold text-card-foreground">
                  100 days done, {userName}! 🏆
                </Dialog.Title>
                <Dialog.Description className="text-sm font-bold text-muted-foreground">
                  Golden star #{starCount + 1} is yours — permanently, beside your name. Here's how the run went.
                </Dialog.Description>
              </div>

              <RunReport summary={summary} badges={badges} />

              <div className="rounded-xl border-2 border-[hsl(40,70%,45%)] bg-[hsl(45,82%,88%)] px-3 py-2 text-xs font-bold text-[hsl(30,55%,32%)]">
                🔒 Days 1–{CHALLENGE_DAYS} are locked and final. Starting your next 100 days files this run away in your
                finisher archive and empties the trophy case for a fresh set — your XP, level and rank are permanent and
                carry straight over.
              </div>

              <div className="space-y-2">
                <GameButton color="gold" size="lg" className="w-full" onClick={() => setStage("restart")}>
                  Keep the habit — set up my next 100 days
                </GameButton>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="w-full text-center font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-card-foreground"
                >
                  Not yet — I'll do this later
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1 text-center">
                <Dialog.Title className="font-display text-2xl font-bold text-card-foreground">
                  Your next 100 days
                </Dialog.Title>
                <Dialog.Description className="text-sm font-bold text-muted-foreground">
                  Pick when Day 1 lands and update your starting numbers — we'll recalculate your daily targets.
                </Dialog.Description>
              </div>

              {/* When does the next Day 1 land? */}
              <div className="space-y-1.5">
                <Label className={labelClass}>Start Day 1 on</Label>
                <div
                  role="tablist"
                  aria-label="Start Day 1 on"
                  className="grid grid-cols-3 gap-1 rounded-xl border-2 border-[hsl(33,28%,58%)] bg-[hsl(37,40%,82%)] p-1"
                >
                  {startOptions.map((opt) => {
                    const active = startChoice === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setStartChoice(opt.value)}
                        className={cn(
                          "rounded-lg px-2 py-2 text-center transition",
                          active
                            ? "border-2 border-[hsl(33,75%,28%)] bg-gradient-to-b from-[hsl(42,95%,62%)] to-[hsl(36,85%,46%)] text-[hsl(26,50%,18%)] shadow-[0_2px_0_hsl(33,75%,28%)]"
                            : "border-2 border-transparent text-muted-foreground hover:bg-[hsl(40,48%,92%)]",
                        )}
                      >
                        <span className="block font-display text-xs font-bold uppercase tracking-wide">{opt.label}</span>
                        <span className={cn("block text-[10px] font-bold", active ? "text-[hsl(28,55%,25%)]" : "opacity-70")}>
                          {opt.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {startChoice === "custom" && (
                  <Input
                    type="date"
                    min={today}
                    max={shiftDays(MAX_START_OFFSET_DAYS)}
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                )}
                <p className="text-xs font-bold text-muted-foreground">
                  {startValid
                    ? newStart === today
                      ? "Day 1 is today — start logging right away."
                      : `Day 1 lands on ${pretty(newStart)}. Your dashboard waits until then.`
                    : "Pick a date from today up to 60 days out."}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="restart-weight" className={labelClass}>Starting Weight (kg)</Label>
                <Input
                  id="restart-weight"
                  type="number"
                  step="0.1"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  placeholder="85"
                />
                <p className="text-xs font-bold text-muted-foreground">
                  Prefilled from your latest weigh-in. This becomes Day 1 of the new run.
                </p>
              </div>

              {/* Goal: drives the target limits and the calorie maths */}
              <div className="space-y-1.5">
                <Label className={labelClass}>Goal</Label>
                <div
                  role="tablist"
                  aria-label="Goal"
                  className="grid grid-cols-2 gap-1 rounded-xl border-2 border-[hsl(33,28%,58%)] bg-[hsl(37,40%,82%)] p-1"
                >
                  {([
                    { value: "lose" as const, label: "Lose", hint: "Drop weight" },
                    { value: "maintain" as const, label: "Maintain", hint: "Hold steady" },
                  ]).map((opt) => {
                    const active = goalType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setGoalType(opt.value)}
                        className={cn(
                          "rounded-lg px-3 py-2 text-center transition",
                          active
                            ? "border-2 border-[hsl(70,50%,22%)] bg-gradient-to-b from-[hsl(68,46%,50%)] to-[hsl(70,50%,38%)] text-white shadow-[0_2px_0_hsl(70,50%,22%)]"
                            : "border-2 border-transparent text-muted-foreground hover:bg-[hsl(40,48%,92%)]",
                        )}
                      >
                        <span className="block font-display text-sm font-bold uppercase tracking-wide">{opt.label}</span>
                        <span className={cn("block text-[10px] font-bold", active ? "text-white/80" : "opacity-70")}>
                          {opt.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="restart-target" className={labelClass}>Target Weight (kg)</Label>
                <Input
                  id="restart-target"
                  type="number"
                  step="0.1"
                  min={range?.min}
                  max={range?.max}
                  value={useRecommended ? "" : targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  disabled={!hasWeight || useRecommended}
                  placeholder={
                    useRecommended && recommended ? `${recommended.min} – ${recommended.max}` : range ? String(range.min) : "—"
                  }
                />
                <p
                  className={cn(
                    "text-xs font-bold",
                    !useRecommended && targetInput !== "" && !targetValid ? "text-[hsl(6,62%,42%)]" : "text-muted-foreground",
                  )}
                >
                  {useRecommended && recommended
                    ? `Using the recommended range: ${recommended.min} kg – ${recommended.max} kg`
                    : range
                      ? `${range.min} kg – ${range.max} kg`
                      : "Enter your starting weight first."}
                </p>
                <label className="flex cursor-pointer items-start gap-2 pt-1">
                  <Checkbox
                    checked={useRecommended}
                    onCheckedChange={(v) => setUseRecommended(v === true)}
                    disabled={!hasWeight}
                    className="mt-0.5 border-[hsl(33,30%,45%)] data-[state=checked]:border-[hsl(70,50%,22%)] data-[state=checked]:bg-[hsl(70,50%,38%)]"
                  />
                  <span className="text-xs font-bold text-muted-foreground">Just use the recommended weight range</span>
                </label>
              </div>

              {targets && (
                <div className="rounded-xl border-2 border-[hsl(33,28%,60%)] bg-[hsl(37,40%,82%)] p-4">
                  <p className="font-display text-sm font-semibold uppercase tracking-wider text-card-foreground">
                    Your New Daily Targets
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      { label: "Calories", value: `${targets.calorieMin}–${targets.calorieMax} kcal` },
                      { label: "Protein", value: `${targets.proteinMin}–${targets.proteinMax} g` },
                      {
                        label: "Target Weight",
                        value: useRecommended && recommended ? `${recommended.min}–${recommended.max} kg` : `${target} kg`,
                      },
                      { label: "Water / Steps", value: `${targets.water} glasses / ${targets.steps.toLocaleString()}` },
                    ].map(({ label, value }) => (
                      <div key={label} className="game-tag px-2.5 py-1.5">
                        <p className="font-display text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {label}
                        </p>
                        <p className="font-bold text-card-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!statsReady && (
                <div className="rounded-lg border-2 border-[hsl(6,55%,45%)] bg-[hsl(6,60%,92%)] px-3 py-2 text-xs font-bold text-[hsl(6,62%,40%)]">
                  Your age, height, gender or activity level is missing — update your profile first so we can work out
                  your new targets.
                </div>
              )}

              <div className="space-y-2">
                <GameButton color="gold" size="lg" className="w-full" disabled={!canConfirm} onClick={() => void confirm()}>
                  {busy ? "Starting…" : "Claim my star & start Day 1"}
                </GameButton>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStage("report")}
                  className="w-full text-center font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-card-foreground disabled:opacity-50"
                >
                  Back to my results
                </button>
              </div>
            </div>
          )}

          <Dialog.Close
            disabled={busy}
            className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground transition-colors hover:text-card-foreground focus:outline-none disabled:opacity-40"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default HundredDayFinishModal;
