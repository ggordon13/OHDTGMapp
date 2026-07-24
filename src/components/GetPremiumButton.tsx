import { useEffect, useState } from "react";
import { Crown, Hourglass } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import GameButton from "@/components/game/GameButton";
import type { RequestStatus } from "@/lib/access";

interface GetPremiumButtonProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Lets a free user ask an admin to grant them premium. One open request at a
 * time — the DB enforces it too (partial unique index), this just reflects it.
 */
const GetPremiumButton = ({ size = "sm", className }: GetPremiumButtonProps) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<RequestStatus | "none" | "loading">("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user) return;
    void (async () => {
      // The most recent request tells us whether one is already pending.
      const { data } = await supabase
        .from("premium_requests")
        .select("status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      setStatus(((data as { status?: RequestStatus } | null)?.status as RequestStatus) ?? "none");
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const handleRequest = async () => {
    if (!user?.email) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("premium_requests")
      .insert({ user_id: user.id, email: user.email.trim().toLowerCase(), status: "pending" });
    setSubmitting(false);

    if (error) {
      // A duplicate-key error means a request is already pending — treat as success.
      if (error.code === "23505") {
        setStatus("pending");
        toast.info("You already have a premium request pending.");
        return;
      }
      toast.error("Couldn't send your request. Please try again.");
      return;
    }
    setStatus("pending");
    toast.success("Premium request sent! An admin will review it soon. 👑");
  };

  if (status === "loading") return null;

  if (status === "pending") {
    return (
      <GameButton color="wood" size={size} className={className} disabled title="Your premium request is awaiting review">
        <Hourglass className="h-4 w-4" />
        <span>Premium Requested</span>
      </GameButton>
    );
  }

  return (
    <GameButton color="gold" size={size} className={className} onClick={() => void handleRequest()} disabled={submitting}>
      <Crown className="h-4 w-4" />
      <span>{submitting ? "Sending…" : "Get Premium"}</span>
    </GameButton>
  );
};

export default GetPremiumButton;
