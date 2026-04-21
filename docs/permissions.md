# Group Session Permissions

## Roles
- `host`: full control over group configuration and member roles.
- `admin`: operational control for member and invite management.
- `member`: standard participation controls.

## Session controls
- **Start / Pause / Stop (self)**: allowed for any group member.
- **Group-wide stop for everyone**: reserved for `host` and `admin` (implementation pending in a dedicated action path).

## Membership boundary
- Non-members cannot run session controls.
- Non-members can only request access or join through allowed privacy mode.

## UX policy
- Every active state must expose a visible stop action.
- Button text must use plain action labels (`Start Focus`, `Pause`, `Stop`).
