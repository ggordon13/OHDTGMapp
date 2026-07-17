import { useRef, useState } from "react";
import { DailyLog, exerciseOptions } from "@/lib/mockData";
import { formatDateInputValue, getUserTimeZone } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Scale, Utensils, Beef, Droplets, Dumbbell, Footprints, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import GamePanel from "@/components/game/GamePanel";
import GameButton from "@/components/game/GameButton";
import { confettiBurst } from "@/lib/fx";

interface TodayEntryProps {
  nextDay: number;
  onAdd: (entry: DailyLog) => void;
  disabled?: boolean;
  disabledReason?: "logged_today" | "incomplete_logs";
}

const TodayEntry = ({ nextDay, onAdd, disabled, disabledReason }: TodayEntryProps) => {
  const [form, setForm] = useState({
    weight: "",
    calories: "",
    protein: "",
    water: "",
    exercise: "None",
    steps: "",
  });
  const submitRef = useRef<HTMLButtonElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const today = formatDateInputValue();
    const entry: DailyLog = {
      date: today,
      day: nextDay,
      weight: form.weight ? Number(form.weight) : null,
      calories: form.calories ? Number(form.calories) : null,
      protein: form.protein ? Number(form.protein) : null,
      water: form.water ? Number(form.water) : null,
      exercise: form.exercise || "None",
      steps: form.steps ? Number(form.steps) : null,
    };

    onAdd(entry);
    confettiBurst(submitRef.current, 20);
    setForm({ weight: "", calories: "", protein: "", water: "", exercise: "None", steps: "" });
    toast.success(`Day ${nextDay} logged! 🎉`);
  };

  const fields = [
    { key: "weight", label: "Weight", unit: "kg", icon: Scale, type: "number" },
    { key: "calories", label: "Calories", unit: "kcal", icon: Utensils, type: "number" },
    { key: "protein", label: "Protein", unit: "g", icon: Beef, type: "number" },
    { key: "water", label: "Water", unit: "glasses (~250ml)", icon: Droplets, type: "number" },
    { key: "exercise", label: "Exercise", unit: "", icon: Dumbbell, type: "select" },
    { key: "steps", label: "Steps", unit: "", icon: Footprints, type: "number" },
  ] as const;

  if (disabledReason === "logged_today") {
    return (
      <GamePanel title="Today's Log" icon={<CheckCircle2 className="h-4 w-4" />} color="leaf">
        <div className="flex items-center gap-2">
          <p className="font-display font-semibold text-card-foreground">Complete ✅</p>
          <p className="text-xs font-semibold text-muted-foreground">
            You can still edit it in the Daily Log table below.
          </p>
        </div>
      </GamePanel>
    );
  }

  return (
    <GamePanel title={`Log Day ${nextDay}`} icon={<Plus className="h-4 w-4" />} color="leaf">
      <div className="space-y-4">
        <p className="text-xs font-bold text-muted-foreground">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: getUserTimeZone() })}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {fields.map(({ key, label, unit, icon: Icon, type }) => (
              <div key={key} className="space-y-1">
                <label className="flex items-center gap-1.5 font-display text-xs font-semibold text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {label} {unit && <span className="opacity-60">({unit})</span>}
                </label>
                {type === "select" ? (
                  <Select value={form[key]} onValueChange={(value) => setForm((f) => ({ ...f, [key]: value }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {exerciseOptions.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={type}
                    placeholder="0"
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="h-9"
                  />
                )}
              </div>
            ))}
          </div>
          <GameButton
            ref={submitRef}
            type="submit"
            color="leaf"
            size="lg"
            className="w-full"
            disabled={disabledReason === "incomplete_logs"}
          >
            <Plus className="h-4 w-4" strokeWidth={3} />
            Add to Log
          </GameButton>
          {disabledReason === "incomplete_logs" && (
            <p className="text-xs font-bold text-[hsl(24,75%,40%)]">
              Complete the empty values in the Daily Log table first.
            </p>
          )}
        </form>
      </div>
    </GamePanel>
  );
};

export default TodayEntry;
