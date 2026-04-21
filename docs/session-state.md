# Session State Rules

## Core rule
- A user can have only one active focus session at a time across the whole product.

## Source of truth
- Active presence is represented by a `liveSessions` document.
- Group-level `status` (`active`, `paused`, `idle`) is derived from active members and control actions.

## Allowed actions
- **Start**: user enters focus in the selected group.
- **Pause**: user leaves active focus state without resetting local timer progress.
- **Stop**: user leaves active focus state and resets local timer run.

## Group status transitions
- When a user starts and the group is not active, set group to `active` and set `startTime`.
- When a user pauses/stops and no one else is focusing, set group to `idle` and clear `startTime`.
- If other members are still focusing, keep group status unchanged.

## Reliability guarantees
- Session actions are idempotent (safe for repeated clicks).
- UI controls lock while a session action is pending.
- A user cannot remain active in multiple groups after a successful action.
