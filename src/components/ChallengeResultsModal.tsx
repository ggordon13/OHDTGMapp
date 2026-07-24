import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Trophy } from "lucide-react";
import GameButton from "@/components/game/GameButton";
import type { ChallengeMode, ChallengeReward, LeaderboardRow } from "@/hooks/useChallenge";
import { AWARD_META, topBy, overallWinner } from "@/lib/challenge";

interface ChallengeResultsModalProps {
  open: boolean;
  mode: ChallengeMode;
  rows: LeaderboardRow[];
  rewards: ChallengeReward[];
  /** Persist that results were seen (finishes the challenge). May be async. */
  onAcknowledge: () => void | Promise<void>;
}

const name = (r: LeaderboardRow | null) => r?.username ?? "—";

/**
 * Next-day results reveal. Non-dismissible until acknowledged so it never gets
 * lost; acknowledging finishes the challenge and frees the user to start a new
 * one. Winners still stay visible in the Challenge panel afterward.
 */
const ChallengeResultsModal = ({ open, mode, rows, rewards, onAcknowledge }: ChallengeResultsModalProps) => {
  const [busy, setBusy] = useState(false);
  const rewardText = (key: string) => rewards.find((r) => r.award_key === key)?.reward_text || null;
  const overall = mode === "partner" ? overallWinner(rows) : null;

  const ack = async () => {
    if (busy) return;
    setBusy(true);
    await onAcknowledge();
    setBusy(false);
  };

  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="game-panel fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 p-6 focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="space-y-5">
            <div className="space-y-2 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-[hsl(40,65%,32%)] bg-gradient-to-b from-[hsl(44,92%,62%)] to-[hsl(38,85%,48%)] shadow-[0_4px_0_hsl(38,65%,32%),0_6px_12px_rgba(0,0,0,0.4),inset_0_2px_0_rgba(255,255,255,0.5)]">
                <Trophy className="h-7 w-7 text-[hsl(30,55%,25%)]" />
              </div>
              <Dialog.Title className="font-display text-2xl font-bold text-card-foreground">
                Challenge results! 🏆
              </Dialog.Title>
              <Dialog.Description className="text-sm font-bold text-muted-foreground">
                30 days done. Here's how everyone finished.
              </Dialog.Description>
            </div>

            {mode === "partner" && overall && (
              <div className="rounded-xl border-2 border-[hsl(42,90%,45%)]/50 bg-[hsl(42,90%,60%)]/15 px-4 py-3 text-center">
                <p className="font-display text-[11px] font-bold uppercase tracking-widest text-[hsl(36,70%,38%)]">Winner</p>
                <p className="font-display text-xl font-bold text-card-foreground">{name(overall)}</p>
                {rewardText("overall") && <p className="text-xs font-bold text-muted-foreground">Reward: {rewardText("overall")}</p>}
              </div>
            )}

            <div className="space-y-1.5 rounded-xl border-2 border-[hsl(33,28%,60%)] bg-[hsl(37,40%,82%)] p-3">
              {AWARD_META.map((a) => {
                const winner = topBy(rows, a.metric);
                const reward = mode === "group" ? rewardText(a.key) : null;
                return (
                  <div key={a.key} className="flex items-center gap-2 text-xs">
                    <span className="shrink-0">{a.icon}</span>
                    <span className="shrink-0 font-bold text-card-foreground">{a.label}</span>
                    <span className="flex-1 truncate text-right font-bold text-[hsl(222,40%,42%)]">{name(winner)}</span>
                    {reward && <span className="shrink-0 text-muted-foreground">· {reward}</span>}
                  </div>
                );
              })}
            </div>

            <GameButton color="gold" size="lg" className="w-full" disabled={busy} onClick={() => void ack()}>
              {busy ? "…" : "See full results"}
            </GameButton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default ChallengeResultsModal;
