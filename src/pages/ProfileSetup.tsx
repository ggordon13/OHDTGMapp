import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import {
  requiresProfileSetup,
  targetWeightRange,
  recommendedTargetRange,
  calculateTargets,
  isValidUsername,
  isAtOrBelowHealthyFloor,
  MIN_SIGNUP_AGE,
  USERNAME_MAX_LENGTH,
  USERNAME_RULE_HINT,
  type GoalType,
} from "@/lib/profile";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateInputValue } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import GameButton from "@/components/game/GameButton";
import DeleteAccountButton from "@/components/DeleteAccountButton";
import { canEditStartingData } from "@/lib/access";
import { track } from "@/lib/telemetry";
import { toast } from "sonner";

const ProfileSetup = () => {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const cameFromUpdateButton = (location.state as { intentional?: boolean } | null)?.intentional === true;
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [gender, setGender] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("lose");
  const [targetWeight, setTargetWeight] = useState("");
  const [useRecommended, setUseRecommended] = useState(false);
  const [dayOneDate, setDayOneDate] = useState(formatDateInputValue());
  const [saving, setSaving] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  // Explicit consent to store health data. Pre-ticked only for people who have
  // already given it — a pre-ticked box is not consent for anyone else.
  const [healthConsent, setHealthConsent] = useState(false);

  const isUpdate = !requiresProfileSetup(profile);
  // Any of these changing re-bases the challenge, so the user has to start
  // logging again from Day 1 — including the goal, target and Day 1 itself.
  const hasChangedStartingData = profile != null && (
    age !== (profile.age != null ? String(profile.age) : "") ||
    heightCm !== (profile.height_cm != null ? String(profile.height_cm) : "") ||
    currentWeight !== (profile.current_weight != null ? String(profile.current_weight) : "") ||
    gender !== (profile.gender ?? "") ||
    activityLevel !== (profile.activity_level ?? "") ||
    goalType !== (profile.goal_type ?? "lose") ||
    targetWeight !== (profile.target_weight != null ? String(profile.target_weight) : "") ||
    useRecommended !== (profile.target_weight_min != null && profile.target_weight_max != null) ||
    dayOneDate !== (profile.challenge_start_date ?? formatDateInputValue())
  );

  // Target weight and Day 1 are "locked" fields: free users can't change them,
  // premium users only once every 30 days. Staff are unrestricted. The lock only
  // applies to existing profiles (first-time setup always sets them freely).
  const startingDataEdit = canEditStartingData(
    profile?.access_level,
    profile?.role,
    profile?.starting_data_updated_at,
  );
  const lockStartingFields = isUpdate && !startingDataEdit.allowed;

  // Did the user actually touch target weight or Day 1 (vs the saved profile)?
  const startingDataChanged = profile != null && (
    targetWeight !== (profile.target_weight != null ? String(profile.target_weight) : "") ||
    useRecommended !== (profile.target_weight_min != null && profile.target_weight_max != null) ||
    dayOneDate !== (profile.challenge_start_date ?? formatDateInputValue())
  );

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
      return;
    }

    // A user with a complete profile who lands here any way other than the
    // "Update Profile" button (fresh login, bookmark, browser history) should
    // go straight to the dashboard instead of seeing the setup form again.
    if (!authLoading && !profileLoading && user && isUpdate && !cameFromUpdateButton) {
      navigate("/", { replace: true });
    }
  }, [authLoading, profileLoading, user, isUpdate, cameFromUpdateButton, navigate]);

  // Pre-fill the form with existing profile data when a returning user edits their profile
  useEffect(() => {
    if (prefilled || profileLoading || !profile) return;
    if (profile.username) setUsername(profile.username);
    if (profile.age != null) setAge(String(profile.age));
    if (profile.height_cm != null) setHeightCm(String(profile.height_cm));
    if (profile.current_weight != null) setCurrentWeight(String(profile.current_weight));
    if (profile.gender) setGender(profile.gender);
    if (profile.activity_level) setActivityLevel(profile.activity_level);
    if (profile.goal_type === "lose" || profile.goal_type === "maintain") setGoalType(profile.goal_type);
    if (profile.target_weight != null) setTargetWeight(String(profile.target_weight));
    // A stored min/max band means they opted into the recommended range.
    setUseRecommended(profile.target_weight_min != null && profile.target_weight_max != null);
    if (profile.challenge_start_date) setDayOneDate(profile.challenge_start_date);
    // Already consented on a previous visit — don't make them re-tick it.
    if (profile.health_data_consent_at) setHealthConsent(true);
    setPrefilled(true);
  }, [profile, profileLoading, prefilled]);

  const usernameTrimmed = username.trim();
  const usernameValid = isValidUsername(usernameTrimmed);
  const showUsernameError = username !== "" && !usernameValid;

  // Live uniqueness check (debounced). Runs against a SECURITY DEFINER RPC that
  // excludes the caller, so keeping your own nickname reads as available.
  useEffect(() => {
    if (!usernameValid) {
      setUsernameStatus("idle");
      return;
    }
    let active = true;
    setUsernameStatus("checking");
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("is_username_available", { candidate: usernameTrimmed });
      if (!active) return;
      // If the check itself fails, stay neutral — the unique index guards on save.
      setUsernameStatus(error ? "idle" : data ? "available" : "taken");
    }, 400);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [usernameTrimmed, usernameValid]);

  const w = Number(currentWeight);
  const hasWeight = currentWeight !== "" && !Number.isNaN(w) && w > 0;
  const h = heightCm === "" ? null : Number(heightCm);
  // Height feeds the healthy-BMI floor, so a "lose" target can never be set
  // below it — see targetWeightRange.
  const range = hasWeight ? targetWeightRange(w, goalType, h) : null;
  const recommended = hasWeight ? recommendedTargetRange(w, goalType, h) : null;
  const belowHealthyFloor = hasWeight && isAtOrBelowHealthyFloor(w, h);

  // Neutral age screen. We ask because BMR needs it; we act on it because a
  // gamified weight-loss app is not something to hand a child.
  const ageNum = age === "" ? null : Number(age);
  const ageTooYoung = ageNum != null && !Number.isNaN(ageNum) && ageNum < MIN_SIGNUP_AGE;

  // Snap an out-of-range target back into the allowed band when the goal or
  // current weight changes, so the form can never hold an invalid value.
  useEffect(() => {
    if (!range || targetWeight === "") return;
    const t = Number(targetWeight);
    if (Number.isNaN(t)) return;
    if (t < range.min) setTargetWeight(String(range.min));
    else if (t > range.max) setTargetWeight(String(range.max));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalType, currentWeight]);

  const target = Number(targetWeight);
  // Following the recommended range needs no manual entry to be valid.
  const targetValid = useRecommended
    ? recommended != null
    : range != null && targetWeight !== "" && !Number.isNaN(target) && target >= range.min && target <= range.max;

  const preview = hasWeight && age && heightCm && gender && activityLevel && targetValid
    ? calculateTargets(Number(age), Number(heightCm), w, gender, activityLevel, goalType, target, useRecommended)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !preview) return;

    if (ageTooYoung) {
      toast.error(`Sorry — you need to be at least ${MIN_SIGNUP_AGE} to use GGLvlup.`);
      return;
    }

    if (!healthConsent) {
      toast.error("Please confirm you're happy for us to store the health data you enter.");
      return;
    }

    if (!usernameValid) {
      toast.error(`Please pick a valid nickname. ${USERNAME_RULE_HINT}`);
      return;
    }

    if (usernameStatus === "taken") {
      toast.error("That nickname is already taken — please choose another.");
      return;
    }

    // Enforce the target-weight / Day 1 lock on the server-bound path too, not
    // just by disabling the inputs.
    if (isUpdate && startingDataChanged && !startingDataEdit.allowed) {
      toast.error(startingDataEdit.reason || "You can't change your target weight or Day 1 date right now.");
      return;
    }

    if (isUpdate && hasChangedStartingData) {
      const shouldRestart = window.confirm(
        "Changing your age, height, weight, gender, activity, goal, target weight or Day 1 date restarts your challenge — you'll begin logging again from Day 1. Continue?"
      );
      if (!shouldRestart) return;
    }

    // The user picks their own Day 1 now (they may have started ahead).
    const challengeStartDate = dayOneDate || formatDateInputValue();

    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      username: usernameTrimmed,
      // Explicit consent to process health data (GDPR Art. 9 / PH DPA sensitive
      // personal information). Stamped once and never cleared by a later edit.
      health_data_consent_at: profile?.health_data_consent_at ?? new Date().toISOString(),
      age: Number(age),
      height_cm: Number(heightCm),
      current_weight: w,
      goal_type: goalType,
      // Following the recommendation stores the whole band (the dashboard then
      // shows a range); a manual pick stores just that single number.
      target_weight: useRecommended
        ? (goalType === "lose" ? recommended!.max : w)
        : target,
      target_weight_min: useRecommended ? recommended!.min : null,
      target_weight_max: useRecommended ? recommended!.max : null,
      gender,
      activity_level: activityLevel,
      daily_calorie_target: preview.calorieMax, // primary target = max (moderate)
      daily_calorie_target_min: preview.calorieMin,
      daily_calorie_target_max: preview.calorieMax,
      daily_protein_target: preview.proteinMin, // primary target = min
      daily_protein_target_min: preview.proteinMin,
      daily_protein_target_max: preview.proteinMax,
      daily_water_target: preview.water,
      daily_steps_target: preview.steps,
      challenge_start_date: challengeStartDate,
      // Stamp the lock clock only when a locked field actually changed, so the
      // 30-day premium window starts from the real change.
      ...(startingDataChanged ? { starting_data_updated_at: new Date().toISOString() } : {}),
    }).eq("user_id", user.id);

    // Seed Day 1's weight from the profile so the challenge starts from a real
    // data point. Merge into any existing row for that date rather than
    // overwriting the other metrics the user may have already logged.
    if (!error) {
      const { data: existing } = await supabase
        .from("daily_logs")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", challengeStartDate)
        .maybeSingle();

      if (existing) {
        await supabase.from("daily_logs").update({ weight: w }).eq("id", existing.id);
      } else {
        await supabase.from("daily_logs").insert({
          user_id: user.id,
          date: challengeStartDate,
          day_number: 1,
          weight: w,
        });
      }
    }

    setSaving(false);
    if (error) {
      // A unique-violation means another user claimed this nickname between the
      // live check and save — reject it and point the user back at the field.
      if ((error as { code?: string }).code === "23505") {
        setUsernameStatus("taken");
        toast.error("That nickname is already taken — please choose another.");
      } else {
        toast.error("Failed to save profile");
      }
    } else {
      // Activation funnel: first-time completion is the "profile done" step.
      track("profile_completed", { first_time: !isUpdate });
      toast.success(isUpdate ? "Profile updated" : "Profile saved! Let's start your journey 💪");
      // First-time setup hands off to the dashboard with a flag so the quick
      // guide is shown before the user starts tracking.
      navigate("/", { state: { justOnboarded: !isUpdate } });
    }
  };

  if (authLoading || !user || profileLoading) {
    return (
      <div className="wood-bg flex min-h-screen items-center justify-center">
        <div className="animate-pulse font-display text-[hsl(35,30%,65%)]">Loading...</div>
      </div>
    );
  }

  const labelClass = "font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground";

  const targets = preview
    ? [
        { label: "Calories", value: `${preview.calorieMin}–${preview.calorieMax} kcal` },
        { label: "Protein", value: `${preview.proteinMin}–${preview.proteinMax} g` },
        {
          label: "Target Weight",
          value: useRecommended && recommended ? `${recommended.min}–${recommended.max} kg` : `${target} kg`,
        },
        { label: "Water / Steps", value: `${preview.water} glasses / ${preview.steps.toLocaleString()}` },
      ]
    : [];

  // Bounds hint under the target-weight field: just the numbers.
  const rangeHint = !range
    ? "Enter your current weight first."
    : `${range.min} kg – ${range.max} kg`;

  return (
    <div className="wood-bg flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="font-display text-3xl font-bold tracking-wide text-[hsl(38,60%,90%)] [text-shadow:0_3px_0_rgba(0,0,0,0.4)]">
            {isUpdate ? "Update Your Profile" : "Set Up Your Profile"}
          </h1>
          <p className="font-semibold text-[hsl(35,30%,65%)]">
            {isUpdate
              ? "Adjust your stats and we'll recalculate your daily targets."
              : "We'll calculate personalized targets based on your data"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="game-panel space-y-5 p-6">
          {isUpdate && hasChangedStartingData && (
            <div className="rounded-lg border-2 border-[hsl(40,70%,45%)] bg-[hsl(45,82%,88%)] px-3 py-2 text-sm font-bold text-[hsl(30,55%,32%)]">
              ⚠️ Changing your stats, goal, target weight or Day 1 date restarts the challenge — you'll start logging again from Day 1.
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="username" className={labelClass}>Nickname</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={USERNAME_MAX_LENGTH}
              required
              placeholder="e.g. FitFalcon"
              autoComplete="off"
            />
            <p
              className={`text-xs font-bold ${
                showUsernameError || usernameStatus === "taken"
                  ? "text-[hsl(6,62%,42%)]"
                  : usernameStatus === "available"
                    ? "text-[hsl(84,45%,32%)]"
                    : "text-muted-foreground"
              }`}
            >
              {showUsernameError
                ? USERNAME_RULE_HINT
                : usernameStatus === "checking"
                  ? "Checking availability…"
                  : usernameStatus === "taken"
                    ? "That nickname is already taken — please choose another."
                    : usernameStatus === "available"
                      ? "✓ Nickname is available"
                      : "Shown on your dashboard instead of your full name."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="age" className={labelClass}>Age</Label>
              <Input
                id="age"
                type="number"
                min={MIN_SIGNUP_AGE}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required
                placeholder="25"
                aria-invalid={ageTooYoung}
              />
              {ageTooYoung && (
                <p className="text-xs font-bold text-[hsl(6,62%,42%)]">
                  You need to be at least {MIN_SIGNUP_AGE} to use GGLvlup.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gender" className={labelClass}>Gender</Label>
              <Select value={gender} onValueChange={setGender} required>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="height" className={labelClass}>Height (cm)</Label>
            <Input id="height" type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} required placeholder="170" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cw" className={labelClass}>Current Weight (kg)</Label>
            <Input id="cw" type="number" step="0.1" value={currentWeight} onChange={(e) => setCurrentWeight(e.target.value)} required placeholder="85" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="activity" className={labelClass}>Activity Level</Label>
            <Select value={activityLevel} onValueChange={setActivityLevel} required>
              <SelectTrigger><SelectValue placeholder="Select activity level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentary">Sedentary: 0-1 exercises/wk, &lt;4k steps/day</SelectItem>
                <SelectItem value="lightly_active">Lightly Active: 2-4 exercises/wk, 4-8k steps/day</SelectItem>
                <SelectItem value="very_active">Very Active: 5-6 exercises/wk, &gt;8k steps/day</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Goal: two-tab switch driving the target-weight limits + calorie math */}
          <div className="space-y-1.5">
            <Label className={labelClass}>Goal</Label>
            <div
              role="tablist"
              aria-label="Goal"
              className="grid grid-cols-2 gap-1 rounded-xl border-2 border-[hsl(33,28%,58%)] bg-[hsl(37,40%,82%)] p-1"
            >
              {([
                { value: "lose", label: "Lose", hint: "Drop weight" },
                { value: "maintain", label: "Maintain", hint: "Hold steady" },
              ] as const).map((opt) => {
                const active = goalType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setGoalType(opt.value)}
                    className={`rounded-lg px-3 py-2 text-center transition ${
                      active
                        ? "border-2 border-[hsl(70,50%,22%)] bg-gradient-to-b from-[hsl(68,46%,50%)] to-[hsl(70,50%,38%)] text-white shadow-[0_2px_0_hsl(70,50%,22%)]"
                        : "border-2 border-transparent text-muted-foreground hover:bg-[hsl(40,48%,92%)]"
                    }`}
                  >
                    <span className="block font-display text-sm font-bold uppercase tracking-wide">{opt.label}</span>
                    <span className={`block text-[10px] font-bold ${active ? "text-white/80" : "opacity-70"}`}>
                      {opt.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Safety floor. The per-run percentage limits are relative, so across
              successive runs they would happily ratchet someone below a healthy
              weight; targetWeightRange clamps to BMI 18.5 and this explains why
              the allowed range stopped where it did. */}
          {belowHealthyFloor && goalType === "lose" && (
            <div className="rounded-xl border-2 border-[hsl(6,62%,52%)]/50 bg-[hsl(6,62%,52%)]/10 px-3 py-2.5">
              <p className="text-xs font-bold text-[hsl(6,62%,38%)]">
                You're already at or below a healthy weight for your height, so we won't set a
                weight-loss target. Switch to <strong>Maintain</strong> — and please talk to a
                doctor or dietitian before losing more.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="tw" className={labelClass}>Target Weight (kg)</Label>
            {lockStartingFields && (
              <div className="rounded-lg border-2 border-[hsl(268,42%,60%)]/40 bg-[hsl(268,42%,60%)]/10 px-3 py-2 text-xs font-bold text-[hsl(268,40%,38%)]">
                🔒 {startingDataEdit.reason}
              </div>
            )}
            <Input
              id="tw"
              type="number"
              step="0.1"
              min={range?.min}
              max={range?.max}
              value={useRecommended ? "" : targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              disabled={!hasWeight || useRecommended || lockStartingFields}
              required={!useRecommended}
              placeholder={
                useRecommended && recommended ? `${recommended.min} – ${recommended.max}` : range ? String(range.min) : "—"
              }
            />
            <p
              className={`text-xs font-bold ${
                !useRecommended && targetWeight !== "" && !targetValid ? "text-[hsl(6,62%,42%)]" : "text-muted-foreground"
              }`}
            >
              {useRecommended && recommended
                ? `Using the recommended range: ${recommended.min} kg – ${recommended.max} kg`
                : !useRecommended && targetWeight !== "" && !targetValid
                  ? `Must be between ${rangeHint}`
                  : rangeHint}
            </p>

            <label className="flex cursor-pointer items-start gap-2 pt-1">
              <Checkbox
                checked={useRecommended}
                onCheckedChange={(v) => setUseRecommended(v === true)}
                disabled={!hasWeight || lockStartingFields}
                className="mt-0.5 border-[hsl(33,30%,45%)] data-[state=checked]:border-[hsl(70,50%,22%)] data-[state=checked]:bg-[hsl(70,50%,38%)]"
              />
              <span className="text-xs font-bold text-muted-foreground">
                Just use the recommended weight range
              </span>
            </label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="day1" className={labelClass}>Day 1 Date</Label>
            <Input
              id="day1"
              type="date"
              max={formatDateInputValue()}
              value={dayOneDate}
              onChange={(e) => setDayOneDate(e.target.value)}
              disabled={lockStartingFields}
              required
            />
            <p className="text-xs font-bold text-muted-foreground">
              {lockStartingFields
                ? `🔒 ${startingDataEdit.reason}`
                : "Already started? Pick the day your challenge began."}
            </p>
          </div>

          {preview && (
            <div className="rounded-xl border-2 border-[hsl(33,28%,60%)] bg-[hsl(37,40%,82%)] p-4">
              <p className="font-display text-sm font-semibold uppercase tracking-wider text-card-foreground">
                Your Calculated Targets
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {targets.map(({ label, value }) => (
                  <div key={label} className="game-tag px-2.5 py-1.5">
                    <p className="font-display text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="font-bold text-card-foreground">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Health data is a special category under GDPR Art. 9 and sensitive
              personal information under the PH Data Privacy Act — both need
              explicit, unbundled consent, which a Terms link cannot carry. */}
          <label className="game-tag flex cursor-pointer items-start gap-2.5 px-3 py-3 text-left">
            <Checkbox
              checked={healthConsent}
              onCheckedChange={(v) => setHealthConsent(v === true)}
              className="mt-0.5 shrink-0"
              aria-describedby="health-consent-text"
            />
            <span id="health-consent-text" className="text-xs font-semibold text-muted-foreground">
              I agree to GGLvlup storing the health and fitness data I enter (weight, food, water,
              steps and exercise) so it can run my dashboard, streaks and trophies. I can withdraw
              this at any time by deleting my account.{" "}
              <a href="/privacy" target="_blank" rel="noreferrer" className="font-bold underline">
                Privacy Policy
              </a>
            </span>
          </label>

          <div className="space-y-3 pt-1">
            <GameButton
              type="submit"
              color="red"
              size="lg"
              className="w-full"
              disabled={
                saving ||
                !healthConsent ||
                ageTooYoung ||
                !usernameValid ||
                usernameStatus === "taken" ||
                !gender ||
                !activityLevel ||
                !targetValid
              }
            >
              {saving ? "Saving..." : isUpdate ? "Save Changes" : "Start My 100-Day Challenge 🚀"}
            </GameButton>
            {isUpdate && (
              <button
                type="button"
                onClick={() => navigate("/")}
                className="w-full text-center font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-card-foreground"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {isUpdate && (
          <div className="mt-6 border-t-2 border-[hsl(33,28%,62%)] pt-5">
            <DeleteAccountButton />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileSetup;
