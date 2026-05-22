import { describe, it, expect } from "vitest";
import {
  fmtMinutes,
  fmtElapsed,
  generateInviteToken,
  getGoalTypeLabel,
  getGoalPeriodBounds,
  toMillis,
} from "@/lib/groups";

describe("fmtMinutes", () => {
  it("returns '0m' for 0", () => {
    expect(fmtMinutes(0)).toBe("0m");
  });

  it("formats minutes only", () => {
    expect(fmtMinutes(45)).toBe("45m");
  });

  it("formats hours only", () => {
    expect(fmtMinutes(120)).toBe("2h");
  });

  it("formats hours and minutes", () => {
    expect(fmtMinutes(90)).toBe("1h 30m");
  });
});

describe("fmtElapsed", () => {
  it("returns '0s' for 0", () => {
    expect(fmtElapsed(0)).toBe("0s");
  });

  it("formats seconds only", () => {
    expect(fmtElapsed(45)).toBe("45s");
  });

  it("formats minutes and seconds", () => {
    expect(fmtElapsed(125)).toBe("2m 5s");
  });

  it("formats hours, minutes, and seconds", () => {
    expect(fmtElapsed(3661)).toBe("1h 1m 1s");
  });
});

describe("generateInviteToken", () => {
  it("returns an 8-character string", () => {
    const token = generateInviteToken();
    expect(token).toHaveLength(8);
  });

  it("returns uppercase alphanumeric characters", () => {
    const token = generateInviteToken();
    expect(token).toMatch(/^[A-Z0-9]+$/);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateInviteToken()));
    // With 8 hex chars, collisions in 100 runs are astronomically unlikely
    expect(tokens.size).toBeGreaterThan(95);
  });
});

describe("getGoalTypeLabel", () => {
  it("returns correct labels", () => {
    expect(getGoalTypeLabel("daily")).toBe("Daily");
    expect(getGoalTypeLabel("weekly")).toBe("Weekly");
    expect(getGoalTypeLabel("monthly")).toBe("Monthly");
    expect(getGoalTypeLabel("custom")).toBe("Custom");
  });

  it("defaults to Weekly for undefined", () => {
    expect(getGoalTypeLabel(undefined)).toBe("Weekly");
  });
});

describe("getGoalPeriodBounds", () => {
  const referenceDate = new Date(2026, 4, 20, 12, 0, 0); // Wed May 20, 2026

  it("daily bounds are start and end of day", () => {
    const { start, end } = getGoalPeriodBounds("daily", undefined, referenceDate);
    expect(start.getDate()).toBe(20);
    expect(end.getDate()).toBe(21);
  });

  it("weekly bounds span 7 days", () => {
    const { start, end } = getGoalPeriodBounds("weekly", undefined, referenceDate);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(7);
  });

  it("monthly bounds span the full month", () => {
    const { start, end } = getGoalPeriodBounds("monthly", undefined, referenceDate);
    expect(start.getDate()).toBe(1);
    expect(end.getMonth()).toBe(5); // June (0-indexed)
  });

  it("custom bounds use provided days", () => {
    const { start, end } = getGoalPeriodBounds("custom", 14, referenceDate);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(14);
  });
});

describe("toMillis", () => {
  it("returns null for null/undefined", () => {
    expect(toMillis(null)).toBeNull();
    expect(toMillis(undefined)).toBeNull();
  });

  it("passes through numbers", () => {
    expect(toMillis(12345)).toBe(12345);
  });

  it("converts Date objects", () => {
    const d = new Date(2026, 0, 1);
    expect(toMillis(d)).toBe(d.getTime());
  });

  it("converts Firestore-like timestamps with toMillis", () => {
    const fake = { toMillis: () => 999999 };
    expect(toMillis(fake)).toBe(999999);
  });

  it("converts Firestore-like timestamps with seconds", () => {
    const fake = { seconds: 100, nanoseconds: 0 };
    expect(toMillis(fake)).toBe(100000);
  });
});
