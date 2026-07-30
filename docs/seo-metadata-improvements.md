# SEO, Metadata & Open Graph Refactoring Documentation

This document provides a detailed breakdown of the search engine optimization (SEO), metadata, and Open Graph (OG) changes implemented in the codebase. These changes improve indexability, unify URL routing, enhance branding on shared cards, and add rich snippet structured data.

---

## 📋 Architectural Overview

To follow Next.js App Router conventions and maximize index quality, we refactored public-facing views and search configuration files. 

Key changes include:
1. **Separation of Page Concerns (Server vs. Client)**:
   - Next.js App Router forbids exporting `metadata` from `"use client"` components.
   - We split public-facing routes (`/`, `/leaderboard`, `/groups`) into a server page wrapper (`page.tsx`) that handles static/dynamic metadata generation and a client page implementation (`page.client.tsx`) that maintains full state sync and interactive user interfaces.
2. **Canonical Domain Unification**:
   - Unified the project domain to **`https://www.dangdoro.com`** across `sitemap.ts`, `robots.ts`, `metadata.ts`, and manifest metadata to avoid split-ranking issues.
3. **Structured JSON-LD Schema Data**:
   - Injected Schema.org microdata into the application root layout to provide Google and other crawlers with explicit rich-snippet descriptors for a `WebApplication`.

---

## 🛠️ File-by-File Breakdown of Changes

### 1. Unified Configuration Files

#### 📂 [app/metadata.ts](../app/metadata.ts) [NEW]
Houses global Next.js `Metadata` parameters. It specifies:
- Title formats, descriptions, and keywords.
- Alternates mapping for canonical paths.
- Open Graph parameters (`siteName`, `locale`, `type: "website"`).
- Robots crawlers properties (`index: true`, `follow: true`, specific Googlebot settings).
- Twitter large image card details.

#### 📂 [app/manifest.ts](../app/manifest.ts) [NEW]
Standard Web App manifest returned via Next.js metadata route:
- Sets display format to `standalone`.
- Defines matching application icons (`32x32` and `180x180`).
- Declares the app theme color (`#ef4444` / Pomodoro Red) and background color (`#09090b` / Zinc-950).

#### 📂 [app/robots.ts](../app/robots.ts) [MODIFY]
Revised rules structure:
- Directs search engines to `https://www.dangdoro.com/sitemap.xml`.
- Standardises crawler rules to block indexing of secure/dynamic dashboard routes (`/api/`, `/settings`, `/profile`, `/friends`, `/tasks`) while leaving main entry pages fully indexable.

#### 📂 [app/sitemap.ts](../app/sitemap.ts) [MODIFY]
- Standardised `baseUrl` to `https://www.dangdoro.com`.
- Maps priorities (`1.0` for landing page, `0.8` for daily ranking pages like leaderboard/groups, `0.5` for monthly auth views).

#### 📂 [app/layout.tsx](../app/layout.tsx) [MODIFY]
- Imports and re-exports metadata from `metadata.ts`.
- Injects a JSON-LD structured script tag mapping details about Dangdoro (e.g. productivity tools, collaborative timer, leaderboard support) to improve crawler classification.

---

### 2. Page Structure Isolation (Server-Client Splits)

To allow page-level SEO attributes without breaking the client-side Firebase hook bindings and local stores:

#### 🔗 Landing Route (`/`)
- **[page.tsx](../app/page.tsx)**: Now a Server component that imports and mounts the client bundle.
- **[page.client.tsx](../app/page.client.tsx)**: House for the original landing page code, managing focus timelines, notifications, and floating avatars.

#### 🔗 Leaderboard Route (`/leaderboard`)
- **[leaderboard/page.tsx](../app/leaderboard/page.tsx)**: Server component declaring page-specific metadata (`Leaderboard | Dangdoro`) and returning the leaderboard client page.
- **[leaderboard/page.client.tsx](../app/leaderboard/page.client.tsx)**: Handles rank state indexing, tab views, and Firestore queries.

#### 🔗 Groups Route (`/groups`)
- **[groups/page.tsx](../app/groups/page.tsx)**: Server component declaring page-specific metadata (`Groups | Dangdoro`) and returning the groups client page.
- **[groups/page.client.tsx](../app/groups/page.client.tsx)**: Holds listeners for active groups, invite code generation, and team presence statuses.

---

### 3. Dynamic Open Graph Image Canvas

#### 📂 [app/opengraph-image.tsx](../app/opengraph-image.tsx) [NEW]
Generates the image that displays on social shares (Twitter/Discord/Slack/Facebook). To ensure a premium aesthetic specific to Dangdoro:
- **Font Assets**: Relies on Montserrat-Bold, loaded locally via [app/fonts/Montserrat-Bold.ttf](../app/fonts).
- **Theme Color Palette**: Deep black background (`#09090b` / Zinc-950) with crimson radial focus glows, gold leaderboard accents, and sky-blue tags.
- **Design Elements**:
  - **Left Side**: App name (`Dangdoro`) with clean typographic spacing, feature tags, and a decorative "Pomodoro Engine" badge.
  - **Right Side**: Renders a mock of the actual web interface:
    - A glassmorphic Pomodoro Card displaying the standard focus time `25:00` and progress tracking bars.
    - A "Synced Workspace" bar featuring overlapping avatars representing collaborative users actively working in real-time.

---

## 🔍 Validation Results
- Executed local compilation checks (`npm run build`).
- Build checks completed successfully, generating dynamic Edge routes for `/opengraph-image` alongside static-prerendered HTML for all public index pages.
