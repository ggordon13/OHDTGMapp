import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { getTrialState, isPremiumUser } from "@/lib/access";
import GameButton from "@/components/game/GameButton";

interface StartTrialButtonProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Starts the one-time 7-day premium trial. Renders nothing once the user is
 * premium or has already used their trial, so it can sit beside any Get Premium
 * button without extra gating at the call site.
 */
const StartTrialButton = ({ size = "sm", className }: StartTrialButtonProps) => {
  const { profile, refetch } = useProfile();
  const [starting, setStarting] = useState(false);

  const premium = isPremiumUser(profile?.access_level, profile?.role);
  const trial = getTrialState(profile?.premium_trial_started_at);
  if (premium || trial.used) return null;

  const start = async () => {
    setStarting(true);
    try {
      const { error } = await supabase.rpc("start_premium_trial");
      if (error) throw error;
      await refetch();
      toast.success("7-day premium trial started — enjoy! ✨");
    } catch {
      toast.error("Couldn't start the trial — try again.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <GameButton color="leaf" size={size} className={className} disabled={starting} onClick={() => void start()}>
      <Sparkles className="h-4 w-4" />
      <span>{starting ? "Starting…" : "Free 7-day trial"}</span>
    </GameButton>
  );
};

export default StartTrialButton;
