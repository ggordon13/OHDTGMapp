import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarCheck, Scale, Utensils, Beef, Droplets, Dumbbell, Footprints, Save, Check, Loader2 } from "lucide-react";
import { DailyLog, exerciseOptions } from "@/lib/mockData";
import { isDayComplete } from "@/lib/gamification";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import GamePanel from "@/components/game/GamePanel";
import { confettiBurst, pop } from "@/lib/fx";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TodayDataProps {
  /** Today's row (merged with anything already saved), or null before load. */
  entry: DailyLog | null;
  /** Persist the updated row for today. */
  onSave: (entry: DailyLog) => void | Promise<void>;
  /** Small chip shown in the panel header (e.g. the free-plan day counter). */
  statusBadge?: ReactNode;
  /** Rendered below the fields (e.g. the free-plan premium notice). */
  footer?: ReactNode;
  /** When true, today is beyond the free plan's cap — fields are read-only. */
  locked?: boolean;
}

const fields = [
  { key: "weight", label: "Weight", unit: "kg", icon: Scale, type: "number" },
  { key: "calories", label: "Calories", unit: "kcal", icon: Utensils, type: "number" },
  { key: "protein", label: "Protein", unit: "g", icon: Beef, type: "number" },
  { key: "water", label: "Water", unit: "glasses", icon: Droplets, type: "number" },
  { key: "steps", label: "Steps", unit: "", icon: Footprints, type: "number" },
  { key: "exercise", label: "Exercise", unit: "", icon: Dumbbell, type: "select" },
] as const;

type FieldKey = (typeof fields)[number]["key"];

const toFormValue = (v: string | number | null | undefined) => (v == null ? "" : String(v));

/** The value that should seed the form input for a field (exercise defaults to "None"). */
const seedValue = (entry: DailyLog, key: FieldKey): string =>
  key === "exercise" ? entry.exercise || "None" : toFormValue(entry[key]);

const TodayData = ({ entry, onSave, statusBadge, footer, locked = false }: TodayDataProps) => {
  const [form, setForm] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<FieldKey | null>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  // Previous entry, so we only adopt external changes for fields the user
  // hasn't edited — saving one field never wipes another's unsaved input.
  const prevEntry = useRef<DailyLog | null>(null);
  const complete = entry != null && isDayComplete(entry);
  const wasComplete = useRef(complete);

  // Mirror saved values into the form: seed on first load, and afterwards only
  // overwrite fields the user hasn't touched (kept clean vs the prior entry).
  useEffect(() => {
    if (!entry) return;
    const prev = prevEntry.current;
    setForm((f) => {
      const next = { ...f };
      for (const { key } of fields) {
        const wasClean = prev == null || f[key] === undefined || f[key] === seedValue(prev, key);
        if (wasClean) next[key] = seedValue(entry, key);
      }
      return next;
    });
    prevEntry.current = entry;
  }, [entry]);

  // Celebrate the moment today's row becomes complete.
  useEffect(() => {
    if (complete && !wasComplete.current) {
      pop(doneRef.current, 1.4);
      confettiBurst(doneRef.current, 22);
    }
    wasComplete.current = complete;
  }, [complete]);

  // What's currently persisted for a field ("" = nothing saved yet).
  const persistedValue = (key: FieldKey): string =>
    !entry ? "" : key === "exercise" ? entry.exercise ?? "" : toFormValue(entry[key]);

  const isDirty = (key: FieldKey) => (form[key] ?? "") !== persistedValue(key);
  const isSaved = (key: FieldKey) => persistedValue(key) !== "" && !isDirty(key);

  const savedCount = fields.filter((f) => isSaved(f.key)).length;

  const saveField = async (key: FieldKey) => {
    if (!entry || savingKey || locked) return;
    setSavingKey(key);
    const num = (k: FieldKey) => (form[k] === "" || form[k] == null ? null : Number(form[k]));
    // Change only this field; every other field keeps its persisted value, so
    // unsaved edits elsewhere are neither written nor lost.
    const updated: DailyLog = {
      ...entry,
      weight: key === "weight" ? num("weight") : entry.weight,
      calories: key === "calories" ? num("calories") : entry.calories,
      protein: key === "protein" ? num("protein") : entry.protein,
      water: key === "water" ? num("water") : entry.water,
      steps: key === "steps" ? num("steps") : entry.steps,
      exercise: key === "exercise" ? form.exercise || "None" : entry.exercise,
    };
    await onSave(updated);
    setSavingKey(null);
    // Quiet, field-specific confirmation — the green check is the main signal.
    const label = fields.find((f) => f.key === key)?.label ?? "Value";
    toast.success(`${label} saved`, { duration: 1500 });
  };

  return (
    <GamePanel
      title="Today's Data"
      icon={<CalendarCheck className="h-4 w-4" />}
      color="leaf"
      right={
        <div className="flex items-center gap-2">
          {statusBadge}
          <span className="game-tag px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {savedCount}/{fields.length} saved
          </span>
        </div>
      }
    >
      <div className="space-y-4">
        {complete ? (
          <div ref={doneRef} className="flex items-center gap-2 rounded-lg border-2 border-[hsl(84,45%,40%)]/40 bg-[hsl(84,46%,52%)]/12 px-3 py-2">
            <span className="text-lg">🎉</span>
            <p className="text-sm font-bold text-[hsl(84,45%,28%)]">Today's data is complete — nice work!</p>
          </div>
        ) : locked ? (
          <p className="text-xs font-semibold text-muted-foreground">
            Logging is paused on the free plan — upgrade to keep tracking today.
          </p>
        ) : (
          <p className="text-xs font-semibold text-muted-foreground">
            Fill in each number and save it on its own — no need to submit them all at once.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {fields.map(({ key, label, unit, icon: Icon, type }) => {
            const saved = isSaved(key);
            const busy = savingKey === key;
            return (
              <div
                key={key}
                className={cn(
                  "space-y-1 rounded-xl p-2 transition-colors",
                  saved && "bg-[hsl(84,46%,52%)]/12 ring-1 ring-inset ring-[hsl(84,45%,40%)]/40",
                )}
              >
                <label
                  htmlFor={`today-${key}`}
                  className="flex items-center gap-1 font-display text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {label}
                    {unit && <span className="ml-0.5 opacity-60">({unit})</span>}
                  </span>
                </label>

                <div className="flex items-center gap-1.5">
                  {type === "select" ? (
                    <Select
                      value={form.exercise || "None"}
                      onValueChange={(v) => setForm((f) => ({ ...f, exercise: v }))}
                      disabled={locked}
                    >
                      <SelectTrigger id={`today-${key}`} className="h-9 flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {exerciseOptions.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={`today-${key}`}
                      type="number"
                      step={key === "weight" ? "0.1" : "1"}
                      inputMode="decimal"
                      placeholder="0"
                      value={form[key] ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && isDirty(key)) void saveField(key);
                      }}
                      disabled={locked}
                      className="h-9 flex-1"
                    />
                  )}

                  {saved ? (
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-[hsl(84,45%,24%)] bg-gradient-to-b from-[hsl(84,46%,52%)] to-[hsl(70,50%,38%)] text-white shadow-[0_2px_0_hsl(84,45%,24%)]"
                      title="Saved"
                      aria-label={`${label} saved`}
                    >
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void saveField(key)}
                      disabled={!isDirty(key) || savingKey != null || !entry || locked}
                      title={`Save ${label.toLowerCase()}`}
                      aria-label={`Save ${label}`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-[hsl(70,50%,22%)] bg-gradient-to-b from-[hsl(68,46%,50%)] to-[hsl(70,50%,38%)] text-white shadow-[0_2px_0_hsl(70,50%,22%)] transition hover:brightness-110 active:translate-y-[2px] active:shadow-none disabled:opacity-40 disabled:saturate-50"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {footer}
      </div>
    </GamePanel>
  );
};

export default TodayData;
