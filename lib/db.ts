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
    where,
    writeBatch
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "./firebase";
import { User, updateProfile } from "firebase/auth";

/**
 * Syncs user authentication data with the Firestore 'users' collection.
 * This ensures every user (including anonymous ones) has a profile document.
 */
export const syncUserProfile = async (user: User) => {
    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            console.log(`syncUserProfile: Creating new Firestore profile for: ${user.uid}`);
            // Generate a unique signature for guests (e.g., Guest #8F2A)
            const signature = user.uid.slice(0, 4).toUpperCase();
            const finalName = user.isAnonymous ? `Guest #${signature}` : "Focus Hero";

            // Initial profile creation
            await setDoc(userRef, {
                uid: user.uid,
                displayName: user.displayName || finalName,
                photoURL: user.photoURL || null,
                email: user.email || null,
                totalPomodoros: 0,
                totalMinutes: 0,
                lastActive: serverTimestamp(),
                createdAt: serverTimestamp(),
                isAnonymous: user.isAnonymous
            });

            // Sync the name BACK to the Auth user so the Header sees it immediately
            const nameToSync = user.displayName || finalName;
            if (user.displayName !== nameToSync) {
                console.log(`syncUserProfile: Syncing name "${nameToSync}" back to Auth user profile.`);
                await updateProfile(user, { displayName: nameToSync });
            }
        } else {
            console.log(`syncUserProfile: Updating existing profile for: ${user.uid}`);
            const existingData = userSnap.data();

            const updateData: any = {
                lastActive: serverTimestamp(),
                isAnonymous: user.isAnonymous,
                email: user.email || existingData.email,
            };

            // If user is NOT anonymous (Google/Email), we update their profile info from the provider
            if (!user.isAnonymous) {
                // ... (Verified user logic)
                const provider = user.providerData[0];
                const nameFromProvider = provider?.displayName;
                const photoFromProvider = provider?.photoURL;

                const currentName = user.displayName || nameFromProvider || existingData.displayName;

                if (currentName && !currentName.startsWith("Guest #")) {
                    updateData.displayName = currentName;
                } else if (!existingData.displayName || existingData.displayName.startsWith("Guest #")) {
                    updateData.displayName = currentName || "Focus Hero";
                }

                // PHOTO SYNC PRIORITY: Firestore > Auth > Provider.
                // This ensures manual uploads in our app aren't overwritten by Google.
                updateData.photoURL = existingData.photoURL || user.photoURL || photoFromProvider;
            } else {
                // For Anonymous users
                let finalName = existingData.displayName;
                if (!finalName || finalName === "Guest Master") {
                    const signature = user.uid.slice(0, 4).toUpperCase();
                    finalName = `Guest #${signature}`;
                    updateData.displayName = finalName;
                }

                // Sync the name BACK to the Auth user so the Header/Sidebar can see it!
                if (user.displayName !== finalName) {
                    await updateProfile(user, { displayName: finalName });
                }

                // Preserve custom avatar if set
                updateData.photoURL = existingData.photoURL || user.photoURL || null;
            }

            await updateDoc(userRef, updateData);
        }
    } catch (error) {
        console.error("❌ syncUserProfile FAILED:", error);
        throw error;
    }
};

/**
 * Saves a completed Pomodoro session and increments the user's focus stats.
 */
export const savePomodoroSession = async (userId: string, durationMinutes: number = 25) => {
    try {
        // Lazy Sync: Ensure profile exists before saving session
        if (auth.currentUser && auth.currentUser.uid === userId) {
            await syncUserProfile(auth.currentUser);
        }

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
        orderBy("totalMinutes", "desc"),
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

export type TaskPriority = "urgent" | "high" | "normal" | "natural";

export const addTask = async (
    userId: string,
    title: string,
    groupId: string | null = null,
    priority: TaskPriority = "natural",
    pomodoros: number = 1,
    durationMinutes: number | null = null,
    notes: string = ""
) => {
    try {
        if (auth.currentUser && auth.currentUser.uid === userId) {
            await syncUserProfile(auth.currentUser);
        }
        await addDoc(collection(db, "tasks"), {
            userId,
            groupId,
            title,
            notes,
            priority,
            durationMinutes,
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

/**
 * Task Group CRUD Operations
 */

export const addGroup = async (userId: string, name: string, x = 40, y = 140, w = 300, h = 400) => {
    try {
        const ref = await addDoc(collection(db, "taskGroups"), {
            userId,
            name,
            positionX: x,
            positionY: y,
            width: w,
            height: h,
            createdAt: serverTimestamp(),
        });
        return ref.id;
    } catch (error) {
        console.error("Error adding group:", error);
        return null;
    }
};

export const renameGroup = async (groupId: string, name: string) => {
    try {
        await updateDoc(doc(db, "taskGroups", groupId), { name });
        return true;
    } catch (error) {
        console.error("Error renaming group:", error);
        return false;
    }
};

export const deleteGroup = async (groupId: string, userId: string) => {
    try {
        const batch = writeBatch(db);
        // Delete all tasks in the group
        const tasksQ = query(
            collection(db, "tasks"),
            where("groupId", "==", groupId),
            where("userId", "==", userId)
        );
        const tasksSnap = await getDocs(tasksQ);
        tasksSnap.docs.forEach(d => batch.delete(d.ref));
        // Delete the group itself
        batch.delete(doc(db, "taskGroups", groupId));
        await batch.commit();
        return true;
    } catch (error) {
        console.error("Error deleting group:", error);
        return false;
    }
};

export const updateGroupPosition = async (groupId: string, x: number, y: number) => {
    try {
        await updateDoc(doc(db, "taskGroups", groupId), { positionX: x, positionY: y });
        return true;
    } catch (error) {
        console.error("Error updating group position:", error);
        return false;
    }
};

export const updateGroupDimensions = async (groupId: string, w: number, h: number) => {
    try {
        await updateDoc(doc(db, "taskGroups", groupId), { width: w, height: h });
        return true;
    } catch (error) {
        console.error("Error updating group dimensions:", error);
        return false;
    }
};

export const moveTaskToGroup = async (taskId: string, newGroupId: string | null) => {
    try {
        await updateDoc(doc(db, "tasks", taskId), { groupId: newGroupId });
        return true;
    } catch (error) {
        console.error("Error moving task:", error);
        return false;
    }
};

export const updateTaskPriority = async (taskId: string, priority: TaskPriority) => {
    try {
        await updateDoc(doc(db, "tasks", taskId), { priority });
        return true;
    } catch (error) {
        console.error("Error updating task priority:", error);
        return false;
    }
};

export const updateTaskField = async (taskId: string, fields: { title?: string; durationMinutes?: number | null; notes?: string }) => {
    try {
        await updateDoc(doc(db, "tasks", taskId), fields);
        return true;
    } catch (error) {
        console.error("Error updating task:", error);
        return false;
    }
};

export const subscribeToGroups = (userId: string, callback: (groups: any[]) => void) => {
    if (!userId) return () => { };

    let activeUnsub: (() => void) | null = null;
    let isCancelled = false;

    const q = query(
        collection(db, "taskGroups"),
        where("userId", "==", userId),
        orderBy("createdAt", "asc")
    );

    activeUnsub = onSnapshot(q, (snap) => {
        if (isCancelled) return;
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
        if (!isCancelled) {
            console.error("Error subscribing to groups:", error);
        }
    });

    return () => {
        isCancelled = true;
        if (activeUnsub) activeUnsub();
    };
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
            if (!isCancelled) {
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
