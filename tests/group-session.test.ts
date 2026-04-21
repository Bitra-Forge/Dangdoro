import { describe, expect, it } from "vitest";
import { getClientTimerEffects, getGroupStatusRules, GroupLike } from "@/lib/group-session-rules";

describe("group session timer effects", () => {
  it("returns start effects for start action", () => {
    const result = getClientTimerEffects("group-1", "start");
    expect(result).toEqual({
      shouldSetActiveGroupId: "group-1",
      shouldStartTimer: true,
      shouldPauseTimer: false,
      shouldStopTimer: false,
    });
  });

  it("returns pause effects for pause action", () => {
    const result = getClientTimerEffects("group-1", "pause");
    expect(result).toEqual({
      shouldSetActiveGroupId: null,
      shouldStartTimer: false,
      shouldPauseTimer: true,
      shouldStopTimer: false,
    });
  });

  it("returns stop effects for stop action", () => {
    const result = getClientTimerEffects("group-1", "stop");
    expect(result).toEqual({
      shouldSetActiveGroupId: null,
      shouldStartTimer: false,
      shouldPauseTimer: false,
      shouldStopTimer: true,
    });
  });
});

describe("group status updates", () => {
  it("marks group active on start", () => {
    const group: GroupLike = { id: "g1", status: "idle", memberDetails: [] };
    const rules = getGroupStatusRules(group, "u1", "start");
    expect(rules).toEqual({
      status: "active",
      setStartTime: true,
      clearStartTime: false,
    });
  });

  it("marks group idle when pausing and no other focusers exist", () => {
    const group: GroupLike = {
      id: "g1",
      status: "active",
      memberDetails: [{ uid: "u1", isFocusing: true }],
    };
    const rules = getGroupStatusRules(group, "u1", "pause");
    expect(rules).toEqual({
      status: "idle",
      setStartTime: false,
      clearStartTime: true,
    });
  });

  it("keeps group active when other members are still focusing", () => {
    const group: GroupLike = {
      id: "g1",
      status: "active",
      memberDetails: [
        { uid: "u1", isFocusing: true },
        { uid: "u2", isFocusing: true },
      ],
    };
    const rules = getGroupStatusRules(group, "u1", "stop");
    expect(rules).toEqual({
      setStartTime: false,
      clearStartTime: false,
    });
  });
});
