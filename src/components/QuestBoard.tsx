import { motion } from "framer-motion";
import { Swords, CalendarDays, Check } from "lucide-react";
import { Quest } from "@/lib/gamification";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface QuestBoardProps {
  dailyQuests: Quest[];
  weeklyQuests: Quest[];
  dailyPeriod: string;
  weeklyPeriod: string;
  isClaimed: (period: string, questKey: string) => boolean;
  onClaim: (quest: Quest, period: string) => void;
  claimingKey: string | null;
}

const QuestRow = ({
  quest,
  period,
  claimed,
  claiming,
  onClaim,
}: {
  quest: Quest;
  period: string;
  claimed: boolean;
  claiming: boolean;
  onClaim: (quest: Quest, period: string) => void;
}) => {
  const pct = Math.min(100, Math.round((quest.current / quest.target) * 100));

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        claimed ? "border-primary/40 bg-primary/5" : quest.completed ? "border-accent/50 bg-accent/5" : "border-border/70 bg-background"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight">{quest.title}</p>
          <p className="text-xs text-muted-foreground">{quest.description}</p>
        </div>
        <div className="shrink-0 text-right">
          {claimed ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
              <Check className="h-3 w-3" /> +{quest.xp}
            </span>
          ) : quest.completed ? (
            <Button
              size="sm"
              className="h-7 px-3 text-xs"
              disabled={claiming}
              onClick={() => onClaim(quest, period)}
            >
              {claiming ? "…" : `Claim +${quest.xp}`}
            </Button>
          ) : (
            <span className="text-xs font-medium text-muted-foreground">+{quest.xp} XP</span>
          )}
        </div>
      </div>
      {!claimed && (
        <div className="mt-2 flex items-center gap-2">
          <Progress value={pct} className="h-1.5" />
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {Math.round(quest.current).toLocaleString()}/{quest.target.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
};

const QuestBoard = ({
  dailyQuests,
  weeklyQuests,
  dailyPeriod,
  weeklyPeriod,
  isClaimed,
  onClaim,
  claimingKey,
}: QuestBoardProps) => {
  const dailyDone = dailyQuests.filter((q) => isClaimed(dailyPeriod, q.key)).length;
  const weeklyDone = weeklyQuests.filter((q) => isClaimed(weeklyPeriod, q.key)).length;

  return (
    <motion.div
      className="rounded-xl border bg-card p-5 space-y-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-2">
        <Swords className="h-5 w-5 text-primary" />
        <h3 className="font-display font-semibold">Quests</h3>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Daily</p>
          <span className="text-[10px] text-muted-foreground">
            {dailyDone}/{dailyQuests.length} claimed
          </span>
        </div>
        <div className="space-y-2">
          {dailyQuests.map((q) => (
            <QuestRow
              key={q.key}
              quest={q}
              period={dailyPeriod}
              claimed={isClaimed(dailyPeriod, q.key)}
              claiming={claimingKey === q.key}
              onClaim={onClaim}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <CalendarDays className="h-3 w-3" /> This Week
          </p>
          <span className="text-[10px] text-muted-foreground">
            {weeklyDone}/{weeklyQuests.length} claimed
          </span>
        </div>
        <div className="space-y-2">
          {weeklyQuests.map((q) => (
            <QuestRow
              key={q.key}
              quest={q}
              period={weeklyPeriod}
              claimed={isClaimed(weeklyPeriod, q.key)}
              claiming={claimingKey === q.key}
              onClaim={onClaim}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default QuestBoard;
