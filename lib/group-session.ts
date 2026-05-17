import { trackSessionEvent } from "@/lib/session-telemetry";
import {
  getClientTimerEffects,
  GroupLike,
  GroupSessionActionResult,
  SessionAction,
} from "@/lib/group-session-rules";


interface ApplyGroupSessionActionInput {
  group: GroupLike;
  userId: string;
  action: SessionAction;
}

export type { GroupLike, GroupSessionActionResult, SessionAction } from "@/lib/group-session-rules";

export async function applyGroupSessionAction({
  group,
  userId,
  action,
}: ApplyGroupSessionActionInput): Promise<GroupSessionActionResult> {
  trackSessionEvent(
    action === "start"
      ? "group_session_start"
      : action === "pause"
        ? "group_session_pause"
        : "group_session_stop",
    { groupId: group.id, userId }
  );

  return getClientTimerEffects(group.id, action);
}
