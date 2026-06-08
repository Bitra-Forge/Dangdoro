# Leaderboard Bug Fix Plan

## Overview

Two main reported issues:
1. **Leaderboard takes a very long time to load**
2. **Profile pictures sometimes don't appear**

After tracing the full data flow through `app/leaderboard/page.tsx`, `lib/db.ts`, `lib/friendship.ts`, and `lib/leaderboard-updater.ts`, here is a detailed breakdown of every root cause and the concrete fix for each.

---

## Bug 1 — Slow Loading

### 1a. Blocking photo-URL overlay before showing any data (most impactful)

**File:** `lib/db.ts` — `getLeaderboard()` (~L759–L778)

**Root cause:** When the `/cache/leaderboard` Firestore document is older than 5 minutes (`cacheStale = true`), `getLeaderboard` fetches fresh `photoURL` values for *all* users (up to 500) before it returns anything to the UI. With a chunk size of 30, that is up to **17 sequential batched Firestore reads** piled on top of the initial cache-doc read. All of this happens while the user stares at the spinner.

```ts
// db.ts ~L759 — this whole block runs synchronously before the leaderboard is returned
if (cacheStale) {
    const uids = data.map((p: any) => p.uid).filter(Boolean);
    if (uids.length > 0) {
        const freshProfiles = await fetchUserProfiles(uids);   // ← up to 17 Firestore reads
        ...
    }
}
```

**Fix:** Remove the blocking photo overlay from `getLeaderboard`. Return the cached data immediately, then let the cron job (which already runs every 5 minutes) refresh the Firestore cache doc with up-to-date `photoURL` values. The UI should never have to do a secondary batch fetch just to show pictures.

```ts
// REMOVE the entire `if (cacheStale) { ... fetchUserProfiles ... }` block.
// Trust the /cache/leaderboard doc (written by the cron) and return data immediately.
cachedLeaderboard = { data, timestamp: Date.now(), queriedLimit: queryLimit };
setSessionStorageItem("dangdoro_leaderboard_cache", cachedLeaderboard);
return data;
```

---

### 1b. `useEffect` depends on the mutable `searchParams` object

**File:** `app/leaderboard/page.tsx` — `useEffect` dependency array (~L108)

**Root cause:** `useSearchParams()` from Next.js returns a new object reference on nearly every render. Adding `searchParams` directly to the dependency array of the main `fetchTops` `useEffect` can cause the effect to re-run (and re-fetch the entire leaderboard) unexpectedly, creating duplicate network requests.

```ts
// page.tsx — searchParams is a live object; adding it raw causes spurious re-runs
}, [user, authLoading, activeTab, selectedGroup, searchParams]);
```

**Fix:** Extract only the specific param values you actually use (`tab`, `groupId`) and depend on those strings, not the whole object.

```ts
const tabParam = searchParams.get("tab");
const groupIdParam = searchParams.get("groupId");

useEffect(() => {
    ...
}, [user, authLoading, activeTab, selectedGroup, tabParam, groupIdParam]);
```

---

### 1c. `setPlayers([])` causes a visible flash and double animation on every tab switch

**File:** `app/leaderboard/page.tsx` — `fetchTops` (~L53)

**Root cause:** At the start of every `fetchTops` call, `setPlayers([])` clears the list immediately. Combined with `AnimatePresence mode="wait"`, the old content animates out, the spinner appears, and then the new content animates in — even for a tab the user has already visited and is cached.

**Fix:** Only reset players if there is no cached data available for that tab/state. Keep showing the previous list until the new one arrives, or at minimum don't clear it if the new data will arrive in milliseconds (cache hit).

---

### 1d. Auth loading gate adds an extra render cycle before fetching begins

**File:** `app/leaderboard/page.tsx` — `fetchTops` (~L50)

**Root cause:** The effect has an early exit when `authLoading` is `true`. On first mount, auth always starts loading, so the effect fires, exits immediately (no fetch), then fires again once `authLoading` flips to `false`. This adds one unnecessary render cycle to every page load.

**Fix:** This is minor but can be improved by not triggering `setLoading(true)` until auth is confirmed to be resolved with a real user.

---

## Bug 2 — Profile Pictures Not Appearing

### 2a. Firebase Storage URLs are truncated to 512 characters (root cause — most critical)

**File:** `lib/leaderboard-updater.ts` (~L15–L18)  
**Also:** `lib/db.ts` — `getLeaderboard` fallback path (~L747–L749)

**Root cause:** Both the cron leaderboard updater and the fallback query in `getLeaderboard` deliberately truncate `photoURL` to 512 characters:

```ts
// leaderboard-updater.ts
const photoURL = rawPhoto && !rawPhoto.startsWith("data:")
    ? rawPhoto.slice(0, 512)   // ← BREAKS Firebase Storage URLs
    : null;
```

Firebase Storage download URLs look like this:

```
https://firebasestorage.googleapis.com/v0/b/your-app.appspot.com/o/profile_pictures%2Fsome-uid%2Fphoto.jpg?alt=media&token=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

These URLs routinely exceed 512 characters because the download token alone is 36 characters and the path encoding adds more. **Slicing at 512 cuts off the `token=` parameter**, turning every Firebase Storage URL into a broken, unauthenticated 403 request. The `AvatarImage` silently fails and shows the fallback initial instead.

**Fix:** The 512-char limit was added to avoid hitting Firestore's 1 MB document limit. The correct solution is to **not store the photoURL in the cached leaderboard document at all** (or store only Google/GitHub URLs which are short). Instead, resolve photos at read time via `fetchUserProfiles`, or increase the limit to a safe value (e.g., 2048 chars) which covers all normal Firebase Storage URLs.

**Option A (recommended) — Don't store photoURLs in the cache doc; resolve at read time:**
```ts
// leaderboard-updater.ts — omit photoURL from the cached players array
return {
    id: doc.id,
    uid: doc.id,
    displayName: data.displayName || "Focus Hero",
    // photoURL intentionally omitted — resolved from users collection at read time
    totalMinutes: data.totalMinutes || 0,
    totalPomodoros: data.totalPomodoros || 0,
};
```
Then in `getLeaderboard`, always do a single batch fetch of photoURLs (not gated behind `cacheStale`) but do it **non-blocking** after returning the data — e.g., resolve them in the background and update the UI with a second state update.

**Option B (simpler short-term) — Raise the truncation limit:**
```ts
// leaderboard-updater.ts & db.ts fallback
const photoURL = rawPhoto && !rawPhoto.startsWith("data:")
    ? rawPhoto.slice(0, 2048)   // Firebase Storage URLs rarely exceed 1500 chars
    : null;
```
This alone will fix most broken profile pictures immediately with a one-line change. Make the same change in the `db.ts` fallback path.

---

### 2b. `fetchUserProfiles` uses a field query instead of document ID lookups

**File:** `lib/db.ts` — `fetchUserProfiles` (~L927)

**Root cause:** Profile hydration queries Firestore with `where("uid", "in", chunk)` — a field-value query. If any user document was created before the `uid` field was explicitly written (e.g., by an older version of `syncUserProfile`), that document is silently skipped and their profile (including photo) never resolves.

```ts
const q = query(usersRef, where("uid", "in", chunk));   // misses docs without uid field
```

**Fix:** Use direct document reads by ID, which are always correct and also cheaper (1 read per doc vs. a collection scan):

```ts
import { getDoc, doc } from "firebase/firestore";

// Replace the chunk query with individual getDoc calls (batched with Promise.all)
const docs = await Promise.all(chunk.map(uid => getDoc(doc(usersRef, uid))));
```

This guarantees every user document is found as long as it exists, regardless of whether a `uid` field is present.

---

### 2c. User profile cache TTL is only 2 minutes

**File:** `lib/db.ts` — `USER_PROFILE_CACHE_TTL` (~L648)

**Root cause:** The in-memory + sessionStorage profile cache expires every 2 minutes. Any leaderboard view longer than 2 minutes triggers a full re-fetch of all visible profiles. This isn't strictly a bug, but it contributes to unnecessary slowness and also interacts badly with Bug 1a (stale leaderboard triggers the photo overlay which triggers a cache miss every time).

**Fix:** Increase `USER_PROFILE_CACHE_TTL` to at least 10 minutes. Profile pictures and display names change infrequently; a 10-minute cache is appropriate.

```ts
const USER_PROFILE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
```

---

## Priority Order

| # | Bug | Impact | Effort | Fix |
|---|-----|--------|--------|-----|
| 1 | **2a** — photoURL truncation cuts Firebase Storage tokens | Photos broken for all Firebase Storage users | Very low (1–2 lines) | Raise slice limit to 2048 in `leaderboard-updater.ts` and `db.ts` |
| 2 | **1a** — blocking photo overlay on stale cache | Load time 3–10s longer on first visit after 5 min | Low | Remove the `if (cacheStale) fetchUserProfiles` block from `getLeaderboard` |
| 3 | **1b** — `searchParams` object in `useEffect` dep array | Spurious duplicate fetches on every render | Low | Depend on extracted string values, not the object |
| 4 | **2b** — `where("uid", "in")` misses legacy user docs | Missing photos for older accounts | Low | Switch to `getDoc(doc(usersRef, uid))` per UID |
| 5 | **1c** — `setPlayers([])` causes flash | Jarring UX on tab switch | Low | Only reset players when needed |
| 6 | **2c** — 2-minute profile cache TTL too short | Unnecessary re-fetches after cache expires | Trivial | Increase to 10 minutes |
| 7 | **1d** — auth loading gate adds a render cycle | Minor first-load delay | Trivial | Skip `setLoading(true)` until user confirmed |

---

## Files to Change

| File | Changes |
|------|---------|
| `lib/leaderboard-updater.ts` | Raise `slice(0, 512)` to `slice(0, 2048)` or remove photoURL from cache doc |
| `lib/db.ts` | Remove blocking `fetchUserProfiles` overlay in `getLeaderboard`; raise fallback `slice(0, 512)` to `slice(0, 2048)`; switch profile fetch to `getDoc` by UID; increase `USER_PROFILE_CACHE_TTL` to 10 min |
| `app/leaderboard/page.tsx` | Extract `searchParams` string values for `useEffect` deps; avoid `setPlayers([])` on cached tab switch |
