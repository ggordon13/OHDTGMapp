import { useEffect, useRef, useState } from "react";
import { CalendarCheck, Scale, Utensils, Beef, Droplets, Dumbbell, Footprints, Save, Pencil } from "lucide-react";
import { DailyLog, exerciseOptions } from "@/lib/mockData";
import { isDayComplete } from "@/lib/gamification";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import GamePanel from "@/components/game/GamePanel";
import GameButton from "@/components/game/GameButton";
import { confettiBurst, pop } from "@/lib/fx";

interface TodayDataProps {
  /** Today's row (merged with anything already saved), or null before load. */
  entry: DailyLog | null;
  /** Persist the updated row for today. */
  onSave: (entry: DailyLog) => void | Promise<void>;
}

const fields = [
  { key: "weight", label: "Weight", unit: "kg", icon: Scale, type: "number" },
  { key: "calories", label: "Calories", unit: "kcal", icon: Utensils, type: "number" },
  { key: "protein", label: "Protein", unit: "g", icon: Beef, type: "number" },
  { key: "water", label: "Water", unit: "glasses", icon: Droplets, type: "number" },
  { key: "steps", label: "Steps", unit: "", icon: Footprints, type: "number" },
  { key: "exercise", label: "Exercise", unit: "", icon: Dumbbell, type: "select" },
] as const;

const toFormValue = (v: string | number | null | undefined) => (v == null ? "" : String(v));

const TodayData = ({ entry, onSave }: TodayDataProps) => {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // Re-opens the form on a day that's already complete, so today's numbers
  // can be corrected without leaving the panel.
  const [editing, setEditing] = useState(false);
  const doneRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const complete = entry != null && isDayComplete(entry);
  const wasComplete = useRef(complete);
  const showDone = complete && !editing;

  // Mirror whatever is already saved for today into the form.
  useEffect(() => {
    if (!entry) return;
    setForm({
      weight: toFormValue(entry.weight),
      calories: toFormValue(entry.calories),
      protein: toFormValue(entry.protein),
      water: toFormValue(entry.water),
      steps: toFormValue(entry.steps),
      exercise: entry.exercise || "None",
    });
  }, [entry]);

  // Celebrate the moment today's row becomes complete.
  useEffect(() => {
    if (complete && !wasComplete.current) {
      pop(doneRef.current, 1.4);
      confettiBurst(doneRef.current, 22);
    }
    wasComplete.current = complete;
  }, [complete]);

  const handleSave = async () => {
    if (!entry || saving) return;
    setSaving(true);
    const num = (k: string) => (form[k] === "" || form[k] == null ? null : Number(form[k]));
    await onSave({
      ...entry,
      weight: num("weight"),
      calories: num("calories"),
      protein: num("protein"),
      water: num("water"),
      steps: num("steps"),
      exercise: form.exercise || "None",
    });
    setSaving(false);
    setEditing(false);
  };

  const handleCancelEdit = () => {
    // Discard edits by re-mirroring what's currently saved.
    if (entry) {
      setForm({
        weight: toFormValue(entry.weight),
        calories: toFormValue(entry.calories),
        protein: toFormValue(entry.protein),
        water: toFormValue(entry.water),
        steps: toFormValue(entry.steps),
        exercise: entry.exercise || "None",
      });
    }
    setEditing(false);
  };

  const filled = fields.filter((f) =>
    f.key === "exercise" ? !!form.exercise : form[f.key] !== "" && form[f.key] != null,
  ).length;

  return (
    <GamePanel
      title="Today's Data"
      icon={<CalendarCheck className="h-4 w-4" />}
      color="leaf"
      right={
        <span className="game-tag px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {filled}/{fields.length} filled
        </span>
      }
    >
      {showDone ? (
        <div ref={doneRef} className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-[hsl(84,45%,24%)] bg-gradient-to-b from-[hsl(84,46%,52%)] to-[hsl(70,50%,38%)] text-3xl shadow-[0_4px_0_hsl(84,45%,24%),0_6px_12px_rgba(0,0,0,0.35),inset_0_2px_0_rgba(255,255,255,0.4)]">
            🎉
          </div>
          <div>
            <p className="font-display text-lg font-bold text-card-foreground">Good job — today's data is complete!</p>
            <p className="text-sm font-semibold text-muted-foreground">
              Everything for today is logged. Come back tomorrow to keep the streak alive.
            </p>
          </div>

          <div className="mt-1 flex flex-wrap justify-center gap-2">
            {fields.map(({ key, label, unit }) => (
              <span key={key} className="game-tag inline-flex items-baseline gap-1 px-2.5 py-1">
                <span className="font-display text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
                <span className="text-xs font-bold text-card-foreground">
                  {form[key] || "—"}
                  {unit ? ` ${unit}` : ""}
                </span>
              </span>
            ))}
          </div>

          <GameButton color="wood" size="sm" className="mt-1" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Update Data
          </GameButton>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground">
            {editing
              ? "Update today's numbers — changes save straight into the Daily Log."
              : "Fill in today's numbers — they save straight into the Daily Log."}
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {fields.map(({ key, label, unit, icon: Icon, type }) => (
              <div key={key} className="space-y-1">
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
                {type === "select" ? (
                  <Select
                    value={form.exercise || "None"}
                    onValueChange={(v) => setForm((f) => ({ ...f, exercise: v }))}
                  >
                    <SelectTrigger id={`today-${key}`} className="h-9"><SelectValue /></SelectTrigger>
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
                    className="h-9"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <GameButton
              ref={saveRef}
              color="leaf"
              className="w-full flex-1"
              onClick={handleSave}
              disabled={saving || !entry}
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : editing ? "Save Changes" : "Save Today's Data"}
            </GameButton>
            {editing && (
              <GameButton color="wood" className="w-full sm:w-auto" onClick={handleCancelEdit} disabled={saving}>
                Cancel
              </GameButton>
            )}
          </div>
        </div>
      )}
    </GamePanel>
  );
};

export default TodayData;
