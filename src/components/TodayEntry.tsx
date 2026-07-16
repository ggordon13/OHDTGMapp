import { useState } from "react";
import { DailyLog, exerciseOptions } from "@/lib/mockData";
import { formatDateInputValue } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Scale, Utensils, Beef, Droplets, Dumbbell, Footprints } from "lucide-react";
import { toast } from "sonner";

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
      <div className="rounded-xl border bg-card p-5 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15">
            <Plus className="h-4 w-4 text-accent" />
          </div>
          <div>
            <h3 className="font-display font-semibold">Today's Log Complete ✅</h3>
            <p className="text-xs text-muted-foreground">You can still edit it in the Daily Log table below.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <Plus className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="font-display font-semibold">Log Day {nextDay}</h3>
          <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {fields.map(({ key, label, unit, icon: Icon, type }) => (
            <div key={key} className="space-y-1">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
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
        <Button type="submit" className="w-full gap-2" disabled={disabledReason === "incomplete_logs"}>
          <Plus className="h-4 w-4" />
          Add to Log
        </Button>
        {disabledReason === "incomplete_logs" && (
          <p className="text-xs text-amber-600">Complete the empty values in the Daily Log table first.</p>
        )}
      </form>
    </div>
  );
};

export default TodayEntry;
