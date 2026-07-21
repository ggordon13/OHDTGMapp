import { describe, expect, it } from "vitest";
import { isValidUsername, USERNAME_MAX_LENGTH } from "@/lib/profile";

describe("isValidUsername", () => {
  it("accepts letters and numbers", () => {
    expect(isValidUsername("FitFalcon")).toBe(true);
    expect(isValidUsername("John23")).toBe(true);
    expect(isValidUsername("a1")).toBe(true);
  });

  it("allows exactly one space in between", () => {
    expect(isValidUsername("Fit Falcon")).toBe(true);
    expect(isValidUsername("John 23")).toBe(true);
  });

  it("rejects more than one space or consecutive spaces", () => {
    expect(isValidUsername("Fit  Falcon")).toBe(false); // double space
    expect(isValidUsername("A B C")).toBe(false); // two spaces
  });

  it("rejects leading or trailing spaces", () => {
    expect(isValidUsername(" John")).toBe(false);
    expect(isValidUsername("John ")).toBe(false);
  });

  it("rejects non-alphanumeric characters", () => {
    expect(isValidUsername("John_23")).toBe(false);
    expect(isValidUsername("cool.guy")).toBe(false);
    expect(isValidUsername("naïve")).toBe(false);
    expect(isValidUsername("emoji😀")).toBe(false);
  });

  it("enforces the length cap and non-empty rule", () => {
    expect(isValidUsername("")).toBe(false);
    expect(isValidUsername("a".repeat(USERNAME_MAX_LENGTH))).toBe(true);
    expect(isValidUsername("a".repeat(USERNAME_MAX_LENGTH + 1))).toBe(false);
    // A space counts toward the 16-char cap.
    expect(isValidUsername("aaaaaaaa aaaaaaa")).toBe(true); // 16 chars incl. space
    expect(isValidUsername("aaaaaaaa aaaaaaaa")).toBe(false); // 17 chars
  });
});
