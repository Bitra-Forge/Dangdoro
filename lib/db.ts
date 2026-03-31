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
    updateDoc
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
        // Update last active and sync profile info if it changed
        await updateDoc(userRef, {
            lastActive: serverTimestamp(),
            displayName: user.displayName || userSnap.data().displayName,
            photoURL: user.photoURL || userSnap.data().photoURL,
            isAnonymous: user.isAnonymous
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
