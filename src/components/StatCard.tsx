import { useEffect, useRef } from "react";
import { LucideIcon } from "lucide-react";
import { countUp, pop } from "@/lib/fx";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  target?: string;
  color?: string;
}

const StatCard = ({ label, value, unit, icon: Icon, target }: StatCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    pop(cardRef.current, 1.06);
  }, []);

  // Numbers roll up to their value; non-numeric values ("—") render directly.
  useEffect(() => {
    if (typeof value === "number" && valueRef.current) {
      countUp(valueRef.current, value, { decimals: value % 1 === 0 ? 0 : 1 });
    }
  }, [value]);

  return (
    <div ref={cardRef} className="game-panel space-y-2 p-4">
      <div className="flex items-center justify-between">
        <span className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-[hsl(22,45%,14%)] bg-gradient-to-b from-[hsl(26,36%,38%)] to-[hsl(24,40%,26%)] shadow-[0_2px_0_hsl(22,45%,12%)]">
          <Icon className="h-3.5 w-3.5 text-[hsl(42,80%,72%)]" />
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span ref={valueRef} className="font-display text-2xl font-bold text-card-foreground">
          {typeof value === "number" ? 0 : value}
        </span>
        {unit && <span className="text-sm font-semibold text-muted-foreground">{unit}</span>}
      </div>
      {target && (
        <p className="game-tag inline-block px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
          Target: {target}
        </p>
      )}
    </div>
  );
};

export default StatCard;
