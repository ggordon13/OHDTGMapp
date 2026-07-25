import { Crown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import GameButton from "@/components/game/GameButton";
import { startWhopCheckout } from "@/lib/whop";

interface GetPremiumButtonProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Get Premium — sends the user straight to Whop's hosted checkout. Whop's
 * payment_succeeded webhook (supabase/functions/whop-webhook) grants premium
 * once payment clears, and useProfile picks it up when they return.
 */
const GetPremiumButton = ({ size = "sm", className }: GetPremiumButtonProps) => {
  const { user } = useAuth();

  return (
    <GameButton
      color="gold"
      size={size}
      className={className}
      onClick={() => startWhopCheckout({ email: user?.email, userId: user?.id })}
    >
      <Crown className="h-4 w-4" />
      <span>Get Premium</span>
    </GameButton>
  );
};

export default GetPremiumButton;
