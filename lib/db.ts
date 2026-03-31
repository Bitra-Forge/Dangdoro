import {
    doc,
    setDoc,
    getDoc,
    collection,
    addDoc,
    query,
    orderBy,
    limit,
    getDocs,
    serverTimestamp,
    increment,
    updateDoc,
    deleteDoc,
    onSnapshot
} from "firebase/firestore";
import { db } from "./firebase";
import { User } from "firebase/auth";

/**
 * Syncs user authentication data with the Firestore 'users' collection.
 * This ensures every user (including anonymous ones) has a profile document.
 */
export const syncUserProfile = async (user: User) => {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        // Initial profile creation
        await setDoc(userRef, {
            uid: user.uid,
            displayName: user.displayName || (user.isAnonymous ? "Guest Master" : "Focus Hero"),
            photoURL: user.photoURL || null,
            email: user.email || null,
            totalPomodoros: 0,
            totalMinutes: 0,
            lastActive: serverTimestamp(),
            createdAt: serverTimestamp(),
            isAnonymous: user.isAnonymous
        });
    } else {
        // Update profile. If the user is now permanent (not anonymous), 
        // prioritize their new auth displayName.
        const existingData = userSnap.data();
        const newDisplayName = !user.isAnonymous ? (user.displayName || existingData.displayName) : existingData.displayName;

        await updateDoc(userRef, {
            lastActive: serverTimestamp(),
            displayName: newDisplayName,
            photoURL: user.photoURL || existingData.photoURL,
            isAnonymous: user.isAnonymous,
            email: user.email || existingData.email
        });
    }
};

/**
 * Saves a completed Pomodoro session and increments the user's focus stats.
 */
export const savePomodoroSession = async (userId: string, durationMinutes: number = 25) => {
    try {
        // 1. Add session record
        await addDoc(collection(db, "sessions"), {
            userId,
            duration: durationMinutes,
            type: "work",
            completedAt: serverTimestamp(),
        });

        // 2. Increment user totals
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
            totalPomodoros: increment(1),
            totalMinutes: increment(durationMinutes),
            lastActive: serverTimestamp()
        });

        return true;
    } catch (error) {
        console.error("Error saving session:", error);
        return false;
    }
};

/**
 * Fetches the top focusers for the leaderboard.
 */
export const getLeaderboard = async (limitCount: number = 10) => {
    const usersRef = collection(db, "users");
    const q = query(
        usersRef,
        orderBy("totalPomodoros", "desc"),
        limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
};

/**
 * Task CRUD Operations
 */

export const addTask = async (userId: string, title: string, pomodoros: number = 1) => {
    try {
        await addDoc(collection(db, "tasks"), {
            userId,
            title,
            estimatedPomodoros: pomodoros,
            completedPomodoros: 0,
            completed: false,
            createdAt: serverTimestamp(),
        });
        return true;
    } catch (error) {
        console.error("Error adding task:", error);
        return false;
    }
};

export const toggleTask = async (taskId: string, completed: boolean) => {
    try {
        const taskRef = doc(db, "tasks", taskId);
        await updateDoc(taskRef, { completed });
        return true;
    } catch (error) {
        console.error("Error toggling task:", error);
        return false;
    }
};

export const deleteTask = async (taskId: string) => {
    try {
        await deleteDoc(doc(db, "tasks", taskId));
        return true;
    } catch (error) {
        console.error("Error deleting task:", error);
        return false;
    }
};

export const subscribeToTasks = (userId: string, callback: (tasks: any[]) => void) => {
    const q = query(
        collection(db, "tasks"),
        orderBy("createdAt", "desc")
    );
    // Filter by userId locally or use a proper Firestore index/filter
    // For simplicity with anonymous users, we might need a composite index if we filter by userId
    return onSnapshot(q, (snapshot) => {
        const tasks = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter((t: any) => t.userId === userId);
        callback(tasks);
    });
};

/**
 * Stats and Sessions
 */

export const getSessionHistory = async (userId: string, limitCount: number = 20) => {
    const q = query(
        collection(db, "sessions"),
        orderBy("completedAt", "desc"),
        limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((s: any) => s.userId === userId);
};
