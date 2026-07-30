import { describe, it, expect } from "vitest";
import {
  fmtMinutes,
  fmtElapsed,
  generateInviteToken,
  getGoalTypeLabel,
  toMillis,
  deriveTaskProgressAndStatus,
  SharedSubtask,
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

describe("deriveTaskProgressAndStatus", () => {
  it("returns defaults for empty subtasks", () => {
    const result = deriveTaskProgressAndStatus(undefined, "todo");
    expect(result.subtaskCount).toBe(0);
    expect(result.progress).toBe(0);
    expect(result.status).toBe("todo");
  });

  it("calculates progress based on completed status", () => {
    const subtasks: SharedSubtask[] = [
      { id: "1", title: "Subtask 1", completed: true, status: "done" },
      { id: "2", title: "Subtask 2", completed: false, status: "in-progress" },
      { id: "3", title: "Subtask 3", completed: false, status: "todo" },
    ];
    const result = deriveTaskProgressAndStatus(subtasks, "todo");
    expect(result.subtaskCount).toBe(3);
    expect(result.completedSubtaskCount).toBe(1);
    expect(result.progress).toBe(33);
    expect(result.status).toBe("in-progress");
  });

  it("moves status to done when all completed", () => {
    const subtasks: SharedSubtask[] = [
      { id: "1", title: "Subtask 1", completed: true, status: "done" },
      { id: "2", title: "Subtask 2", completed: true, status: "done" },
    ];
    const result = deriveTaskProgressAndStatus(subtasks, "todo");
    expect(result.status).toBe("done");
  });
});
