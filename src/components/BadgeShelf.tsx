import { motion } from "framer-motion";
import { Award } from "lucide-react";
import { Badge, BadgeTier } from "@/lib/gamification";

interface BadgeShelfProps {
  badges: (Badge & { unlocked: boolean })[];
}

const tierRing: Record<BadgeTier, string> = {
  bronze: "ring-amber-600/40 bg-amber-500/10",
  silver: "ring-slate-400/50 bg-slate-400/10",
  gold: "ring-yellow-400/60 bg-yellow-400/10",
  special: "ring-primary/40 bg-primary/10",
};

const BadgeShelf = ({ badges }: BadgeShelfProps) => {
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold">Trophy Case</h3>
        </div>
        <span className="text-xs text-muted-foreground">{unlockedCount} unlocked</span>
      </div>

      {badges.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No badges yet — log your days and hit your targets to start unlocking trophies.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {badges.map((b) => (
            <motion.div
              key={b.key}
              className="flex flex-col items-center gap-1.5 text-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              title={b.description}
            >
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl ring-2 ${
                  b.unlocked ? tierRing[b.tier] : "bg-muted ring-border grayscale opacity-40"
                }`}
              >
                {b.icon}
              </div>
              <span className={`text-[11px] font-medium leading-tight ${b.unlocked ? "" : "text-muted-foreground"}`}>
                {b.label}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BadgeShelf;
