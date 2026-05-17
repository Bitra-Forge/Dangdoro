import { describe, expect, it } from "vitest";
import { getClientTimerEffects } from "@/lib/group-session-rules";

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
      shouldSetActiveGroupId: "group-1",
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
