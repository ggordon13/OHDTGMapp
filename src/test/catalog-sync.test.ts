import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ALL_BADGES, getDailyQuests, getWeeklyQuests } from "@/lib/gamification";

// ---------------------------------------------------------------------------
// XP is server-authoritative: claim_quest / grant_achievement read the reward
// value out of quest_catalog / badge_catalog rather than trusting the client.
// That only holds if the SQL catalogs match the TypeScript definitions — a new
// trophy added to ALL_BADGES without a catalog row would fail to grant at all,
// and a mismatched XP value would silently pay the wrong amount.
//
// These tests parse the hardening migration and hold the two in step.
// ---------------------------------------------------------------------------

const migration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260740000000_security_hardening.sql"),
  "utf8",
);

/** Rows of a `('key', ..., 42),` VALUES block, as [key, xp]. */
function parseCatalog(afterMarker: string): Map<string, number> {
  const start = migration.indexOf(afterMarker);
  expect(start, `marker not found: ${afterMarker}`).toBeGreaterThan(-1);
  const block = migration.slice(start, migration.indexOf("ON CONFLICT", start));
  const rows = new Map<string, number>();
  for (const [, key, xp] of block.matchAll(/\('([a-z0-9-]+)'[^)]*?(\d+)\)/g)) {
    rows.set(key, Number(xp));
  }
  return rows;
}

describe("badge_catalog matches ALL_BADGES", () => {
  const catalog = parseCatalog("INSERT INTO public.badge_catalog");

  it("covers every trophy, with no extras", () => {
    expect([...catalog.keys()].sort()).toEqual(ALL_BADGES.map((b) => b.key).sort());
  });

  it("pays the same XP as the TypeScript definition", () => {
    for (const badge of ALL_BADGES) {
      expect(catalog.get(badge.key), `XP mismatch for ${badge.key}`).toBe(badge.xp);
    }
  });
});

describe("quest_catalog matches the quest definitions", () => {
  const catalog = parseCatalog("INSERT INTO public.quest_catalog");
  const goals = { caloriesMax: 2000, protein: 150, water: 7, steps: 10000 };
  const weeklyGoals = { dailyCalories: 2000, dailyProtein: 150, dailyWater: 7, dailySteps: 10000 };
  const quests = [...getDailyQuests(null, goals), ...getWeeklyQuests([], weeklyGoals, null)];

  it("covers every quest, with no extras", () => {
    expect([...catalog.keys()].sort()).toEqual(quests.map((q) => q.key).sort());
  });

  it("pays the same XP as the TypeScript definition", () => {
    for (const quest of quests) {
      expect(catalog.get(quest.key), `XP mismatch for ${quest.key}`).toBe(quest.xp);
    }
  });
});

describe("the client never writes XP directly", () => {
  // The whole fix rests on these revokes. If a later migration re-grants them,
  // or someone reintroduces a direct write, this is the tripwire.
  it("revokes the privilege-bearing columns and tables", () => {
    for (const revoke of [
      /REVOKE\s+INSERT\s*\(email\)\s+ON\s+public\.profiles\s+FROM\s+authenticated/i,
      /REVOKE\s+UPDATE\s*\(email\)\s+ON\s+public\.profiles\s+FROM\s+authenticated/i,
      /REVOKE\s+UPDATE\s*\(total_xp,\s*level[^)]*\)\s+ON\s+public\.profiles\s+FROM\s+authenticated/i,
      // DELETE included: total_xp is never decremented, so a client that could
      // delete its own claims could reclaim the same quest forever.
      /REVOKE\s+INSERT,\s*UPDATE,\s*DELETE\s+ON\s+public\.quest_claims\s+FROM\s+authenticated/i,
      /REVOKE\s+INSERT,\s*UPDATE,\s*DELETE\s+ON\s+public\.achievements\s+FROM\s+authenticated/i,
    ]) {
      expect(migration, `missing revoke: ${revoke}`).toMatch(revoke);
    }
  });

  it("drops the founding-admin trigger that granted role from a user-writable column", () => {
    expect(migration).toMatch(/DROP TRIGGER IF EXISTS grant_founding_admin_trg/i);
    expect(migration).toMatch(/DROP FUNCTION IF EXISTS public\.grant_founding_admin/i);
  });

  it("scopes the premium allowlist to the caller's own email", () => {
    expect(migration).toMatch(/DROP POLICY IF EXISTS "Users can view active premium allowlist entries"/i);
    expect(migration).toMatch(/lower\(email\)\s*=\s*lower\(auth\.jwt\(\)\s*->>\s*'email'\)/i);
  });
});

describe("no client code writes the protected tables", () => {
  it("useGamification goes through the RPCs", () => {
    const hook = readFileSync(resolve(__dirname, "../hooks/useGamification.tsx"), "utf8");
    expect(hook).not.toMatch(/from\("quest_claims"\)\s*\.insert/);
    expect(hook).not.toMatch(/from\("achievements"\)\s*\.insert/);
    expect(hook).not.toMatch(/update\(\{\s*total_xp/);
    expect(hook).toMatch(/rpc\("claim_quest"/);
    expect(hook).toMatch(/rpc\("grant_achievement"/);
  });
});
