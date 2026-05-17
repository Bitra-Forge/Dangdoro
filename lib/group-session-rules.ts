export type SessionAction = "start" | "pause" | "stop";

export interface GroupMemberLike {
  uid: string;
  isFocusing?: boolean;
}

export interface GroupLike {
  id: string;
  memberDetails?: GroupMemberLike[];
}

export interface GroupSessionActionResult {
  shouldSetActiveGroupId: string | null;
  shouldStartTimer: boolean;
  shouldPauseTimer: boolean;
  shouldStopTimer: boolean;
}

export function getClientTimerEffects(groupId: string, action: SessionAction): GroupSessionActionResult {
  const isStarting = action === "start";
  const isPauseOrResume = action === "pause";
  return {
    shouldSetActiveGroupId: isStarting || isPauseOrResume ? groupId : null,
    shouldStartTimer: isStarting,
    shouldPauseTimer: action === "pause",
    shouldStopTimer: action === "stop",
  };
}
