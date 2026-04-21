type SessionEvent =
  | "group_session_start"
  | "group_session_pause"
  | "group_session_stop"
  | "group_session_sync_failed"
  | "live_session_start"
  | "live_session_end"
  | "live_session_conflict"
  | "live_session_stale_cleanup";

type SessionTelemetryPayload = Record<string, unknown>;

export function trackSessionEvent(event: SessionEvent, payload: SessionTelemetryPayload = {}) {
  // Minimal structured telemetry that works in all environments.
  console.info("[session-event]", event, payload);
}
