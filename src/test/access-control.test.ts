import { describe, expect, it } from "vitest";
import { canManageAccess, getAccessBadgeLabel, isPremiumAccessGranted, normalizeAccessLevel, normalizeRole } from "@/lib/access";

describe("access control helpers", () => {
  it("treats admin and dev as access managers", () => {
    expect(canManageAccess("admin")).toBe(true);
    expect(canManageAccess("dev")).toBe(true);
    expect(canManageAccess("user")).toBe(false);
  });

  it("normalizes role and access values", () => {
    expect(normalizeRole("ADMIN")).toBe("admin");
    expect(normalizeRole(undefined)).toBe("user");
    expect(normalizeAccessLevel("Premium")).toBe("premium");
    expect(normalizeAccessLevel(undefined)).toBe("free");
  });

  it("grants premium access from the allowlist or existing premium profile", () => {
    expect(isPremiumAccessGranted({ accessLevel: "premium", userEmail: "user@example.com" })).toBe(true);
    expect(
      isPremiumAccessGranted({
        userEmail: "member@example.com",
        allowlistEmails: [{ email: "member@example.com", access_level: "premium", is_active: true }],
      }),
    ).toBe(true);
    expect(
      isPremiumAccessGranted({
        userEmail: "member@example.com",
        allowlistEmails: [{ email: "member@example.com", access_level: "free", is_active: true }],
      }),
    ).toBe(false);
  });

  it("formats a readable access badge label", () => {
    expect(getAccessBadgeLabel("admin", "premium")).toBe("Admin • Premium");
    expect(getAccessBadgeLabel("user", "free")).toBe("Free");
  });
});
