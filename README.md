# Dangdoro

Dangdoro is a collaborative focus timer and productivity application designed to help individuals and teams focus together in real-time. Built with a premium, immersive glassmorphic user interface, Dangdoro combines Pomodoro mechanics, synchronized group focus workspaces, ambient audio mix controls, and AI-powered task planning to create a high-engagement workspace.

---

## 🚀 Key Features

### 1. Collaborative & Real-Time Group Focus
*   **Synchronized Timer Sessions:** Join shared focus spaces where team member timers are synced, allowing teams to enter focus and rest blocks together.
*   **Zero-Write Group Sync:** Active group state is derived dynamically from individual heartbeats and active presence docs rather than writing state frequently to group documents, keeping Firestore writes optimized.
*   **Orbital Avatar Presence:** High-fidelity floating user avatars display the active status of participants in a given workspace, reflecting real-time engagement.
*   **Role-Based Access Controls (RBAC):** Group members are designated as `host`, `admin`, or `member`, providing operational control over configuration, invites, and member management.

### 2. Immersive Aesthetics & Tools
*   **Premium Glassmorphic Design:** Glowing neon outlines, dark-mode aesthetics, custom typography, dynamic themes (ambient gradients, solid colors, and interactive panels), and micro-animations.
*   **Local Audio Engine:** Built-in ambient sound mixer supporting custom blends of white noise, rain, lofi tracks, and focus soundscapes.
*   **Picture-in-Picture (PiP) Widget:** A floating overlay widget to track focus timers and tasks while working in other applications.

### 3. Task Management & AI Generation
*   **Task Hub:** Personal and collaborative task boards with priority labeling (Urgent, High, Normal, Natural), expandable notes, and status toggles.
*   **AI Task Generator:** Leverage AI (OpenRouter and Google Gemini SDK fallback) to suggest task breakdowns based on user focus goals.
*   **Built-in Safety:** Server-side rate limiting (10 requests per 60 seconds) and authorization token verification for all AI generation calls.

### 4. Social Integration & Analytics
*   **Symmetric Friendship System:** Send, accept, or decline friend requests, view active friend presence, and compare stats.
*   **Analytics & Leaderboards:** Weekly/monthly focus dashboards, session histories, and global/friend leaderboards.

---

## 🛠️ Tech Stack

*   **Frontend Framework:** Next.js (App Router, Turbopack) & React 19
*   **Styling:** Tailwind CSS & PostCSS
*   **State Management:** Zustand (custom modular stores)
*   **Animations:** Framer Motion, Lottie Files (`dotlottie-react`)
*   **Backend & Database:** Firebase (Authentication, Firestore, Firebase Admin SDK)
*   **Testing:** Vitest
*   **AI APIs:** OpenRouter API / Google Generative AI (Gemini SDK)

---

## 🗄️ Database Architecture (Firestore)

Dangdoro implements a highly secured Firestore database structure with the following collections:

| Collection | Path | Description | Access Rules |
| :--- | :--- | :--- | :--- |
| **Users** | `/users/{userId}` | Core user profiles and preferences. | Read: Any auth. Write: Profile owner. |
| **Friends** | `/users/{userId}/friends/{friendId}` | Symmetric friendship documents. | Read: User owner. Write: Either party. |
| **Sessions** | `/sessions/{sessionId}` | Logged history of completed Pomodoro focus blocks. | Read: Any auth. Write: User owner (immutable). |
| **Tasks** | `/tasks/{taskId}` | Personal task records. | Read/Write: Task owner only. |
| **Task Groups** | `/taskGroups/{groupId}` | Custom folders/categories for personal tasks. | Read/Write: Group owner only. |
| **Focus Groups** | `/focusGroups/{groupId}` | Collaborative rooms. Includes shared tasks subcollection. | Read: Members/public. Write: Host (all) / Members (stats/joins). |
| **Live Sessions** | `/liveSessions/{sessionId}` | Real-time user heartbeat and active timer status. | Read: Any auth. Write: Session owner. |
| **Friend Requests** | `/friendRequests/{requestId}` | Incoming and outgoing friendship requests. | Read/Write: Sender & Receiver. |
| **Notifications** | `/notifications/{notifId}` | In-app alerts (invites, updates, systems). | Read/Write: Recipient only. |

---

## ⚙️ Environment Variables Setup

Create a `.env.local` file in the root directory of the project and populate it with your credentials:

```bash
cp .env.example .env.local
```

Refer directly to `.env.example` for the list of required variables, default values, and setup instructions.

---

## 🏃 Getting Started

### Prerequisites
To run the project locally using the recommended emulator setup, make sure you have:
1. **Java Development Kit (JDK 11+)** installed (required to run the Firebase Emulators).
2. **Firebase CLI** installed globally:
   ```bash
   npm install -g firebase-tools
   ```

### 1. Initial Setup
1. Clone the repository and navigate into it.
2. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```
   *(Note: The Firebase client credentials in `.env.local` can remain as their placeholder values when using the emulator).*
3. Install the project dependencies:
   ```bash
   npm install
   ```

### 2. Run with Local Firebase Emulators (Recommended)
This runs the application locally using the Firebase Local Emulator Suite. You do not need real Firebase credentials to run the app in this mode.

1. Set `NEXT_PUBLIC_USE_FIREBASE_EMULATOR="true"` in your `.env.local` file.
2. Run the emulator dev server:
   ```bash
   npm run dev:emulator
   ```
* **App URL:** [http://localhost:3000](http://localhost:3000)
* **Firebase Emulator UI:** [http://localhost:4000](http://localhost:4000) (allows inspecting local Firestore, mock Auth users, and Storage).

*Note: The emulator automatically saves your local database state to `./.firebase-emulator-data/` on shutdown (Ctrl+C) and restores it when starting again.*

### 3. Seed Mock Data in Emulator (Optional)
To instantly populate the local database with 4 mock users, weekly focus sessions, tasks, and a focus group (useful for testing leaderboards and pages with content):
1. Ensure the emulator dev server is running (`npm run dev:emulator`).
2. Run the seeding script in a new terminal window:
   ```bash
   npm run seed:emulator
   ```

### 4. Run against Live Cloud Database
This connects the app to the live Cloud Firebase project defined in your `.env.local` credentials.

1. Set `NEXT_PUBLIC_USE_FIREBASE_EMULATOR="false"` (or leave it unset/empty) in `.env.local`.
2. Run the standard Next.js dev server:
   ```bash
   npm run dev
   ```
Open [http://localhost:3000](http://localhost:3000) to view the application.

### 3. Build for Production
```bash
npm run build
npm run start
```

### 4. Running Tests
Dangdoro uses Vitest for testing:
```bash
npm run test
```

### 5. Code Linting
```bash
npm run lint
```

---

## 👥 Meet the Team

| Developer | GitHub | LinkedIn |
| :--- | :--- | :--- |
| <img src="https://avatars.githubusercontent.com/u/114666874?v=4" width="30" height="30" style="border-radius: 50%; vertical-align: middle; margin-right: 8px;" /> **Mohamed Elzalook** | [@Morales020](http://github.com/Morales020) | [Mohamed Elzalook](http://www.linkedin.com/in/mohamed-elzalook/) |
| <img src="https://avatars.githubusercontent.com/u/143705285?v=4" width="30" height="30" style="border-radius: 50%; vertical-align: middle; margin-right: 8px;" /> **Tamim Abdrabou** | [@TamemAbdRab0u](https://github.com/TamemAbdRab0u) | [Tamim Abdrabou](https://www.linkedin.com/in/tamem-abdrabou-34ab14357/) |
| <img src="https://avatars.githubusercontent.com/u/121311553?v=4" width="30" height="30" style="border-radius: 50%; vertical-align: middle; margin-right: 8px;" /> **Hossam Fathy** | [@finitemist](https://github.com/finitemist) | [Hossam Fathy](https://www.linkedin.com/in/hossam-fathy-bb1039259/) |

---

## 💖 Support the Project

If you find Dangdoro helpful and want to support its ongoing development, consider supporting the creator!

[![support](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/morales002)

Your support helps cover hosting costs, AI API usage, and future feature implementations.
