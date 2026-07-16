import { formatDateInputValue, parseDateInputValue } from "@/lib/utils";

export interface DailyLog {
  date: string;
  day: number;
  weight: number | null;
  calories: number | null;
  protein: number | null;
  water: number | null;
  exercise: string;
  steps: number | null;
}

export interface UserGoals {
  targetWeight: number;
  dailyCalories: number;
  dailyProtein: number;
  dailyWater: number;
  dailySteps: number;
}

export const userGoals: UserGoals = {
  targetWeight: 75,
  dailyCalories: 2000,
  dailyProtein: 150,
  dailyWater: 3,
  dailySteps: 10000,
};

export const exerciseOptions = ["None", "Strength Training", "Sports"] as const;

function generateMockData(): DailyLog[] {
  const logs: DailyLog[] = [];
  const startDate = new Date(2026, 1, 1); // Feb 1, 2026
  let weight = 85;

  for (let i = 0; i < 35; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    weight = Math.max(75, weight + (Math.random() - 0.55) * 0.4);

    logs.push({
      date: formatDateInputValue(date),
      day: i + 1,
      weight: Math.round(weight * 10) / 10,
      calories: Math.round(1700 + Math.random() * 600),
      protein: Math.round(100 + Math.random() * 80),
      water: Math.round((2 + Math.random() * 2) * 10) / 10,
      exercise: exerciseOptions[Math.floor(Math.random() * exerciseOptions.length)],
      steps: Math.round(4000 + Math.random() * 10000),
    });
  }
  return logs;
}

export const mockLogs = generateMockData();

export function getCurrentStreak(logs: DailyLog[]): number {
  let streak = 0;
  for (let i = logs.length - 1; i >= 0; i--) {
    if (logs[i].weight !== null) streak++;
    else break;
  }
  return streak;
}

export function buildDayRange(startDate: string, endDate: string, logs: DailyLog[]): DailyLog[] {
  const logsByDate = new Map(logs.map((log) => [log.date, log]));
  const result: DailyLog[] = [];

  const cursor = parseDateInputValue(startDate);
  const end = parseDateInputValue(endDate);
  let day = 1;

  while (cursor <= end) {
    const dateStr = formatDateInputValue(cursor);
    const existing = logsByDate.get(dateStr);
    result.push(
      existing
        ? { ...existing, day }
        : { date: dateStr, day, weight: null, calories: null, protein: null, water: null, exercise: "", steps: null }
    );
    cursor.setDate(cursor.getDate() + 1);
    day++;
  }

  return result;
}
