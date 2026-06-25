# 📱 Mobile & Tablet Responsiveness Plan

> **Scope:** Full audit of every page and component in the Dangdoro app for mobile (≤ 767px) and tablet (768px–1023px) breakpoints.
> **Goal:** Identify every responsiveness issue and provide a concrete, actionable fix for each one.

---

## Table of Contents

1. [Critical Issues](#-critical-issues)
2. [High-Priority Issues](#-high-priority-issues)
3. [Medium-Priority Issues](#-medium-priority-issues)
4. [Low-Priority Issues](#-low-priority-issues)
5. [Summary Fix Table](#-summary-fix-table)

---

## 🔴 Critical Issues

These break core functionality on touch/mobile devices or entirely block access to a page.

---

### 1. Tasks Page — Intentional "Desktop Only" Gate Blocks All Tablets

**File:** `app/tasks/page.tsx`

**Issue:**
The page renders a "Desktop Only" wall when `window.innerWidth < 1024px`. This blocks:
- All phones (< 768px) — expected, but a list view would be far better than a dead end.
- All iPads in **portrait mode** (768px) — unacceptable for a flagship feature.
- iPads in **landscape mode** at exactly 1024px sit right at the threshold boundary.

The entire task board uses `position: absolute` with pixel-level `positionX/positionY` canvas-style drag — there is zero mobile layout alternative.

**Solution:**
- **Short-term:** Lower the desktop-only threshold from `< 1024px` to `< 768px` so iPads in landscape and portrait are no longer blocked.
- **Long-term:** Build a responsive list/column view for `< 1024px` — a simple vertical list grouped by status (Todo / In Progress / Done) with swipe-to-reorder. The drag canvas can remain for `>= 1024px`.

---

### 2. Profile Page — Avatar Photo Update is Invisible on Touch Devices

**File:** `app/profile/page.tsx`

**Issue:**
The avatar update overlay uses `opacity-0 hover:opacity-100`. On touch screens, `hover` never fires, making the overlay — and the `<input type="file">` inside it — permanently invisible and unreachable. Mobile users can never change their profile picture.

**Solution:**
- Add a persistent, always-visible edit icon button on mobile:
  ```tsx
  <div className="relative group">
    <Avatar ... />
    {/* Always visible on touch, hover-only on desktop */}
    <button className="absolute bottom-0 right-0 p-1.5 rounded-full bg-zinc-800 border border-white/10
                       opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
      <Camera className="w-3.5 h-3.5" />
    </button>
  </div>
  ```
- Or use `@media (hover: none)` in CSS to always show the overlay on touch devices.

---

### 3. Friends Page — "Remove Friend" Button is Invisible on Touch Devices

**File:** `app/friends/page.tsx`

**Issue:**
The "Remove Friend" button uses `opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0`. On touch devices there is no hover state, so the button is permanently hidden and cannot be triggered.

**Solution:**
- Show a meatball menu (`⋯`) icon always-visible on the card's top-right corner on touch devices.
- Or reveal the button on tap (toggle a `data-touched` state on `onPointerDown`).
- Minimum fix:
  ```tsx
  <button className="opacity-0 group-hover:opacity-100
                     [@media(hover:none)]:opacity-100
                     translate-y-1 group-hover:translate-y-0
                     [@media(hover:none)]:translate-y-0
                     transition-all">
    Remove
  </button>
  ```

---

### 4. NavigationHub — Nav Visibility is Mouse-Only (Broken on Touch)

**File:** `components/navigation-hub.tsx`

**Issue:**
The auto-hide/reveal logic for the bottom navigation is driven entirely by `mousemove` and `onMouseEnter`/`onMouseLeave`. On touch devices:
- `mousemove` never fires, so the nav will never re-appear after auto-hiding.
- The invisible hit-area div (`onMouseEnter={handleNavMouseEnter}`) has no touch equivalent.
- In focus mode, the nav disappears and there is no way to get it back on a phone.

**Solution:**
- Add a `touchstart` listener alongside `mousemove`:
  ```ts
  window.addEventListener("touchstart", handleMouseMove, { passive: true });
  ```
- Add `onTouchStart={handleNavMouseEnter}` to the nav wrapper div.
- On touch devices, consider always keeping `isNavVisible = true` unless focus mode is explicitly toggled off.

---

## 🟠 High-Priority Issues

These cause noticeable breakage or usability problems on mobile/tablet.

---

### 5. Home Page — GroupFocusSelector Hidden in Focus Mode on Touch

**File:** `app/page.tsx`

**Issue:**
`shouldShowTopLeft` is computed from a `mousemove` event. In focus mode on a touch device, `shouldShowTopLeft` is always `false` and the `GroupFocusSelector` becomes permanently hidden — unreachable without a mouse.

**Solution:**
- Track the last interaction type (`mouse` vs `touch`).
- On touch devices, keep `shouldShowTopLeft = true` at all times, or show the selector via a floating tap button.

---

### 6. Header — No Mobile Navigation, Hard-Coded Horizontal Padding

**File:** `components/header.tsx`

**Issue:**
- The `nav` links are `hidden lg:flex` with no mobile-accessible fallback in the header itself (the bottom `Navigation` component compensates, but users don't know it).
- `px-12` (48px each side) is very tight on small phones (≤ 375px) — leaves only ~279px for content on a 375px screen.
- The username/status block is `hidden md:flex` — fine, but the remaining header items (Heart, Notifications, Avatar) can feel cramped without enough horizontal room.

**Solution:**
- Change `px-12` to `px-4 sm:px-6 md:px-12` to give phones breathing room.
- The bottom nav adequately handles navigation, so no hamburger is strictly needed, but consider adding a visual hint on first visit for discoverability.

---

### 7. FloatingFocusAvatars — Fixed Orbit Radii Overflow Viewport

**File:** `components/floating-focus-avatars.tsx`

**Issue:**
`ORBIT_RX = 340` and `ORBIT_RY = 180` are hard-coded pixel values. On a phone with a 375px-wide viewport, avatars orbiting at ±340px horizontally will render ~305px off-screen on each side.

**Solution:**
- Make orbit dimensions viewport-relative:
  ```ts
  const ORBIT_RX = Math.min(340, window.innerWidth * 0.44);
  const ORBIT_RY = Math.min(180, window.innerHeight * 0.22);
  ```
- Re-compute these values on `resize` using the existing `useEffect` resize observer.

---

### 8. TimerCard Settings Popup — Can Overflow Viewport Top on Mobile

**File:** `components/timer-card.tsx`

**Issue:**
The settings popup uses `absolute right-0 bottom-full mb-4` — it pops upward. On a phone with no scroll, a tall popup (no `max-height`, no scroll) can extend above the visible viewport with no way to reach the clipped content.

On `lg+` it switches to `lg:left-full lg:right-auto lg:ml-32`, which is fine for desktop.

**Solution:**
- Add `max-h-[70vh] overflow-y-auto` to the settings popup container.
- On small screens, consider rendering it as a bottom-sheet (`fixed bottom-0 left-0 right-0 rounded-t-2xl`) instead of an upward popup.

---

### 9. Group Session Mini-Bar — Fixed Width, No Responsive Sizing

**File:** `components/group-session-mini-bar.tsx`

**Issue:**
Hard-coded `w-[260px]` with `fixed right-5 bottom-24`. On a 320px phone, this leaves only 55px of space on the left side. It overlaps the center timer and the floating-notes-trigger dock.

**Solution:**
- Change to `w-[calc(100vw-2.5rem)] max-w-[260px]` or use `w-[90vw] sm:w-[260px]`.
- Anchor it differently on mobile — e.g. `bottom-0 left-0 right-0` as a full-width bottom bar on phones only.

---

### 10. Profile Page — Heatmap Overflows on Narrow Screens

**File:** `app/profile/page.tsx`

**Issue:**
The heatmap uses `grid-flow-col` with ~20 columns. On mobile the cells are `w-[8px] h-[8px]` but there's no horizontal scroll affordance — the grid just compresses and the cells become illegible. On very narrow phones the grid may overflow the container.

**Solution:**
- Wrap the heatmap in `overflow-x-auto` so users can scroll horizontally.
- Add `min-w-max` to the inner grid to prevent compression.
- Consider reducing columns shown on mobile (e.g. last 8 weeks instead of all 20).

---

### 11. Profile Page — Non-Standard `xs:` Breakpoint Silently Ignored

**File:** `app/profile/page.tsx`

**Issue:**
`xs:max-w-[320px]` is used in the streak calendar section. `xs` is not a built-in Tailwind breakpoint. Unless it's configured in `tailwind.config`, this class is silently ignored and the intended sizing at ~320px screens never activates.

**Solution:**
- Check `tailwind.config.ts` for a custom `xs` breakpoint. If missing, add it:
  ```ts
  // tailwind.config.ts
  theme: {
    extend: {
      screens: {
        xs: "375px",
      },
    },
  }
  ```
- Or replace `xs:max-w-[320px]` with `max-w-[320px]` / `sm:max-w-[360px]` using standard breakpoints.

---

### 12. Settings Page — Custom Color Dropdown Can Clip Off-Screen

**File:** `app/settings/page.tsx`

**Issue:**
The custom color dropdown uses `absolute top-[calc(100%+8px)] left-0 w-72` (288px). If the trigger button is positioned in the right half of the viewport on a 360px phone, the dropdown's right edge extends ~72px off-screen.

**Solution:**
- Detect if there's enough right-side space. Use `right-0` when the button is near the right edge:
  ```tsx
  <div className="absolute top-[calc(100%+8px)] left-0 w-72 
                  max-w-[calc(100vw-1rem)]
                  sm:left-0">
  ```
- Or use a library like Floating UI / Radix Popper that auto-flips and clips to the viewport.

---

### 13. Leaderboard — Podium Cards Lose Visual Hierarchy on Mobile

**File:** `app/leaderboard/page.tsx`

**Issue:**
Gold/1st place moves to center via `order-1 md:order-2` (re-order only on `md+`). On mobile the podium renders top-to-bottom as 1st → 2nd → 3rd — a flat list with no visual podium step effect. The scale/height difference (`scale-[0.9] sm:scale-95`) also doesn't create the stepped hierarchy on mobile.

**Solution:**
- On mobile, use a horizontal flex layout with center-elevated gold card:
  ```tsx
  // Mobile: show 2nd | 1st | 3rd side by side with 1st elevated
  <div className="flex items-end justify-center gap-3 md:hidden">
    {/* 2nd place - shorter */}
    {/* 1st place - tallest, centered */}
    {/* 3rd place - shortest */}
  </div>
  {/* Desktop: existing order-based flex layout */}
  <div className="hidden md:flex ...">...</div>
  ```

---

### 14. FocusZoneCeremony — Icon Row Gap Overflows Small Screens

**File:** `components/FocusZoneCeremony.tsx`

**Issue:**
`flex items-center justify-center gap-8` with 3 icon badges each `w-12` requires at minimum ~132px + padding. On phones ≤ 320px (e.g. iPhone SE 1st gen) this overflows. No wrapping fallback exists.

**Solution:**
- Scale down the gap on small screens: `gap-4 sm:gap-8`
- Or allow wrapping: `flex flex-wrap justify-center gap-4`
- Scale down icon size: `w-10 h-10 sm:w-12 sm:h-12`

---

### 15. Notifications Menu — 480px Panel on Mobile, `top-22` Non-Standard Value

**File:** `components/notifications-menu.tsx`

**Issue:**
- The notification popover is `w-[480px] max-w-[calc(100vw-16px)]` on mobile — only 8px of margin on each side on a 375px screen.
- `top-22` is a non-standard Tailwind value — unless `22` is configured in the spacing scale, this compiles to nothing and the panel may overlap the header.
- No `safe-area-inset` consideration for notched phones.

**Solution:**
- Use a proper bottom-sheet pattern on mobile:
  ```tsx
  // Mobile: bottom sheet
  className="fixed bottom-0 left-0 right-0 w-full rounded-t-2xl
             sm:fixed sm:top-[88px] sm:right-8 sm:w-80 sm:rounded-[15px]"
  ```
- Replace `top-22` with `top-[88px]` (matching the 80px header + 8px gap).
- Add `pb-[env(safe-area-inset-bottom)]` for notched phones.

---

### 16. Notifications Dock — Same `top-22` Issue + Tight Mobile Margin

**File:** `components/notifications-dock.tsx`

**Issue:**
- Same `top-22` non-standard Tailwind value as the notifications menu.
- The feedback form card is `w-[480px] max-w-[calc(100vw-16px)]` — identical 8px-margin problem on narrow phones.

**Solution:**
- Replace `top-22` with `top-[88px]` consistently across both components.
- For the feedback form on mobile, use `w-[calc(100vw-2rem)]` (16px per side) or render it as a full-screen modal on `< sm`.

---

## 🟡 Low-Priority Issues

These are minor polish issues, edge cases, or things that technically work but could be improved.

---

### 17. Navigation.tsx — SSR Hydration Flash from `window.innerWidth`

**File:** `components/navigation.tsx`

**Issue:**
`isMobileOrTablet` and `isMobileView` are set via `window.innerWidth` in a `useEffect`. On the server they default to `false`, causing a brief layout flash/mismatch after hydration on mobile (the wrong nav items render for a frame).

**Solution:**
- Initialize state with `null` and render nothing (or a skeleton) until hydration completes:
  ```tsx
  const [isMobileOrTablet, setIsMobileOrTablet] = useState<boolean | null>(null);
  if (isMobileOrTablet === null) return null; // or a skeleton
  ```
- Or use a CSS-only approach with Tailwind breakpoints instead of JS to filter nav items.

---

### 18. QuickTasksPanel / NotesPanel — Fixed Height Can Overflow Short Viewports

**Files:** `components/quick-tasks-panel.tsx`, `components/notes-panel.tsx`

**Issue:**
Both panels use a fixed `h-[530px]`. On short-viewport phones (e.g. iPhone SE landscape: 375px tall) the panel overflows the screen. The `bottom-40 sm:bottom-28` offset makes this worse.

**Solution:**
- Change to `h-[min(530px,_calc(100dvh-10rem))]` to cap height relative to the dynamic viewport height.
- Use `dvh` (dynamic viewport height) units to account for the mobile browser toolbar.

---

### 19. SoundPanel — Can Extend Above Viewport on Short Screens

**File:** `components/sound-panel.tsx`

**Issue:**
`absolute bottom-full mb-3` pops the panel upward. Combined with `max-h-[340px]` and the nav's bottom offset, on short phones (landscape) the panel top edge can exceed the viewport top.

**Solution:**
- Add `max-h-[min(340px,_calc(100dvh-12rem))]` to limit height on short screens.
- Or switch to a `fixed` bottom-sheet on mobile instead of an upward popup.

---

### 20. Floating Feedback & Notifications Dock — Potential Z-Index Collision

**Files:** `components/floating-feedback.tsx`, `components/notifications-dock.tsx`

**Issue:**
Both components position their trigger buttons at `fixed top-8 right-4/right-2` — they render in the same screen zone and may visually overlap or fight for touch targets on mobile.

**Solution:**
- Consolidate the feedback trigger into the `NotificationsDock` or `NotificationsMenu` as a secondary action (e.g. a "Feedback" item in the notifications panel).
- This eliminates the duplicate top-right floating element entirely.

---

### 21. Profile Page — Theme Picker Stacks Awkwardly on Tablets

**File:** `app/profile/page.tsx`

**Issue:**
`lg:absolute lg:right-full lg:mr-8` positions the theme picker to the left of the avatar on `lg+`. Below `lg` (tablets), it renders inline above the avatar in the flex column, creating a very tall stacked layout.

**Solution:**
- On tablet, float the theme picker to the right of the avatar row using `md:absolute md:right-full md:mr-4` instead of requiring `lg`.
- Or hide it inside a `<details>` / disclosure button on screens below `lg`.

---

### 22. Profile Page — Fixed-Width Action Button on Narrow Screens

**File:** `app/profile/page.tsx`

**Issue:**
The Add Friend / Pending / Accept button container is `w-32 md:w-40`. On narrow screens with longer button labels (e.g. "Accept" + "Decline" side by side), this can clip text.

**Solution:**
- Use `min-w-[8rem] w-auto md:w-40` to let the button grow as needed on mobile.

---

### 23. FloatingNotesTrigger — Overlaps Group Session Mini-Bar

**File:** `components/floating-notes-trigger.tsx`

**Issue:**
`fixed left-5 bottom-24` positions the dock over the same zone as the `GroupSessionMiniBar` (`fixed right-5 bottom-24`). On small screens these two fixed elements converge and create a cluttered corner.

**Solution:**
- When `GroupSessionMiniBar` is active, shift the notes trigger upward: `bottom-24 group-active:bottom-40` or dynamically reposition using a shared layout store value.

---

### 24. Sidebar — Renders on `md+` but May Conflict with Bottom Nav

**File:** `components/sidebar.tsx`

**Issue:**
`hidden md:flex` means the sidebar appears on tablets (768px+). However, on tablets the bottom `Navigation` is also visible (it hides the Tasks link). Having both a left sidebar and a bottom nav on a tablet wastes vertical space and may confuse the navigation hierarchy.

**Solution:**
- Review whether the sidebar is actually used anywhere (it contains links to `/tasks/new`, `/goals`, `/zen` which may not exist). If unused, remove it.
- If kept, ensure sidebar links are consistent with the bottom nav — avoid duplicating links.

---

### 25. globals.css — Scrollbar Hidden Globally

**File:** `app/globals.css`

**Issue:**
`scrollbar-width: none` applied globally to `html` removes all scrollbars. On mobile this is fine cosmetically, but hides scroll affordance for overflow content (e.g. the heatmap, sound panel, task lists). Users may not discover that content is scrollable.

**Solution:**
- Keep `scrollbar-width: none` globally for aesthetics.
- Add `overflow-x: auto; -webkit-overflow-scrolling: touch;` to specific scrollable containers so they still scroll naturally on touch even without a visible scrollbar.
- For content that benefits from scroll indication, use a gradient fade mask at the edge instead of a scrollbar.

---

## 📊 Summary Fix Table

| # | File / Component | Issue | Priority | Fix Type |
|---|---|---|---|---|
| 1 | `app/tasks/page.tsx` | `< 1024px` blocks all iPads | 🔴 Critical | Lower threshold + build list view |
| 2 | `app/profile/page.tsx` | Avatar upload invisible on touch | 🔴 Critical | Always-visible edit button on mobile |
| 3 | `app/friends/page.tsx` | Remove Friend button inaccessible on touch | 🔴 Critical | `@media (hover:none)` always-visible |
| 4 | `components/navigation-hub.tsx` | Nav hide/show is mouse-only | 🔴 Critical | Add `touchstart` listener |
| 5 | `app/page.tsx` | GroupFocusSelector hidden on touch in focus mode | 🟠 High | Touch-aware show logic |
| 6 | `components/header.tsx` | `px-12` too tight on phones | 🟠 High | `px-4 sm:px-6 md:px-12` |
| 7 | `components/floating-focus-avatars.tsx` | Orbit radii off-screen on phones | 🟠 High | Viewport-relative orbit values |
| 8 | `components/timer-card.tsx` | Settings popup can overflow viewport top | 🟠 High | `max-h-[70vh] overflow-y-auto` or bottom sheet |
| 9 | `components/group-session-mini-bar.tsx` | Fixed `w-[260px]` overlaps center on narrow screens | 🟠 High | `w-[90vw] sm:w-[260px]` |
| 10 | `app/profile/page.tsx` | Heatmap 20-col grid not scrollable | 🟠 High | `overflow-x-auto` + `min-w-max` |
| 11 | `app/profile/page.tsx` | `xs:` is non-standard breakpoint | 🟠 High | Add `xs` to Tailwind config or use `sm:` |
| 12 | `app/settings/page.tsx` | Color dropdown clips viewport edge | 🟠 High | `max-w-[calc(100vw-1rem)]` + right-anchor |
| 13 | `app/leaderboard/page.tsx` | Podium loses hierarchy on mobile | 🟠 High | Mobile horizontal flex with center-elevated gold |
| 14 | `components/FocusZoneCeremony.tsx` | Icon row overflows on ≤ 320px | 🟠 High | `gap-4 sm:gap-8`, smaller icons on mobile |
| 15 | `components/notifications-menu.tsx` | 480px panel + `top-22` non-standard | 🟠 High | Bottom sheet on mobile + `top-[88px]` |
| 16 | `components/notifications-dock.tsx` | Same issues as notifications-menu | 🟠 High | Same fixes |
| 17 | `components/navigation.tsx` | SSR hydration flash from `window.innerWidth` | 🟡 Low | Init state as `null`, render skeleton |
| 18 | `components/quick-tasks-panel.tsx` / `notes-panel.tsx` | Fixed `h-[530px]` overflows short viewports | 🟡 Low | `h-[min(530px,_calc(100dvh-10rem))]` |
| 19 | `components/sound-panel.tsx` | Upward popup can exceed viewport on short screens | 🟡 Low | `max-h-[min(340px,_calc(100dvh-12rem))]` |
| 20 | `components/floating-feedback.tsx` + `notifications-dock.tsx` | Z-index collision in top-right corner | 🟡 Low | Consolidate feedback into notifications panel |
| 21 | `app/profile/page.tsx` | Theme picker stacks awkwardly on tablets | 🟡 Low | `md:absolute md:right-full` |
| 22 | `app/profile/page.tsx` | Fixed action button clips long labels | 🟡 Low | `min-w-[8rem] w-auto` |
| 23 | `components/floating-notes-trigger.tsx` | Overlaps group-session-mini-bar zone | 🟡 Low | Conditional repositioning |
| 24 | `components/sidebar.tsx` | Sidebar + bottom nav may conflict on tablets | 🟡 Low | Audit usage, possibly remove |
| 25 | `app/globals.css` | Global scrollbar hidden, no scroll affordance | 🟡 Low | Gradient fade masks on overflow containers |

---

## Suggested Fix Order

```
Phase 1 — Unblock features (Critical):
  → Fix tasks gate threshold (#1)
  → Fix avatar upload on touch (#2)
  → Fix remove friend on touch (#3)
  → Fix nav hide/show on touch (#4)

Phase 2 — Core usability (High):
  → Fix header padding (#6)
  → Fix orbit radii (#7)
  → Fix notifications bottom sheet (#15, #16)
  → Fix timer settings popup overflow (#8)
  → Fix focus selector on touch (#5)
  → Fix heatmap scroll (#10)
  → Fix xs breakpoint (#11)

Phase 3 — Polish (High → Low):
  → Fix color dropdown clip (#12)
  → Fix leaderboard podium mobile layout (#13)
  → Fix FocusZoneCeremony icon gap (#14)
  → Fix group-session-mini-bar width (#9)
  → Fix quick-tasks / notes height (#18)
  → Fix sound panel height (#19)
  → Fix orbit avatars (#7)
  → Fix floating button collisions (#20, #23)
  → Fix sidebar tablet conflict (#24)
  → Fix SSR hydration flash (#17)
  → Remaining profile page polish (#21, #22)
  → Scroll affordance (#25)
```
