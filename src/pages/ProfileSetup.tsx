import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { requiresProfileSetup } from "@/lib/profile";
import { formatDateInputValue } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const activityMultipliers: Record<string, number> = {
  sedentary: 1.3,
  lightly_active: 1.45,
  very_active: 1.7,
};

function calculateTargets(age: number, heightCm: number, weight: number, gender: string, activity: string) {
  // Mifflin-St Jeor BMR
  const bmr = gender === "male"
    ? (10 * weight + 6.25 * heightCm - 5 * age + 5)
    : (10 * weight + 6.25 * heightCm - 5 * age - 161);

  const multiplier = activityMultipliers[activity] || 1.45;
  const tdee = bmr * multiplier;

  // Calorie targets: TDEE - (weight * factor * 7700 / 100)
  const calorieMin = Math.round(tdee - (weight * 0.13 * 7700 / 100)); // aggressive
  const calorieMax = Math.round(tdee - (weight * 0.09 * 7700 / 100)); // moderate

  // Protein targets
  const proteinMin = Math.round(weight * 1.3);
  const proteinMax = Math.round(weight * 1.8);

  // Target weight after 100 days
  const targetWeightMin = Math.round(weight * 0.87 * 10) / 10;
  const targetWeightMax = Math.round(weight * 0.91 * 10) / 10;

  // Water based on weight, converted to glasses (~250ml per glass)
  const water = Math.max(1, Math.round((weight * 0.033) / 0.25));

  // Steps based on activity
  const stepsMap: Record<string, number> = {
    sedentary: 4000,
    lightly_active: 6000,
    very_active: 8000,
  };

  return {
    calorieMin,
    calorieMax,
    proteinMin,
    proteinMax,
    targetWeightMin,
    targetWeightMax,
    water,
    steps: stepsMap[activity] || 6000,
  };
}

const ProfileSetup = () => {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const cameFromUpdateButton = (location.state as { intentional?: boolean } | null)?.intentional === true;
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [gender, setGender] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [saving, setSaving] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  const isUpdate = !requiresProfileSetup(profile);
  const hasChangedStartingData = profile != null && (
    age !== (profile.age != null ? String(profile.age) : "") ||
    heightCm !== (profile.height_cm != null ? String(profile.height_cm) : "") ||
    currentWeight !== (profile.current_weight != null ? String(profile.current_weight) : "") ||
    gender !== (profile.gender ?? "") ||
    activityLevel !== (profile.activity_level ?? "")
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
    if (profile.age != null) setAge(String(profile.age));
    if (profile.height_cm != null) setHeightCm(String(profile.height_cm));
    if (profile.current_weight != null) setCurrentWeight(String(profile.current_weight));
    if (profile.gender) setGender(profile.gender);
    if (profile.activity_level) setActivityLevel(profile.activity_level);
    setPrefilled(true);
  }, [profile, profileLoading, prefilled]);

  const w = Number(currentWeight);
  const preview = currentWeight && age && heightCm && gender && activityLevel
    ? calculateTargets(Number(age), Number(heightCm), w, gender, activityLevel)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !preview) return;

    if (isUpdate && hasChangedStartingData) {
      const shouldRestart = window.confirm(
        "Changing your starting data will reset your challenge back to day 1. Continue?"
      );
      if (!shouldRestart) return;
    }

    const challengeStartDate = !isUpdate || hasChangedStartingData
      ? formatDateInputValue()
      : profile?.challenge_start_date ?? formatDateInputValue();

    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      age: Number(age),
      height_cm: Number(heightCm),
      current_weight: w,
      target_weight: preview.targetWeightMax, // used as primary display target
      target_weight_min: preview.targetWeightMin,
      target_weight_max: preview.targetWeightMax,
      gender,
      activity_level: activityLevel,
      daily_calorie_target: preview.calorieMax, // primary target = max (moderate)
      daily_calorie_target_min: preview.calorieMin,
      daily_calorie_target_max: preview.calorieMax,
      daily_protein_target: preview.proteinMin, // primary target = min
      daily_protein_target_min: preview.proteinMin,
      daily_protein_target_max: preview.proteinMax,
      daily_water_target: 7,
      daily_steps_target: preview.steps,
      challenge_start_date: challengeStartDate,
    }).eq("user_id", user.id);

    setSaving(false);
    if (error) {
      toast.error("Failed to save profile");
    } else {
      toast.success(isUpdate ? "Profile updated" : "Profile saved! Let's start your journey 💪");
      navigate("/");
    }
  };

  if (authLoading || !user || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold font-display">
            {isUpdate ? "Update Your Profile" : "Set Up Your Profile"}
          </h1>
          <p className="text-muted-foreground">
            {isUpdate
              ? "Adjust your stats and we'll recalculate your daily targets."
              : "We'll calculate personalized targets based on your data"}
          </p>
        </div>

        {isUpdate && hasChangedStartingData && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Updating these details will restart your challenge from day 1.
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="age">Age</Label>
            <Input id="age" type="number" value={age} onChange={(e) => setAge(e.target.value)} required placeholder="25" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
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

        <div className="space-y-2">
          <Label htmlFor="height">Height (cm)</Label>
          <Input id="height" type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} required placeholder="170" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cw">Current Weight (kg)</Label>
          <Input id="cw" type="number" step="0.1" value={currentWeight} onChange={(e) => setCurrentWeight(e.target.value)} required placeholder="85" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="activity">Activity Level</Label>
          <Select value={activityLevel} onValueChange={setActivityLevel} required>
            <SelectTrigger><SelectValue placeholder="Select activity level" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sedentary">Sedentary: 0-1 exercises/wk, &lt;4k steps/day</SelectItem>
              <SelectItem value="lightly_active">Lightly Active: 2-4 exercises/wk, 4-8k steps/day</SelectItem>
              <SelectItem value="very_active">Very Active: 5-6 exercises/wk, &gt;8k steps/day</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {preview && (
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="font-display font-semibold text-sm">Your Calculated Targets</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Calories:</span>
                <p className="font-semibold">{preview.calorieMin} – {preview.calorieMax} kcal</p>
              </div>
              <div>
                <span className="text-muted-foreground">Protein:</span>
                <p className="font-semibold">{preview.proteinMin} – {preview.proteinMax} g</p>
              </div>
              <div>
                <span className="text-muted-foreground">Target Weight:</span>
                <p className="font-semibold">{preview.targetWeightMin} – {preview.targetWeightMax} kg</p>
              </div>
              <div>
                <span className="text-muted-foreground">Water / Steps:</span>
                <p className="font-semibold">{preview.water} glasses / {preview.steps.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Button type="submit" className="w-full" size="lg" disabled={saving || !gender || !activityLevel}>
            {saving ? "Saving..." : isUpdate ? "Save Changes" : "Start My 100-Day Challenge 🚀"}
          </Button>
          {isUpdate && (
            <Button type="button" variant="ghost" className="w-full" onClick={() => navigate("/")}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};

export default ProfileSetup;
