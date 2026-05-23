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

Create a `.env.local` file in the root directory and populate it with your credentials as defined in `.env.example`:

```env
# Firebase Client SDK Configuration (Public)
NEXT_PUBLIC_FIREBASE_API_KEY="your-firebase-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"

# Firebase Admin SDK Configuration (Server-Side)
# In local development, you can place 'service-account.json' in the root directory instead.
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"

# AI Task Generation Keys
GEMINI_API_KEY="your-gemini-api-key"
OPENROUTER_API_KEY="your-openrouter-api-key"
```

---

## 🏃 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
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

## 💖 Support the Project

If you find Dangdoro helpful and want to support its ongoing development, consider supporting the creator!

[![support](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/morales002)

Your support helps cover hosting costs, AI API usage, and future feature implementations.
