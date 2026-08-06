import { Eye } from "lucide-react";

/**
 * What joining a challenge actually discloses.
 *
 * `challenge_leaderboard` returns each member's percentage weight change,
 * average steps, exercise days and quest XP to every other accepted member.
 * That is health data shared with third parties, so it has to be said plainly
 * at the point of joining rather than buried in a policy — people should know
 * what their teammates will see *before* they agree to be seen.
 */
const ChallengeSharingNotice = ({ className }: { className?: string }) => (
  <div
    className={
      "flex items-start gap-2 rounded-xl border-2 border-[hsl(222,45%,45%)]/40 bg-[hsl(222,50%,60%)]/10 px-3 py-2.5 " +
      (className ?? "")
    }
  >
    <Eye className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(222,45%,45%)]" />
    <p className="text-xs font-semibold text-muted-foreground">
      <strong className="text-card-foreground">Everyone in this challenge will see</strong> your
      nickname, your quest XP, your average steps, your exercise days and your{" "}
      <strong className="text-card-foreground">percentage weight change</strong> — but never your
      actual weight, your food log or your email. Leave it out by not joining.
    </p>
  </div>
);

export default ChallengeSharingNotice;
