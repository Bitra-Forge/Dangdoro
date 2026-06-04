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
    writeBatch,
    arrayRemove,
    Timestamp
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "./firebase";
import { User, updateProfile } from "firebase/auth";
import { trackSessionEvent } from "@/lib/session-telemetry";
import { FirebaseTimestampLike, FocusGroup, UserProfileData } from "./groups";

const LIVE_SESSION_STALE_MS = 3 * 60 * 1000;


export interface TaskGroup {
    id: string;
    userId: string;
    name: string;
    positionX: number;
    positionY: number;
    width?: number;
    height?: number;
    color?: string;
    sortBy?: string;
    createdAt?: Timestamp | FirebaseTimestampLike;
}

export interface TaskItem {
    id: string;
    userId: string;
    groupId: string | null;
    title: string;
    completed: boolean;
    durationMinutes?: number | null;
    notes?: string;
    priority?: TaskPriority;
    order?: number;
    createdAt?: Timestamp | FirebaseTimestampLike;
    sourceGroupId?: string;
    isGroupTask?: boolean;
}

const toMillis = (ts: FirebaseTimestampLike | Date | number | null | undefined): number | null => {
    if (!ts) return null;
    if (typeof ts === "number") return ts;
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === "object") {
        if (typeof ts.toMillis === "function") return ts.toMillis();
        if (typeof ts.seconds === "number") return ts.seconds * 1000;
        return Date.now();
    }
    return null;
};


/**
 * Syncs user authentication data with the Firestore 'users' collection.
 * This ensures every user (including anonymous ones) has a profile document.
 */
/**
 * Pure helper to resolve a user's display name based on provider, auth, and database records.
 */
export function isCustomName(name: string | null | undefined): boolean {
    if (!name) return false;
    const trimmed = name.trim();
    if (trimmed === "") return false;
    if (trimmed.startsWith("Guest #")) return false;
    if (trimmed === "Focus Hero") return false;
    if (trimmed === "Guest Master") return false;
    return true;
}

export function resolveUserDisplayName(
    providerData: { displayName: string | null }[],
    authDisplayName: string | null | undefined,
    existingDisplayName: string | null | undefined
): string {
    // 1. Prefer custom name from the database (the user's saved choice)
    if (isCustomName(existingDisplayName)) {
        return existingDisplayName!;
    }
    
    // 2. Prefer custom name from Auth profile
    if (isCustomName(authDisplayName)) {
        return authDisplayName!;
    }

    // 3. Fallback to provider name (e.g. Google name) if it's not a guest name
    const provider = providerData.find(p => p.displayName && !p.displayName.startsWith("Guest #"));
    const nameFromProvider = provider?.displayName || null;
    if (nameFromProvider) {
        return nameFromProvider;
    }

    // 4. Fallback to any non-custom auth display name (e.g. "Guest #XXXX")
    if (authDisplayName && authDisplayName.trim() !== "") {
        return authDisplayName;
    }

    // 5. Fallback to any non-custom database name
    if (existingDisplayName && existingDisplayName.trim() !== "") {
        return existingDisplayName;
    }

    // 6. Final fallback
    return "Focus Hero";
}

export const syncUserProfile = async (user: User) => {
    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        const isValidPhoto = (url: any) => url && typeof url === 'string' && url.trim() !== '' && url !== 'null' && url !== 'undefined';

        if (!userSnap.exists()) {
            console.log(`syncUserProfile: Creating new Firestore profile for: ${user.uid}`);
            // Generate a unique signature for guests (e.g., Guest #8F2A)
            const signature = user.uid.slice(0, 4).toUpperCase();
            const finalName = user.isAnonymous ? `Guest #${signature}` : "Focus Hero";

            const photoURLCandidate = user.photoURL;

            // Initial profile creation
            await setDoc(userRef, {
                uid: user.uid,
                displayName: user.displayName || finalName,
                photoURL: isValidPhoto(photoURLCandidate) ? photoURLCandidate : null,
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

            const updateData: Record<string, unknown> = {
                lastActive: serverTimestamp(),
                isAnonymous: user.isAnonymous,
                email: user.email || existingData.email,
            };

            // If user is NOT anonymous (Google/Email), we update their profile info from the provider
            if (!user.isAnonymous) {
                // Find a provider (like Google) that has a real display name
                const provider = user.providerData.find(p => p.displayName && !p.displayName.startsWith("Guest #"));
                const photoFromProvider = provider?.photoURL;

                const resolvedName = resolveUserDisplayName(
                    user.providerData || [],
                    user.displayName,
                    existingData.displayName
                );

                console.log("🔍 syncUserProfile [Debug]: providerData =", user.providerData);
                console.log("🔍 syncUserProfile [Debug]: user.displayName =", user.displayName);
                console.log("🔍 syncUserProfile [Debug]: existingData.displayName =", existingData?.displayName);
                console.log("🔍 syncUserProfile [Debug]: resolvedName =", resolvedName);

                updateData.displayName = resolvedName;

                // Sync the name BACK to the Auth user so the UI/Header updates immediately
                if (user.displayName !== resolvedName) {
                    console.log(`syncUserProfile: Syncing name "${resolvedName}" back to Auth user profile.`);
                    await updateProfile(user, { displayName: resolvedName });
                    await user.reload();
                }

                // PHOTO SYNC PRIORITY: Firestore > Auth > Provider.
                // This ensures manual uploads in our app aren't overwritten by Google.
                updateData.photoURL = [existingData.photoURL, user.photoURL, photoFromProvider].find(isValidPhoto) || null;
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
                updateData.photoURL = [existingData.photoURL, user.photoURL].find(isValidPhoto) || null;
            }

            await updateDoc(userRef, updateData);
        }

        // Clear caches so the new profile/display name is immediately visible
        userProfileCache.delete(user.uid);
        saveMapToSession("dangdoro_profile_cache", userProfileCache);
        cachedLeaderboard = null;
        if (typeof window !== "undefined") {
            try {
                sessionStorage.removeItem("dangdoro_leaderboard_cache");
                sessionStorage.removeItem("dangdoro_group_leaderboard_cache");
            } catch {}
        }
        groupLeaderboardCache.clear();
    } catch (error) {
        console.error("❌ syncUserProfile FAILED:", error);
        throw error;
    }
};

/**
 * Saves a completed Pomodoro session and increments the user's focus stats.
 */
export const savePomodoroSession = async (userId: string, durationMinutes: number = 25, groupId: string | null = null) => {
    try {
        if (auth.currentUser && auth.currentUser.uid === userId) {
            await syncUserProfile(auth.currentUser);
        }

        await addDoc(collection(db, "sessions"), {
            userId,
            groupId, // Track if session happened in a group
            duration: durationMinutes,
            type: "work",
            startedAt: null,
            endedAt: serverTimestamp(),
            status: "completed",
            completedAt: serverTimestamp(),
        });

        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
            totalPomodoros: increment(1),
            totalMinutes: increment(durationMinutes),
            lastActive: serverTimestamp()
        });

        if (groupId) {
            const groupRef = doc(db, "focusGroups", groupId);
            await updateDoc(groupRef, {
                [`memberStats.${userId}.totalMinutes`]: increment(durationMinutes),
                [`memberStats.${userId}.lastActive`]: serverTimestamp(),
                totalMinutes: increment(durationMinutes)
            });
        }

        return true;
    } catch (error) {
        console.error("Error saving session:", error);
        return false;
    }
};

/**
 * Presence Logic: Live Sessions
 * These are temporary documents that broadcast user activity to the group.
 */

export const startLiveSession = async (userId: string, groupId: string, userName?: string, userPhoto?: string) => {
    try {
        interface ExistingLiveSession {
            groupId?: string;
            startedAt?: Timestamp | FirebaseTimestampLike | null;
            lastHeartbeat?: Timestamp | FirebaseTimestampLike | null;
        }
        const existingActiveQuery = query(
            collection(db, "liveSessions"),
            where("userId", "==", userId),
            limit(10)
        );
        const existingActiveSnap = await getDocs(existingActiveQuery);
        if (!existingActiveSnap.empty) {
            const existing = existingActiveSnap.docs[0];
            const data = existing.data() as ExistingLiveSession;
            const heartbeatMs = toMillis(data.lastHeartbeat) ?? toMillis(data.startedAt);
            const isStale = !heartbeatMs || (Date.now() - heartbeatMs) > LIVE_SESSION_STALE_MS;

            if (existingActiveSnap.docs.length > 1) {
                await Promise.all(
                    existingActiveSnap.docs.slice(1).map((staleDoc) => deleteDoc(staleDoc.ref))
                );
                trackSessionEvent("live_session_stale_cleanup", {
                    userId,
                    staleCount: existingActiveSnap.docs.length - 1,
                });
            }

            if (isStale) {
                await deleteDoc(existing.ref);
                trackSessionEvent("live_session_stale_cleanup", {
                    userId,
                    staleCount: 1,
                    reason: "heartbeat_timeout",
                });
            } else {
                // Idempotent start: if already active in the same group, reuse current session.
                if (data.groupId === groupId) {
                    trackSessionEvent("live_session_start", { userId, groupId, reused: true });
                    return existing.id;
                }

                // Enforce one active session per user globally.
                trackSessionEvent("live_session_conflict", {
                    userId,
                    requestedGroupId: groupId,
                    activeGroupId: data.groupId,
                });
                return null;
            }
        }

        const liveRef = await addDoc(collection(db, "liveSessions"), {
            userId,
            groupId,
            userName: userName || "Focus Hero",
            userPhoto: userPhoto || null,
            startedAt: serverTimestamp(),
            lastHeartbeat: serverTimestamp(),
            status: "focusing"
        });
        trackSessionEvent("live_session_start", { userId, groupId, reused: false });
        return liveRef.id;
    } catch (error) {
        console.error("Error starting live session:", error);
        trackSessionEvent("group_session_sync_failed", {
            stage: "start_live_session",
            userId,
            groupId,
        });
        return null;
    }
};

export const endLiveSession = async (liveSessionId: string) => {
    try {
        const docRef = doc(db, "liveSessions", liveSessionId);
        await deleteDoc(docRef);
        trackSessionEvent("live_session_end", { liveSessionId });
        return true;
    } catch (error: any) {
        // Silently handle permission-denied (stale session from previous auth)
        if (error?.code !== "permission-denied") {
            console.error("Error ending live session:", error);
        }
        trackSessionEvent("group_session_sync_failed", {
            stage: "end_live_session",
            liveSessionId,
        });
        return false;
    }
};

export const updateLiveSessionHeartbeat = async (liveSessionId: string) => {
    try {
        await updateDoc(doc(db, "liveSessions", liveSessionId), {
            lastHeartbeat: serverTimestamp()
        });
    } catch { /* ignore */ }
};

export const updateLiveSessionStatus = async (
    liveSessionId: string, 
    status: "focusing" | "paused",
    startedAt?: Date
) => {
    try {
        const updates: Record<string, unknown> = {
            status,
            lastHeartbeat: serverTimestamp()
        };
        if (status === "paused") {
            updates.pausedAt = serverTimestamp();
        } else {
            updates.pausedAt = null;
        }
        if (startedAt) {
            updates.startedAt = startedAt;
        }
        await updateDoc(doc(db, "liveSessions", liveSessionId), updates);
    } catch { /* ignore */ }
};

/**
 * Saves a partially completed Pomodoro session (user stopped early).
 * The duration reflects actual time spent, not the full configured duration.
 */
export const savePartialPomodoroSession = async (userId: string, durationMinutes: number, groupId: string | null = null) => {
    if (durationMinutes < 1) return false;

    try {
        if (auth.currentUser && auth.currentUser.uid === userId) {
            await syncUserProfile(auth.currentUser);
        }

        await addDoc(collection(db, "sessions"), {
            userId,
            groupId,
            duration: durationMinutes,
            type: "work",
            startedAt: null,
            endedAt: serverTimestamp(),
            status: "completed",
            completedAt: serverTimestamp(),
        });

        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
            totalPomodoros: increment(1),
            totalMinutes: increment(durationMinutes),
            lastActive: serverTimestamp()
        });

        if (groupId) {
            const groupRef = doc(db, "focusGroups", groupId);
            await updateDoc(groupRef, {
                [`memberStats.${userId}.totalMinutes`]: increment(durationMinutes),
                [`memberStats.${userId}.lastActive`]: serverTimestamp(),
                totalMinutes: increment(durationMinutes)
            });
        }

        return true;
    } catch (error) {
        console.error("Error saving partial session:", error);
        return false;
    }
};

/**
 * Recomputes total focused minutes for a group from completed sessions.
 * Useful as a recovery path when aggregate counters drift.
 */
export const recalculateGroupMinutesFromSessions = async (groupId: string) => {
    const sessionsRef = collection(db, "sessions");
    const q = query(
        sessionsRef,
        where("groupId", "==", groupId),
        where("status", "==", "completed")
    );
    const snapshot = await getDocs(q);
    const totalMinutes = snapshot.docs.reduce((acc, snap) => {
        const data = snap.data() as { duration?: number };
        return acc + (typeof data.duration === "number" ? data.duration : 0);
    }, 0);

    await updateDoc(doc(db, "focusGroups", groupId), { totalMinutes });
    return totalMinutes;
};

export const acceptGroupInvite = async (
    groupId: string,
    userId: string,
    userDisplayName?: string | null,
    userPhotoURL?: string | null
) => {
    try {
        const groupRef = doc(db, "focusGroups", groupId);
        const groupSnap = await getDoc(groupRef);
        if (!groupSnap.exists()) return false;

        const groupData = groupSnap.data() as {
            members?: string[];
            pendingInvites?: string[];
            memberStats?: Record<string, unknown>;
        };

        const pendingInvites = Array.isArray(groupData.pendingInvites) ? groupData.pendingInvites : [];
        const members = Array.isArray(groupData.members) ? groupData.members : [];
        const alreadyMember = members.includes(userId);
        const wasInvited = pendingInvites.includes(userId);

        if (!alreadyMember && !wasInvited) return false;

        const nextMembers = alreadyMember ? members : [...members, userId];
        const updates: Record<string, unknown> = {
            members: nextMembers,
            pendingInvites: arrayRemove(userId),
            memberCount: nextMembers.length,
        };

        if (!groupData.memberStats || !groupData.memberStats[userId]) {
            updates[`memberStats.${userId}`] = {
                role: "member",
                totalMinutes: 0,
                joinedAt: serverTimestamp(),
                displayName: userDisplayName || "Member",
                photoURL: userPhotoURL || null,
            };
        }

        await updateDoc(groupRef, updates);
        return true;
    } catch (error) {
        console.error("Error accepting group invite:", error);
        return false;
    }
};

export const declineGroupInvite = async (groupId: string, userId: string) => {
    try {
        const groupRef = doc(db, "focusGroups", groupId);
        await updateDoc(groupRef, {
            pendingInvites: arrayRemove(userId),
        });
        return true;
    } catch (error) {
        console.error("Error declining group invite:", error);
        return false;
    }
};

// --- CACHING LAYER TO REDUCE FIREBASE READS ---
const getSessionStorageItem = (key: string) => {
    if (typeof window === "undefined") return null;
    try {
        const item = sessionStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch {
        return null;
    }
};

const setSessionStorageItem = (key: string, value: any) => {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
    } catch {}
};

const loadMapFromSession = <V>(key: string): Map<string, V> => {
    const map = new Map<string, V>();
    const data = getSessionStorageItem(key);
    if (Array.isArray(data)) {
        for (const [k, v] of data) {
            map.set(k, v);
        }
    }
    return map;
};

const saveMapToSession = <V>(key: string, map: Map<string, V>) => {
    setSessionStorageItem(key, Array.from(map.entries()));
};

const userProfileCache = loadMapFromSession<{ data: UserProfileData; timestamp: number }>("dangdoro_profile_cache");
const USER_PROFILE_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

let cachedLeaderboard: { data: any[]; timestamp: number; queriedLimit: number } | null = getSessionStorageItem("dangdoro_leaderboard_cache");
const LEADERBOARD_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const groupLeaderboardCache = loadMapFromSession<{ data: FocusGroup[]; timestamp: number }>("dangdoro_group_leaderboard_cache");
const GROUP_LEADERBOARD_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let activeLeaderboardPromise: Promise<any[]> | null = null;
const activeGroupLeaderboardPromises = new Map<string, Promise<FocusGroup[]>>();

/**
 * Fetches the top focusers for the leaderboard.
 */
export const getLeaderboard = async (limitCount: number = 10) => {
    const now = Date.now();
    if (cachedLeaderboard && now - cachedLeaderboard.timestamp < LEADERBOARD_CACHE_TTL) {
        if (cachedLeaderboard.data.length >= limitCount || cachedLeaderboard.queriedLimit >= limitCount) {
            console.log("⚡ [Leaderboard Cache] Hit! Returning cached leaderboards.");
            return cachedLeaderboard.data.slice(0, limitCount);
        }
    }

    if (activeLeaderboardPromise) {
        console.log("⚡ [Leaderboard Cache] Coalescing concurrent request.");
        const data = await activeLeaderboardPromise;
        return data.slice(0, limitCount);
    }

    console.log("⏳ [Leaderboard Cache] Miss! Querying Firestore for leaders.");
    activeLeaderboardPromise = (async () => {
        const usersRef = collection(db, "users");
        // Always query up to a reasonable buffer size (e.g. 150) to satisfy subsequent calls and slice them
        const queryLimit = Math.max(150, limitCount);
        const q = query(
            usersRef,
            orderBy("totalMinutes", "desc"),
            orderBy("totalPomodoros", "desc"),
            limit(queryLimit)
        );

        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        cachedLeaderboard = { data, timestamp: Date.now(), queriedLimit: queryLimit };
        setSessionStorageItem("dangdoro_leaderboard_cache", cachedLeaderboard);
        return data;
    })();

    try {
        const data = await activeLeaderboardPromise;
        return data.slice(0, limitCount);
    } finally {
        activeLeaderboardPromise = null;
    }
};


/**
 * Fetches focus groups for the leaderboard with filtering and sorting.
 * Sorting is done client-side to avoid composite Firestore index requirements.
 */
export const getGroupLeaderboard = async (options: { 
    userId?: string; 
    filter?: "joined" | "discover" | "all"; 
    sortBy?: "members" | "minutes";
    limitCount?: number;
} = {}) => {
    const now = Date.now();
    const cacheKey = JSON.stringify(options);
    const cached = groupLeaderboardCache.get(cacheKey);
    if (cached && now - cached.timestamp < GROUP_LEADERBOARD_CACHE_TTL) {
        console.log("⚡ [Group Leaderboard Cache] Hit! Returning cached groups.");
        return cached.data;
    }

    const activePromise = activeGroupLeaderboardPromises.get(cacheKey);
    if (activePromise) {
        console.log("⚡ [Group Leaderboard Cache] Coalescing concurrent request.");
        return activePromise;
    }

    console.log("⏳ [Group Leaderboard Cache] Miss! Querying Firestore for groups.");
    const { userId, filter = "all", sortBy = "minutes", limitCount = 20 } = options;
    
    const fetchPromise = (async () => {
        const groupsRef = collection(db, "focusGroups");
        
        let q;
        
        if (filter === "joined" && userId) {
            // Simple filter — no orderBy needed, sort client-side
            q = query(
                groupsRef,
                where("members", "array-contains", userId),
                limit(100)
            );
        } else {
            // Discover or all: fetch public groups only
            // Supports both legacy "public" value and new privacy model "public"
            q = query(
                groupsRef,
                where("privacy", "==", "public"),
                limit(100)
            );
        }

        const querySnapshot = await getDocs(q);
        let groups = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as unknown as FocusGroup));

        // Filter out already-joined groups for the "discover" tab
        if (filter === "discover" && userId) {
            groups = groups.filter(g => !Array.isArray(g.members) || !g.members.includes(userId));
        }

        // Sort client-side (no composite index needed)
        groups.sort((a, b) => {
            if (sortBy === "minutes") {
                return (b.totalMinutes || 0) - (a.totalMinutes || 0);
            }
            return (b.memberCount || b.members?.length || 0) - (a.memberCount || a.members?.length || 0);
        });

        const result = groups.slice(0, limitCount);
        groupLeaderboardCache.set(cacheKey, { data: result, timestamp: Date.now() });
        saveMapToSession("dangdoro_group_leaderboard_cache", groupLeaderboardCache);
        return result;
    })();

    activeGroupLeaderboardPromises.set(cacheKey, fetchPromise);

    try {
        return await fetchPromise;
    } finally {
        activeGroupLeaderboardPromises.delete(cacheKey);
    }
};

const activeUserProfilePromises = new Map<string, Promise<UserProfileData | null>>();

/**
 * Utility to fetch multiple user profiles by their IDs.
 * Used for hydration in groups and leaderboards.
 */
export const fetchUserProfiles = async (uids: string[]) => {
    if (!uids.length) return [];

    const now = Date.now();
    const result: UserProfileData[] = [];
    
    const uidsToFetch: string[] = [];
    const inFlightPromises: { uid: string; promise: Promise<UserProfileData | null> }[] = [];

    // Check what we have in cache or currently in-flight
    for (const uid of uids) {
        const cached = userProfileCache.get(uid);
        if (cached && now - cached.timestamp < USER_PROFILE_CACHE_TTL) {
            result.push(cached.data);
        } else {
            const activePromise = activeUserProfilePromises.get(uid);
            if (activePromise) {
                inFlightPromises.push({ uid, promise: activePromise });
            } else {
                uidsToFetch.push(uid);
            }
        }
    }

    if (uidsToFetch.length > 0) {
        console.log(`⏳ [Profile Cache] Miss/Stale for UIDs: ${uidsToFetch.join(", ")}. Querying Firestore.`);
        const CHUNK_SIZE = 30;
        const usersRef = collection(db, "users");

        for (let i = 0; i < uidsToFetch.length; i += CHUNK_SIZE) {
            const chunk = uidsToFetch.slice(i, i + CHUNK_SIZE);
            
            // Create a single shared promise for this chunk's Firestore query
            const chunkFetchPromise = (async () => {
                try {
                    const q = query(usersRef, where("uid", "in", chunk));
                    const querySnapshot = await getDocs(q);
                    const fetchedMap = new Map<string, UserProfileData>();
                    
                    querySnapshot.docs.forEach(doc => {
                        const profileData = {
                            uid: doc.id,
                            ...doc.data()
                        } as unknown as UserProfileData;
                        
                        userProfileCache.set(doc.id, { data: profileData, timestamp: Date.now() });
                        fetchedMap.set(doc.id, profileData);
                    });
                    
                    saveMapToSession("dangdoro_profile_cache", userProfileCache);
                    return fetchedMap;
                } catch (error) {
                    console.error("Error fetching user profile chunk:", error);
                    return new Map<string, UserProfileData>();
                }
            })();

            // Map each UID in this chunk to its own promise resolved from the chunk query
            chunk.forEach(uid => {
                const uidPromise = chunkFetchPromise.then(fetchedMap => fetchedMap.get(uid) || null);
                activeUserProfilePromises.set(uid, uidPromise);
                
                // Cleanup active promise on resolution
                uidPromise.finally(() => {
                    activeUserProfilePromises.delete(uid);
                });

                inFlightPromises.push({ uid, promise: uidPromise });
            });
        }
    }

    // Await all active fetches
    if (inFlightPromises.length > 0) {
        const resolvedProfiles = await Promise.all(
            inFlightPromises.map(item => item.promise)
        );
        resolvedProfiles.forEach(p => {
            if (p) result.push(p);
        });
    }

    const hitCount = uids.length - uidsToFetch.length;
    if (hitCount > 0) {
        console.log(`⚡ [Profile Cache] Hit/Coalesced! Resolved ${hitCount}/${uids.length} profiles from memory/in-flight.`);
    }

    // Preserve the original order of requested UIDs
    const profileMap = new Map(result.map(p => [p.uid, p]));
    return uids
        .map(uid => profileMap.get(uid))
        .filter(Boolean) as UserProfileData[];
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
    notes: string = "",
    order?: number
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
            order: order ?? Date.now(),
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

export const addGroup = async (userId: string, name: string, x = 40, y = 140, w = 300, h = 400, color = "zinc") => {
    try {
        const ref = await addDoc(collection(db, "taskGroups"), {
            userId,
            name,
            positionX: x,
            positionY: y,
            width: w,
            height: h,
            color,
            createdAt: serverTimestamp(),
        });
        return ref.id;
    } catch (error) {
        console.error("Error adding group:", error);
        return null;
    }
};

export const updateGroupColor = async (groupId: string, color: string) => {
    try {
        await updateDoc(doc(db, "taskGroups", groupId), { color });
        return true;
    } catch (error) {
        console.error("Error updating group color:", error);
        return false;
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

export const updateGroupSort = async (groupId: string, sortBy: string) => {
    try {
        await updateDoc(doc(db, "taskGroups", groupId), { sortBy });
        return true;
    } catch (error) {
        console.error("Error updating group sort order:", error);
        return false;
    }
};

export const updateTaskPositionAndGroup = async (taskId: string, groupId: string | null, order: number) => {
    try {
        await updateDoc(doc(db, "tasks", taskId), { groupId, order });
        return true;
    } catch (error) {
        console.error("Error updating task position/group:", error);
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

export const subscribeToGroups = (userId: string, callback: (groups: TaskGroup[]) => void) => {
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
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as TaskGroup)));
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

export const subscribeToAssignedGroupTasks = (userId: string, callback: (tasks: TaskItem[]) => void) => {
    if (!userId) return () => { };

    let isCancelled = false;
    let groupsUnsubscribe: (() => void) | null = null;
    let tasksUnsubscribes: (() => void)[] = [];
    const groupTaskMaps: Record<string, TaskItem[]> = {};

    const updateAllTasks = () => {
        if (isCancelled) return;
        const allTasks: TaskItem[] = [];
        for (const tasks of Object.values(groupTaskMaps)) {
            allTasks.push(...tasks);
        }
        callback(allTasks);
    };

    const groupsQ = query(
        collection(db, "focusGroups"),
        where("members", "array-contains", userId)
    );

    groupsUnsubscribe = onSnapshot(groupsQ, (groupsSnap) => {
        if (isCancelled) return;

        tasksUnsubscribes.forEach(unsub => unsub());
        tasksUnsubscribes = [];

        const currentGroupIds = new Set(groupsSnap.docs.map(d => d.id));
        for (const gid of Object.keys(groupTaskMaps)) {
            if (!currentGroupIds.has(gid)) {
                delete groupTaskMaps[gid];
            }
        }

        if (currentGroupIds.size === 0) {
            callback([]);
            return;
        }

        currentGroupIds.forEach((groupId) => {
            const tasksQ = query(
                collection(db, `focusGroups/${groupId}/tasks`),
                where("assignedTo", "==", userId)
            );

            const unsub = onSnapshot(tasksQ, (tasksSnap) => {
                if (isCancelled) return;
                groupTaskMaps[groupId] = tasksSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    sourceGroupId: groupId,
                    isGroupTask: true
                } as unknown as TaskItem));
                updateAllTasks();
            }, (error) => {
                if (!isCancelled) {
                    console.error(`Error subscribing to tasks in group ${groupId}:`, error);
                }
            });

            tasksUnsubscribes.push(unsub);
        });

        updateAllTasks();
    }, (error) => {
        if (!isCancelled) {
            console.error("Error subscribing to focus groups for assigned tasks:", error);
        }
    });

    return () => {
        isCancelled = true;
        if (groupsUnsubscribe) groupsUnsubscribe();
        tasksUnsubscribes.forEach(unsub => unsub());
    };
};

export const subscribeToTasks = (userId: string, callback: (tasks: TaskItem[]) => void) => {
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
            const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as TaskItem));
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

export const getSessionHistory = async (userId: string, limitCount: number = 365) => {
    const q = query(
        collection(db, "sessions"),
        where("userId", "==", userId),
        orderBy("completedAt", "desc"),
        limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

export const updateUserSettings = async (userId: string, settings: Record<string, unknown>) => {
    try {
        const userRef = doc(db, "users", userId);
        // Use dotted field paths to merge individual fields without overwriting
        // the entire settings object (e.g. settings.focusTime, settings.sessionEndSound)
        const dottedUpdate: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(settings)) {
            dottedUpdate[`settings.${key}`] = value;
        }
        await updateDoc(userRef, dottedUpdate);
        return true;
    } catch {
        console.error("Error updating settings");
        return false;
    }
};

export const updateUserProfile = async (userId: string, data: { displayName?: string; nickname?: string; bio?: string; profileTheme?: string }) => {
    try {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, data);

        if (data.displayName && auth.currentUser) {
            await updateProfile(auth.currentUser, { displayName: data.displayName });
        }

        // Clear caches so the new profile/display name is immediately visible
        userProfileCache.delete(userId);
        saveMapToSession("dangdoro_profile_cache", userProfileCache);
        cachedLeaderboard = null;
        if (typeof window !== "undefined") {
            try {
                sessionStorage.removeItem("dangdoro_leaderboard_cache");
                sessionStorage.removeItem("dangdoro_group_leaderboard_cache");
            } catch {}
        }
        groupLeaderboardCache.clear();

        return true;
    } catch {
        console.error("Error updating user profile");
        return false;
    }
};

/**
 * Updates the user's lastActive timestamp to maintain "online" status.
 * This is used by the Heartbeat component.
 */
export const updateLastActive = async (userId: string) => {
    try {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
            lastActive: serverTimestamp()
        });
        return true;
    } catch {
        // Silently fail to avoid console clutter for a secondary feature
        return false;
    }
};
