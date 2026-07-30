import * as admin from 'firebase-admin';

// Force connection to local emulators
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const PROJECT_ID = "demo-dangdoro";

console.log("🌱 Initializing Seeding against Local Firebase Emulators...");

admin.initializeApp({
    projectId: PROJECT_ID
});

const db = admin.firestore();
const auth = admin.auth();

const MOCK_USERS = [
    {
        uid: "user-1-admin",
        email: "admin@dangdoro.com",
        displayName: "Admin Hero",
        photoURL: "https://api.dicebear.com/7.x/pixel-art/svg?seed=admin",
        bio: "System Administrator & Focus Enthusiast",
        totalMinutes: 420,
        totalPomodoros: 16,
    },
    {
        uid: "user-2-tamim",
        email: "tamim@dangdoro.com",
        displayName: "Tamim Focus",
        photoURL: "https://api.dicebear.com/7.x/pixel-art/svg?seed=tamim",
        bio: "Developing clean layouts and interfaces.",
        totalMinutes: 310,
        totalPomodoros: 12,
    },
    {
        uid: "user-3-elzalook",
        email: "elzalook@dangdoro.com",
        displayName: "Morales Code",
        photoURL: "https://api.dicebear.com/7.x/pixel-art/svg?seed=morales",
        bio: "Antigravity coder. Builder of Dangdoro.",
        totalMinutes: 580,
        totalPomodoros: 22,
    },
    {
        uid: "user-4-fathy",
        email: "fathy@dangdoro.com",
        displayName: "Finite Mist",
        photoURL: "https://api.dicebear.com/7.x/pixel-art/svg?seed=fathy",
        bio: "Optimizing state stores and Firestore reads.",
        totalMinutes: 240,
        totalPomodoros: 9,
    }
];

const MOCK_TASKS = [
    { userId: "user-3-elzalook", title: "Implement Local Firestore Emulator", completed: true, priority: "high", notes: "Set up client, server SDKs, package.json scripts and README." },
    { userId: "user-3-elzalook", title: "Review pull requests", completed: false, priority: "normal", notes: "Check the new telemetry charts branch." },
    { userId: "user-2-tamim", title: "Improve responsiveness of profile page", completed: true, priority: "high", notes: "Fix desktop layouts for narrow screens." },
    { userId: "user-2-tamim", title: "Design settings panel toggles", completed: false, priority: "normal", notes: "Mock it up using modern glassmorphic look." },
    { userId: "user-4-fathy", title: "Audit Firestore read/write patterns", completed: true, priority: "high", notes: "Analyze leaderboard batch writes." },
    { userId: "user-4-fathy", title: "Clean up guest profiles script testing", completed: false, priority: "low", notes: "Run the cleanup script manually against the emulator." }
];

async function seed() {
    try {
        console.log("🔑 Seeding Auth Users...");
        for (const user of MOCK_USERS) {
            try {
                // Delete user if they already exist in Auth emulator to start fresh
                try {
                    await auth.deleteUser(user.uid);
                } catch {}

                await auth.createUser({
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    password: "password123", // standard testing password
                    emailVerified: true
                });
                console.log(`✅ Auth created: ${user.displayName} (${user.email})`);
            } catch (err: any) {
                console.error(`❌ Failed to create auth for ${user.displayName}:`, err.message);
            }
        }

        console.log("\n👤 Seeding Firestore User Profiles...");
        for (const user of MOCK_USERS) {
            const userRef = db.collection("users").doc(user.uid);
            await userRef.set({
                uid: user.uid,
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                bio: user.bio,
                totalMinutes: user.totalMinutes,
                totalPomodoros: user.totalPomodoros,
                profileTheme: "ambient-aurora",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                lastActive: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`✅ Firestore Profile created: ${user.displayName}`);
        }

        console.log("\n📝 Seeding User Tasks...");
        for (const task of MOCK_TASKS) {
            const taskRef = db.collection("tasks").doc();
            await taskRef.set({
                id: taskRef.id,
                userId: task.userId,
                groupId: null,
                title: task.title,
                completed: task.completed,
                priority: task.priority,
                notes: task.notes,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`✅ Task created: "${task.title}" for ${task.userId}`);
        }

        console.log("\n⏱️ Seeding Completed Focus Sessions (last 7 days)...");
        const now = new Date();
        for (const user of MOCK_USERS) {
            // Seed 3 to 6 sessions per user with historical timestamps
            const sessionCount = Math.floor(Math.random() * 4) + 3;
            for (let i = 0; i < sessionCount; i++) {
                const sessionDate = new Date();
                sessionDate.setDate(now.getDate() - i); // i days ago
                const duration = [15, 25, 50][Math.floor(Math.random() * 3)];

                const sessionRef = db.collection("sessions").doc();
                await sessionRef.set({
                    id: sessionRef.id,
                    userId: user.uid,
                    durationMinutes: duration,
                    createdAt: admin.firestore.Timestamp.fromDate(sessionDate),
                    completedAt: admin.firestore.Timestamp.fromDate(sessionDate),
                    projectName: "Dangdoro Development"
                });
            }
            console.log(`✅ Historical focus sessions seeded for: ${user.displayName}`);
        }

        console.log("\n👥 Seeding Collaborative Focus Group...");
        const groupRef = db.collection("focusGroups").doc("group-bitra-forge");
        const host = MOCK_USERS[2]; // Morales Code
        await groupRef.set({
            id: "group-bitra-forge",
            name: "Bitra Forge Devs",
            description: "Collaborative Pomodoro sessions for Bitra Forge developers.",
            type: "organization",
            hostId: host.uid,
            hostName: host.displayName,
            members: MOCK_USERS.map(u => u.uid),
            memberCount: MOCK_USERS.length,
            privacy: "public",
            totalMinutes: 1550,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastResetAt: admin.firestore.FieldValue.serverTimestamp(),
            memberStats: {
                "user-3-elzalook": { role: "host", totalMinutes: 580, joinedAt: admin.firestore.Timestamp.now() },
                "user-1-admin": { role: "admin", totalMinutes: 420, joinedAt: admin.firestore.Timestamp.now() },
                "user-2-tamim": { role: "member", totalMinutes: 310, joinedAt: admin.firestore.Timestamp.now() },
                "user-4-fathy": { role: "member", totalMinutes: 240, joinedAt: admin.firestore.Timestamp.now() }
            },
            settings: {
                goalHours: 10,
                maxMembers: 20
            }
        });
        console.log(`✅ Focus Group "Bitra Forge Devs" created (Host: ${host.displayName})`);

        console.log("\n🎉 Seeding Completed Successfully! You can now test leaderboards, tasks, and groups locally.");
    } catch (err: any) {
        console.error("\n❌ Seeding FAILED:", err.message);
    }
}

seed();
