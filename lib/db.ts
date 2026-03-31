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
    onSnapshot,
    where
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "./firebase";
import { User, updateProfile } from "firebase/auth";

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
        const existingData = userSnap.data();

        const updateData: any = {
            lastActive: serverTimestamp(),
            isAnonymous: user.isAnonymous,
            email: user.email || existingData.email,
        };

        if (!user.isAnonymous) {
            // Find data in providerDetails for more reliability
            const provider = user.providerData[0];
            const nameFromProvider = provider?.displayName;
            const photoFromProvider = provider?.photoURL;

            // Priority: New Auth data > Provider data > Existing Firestore data
            // We specifically want to overwrite "Guest Master" if we have a real name
            const currentName = user.displayName || nameFromProvider || existingData.displayName;

            if (currentName && currentName !== "Guest Master") {
                updateData.displayName = currentName;
            } else if (!existingData.displayName || existingData.displayName === "Guest Master") {
                // If it's still default or null, try to use whatever we have, even if it's "Focus Hero"
                updateData.displayName = currentName || "Focus Hero";
            }

            updateData.photoURL = user.photoURL || photoFromProvider || existingData.photoURL;
        }

        await updateDoc(userRef, updateData);
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
    if (!userId) return () => { };

    let activeUnsubscribe: (() => void) | null = null;
    let isCancelled = false;

    const setupListener = () => {
        const q = query(
            collection(db, "tasks"),
            where("userId", "==", userId),
            orderBy("createdAt", "desc")
        );

        activeUnsubscribe = onSnapshot(q, (snapshot) => {
            if (isCancelled) return;
            const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(tasks);
        }, (error) => {
            if (isCancelled) return;

            if (error.code === 'failed-precondition') {
                console.warn("Firestore index required for optimized query. Falling back to client-side filter.");
                if (activeUnsubscribe) activeUnsubscribe();

                const fallbackQ = query(
                    collection(db, "tasks"),
                    orderBy("createdAt", "desc")
                );

                activeUnsubscribe = onSnapshot(fallbackQ, (fallbackSnap) => {
                    if (isCancelled) return;
                    const tasks = fallbackSnap.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .filter((t: any) => t.userId === userId);
                    callback(tasks);
                }, (err) => {
                    if (!isCancelled) console.error("Fallback subscriber error:", err);
                });
            } else {
                console.error("Error subscribing to tasks:", error);
            }
        });
    };

    setupListener();

    return () => {
        isCancelled = true;
        if (activeUnsubscribe) activeUnsubscribe();
    };
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

/**
 * Profile Picture Upload
 */
export const uploadProfilePicture = async (userId: string, file: File | Blob) => {
    try {
        const storageRef = ref(storage, `profiles/${userId}`);

        // Use metadata to ensure correct content type and avoid some pre-check issues
        console.log("Starting upload to Firebase Storage...");
        const snapshot = await uploadBytes(storageRef, file, {
            contentType: "image/jpeg"
        });

        console.log("Upload finished. Fetching download URL...");
        const photoURL = await getDownloadURL(snapshot.ref);

        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, { photoURL });

        if (auth.currentUser) {
            await updateProfile(auth.currentUser, { photoURL });
        }
        return photoURL;
    } catch (error) {
        console.error("Firebase Storage Upload Error:", error);
        throw error;
    }
};

export const updateProfilePictureBase64 = async (userId: string, base64Data: string) => {
    try {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, { photoURL: base64Data });
        // NOTE: We skip updateProfile(auth.currentUser) because Firebase Auth 
        // has a strict character limit on photoURL that Base64 usually exceeds.
        return true;
    } catch (error) {
        console.error("Error updating profile picture with Base64:", error);
        return false;
    }
};

export const updateUserSettings = async (userId: string, settings: any) => {
    try {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, { settings });
        return true;
    } catch (error) {
        console.error("Error updating settings:", error);
        return false;
    }
};
