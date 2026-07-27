import { useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import GameButton from "@/components/game/GameButton";
import { useAuth } from "@/hooks/useAuth";
import { enablePush, notificationPermission, pushSupported } from "@/lib/pwa";
import { track } from "@/lib/telemetry";

/**
 * "Enable reminders" — appears only when push is actually available (a VAPID key
 * is configured, the browser supports it, and permission hasn't been decided).
 * Hidden entirely otherwise, so it's inert until push is set up server-side.
 */
const NotificationsButton = ({ size = "sm" }: { size?: "sm" | "md" | "lg" }) => {
  const { user } = useAuth();
  const [perm, setPerm] = useState(notificationPermission());
  const [busy, setBusy] = useState(false);

  if (!pushSupported() || perm !== "default") return null;

  const enable = async () => {
    if (!user) return;
    setBusy(true);
    const ok = await enablePush(user.id);
    setPerm(notificationPermission());
    setBusy(false);
    if (ok) {
      toast.success("Reminders on — we'll nudge you to log each day. 🔔");
      track("push_enabled");
    } else {
      toast.error("Couldn't enable reminders.");
    }
  };

  return (
    <GameButton color="gold" size={size} disabled={busy} onClick={() => void enable()} title="Enable daily reminders">
      <Bell className="h-4 w-4" />
      <span className="hidden sm:inline">Reminders</span>
    </GameButton>
  );
};

export default NotificationsButton;
