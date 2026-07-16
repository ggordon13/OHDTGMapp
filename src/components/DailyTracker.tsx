import { useState, useEffect } from "react";
import { DailyLog, exerciseOptions } from "@/lib/mockData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface DailyTrackerProps {
  logs: DailyLog[];
  onUpdate: (logs: DailyLog[]) => void;
}

const PAGE_SIZE = 7;

const DailyTracker = ({ logs, onUpdate }: DailyTrackerProps) => {
  const [editedLogs, setEditedLogs] = useState<DailyLog[]>(logs);
  const [page, setPage] = useState(Math.max(0, Math.floor((logs.length - 1) / PAGE_SIZE)));

  useEffect(() => {
    setEditedLogs(logs);
    setPage(Math.max(0, Math.floor((logs.length - 1) / PAGE_SIZE)));
  }, [logs.length]);

  const startIdx = page * PAGE_SIZE;
  const visibleLogs = editedLogs.slice(startIdx, startIdx + PAGE_SIZE);
  const totalPages = Math.ceil(editedLogs.length / PAGE_SIZE);

  const handleChange = (index: number, field: keyof DailyLog, value: string) => {
    const globalIdx = startIdx + index;
    const updated = [...editedLogs];
    const numFields: (keyof DailyLog)[] = ["weight", "calories", "protein", "water", "steps"];

    if (numFields.includes(field)) {
      (updated[globalIdx] as any)[field] = value === "" ? null : Number(value);
    } else {
      (updated[globalIdx] as any)[field] = value;
    }
    setEditedLogs(updated);
  };

  const handleSave = () => {
    onUpdate(editedLogs);
    toast.success("Progress saved! Keep going 💪");
  };

  const columns: { key: keyof DailyLog; label: string; unit: string; type: string }[] = [
    { key: "weight", label: "Weight", unit: "kg", type: "number" },
    { key: "calories", label: "Calories", unit: "kcal", type: "number" },
    { key: "protein", label: "Protein", unit: "g", type: "number" },
    { key: "water", label: "Water", unit: "glasses", type: "number" },
    { key: "exercise", label: "Exercise", unit: "", type: "select" },
    { key: "steps", label: "Steps", unit: "", type: "number" },
  ];

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-display font-semibold">Daily Log</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Week {page + 1} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Day</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Date</th>
              {columns.map((col) => (
                <th key={col.key} className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  {col.label}
                  {col.unit && <span className="ml-1 text-xs opacity-60">({col.unit})</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleLogs.map((log, idx) => (
              <tr key={log.day} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {log.day}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground text-xs">{log.date}</td>
                {columns.map((col) => (
                  <td key={col.key} className="px-2 py-1.5">
                    {col.type === "select" ? (
                      <Select
                        value={(log[col.key] as string) || "None"}
                        onValueChange={(value) => handleChange(idx, col.key, value)}
                      >
                        <SelectTrigger className="h-8 text-sm border-transparent bg-transparent hover:border-input focus:border-input transition-colors">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {exerciseOptions.map((option) => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={col.type}
                        value={log[col.key] ?? ""}
                        onChange={(e) => handleChange(idx, col.key, e.target.value)}
                        className="h-8 text-sm border-transparent bg-transparent hover:border-input focus:border-input transition-colors"
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t flex justify-end">
        <Button onClick={handleSave} className="gap-2">
          <Save className="h-4 w-4" />
          Save Progress
        </Button>
      </div>
    </div>
  );
};

export default DailyTracker;
