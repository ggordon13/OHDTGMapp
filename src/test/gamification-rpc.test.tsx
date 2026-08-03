import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Guards the XP write path end-to-end at the call level.
//
// The catalog-sync test only greps the source for `rpc("claim_quest"`, which
// passed happily while the helper was written as `const rpc = supabase.rpc` —
// that detaches the method from its receiver, so supabase-js threw on an
// undefined `this` and every single claim failed. The mock below is deliberately
// `this`-sensitive: pull the method off the client again and these tests fail.
// ---------------------------------------------------------------------------

const rpcCalls: [string, Record<string, unknown> | undefined][] = [];

vi.mock("@/integrations/supabase/client", () => {
  const chain = (): Record<string, unknown> => {
    const self: Record<string, unknown> = {};
    for (const method of ["select", "eq", "update", "insert", "order", "is"]) {
      self[method] = () => self;
    }
    self.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve);
    return self;
  };

  const supabase = {
    __brand: "supabase-client",
    from: () => chain(),
    rpc(this: { __brand?: string } | undefined, fn: string, args?: Record<string, unknown>) {
      // The real client dereferences `this` immediately; mimic that so a lost
      // binding surfaces as a failure rather than a silent no-op.
      if (this?.__brand !== "supabase-client") {
        throw new TypeError("supabase.rpc called with the wrong `this` — the method was detached");
      }
      rpcCalls.push([fn, args]);
      return Promise.resolve({ data: fn === "claim_quest" ? 40 : 0, error: null });
    },
  };
  return { supabase };
});

vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useGamification } from "@/hooks/useGamification";
import type { Quest } from "@/lib/gamification";
import type { DailyLog } from "@/lib/mockData";

const profile = {
  user_id: "u1",
  total_xp: 0,
  current_run: 1,
  streak_shields: 0,
  current_weight: 80,
  target_weight: 75,
} as never;

const dayRange: DailyLog[] = [
  { date: "2026-08-04", day: 1, weight: 80, calories: 1800, protein: 160, water: 8, exercise: "None", steps: 12000 },
];

const quest: Quest = {
  key: "daily-steps",
  title: "Get your steps in",
  description: "Walk 10,000 steps",
  xp: 15,
  category: "daily",
  current: 12000,
  target: 10000,
  completed: true,
};

const setup = () =>
  renderHook(() =>
    useGamification({
      userId: "u1",
      profile,
      refetchProfile: async () => {},
      dayRange,
      weeklyGoals: { dailyCalories: 2000, dailyProtein: 150, dailyWater: 7, dailySteps: 10000 },
    }),
  );

beforeEach(() => {
  rpcCalls.length = 0;
});

describe("XP goes through the server RPCs", () => {
  it("claims a quest via claim_quest with the key and period", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.claimQuest(quest, "2026-08-04");
    });

    expect(rpcCalls).toContainEqual([
      "claim_quest",
      { p_quest_key: "daily-steps", p_period: "2026-08-04" },
    ]);
  });

  it("banks the XP the server returned, not the client's own number", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.claimQuest(quest, "2026-08-04");
    });
    // The mock returns 40 while the quest claims to be worth 15.
    await waitFor(() => expect(result.current.xp).toBe(40));
  });

  it("claims each pending quest through the server on claim all", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.claimAll([
        { quest, period: "2026-08-04" },
        { quest: { ...quest, key: "daily-water" }, period: "2026-08-04" },
      ]);
    });

    const claims = rpcCalls.filter(([fn]) => fn === "claim_quest");
    expect(claims).toHaveLength(2);
    expect(claims.map(([, args]) => (args as { p_quest_key: string }).p_quest_key)).toEqual([
      "daily-steps",
      "daily-water",
    ]);
  });
});
