import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Swords, CalendarDays, Check } from "lucide-react";
import { Quest } from "@/lib/gamification";
import GamePanel from "@/components/game/GamePanel";
import GameButton from "@/components/game/GameButton";
import GameProgress from "@/components/game/GameProgress";
import { xpFly, confettiBurst, shine, pop } from "@/lib/fx";

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
  const rowRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const sealRef = useRef<HTMLSpanElement>(null);
  const wasClaimed = useRef(claimed);

  // Stamp the seal when a claim lands (not for rows loaded already-claimed).
  useEffect(() => {
    if (claimed && !wasClaimed.current) pop(sealRef.current, 2.2);
    wasClaimed.current = claimed;
  }, [claimed]);

  const handleClaim = () => {
    if (btnRef.current) {
      const xpTarget = document.querySelector('[data-fx="xp-target"]');
      shine(rowRef.current);
      confettiBurst(btnRef.current, 16);
      xpFly(btnRef.current, xpTarget, quest.xp);
    }
    onClaim(quest, period);
  };

  return (
    <div
      ref={rowRef}
      className={`game-panel p-3 transition-[filter] ${claimed ? "brightness-[0.97] saturate-[0.85]" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold leading-tight text-card-foreground">{quest.title}</p>
          <p className="text-xs font-semibold text-muted-foreground">{quest.description}</p>
        </div>
        <div className="shrink-0 text-right">
          {claimed ? (
            <span
              ref={sealRef}
              className="inline-flex items-center gap-1 rounded-full border-2 border-[hsl(84,45%,24%)] bg-gradient-to-b from-[hsl(84,45%,48%)] to-[hsl(84,42%,36%)] px-2.5 py-1 font-display text-xs font-bold text-white shadow-[0_2px_0_hsl(84,45%,24%)] [text-shadow:0_1px_0_rgba(0,0,0,0.3)]"
            >
              <Check className="h-3 w-3" strokeWidth={4} /> +{quest.xp}
            </span>
          ) : quest.completed ? (
            <GameButton ref={btnRef} color="red" size="sm" disabled={claiming} onClick={handleClaim}>
              {claiming ? "…" : `Claim +${quest.xp}`}
            </GameButton>
          ) : (
            <span className="game-tag inline-block px-2 py-1 font-display text-xs font-bold text-muted-foreground">
              +{quest.xp} XP
            </span>
          )}
        </div>
      </div>
      {!claimed && (
        <div className="mt-2 flex items-center gap-2">
          <GameProgress value={pct} color={quest.completed ? "leaf" : "teal"} size="h-2.5" className="flex-1" />
          <span className="shrink-0 text-[10px] font-bold tabular-nums text-muted-foreground">
            {Math.round(quest.current).toLocaleString()}/{quest.target.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
};

const SectionLabel = ({ icon, label, done, total }: { icon?: React.ReactNode; label: string; done: number; total: number }) => (
  <div className="flex items-center justify-between">
    <p className="flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-widest text-[hsl(42,80%,72%)] [text-shadow:0_2px_0_rgba(0,0,0,0.4)]">
      {icon}
      {label}
    </p>
    <span className="game-tag px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
      {done}/{total} claimed
    </span>
  </div>
);

const QuestBoard = ({
  dailyQuests,
  weeklyQuests,
  dailyPeriod,
  weeklyPeriod,
  isClaimed,
  onClaim,
  claimingKey,
}: QuestBoardProps) => {
  const [collapsed, setCollapsed] = useState(false);

  const dailyDone = dailyQuests.filter((q) => isClaimed(dailyPeriod, q.key)).length;
  const weeklyDone = weeklyQuests.filter((q) => isClaimed(weeklyPeriod, q.key)).length;

  // Quests finished but not yet claimed — the reason the collapsed plate glows.
  const claimable =
    dailyQuests.filter((q) => q.completed && !isClaimed(dailyPeriod, q.key)).length +
    weeklyQuests.filter((q) => q.completed && !isClaimed(weeklyPeriod, q.key)).length;

  return (
    <GamePanel
      variant="wood"
      title="Quests"
      icon={<Swords className="h-4 w-4" />}
      color="red"
      onTitleClick={() => setCollapsed((c) => !c)}
      collapsed={collapsed}
      titleGlow={collapsed && claimable > 0}
    >
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="quest-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-5">
              <div className="space-y-2">
                <SectionLabel label="Daily" done={dailyDone} total={dailyQuests.length} />
                <div className="space-y-2.5">
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
                <SectionLabel
                  icon={<CalendarDays className="h-3.5 w-3.5" />}
                  label="This Week"
                  done={weeklyDone}
                  total={weeklyQuests.length}
                />
                <div className="space-y-2.5">
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GamePanel>
  );
};

export default QuestBoard;
