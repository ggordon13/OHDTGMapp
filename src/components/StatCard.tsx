import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  target?: string;
  color?: string;
}

const StatCard = ({ label, value, unit, icon: Icon, target }: StatCardProps) => {
  return (
    <motion.div
      className="rounded-xl border bg-card p-4 space-y-2"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-display font-bold">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {target && <p className="text-xs text-muted-foreground">Target: {target}</p>}
    </motion.div>
  );
};

export default StatCard;
