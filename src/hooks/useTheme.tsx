import { useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isPremiumUser } from "@/lib/access";
import { DEFAULT_THEME_KEY, applyThemeVars, effectiveTheme } from "@/lib/themes";
import { track } from "@/lib/telemetry";
import type { UserProfile } from "./useProfile";

interface UseThemeArgs {
  profile: UserProfile | null;
  userId: string | undefined;
  refetchProfile: () => Promise<void>;
}

/**
 * Applies the user's cosmetic theme to the document root and exposes the actions
 * to change it / start the trial. The *effective* theme reverts to the default
 * whenever a premium theme is selected but the user isn't premium — so themes
 * chosen during a trial drop back automatically once it ends.
 */
export function useTheme({ profile, userId, refetchProfile }: UseThemeArgs) {
  const selectedKey = profile?.theme ?? DEFAULT_THEME_KEY;
  const premium = isPremiumUser(profile?.access_level, profile?.role);
  const appliedKey = effectiveTheme(selectedKey, premium).key;

  useEffect(() => {
    applyThemeVars(effectiveTheme(selectedKey, premium));
  }, [selectedKey, premium]);

  const setTheme = useCallback(
    async (key: string) => {
      if (!userId) return;
      const { error } = await supabase.from("profiles").update({ theme: key }).eq("user_id", userId);
      if (error) throw error;
      await refetchProfile();
    },
    [userId, refetchProfile],
  );

  const startTrial = useCallback(async () => {
    const { error } = await supabase.rpc("start_premium_trial");
    if (error) throw error;
    track("trial_started");
    await refetchProfile();
  }, [refetchProfile]);

  return { selectedKey, appliedKey, isPremium: premium, setTheme, startTrial };
}
