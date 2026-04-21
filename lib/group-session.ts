import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { trackSessionEvent } from "@/lib/session-telemetry";
import {
  getClientTimerEffects,
  getGroupStatusRules,
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

function getGroupStatusUpdates(
  group: GroupLike,
  userId: string,
  action: SessionAction
): Record<string, unknown> {
  const rules = getGroupStatusRules(group, userId, action);
  const updates: Record<string, unknown> = {};
  if (rules.status) updates.status = rules.status;
  if (rules.setStartTime) updates.startTime = serverTimestamp();
  if (rules.clearStartTime) updates.startTime = null;
  return updates;
}

export async function applyGroupSessionAction({
  group,
  userId,
  action,
}: ApplyGroupSessionActionInput): Promise<GroupSessionActionResult> {
  const updates = getGroupStatusUpdates(group, userId, action);

  if (Object.keys(updates).length > 0) {
    await updateDoc(doc(db, "focusGroups", group.id), updates);
  }

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
