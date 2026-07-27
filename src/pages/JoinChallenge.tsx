import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Swords, Crown, Users, UserPlus, CalendarDays, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useChallenge, type ChallengeInviteInfo } from "@/hooks/useChallenge";
import { parseDateInputValue } from "@/lib/utils";
import FireflyCanvas from "@/components/FireflyCanvas";
import Logo from "@/components/Logo";
import GameButton from "@/components/game/GameButton";

/** Where a not-yet-signed-in visitor's target challenge is stashed across auth. */
export const PENDING_JOIN_KEY = "pendingJoinChallenge";

const prettyDate = (iso: string) =>
  parseDateInputValue(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/** Landing page for a shared challenge link — previews it and joins the user in. */
const JoinChallenge = () => {
  const { challengeId } = useParams<{ challengeId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isProfileComplete, loading: profileLoading } = useProfile();
  const { getInviteInfo, joinByLink } = useChallenge();

  const [info, setInfo] = useState<ChallengeInviteInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [joining, setJoining] = useState(false);

  // Load the preview (works signed-out too).
  useEffect(() => {
    if (!challengeId) return;
    let active = true;
    void getInviteInfo(challengeId).then((i) => {
      if (!active) return;
      setInfo(i);
      setLoadingInfo(false);
    });
    return () => {
      active = false;
    };
  }, [challengeId, getInviteInfo]);

  // Not signed in / no profile yet → stash the target and route through auth,
  // then bounce back here (handled on the dashboard after sign-in).
  useEffect(() => {
    if (authLoading || profileLoading || !challengeId) return;
    if (!user) {
      localStorage.setItem(PENDING_JOIN_KEY, challengeId);
      navigate("/login", { replace: true });
    } else if (!isProfileComplete) {
      localStorage.setItem(PENDING_JOIN_KEY, challengeId);
      navigate("/setup", { replace: true });
    }
  }, [authLoading, profileLoading, user, isProfileComplete, challengeId, navigate]);

  // Already in this challenge → nothing to do, go to the dashboard.
  useEffect(() => {
    if (info?.is_member) {
      localStorage.removeItem(PENDING_JOIN_KEY);
      navigate("/", { replace: true });
    }
  }, [info?.is_member, navigate]);

  const handleJoin = async () => {
    if (!challengeId) return;
    setJoining(true);
    try {
      await joinByLink(challengeId);
      localStorage.removeItem(PENDING_JOIN_KEY);
      toast.success("You're in! 💪");
      navigate("/", { replace: true });
    } catch (e) {
      toast.error((e as Error).message || "Couldn't join this challenge.");
      setJoining(false);
    }
  };

  const busy = authLoading || profileLoading || loadingInfo || !user;
  const open = info?.status === "pending" && info.accepted_count < info.capacity;

  return (
    <div className="wood-bg relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <FireflyCanvas count={90} />
      <div className="relative z-10 w-full max-w-sm space-y-5 text-center">
        <Logo className="mx-auto h-auto w-56" />

        <div className="game-panel space-y-4 p-6">
          {busy ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm font-bold text-muted-foreground">Loading invite…</p>
            </div>
          ) : !info ? (
            <div className="space-y-3 py-4">
              <p className="font-display text-xl font-bold text-card-foreground">Invite not found</p>
              <p className="text-sm font-semibold text-muted-foreground">
                This challenge link is invalid or has been removed.
              </p>
              <GameButton color="wood" size="lg" className="w-full" onClick={() => navigate("/")}>
                Go to my dashboard
              </GameButton>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-2">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[hsl(226,60%,18%)] bg-gradient-to-b from-[hsl(222,55%,46%)] to-[hsl(224,60%,32%)] text-white">
                  <Swords className="h-6 w-6" />
                </span>
                <p className="font-display text-xl font-bold text-card-foreground">
                  {info.leader_username ?? "Someone"} invited you!
                </p>
                <p className="text-sm font-semibold text-muted-foreground">
                  Join their {info.mode} challenge and level up together.
                </p>
              </div>

              <div className="space-y-2 rounded-xl border-2 border-[hsl(33,28%,60%)] bg-[hsl(37,40%,84%)] p-3 text-left text-xs font-bold text-card-foreground">
                <p className="flex items-center gap-2">
                  {info.mode === "partner" ? <UserPlus className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                  {info.accepted_count}/{info.capacity} joined
                </p>
                <p className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-[hsl(42,90%,45%)]" /> Led by {info.leader_username ?? "—"}
                </p>
                <p className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" /> Starts {prettyDate(info.start_date)} · {info.duration_days} days
                </p>
              </div>

              {open ? (
                <GameButton color="leaf" size="lg" className="w-full" disabled={joining} onClick={() => void handleJoin()}>
                  {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
                  {joining ? "Joining…" : "Join challenge"}
                </GameButton>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-[hsl(6,55%,45%)]">
                    {info.status !== "pending" ? "This challenge has already started." : "This challenge is full."}
                  </p>
                  <GameButton color="wood" size="lg" className="w-full" onClick={() => navigate("/")}>
                    Go to my dashboard
                  </GameButton>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoinChallenge;
