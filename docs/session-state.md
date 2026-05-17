# Session State Rules

## Core rule
- A user can have only one active focus session at a time across the whole product.

## Source of truth
- Active presence is represented by `liveSessions` documents.
- Group status (active/idle) is derived in real-time from live session presence — no group-level `status` or `startTime` fields are stored.

## Allowed actions
- **Start**: user enters focus in the selected group. Creates a `liveSessions` document.
- **Pause**: user leaves active focus state without resetting local timer progress. Updates `liveSessions` status to `paused`.
- **Stop**: user leaves active focus state and resets local timer. Ends the `liveSessions` document.

## Group status (derived)
- A group is considered "active" when at least one member has a non-stale `liveSessions` document with status `focusing`.
- Elapsed time for the group is computed from the earliest `liveSessions.startedAt` among active members.
- No Firestore writes to the group document are needed for start/pause/stop actions.

## Reliability guarantees
- Session actions are idempotent (safe for repeated clicks).
- UI controls lock while a session action is pending.
- A user cannot remain active in multiple groups after a successful action.
- Live sessions are considered stale if `lastHeartbeat` is older than 3 minutes.
