import { useEffect, useState } from "react";
import { Crown, Hourglass } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import GameButton from "@/components/game/GameButton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { RequestStatus } from "@/lib/access";
import { getWhopPlans, startWhopCheckout } from "@/lib/whop";

interface GetPremiumButtonProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Get Premium. When a Whop checkout is configured, clicking sends the user
 * straight to Whop's hosted checkout (a webhook grants premium after payment).
 * Otherwise it falls back to the admin-approval request flow.
 */
const GetPremiumButton = ({ size = "sm", className }: GetPremiumButtonProps) => {
  const { user } = useAuth();
  const plans = getWhopPlans();
  const whopMode = plans.length > 0;
  const [status, setStatus] = useState<RequestStatus | "none" | "loading">(whopMode ? "none" : "loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // In Whop mode there's no admin request to look up.
    if (whopMode || !user) return;
    let active = true;
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
  }, [user, whopMode]);

  const goToCheckout = (url: string) => startWhopCheckout(url, { email: user?.email, userId: user?.id });

  // Whop mode: one plan → straight to checkout; multiple → a plan picker.
  if (whopMode) {
    if (plans.length === 1) {
      return (
        <GameButton color="gold" size={size} className={className} onClick={() => goToCheckout(plans[0].url)}>
          <Crown className="h-4 w-4" />
          <span>Get Premium</span>
        </GameButton>
      );
    }
    return (
      <Popover>
        <PopoverTrigger asChild>
          <GameButton color="gold" size={size} className={className}>
            <Crown className="h-4 w-4" />
            <span>Get Premium</span>
          </GameButton>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-52 space-y-2 p-3">
          <p className="font-display text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Choose a plan</p>
          {plans.map((p) => (
            <GameButton key={p.id} color="gold" size="sm" className="w-full" onClick={() => goToCheckout(p.url)}>
              {p.label}
            </GameButton>
          ))}
        </PopoverContent>
      </Popover>
    );
  }

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
