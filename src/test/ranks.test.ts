import { describe, expect, it } from "vitest";
import { RANKS, getNextRank, getRank } from "@/lib/ranks";

describe("ranks", () => {
  it("maps each documented threshold to its title", () => {
    const expected: [number, string][] = [
      [1, "Newcomer"],
      [3, "Recruit"],
      [6, "Adventurer"],
      [9, "Pathfinder"],
      [12, "Veteran"],
      [15, "Champion"],
      [18, "Elite"],
      [21, "Hero"],
      [24, "Legend"],
      [27, "Ancient"],
      [30, "Mythic"],
    ];
    for (const [level, name] of expected) {
      expect(getRank(level).name).toBe(name);
    }
  });

  it("holds the current title until the next threshold is crossed", () => {
    expect(getRank(2).name).toBe("Newcomer");
    expect(getRank(5).name).toBe("Recruit");
    expect(getRank(29).name).toBe("Ancient");
  });

  it("stays Mythic for every level past 30", () => {
    expect(getRank(30).name).toBe("Mythic");
    expect(getRank(99).name).toBe("Mythic");
    expect(getNextRank(30)).toBeNull();
  });

  it("clamps levels below 1 to the first rank", () => {
    expect(getRank(0).name).toBe("Newcomer");
    expect(getRank(-5).name).toBe("Newcomer");
  });

  it("points at the next rank up while one exists", () => {
    expect(getNextRank(1)?.name).toBe("Recruit");
    expect(getNextRank(1)?.minLevel).toBe(3);
    expect(getNextRank(29)?.name).toBe("Mythic");
  });

  it("keeps thresholds strictly ascending", () => {
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].minLevel).toBeGreaterThan(RANKS[i - 1].minLevel);
    }
  });
});
