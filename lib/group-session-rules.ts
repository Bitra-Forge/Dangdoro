export type SessionAction = "start" | "pause" | "stop";

export interface GroupMemberLike {
  uid: string;
  isFocusing?: boolean;
}

export interface GroupLike {
  id: string;
  status?: "active" | "paused" | "idle";
  memberDetails?: GroupMemberLike[];
}

export interface GroupSessionActionResult {
  shouldSetActiveGroupId: string | null;
  shouldStartTimer: boolean;
  shouldPauseTimer: boolean;
  shouldStopTimer: boolean;
}

export function getGroupStatusRules(
  group: GroupLike,
  userId: string,
  action: SessionAction
): { status?: "active" | "idle"; clearStartTime: boolean; setStartTime: boolean } {
  const isStarting = action === "start";
  const otherFocusers =
    group.memberDetails?.filter((m) => m.uid !== userId && m.isFocusing) ?? [];

  if (isStarting) {
    return {
      status: "active",
      setStartTime: group.status !== "active",
      clearStartTime: false,
    };
  }

  if (otherFocusers.length === 0) {
    return {
      status: "idle",
      setStartTime: false,
      clearStartTime: true,
    };
  }

  return {
    setStartTime: false,
    clearStartTime: false,
  };
}

export function getClientTimerEffects(groupId: string, action: SessionAction): GroupSessionActionResult {
  const isStarting = action === "start";
  return {
    shouldSetActiveGroupId: isStarting ? groupId : null,
    shouldStartTimer: isStarting,
    shouldPauseTimer: action === "pause",
    shouldStopTimer: action === "stop",
  };
}
