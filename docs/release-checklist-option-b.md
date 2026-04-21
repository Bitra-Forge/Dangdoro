# Option B Release Checklist

## Pre-release validation
- [ ] Verify a user cannot have more than one active live session across groups.
- [ ] Verify `Start Focus` from group creates one live session.
- [ ] Verify `Pause` ends live session but keeps timer progress.
- [ ] Verify `Stop` ends live session and resets local timer run.
- [ ] Verify global mini bar appears on non-group pages while group session is active.
- [ ] Verify mini bar `Pause` and `Stop` actions update live session state.

## Data integrity checks
- [ ] Verify newly saved sessions include `userId`, `groupId`, `startedAt`, `endedAt`, `status`.
- [ ] Verify group and user minute totals still increment only on completed sessions.
- [ ] Verify stale duplicate live sessions for same user are cleaned up when starting.

## Observability checks
- [ ] Verify telemetry logs emit `live_session_start`, `live_session_end`, and conflicts.
- [ ] Verify failure paths emit `group_session_sync_failed`.

## Manual e2e path
- [ ] Join a group.
- [ ] Start focus from group modal.
- [ ] Navigate to another page and stop from global mini bar.
- [ ] Return to group and confirm no active focus state remains.
- [ ] Confirm totals increase only after completed work session save.
