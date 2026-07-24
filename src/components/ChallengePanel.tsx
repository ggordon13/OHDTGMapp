import { useEffect, useState } from "react";
import { Swords, Crown, Check, X, UserPlus, Trash2, Loader2, CalendarDays, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  useChallenge,
  type AwardKey,
  type ChallengeMode,
  type ChallengeView,
  type ChallengeMember,
  type CreateChallengeInput,
  type LeaderboardRow,
} from "@/hooks/useChallenge";
import GamePanel from "@/components/game/GamePanel";
import GameButton from "@/components/game/GameButton";
import { Input } from "@/components/ui/input";
import { formatDateInputValue, parseDateInputValue, cn } from "@/lib/utils";
import { AWARD_META, topBy, overallWinner } from "@/lib/challenge";

const GROUP_AWARDS: { key: AwardKey; label: string; icon: string; desc: string }[] = [
  { key: "golden_shoe", label: "Golden Shoe", icon: "👟", desc: "Highest avg steps" },
  { key: "energetic", label: "The Energetic", icon: "🔥", desc: "Most exercise" },
  { key: "biggest_loser", label: "The Biggest Loser", icon: "📉", desc: "Most % weight lost" },
  { key: "milestone_master", label: "The Milestone Master", icon: "⭐", desc: "Most XP" },
];

const prettyDate = (iso: string) =>
  parseDateInputValue(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/** Day status line for an accepted challenge (before/during/after the window). */
function dayStatus(startDate: string, durationDays: number): string {
  const today = formatDateInputValue();
  const start = parseDateInputValue(startDate);
  const end = parseDateInputValue(startDate);
  end.setDate(end.getDate() + durationDays - 1);
  const endIso = formatDateInputValue(end);
  const msPerDay = 24 * 60 * 60 * 1000;

  if (today < startDate) {
    const days = Math.round((start.getTime() - parseDateInputValue(today).getTime()) / msPerDay);
    return `Starts in ${days} day${days === 1 ? "" : "s"}`;
  }
  if (today <= endIso) {
    const day = Math.round((parseDateInputValue(today).getTime() - start.getTime()) / msPerDay) + 1;
    return `Day ${day} of ${durationDays}`;
  }
  return "Challenge ended";
}

const RosterRow = ({ m }: { m: ChallengeMember }) => (
  <div className="flex items-center justify-between gap-2 rounded-lg border border-[hsl(33,28%,72%)] bg-[hsl(40,48%,94%)] px-3 py-2">
    <span className="flex items-center gap-1.5 truncate font-display text-sm font-bold text-card-foreground">
      {m.is_leader && <Crown className="h-3.5 w-3.5 shrink-0 text-[hsl(42,90%,45%)]" />}
      {m.username ?? "(no nickname)"}
    </span>
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
        m.status === "accepted" && "bg-[hsl(84,45%,45%)]/20 text-[hsl(84,45%,28%)]",
        m.status === "invited" && "bg-muted text-muted-foreground",
        m.status === "declined" && "bg-[hsl(6,60%,55%)]/15 text-[hsl(6,55%,42%)]",
      )}
    >
      {m.status === "accepted" ? "✓ in" : m.status === "invited" ? "pending" : "declined"}
    </span>
  </div>
);

const RewardList = ({ view }: { view: ChallengeView }) => {
  if (view.rewards.length === 0) return null;
  const label = (k: string) => GROUP_AWARDS.find((a) => a.key === k)?.label ?? (k === "overall" ? "Winner" : k);
  return (
    <div className="space-y-1.5">
      <p className="font-display text-[11px] font-bold uppercase tracking-wide text-[hsl(268,40%,42%)]">Rewards</p>
      {view.rewards.map((r) => (
        <div key={r.award_key} className="flex items-center justify-between gap-2 text-xs">
          <span className="font-bold text-muted-foreground">{label(r.award_key)}</span>
          <span className="font-bold text-card-foreground">{r.reward_text || "—"}</span>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Create form
// ---------------------------------------------------------------------------

interface Invitee {
  id: string;
  identifier: string;
  userId: string | null;
  status: "idle" | "checking" | "found" | "notfound" | "self";
}

const newInvitee = (): Invitee => ({ id: crypto.randomUUID(), identifier: "", userId: null, status: "idle" });

interface CreateFormProps {
  create: (input: CreateChallengeInput) => Promise<void>;
  resolveUser: (identifier: string) => Promise<string | null>;
  onCreated: () => void;
}

const CreateForm = ({ create, resolveUser, onCreated }: CreateFormProps) => {
  const { user } = useAuth();
  const [mode, setMode] = useState<ChallengeMode>("partner");
  const [invitees, setInvitees] = useState<Invitee[]>([newInvitee()]);
  const [startDate, setStartDate] = useState(formatDateInputValue());
  const [rewards, setRewards] = useState<Partial<Record<AwardKey, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (next: ChallengeMode) => {
    setMode(next);
    setInvitees((list) => (next === "partner" ? [list[0] ?? newInvitee()] : list));
  };

  const resolve = async (index: number) => {
    const inv = invitees[index];
    const identifier = inv.identifier.trim();
    if (!identifier) {
      setInvitees((l) => l.map((v, i) => (i === index ? { ...v, status: "idle", userId: null } : v)));
      return;
    }
    setInvitees((l) => l.map((v, i) => (i === index ? { ...v, status: "checking" } : v)));
    const userId = await resolveUser(identifier);
    setInvitees((l) =>
      l.map((v, i) =>
        i === index
          ? { ...v, userId, status: !userId ? "notfound" : userId === user?.id ? "self" : "found" }
          : v,
      ),
    );
  };

  const filled = invitees.filter((i) => i.identifier.trim() !== "");
  const uniqueUsers = new Set(filled.map((i) => i.userId));
  const allFound = filled.length > 0 && filled.every((i) => i.status === "found");
  const noDupes = uniqueUsers.size === filled.length;
  const countOk = mode === "partner" ? filled.length === 1 : filled.length >= 1 && filled.length <= 5;
  const dateOk = startDate >= formatDateInputValue();
  const canSubmit = allFound && noDupes && countOk && dateOk && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const payload: Partial<Record<AwardKey, string>> = {};
    const keys: AwardKey[] = mode === "group" ? GROUP_AWARDS.map((a) => a.key) : ["overall"];
    for (const k of keys) {
      const text = (rewards[k] ?? "").trim();
      if (text) payload[k] = text;
    }
    setSubmitting(true);
    try {
      await create({ mode, startDate, participantIds: filled.map((i) => i.userId as string), rewards: payload });
      toast.success("Challenge created — invites sent! 🎉");
      onCreated();
    } catch (e) {
      toast.error((e as Error).message || "Couldn't create the challenge.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-muted-foreground">
        Invite friends to a 30-day challenge. Everyone logs in their own tracker — the challenge just ranks you.
      </p>

      {/* Partner / Group switch */}
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl border-2 border-[hsl(33,28%,58%)] bg-[hsl(37,40%,82%)] p-1">
        {(["partner", "group"] as const).map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchMode(m)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 font-display text-sm font-bold uppercase tracking-wide transition",
                active
                  ? "border-2 border-[hsl(268,45%,30%)] bg-gradient-to-b from-[hsl(268,50%,62%)] to-[hsl(268,46%,48%)] text-white shadow-[0_2px_0_hsl(268,45%,30%)]"
                  : "border-2 border-transparent text-muted-foreground hover:bg-[hsl(40,48%,92%)]",
              )}
            >
              {m === "partner" ? <UserPlus className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              {m}
            </button>
          );
        })}
      </div>

      {/* Invitees */}
      <div className="space-y-2">
        <p className="font-display text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {mode === "partner" ? "Partner (username or email)" : "Members (username or email)"}
        </p>
        {invitees.map((inv, i) => (
          <div key={inv.id} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                value={inv.identifier}
                onChange={(e) =>
                  setInvitees((l) => l.map((v, idx) => (idx === i ? { ...v, identifier: e.target.value, status: "idle", userId: null } : v)))
                }
                onBlur={() => void resolve(i)}
                placeholder="username or email"
                className="pr-8"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                {inv.status === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {inv.status === "found" && <Check className="h-4 w-4 text-[hsl(84,45%,40%)]" strokeWidth={3} />}
                {(inv.status === "notfound" || inv.status === "self") && <X className="h-4 w-4 text-[hsl(6,62%,50%)]" strokeWidth={3} />}
              </span>
            </div>
            {mode === "group" && invitees.length > 1 && (
              <button
                type="button"
                onClick={() => setInvitees((l) => l.filter((_, idx) => idx !== i))}
                className="shrink-0 rounded-lg border border-border/70 p-2 text-muted-foreground hover:bg-muted"
                aria-label="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {invitees.some((v) => v.status === "notfound") && (
          <p className="text-xs font-bold text-[hsl(6,62%,42%)]">Some usernames/emails weren't found.</p>
        )}
        {invitees.some((v) => v.status === "self") && (
          <p className="text-xs font-bold text-[hsl(6,62%,42%)]">You can't invite yourself.</p>
        )}
        {mode === "group" && invitees.length < 5 && (
          <button
            type="button"
            onClick={() => setInvitees((l) => [...l, newInvitee()])}
            className="flex items-center gap-1 text-xs font-bold text-[hsl(268,40%,45%)] hover:underline"
          >
            <UserPlus className="h-3.5 w-3.5" /> Add another (up to 5)
          </button>
        )}
      </div>

      {/* Start date */}
      <div className="space-y-1.5">
        <label htmlFor="challenge-start" className="font-display text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Start date (Day 1)
        </label>
        <Input
          id="challenge-start"
          type="date"
          min={formatDateInputValue()}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>

      {/* Rewards */}
      <div className="space-y-2 rounded-xl border-2 border-[hsl(33,28%,60%)] bg-[hsl(37,40%,82%)] p-3">
        <p className="font-display text-[11px] font-bold uppercase tracking-wide text-[hsl(268,40%,38%)]">
          Rewards (optional)
        </p>
        {mode === "group" ? (
          GROUP_AWARDS.map((a) => (
            <div key={a.key} className="flex items-center gap-2">
              <span className="w-40 shrink-0 text-xs font-bold text-card-foreground">
                {a.icon} {a.label}
                <span className="ml-1 font-semibold text-muted-foreground">· {a.desc}</span>
              </span>
              <Input
                value={rewards[a.key] ?? ""}
                onChange={(e) => setRewards((r) => ({ ...r, [a.key]: e.target.value }))}
                placeholder="e.g. buys coffee"
                className="h-8 flex-1"
              />
            </div>
          ))
        ) : (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">
              Winner = most awards (ties broken by higher XP).
            </p>
            <Input
              value={rewards.overall ?? ""}
              onChange={(e) => setRewards((r) => ({ ...r, overall: e.target.value }))}
              placeholder="Reward for the winner"
              className="h-8"
            />
          </div>
        )}
      </div>

      <GameButton color="purple" size="lg" className="w-full" disabled={!canSubmit} onClick={handleSubmit}>
        {submitting ? "Creating…" : "Start Challenge"}
      </GameButton>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Invite cards + active/pending view
// ---------------------------------------------------------------------------

const InviteCard = ({ view, respond }: { view: ChallengeView; respond: (id: string, accept: boolean) => Promise<void> }) => {
  const [busy, setBusy] = useState(false);
  const leader = view.members.find((m) => m.is_leader);

  const act = async (accept: boolean) => {
    setBusy(true);
    try {
      await respond(view.challenge.id, accept);
      toast.success(accept ? "You're in! 💪" : "Invite declined.");
    } catch (e) {
      toast.error((e as Error).message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border-2 border-[hsl(268,42%,60%)]/40 bg-[hsl(268,42%,60%)]/10 p-3">
      <p className="text-sm font-bold text-[hsl(268,40%,38%)]">
        {leader?.username ?? "Someone"} invited you to a {view.challenge.mode} challenge
      </p>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" /> Starts {prettyDate(view.challenge.start_date)} · 30 days
      </p>
      <div className="space-y-1.5">
        {view.members.map((m) => (
          <RosterRow key={m.user_id} m={m} />
        ))}
      </div>
      <RewardList view={view} />
      <div className="flex gap-2">
        <GameButton color="leaf" size="sm" className="flex-1" disabled={busy} onClick={() => void act(true)}>
          <Check className="h-4 w-4" /> Accept
        </GameButton>
        <GameButton color="wood" size="sm" className="flex-1" disabled={busy} onClick={() => void act(false)}>
          <X className="h-4 w-4" /> Decline
        </GameButton>
      </div>
    </div>
  );
};

const Leaderboard = ({ rows }: { rows: LeaderboardRow[] }) => (
  <div className="space-y-1.5">
    <p className="font-display text-[11px] font-bold uppercase tracking-wide text-[hsl(268,40%,42%)]">Leaderboard</p>
    {rows.map((r, i) => (
      <div key={r.user_id} className="flex items-center gap-2 rounded-lg border border-[hsl(33,28%,72%)] bg-[hsl(40,48%,94%)] px-3 py-1.5">
        <span className="w-5 shrink-0 text-center font-display text-sm font-bold text-[hsl(268,42%,50%)]">{i + 1}</span>
        <span className="flex-1 truncate font-display text-sm font-bold text-card-foreground">{r.username ?? "(no nickname)"}</span>
        <span className="shrink-0 text-xs font-bold text-[hsl(268,40%,42%)]">{r.xp_window} XP</span>
        <span className="w-14 shrink-0 text-right text-xs font-bold text-[hsl(84,45%,32%)]">
          {r.pct_weight_loss != null ? `${r.pct_weight_loss > 0 ? "-" : "+"}${Math.abs(r.pct_weight_loss)}%` : "—"}
        </span>
      </div>
    ))}
  </div>
);

const AwardsView = ({ view, rows }: { view: ChallengeView; rows: LeaderboardRow[] }) => {
  const rewardText = (key: AwardKey) => view.rewards.find((r) => r.award_key === key)?.reward_text || null;
  const overall = view.challenge.mode === "partner" ? overallWinner(rows) : null;

  return (
    <div className="space-y-1.5">
      <p className="font-display text-[11px] font-bold uppercase tracking-wide text-[hsl(268,40%,42%)]">Special Awards</p>
      {AWARD_META.map((a) => {
        const winner = topBy(rows, a.metric);
        const reward = view.challenge.mode === "group" ? rewardText(a.key) : null;
        return (
          <div key={a.key} className="flex items-center gap-2 rounded-lg border border-[hsl(33,28%,72%)] bg-[hsl(40,48%,94%)] px-3 py-1.5 text-xs">
            <span className="shrink-0">{a.icon}</span>
            <span className="shrink-0 font-bold text-card-foreground">{a.label}</span>
            <span className="flex-1 truncate text-right font-bold text-[hsl(268,40%,42%)]">
              {winner ? (winner.username ?? "(no nickname)") : "—"}
            </span>
            {reward && <span className="shrink-0 text-muted-foreground">· {reward}</span>}
          </div>
        );
      })}
      {view.challenge.mode === "partner" && (
        <div className="flex items-center gap-2 rounded-lg border-2 border-[hsl(42,90%,45%)]/40 bg-[hsl(42,90%,60%)]/12 px-3 py-1.5 text-xs">
          <Trophy className="h-3.5 w-3.5 shrink-0 text-[hsl(42,90%,45%)]" />
          <span className="shrink-0 font-bold text-card-foreground">Overall winner</span>
          <span className="flex-1 truncate text-right font-bold text-[hsl(36,70%,38%)]">
            {overall ? (overall.username ?? "(no nickname)") : "—"}
          </span>
          {rewardText("overall") && <span className="shrink-0 text-muted-foreground">· {rewardText("overall")}</span>}
        </div>
      )}
    </div>
  );
};

type ChallengePhase = "roster" | "upcoming" | "live" | "results";

function challengePhase(view: ChallengeView): ChallengePhase {
  if (view.challenge.status === "pending") return "roster";
  if (view.challenge.status === "completed") return "results";
  const today = formatDateInputValue();
  const end = parseDateInputValue(view.challenge.start_date);
  end.setDate(end.getDate() + view.challenge.duration_days - 1);
  const endIso = formatDateInputValue(end);
  if (today < view.challenge.start_date) return "upcoming";
  if (today <= endIso) return "live";
  return "results";
}

const CurrentView = ({
  view,
  cancel,
  getLeaderboard,
  onStartNew,
}: {
  view: ChallengeView;
  cancel: (id: string) => Promise<void>;
  getLeaderboard: (id: string) => Promise<LeaderboardRow[]>;
  onStartNew: () => void;
}) => {
  const [busy, setBusy] = useState(false);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const phase = challengePhase(view);
  const started = phase === "live" || phase === "results";
  const pendingCount = view.members.filter((m) => m.status === "invited").length;

  useEffect(() => {
    if (!started) return;
    let active = true;
    void getLeaderboard(view.challenge.id).then((rows) => {
      if (active) setBoard(rows);
    });
    return () => {
      active = false;
    };
  }, [started, view.challenge.id, getLeaderboard]);

  const doCancel = async () => {
    if (!window.confirm("Cancel this challenge for everyone?")) return;
    setBusy(true);
    try {
      await cancel(view.challenge.id);
      toast.success("Challenge cancelled.");
    } catch (e) {
      toast.error((e as Error).message || "Couldn't cancel.");
    } finally {
      setBusy(false);
    }
  };

  const heading = phase === "results" ? "Final results" : phase === "live" ? "Challenge is live" : "Waiting to start";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-display text-sm font-bold text-card-foreground">
          <Trophy className="h-4 w-4 text-[hsl(268,42%,52%)]" />
          {heading}
        </span>
        <span className="game-tag px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {phase === "roster" ? `${pendingCount} pending` : dayStatus(view.challenge.start_date, view.challenge.duration_days)}
        </span>
      </div>

      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" /> {view.challenge.mode} · starts {prettyDate(view.challenge.start_date)}
      </p>

      {started ? (
        <>
          <Leaderboard rows={board} />
          <AwardsView view={view} rows={board} />
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            {view.members.map((m) => (
              <RosterRow key={m.user_id} m={m} />
            ))}
          </div>
          <RewardList view={view} />
          {phase === "roster" && (
            <p className="text-xs font-semibold text-muted-foreground">Everyone must accept before the challenge begins.</p>
          )}
        </>
      )}

      {phase === "results" ? (
        <GameButton color="purple" size="sm" className="w-full" onClick={onStartNew}>
          Start a new challenge
        </GameButton>
      ) : (
        view.isLeader && (
          <button
            type="button"
            onClick={doCancel}
            disabled={busy}
            className="text-xs font-bold uppercase tracking-wide text-[hsl(6,55%,45%)] hover:underline disabled:opacity-50"
          >
            Cancel challenge
          </button>
        )
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------

const ChallengePanel = ({ challenge }: { challenge: ReturnType<typeof useChallenge> }) => {
  const { current, invites, loading, create, resolveUser, respond, cancel, getLeaderboard } = challenge;
  const [startingNew, setStartingNew] = useState(false);

  const showCreate = startingNew || (!current && invites.length === 0);

  return (
    <GamePanel title="Challenge" icon={<Swords className="h-4 w-4" />} color="purple">
      {loading ? (
        <p className="py-6 text-center text-sm font-semibold text-muted-foreground">Loading…</p>
      ) : showCreate ? (
        <CreateForm create={create} resolveUser={resolveUser} onCreated={() => setStartingNew(false)} />
      ) : current ? (
        <CurrentView view={current} cancel={cancel} getLeaderboard={getLeaderboard} onStartNew={() => setStartingNew(true)} />
      ) : (
        <div className="space-y-3">
          {invites.map((v) => (
            <InviteCard key={v.challenge.id} view={v} respond={respond} />
          ))}
        </div>
      )}
    </GamePanel>
  );
};

export default ChallengePanel;
