import { beforeEach, describe, expect, it, vi } from "vitest";

// The allowlist lookup is the only thing resolveEffectiveAccessLevel touches;
// this stands in for `.from().select().eq().maybeSingle()`.
const maybeSingle = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  },
}));

const { resolveEffectiveAccessLevel } = await import("@/lib/access");

describe("resolveEffectiveAccessLevel", () => {
  beforeEach(() => maybeSingle.mockReset());

  it("upgrades a free user with an active premium entry", async () => {
    maybeSingle.mockResolvedValue({ data: { email: "a@b.com", access_level: "premium", is_active: true }, error: null });
    await expect(resolveEffectiveAccessLevel("a@b.com", "free")).resolves.toBe("premium");
  });

  it("demotes a premium user once their allowlist entry is removed", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(resolveEffectiveAccessLevel("a@b.com", "premium")).resolves.toBe("free");
  });

  it("demotes a premium user whose entry was deactivated", async () => {
    maybeSingle.mockResolvedValue({ data: { email: "a@b.com", access_level: "premium", is_active: false }, error: null });
    await expect(resolveEffectiveAccessLevel("a@b.com", "premium")).resolves.toBe("free");
  });

  it("demotes a premium user downgraded to a free entry", async () => {
    maybeSingle.mockResolvedValue({ data: { email: "a@b.com", access_level: "free", is_active: true }, error: null });
    await expect(resolveEffectiveAccessLevel("a@b.com", "premium")).resolves.toBe("free");
  });

  it("keeps the current level when the lookup fails", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "network" } });
    await expect(resolveEffectiveAccessLevel("a@b.com", "premium")).resolves.toBe("premium");
  });

  it("does not demote admins or devs, whose premium is role-granted", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(resolveEffectiveAccessLevel("a@b.com", "premium", "admin")).resolves.toBe("premium");
    await expect(resolveEffectiveAccessLevel("a@b.com", "premium", "dev")).resolves.toBe("premium");
    await expect(resolveEffectiveAccessLevel("a@b.com", "premium", "user")).resolves.toBe("free");
  });

  it("keeps the current level when there is no email to match on", async () => {
    await expect(resolveEffectiveAccessLevel(null, "premium")).resolves.toBe("premium");
    expect(maybeSingle).not.toHaveBeenCalled();
  });
});
