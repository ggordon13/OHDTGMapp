ALTER TABLE public.profiles
  ADD COLUMN daily_calorie_target_min INTEGER,
  ADD COLUMN daily_calorie_target_max INTEGER,
  ADD COLUMN daily_protein_target_min INTEGER,
  ADD COLUMN daily_protein_target_max INTEGER,
  ADD COLUMN target_weight_min NUMERIC,
  ADD COLUMN target_weight_max NUMERIC;