import {
    doc,
    getDoc,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    serverTimestamp,
    updateDoc,
    deleteDoc,
    onSnapshot,
    orderBy,
    writeBatch,
    limit,
    Timestamp
} from "firebase/firestore";
import { db } from "./firebase";
import { FirebaseTimestampLike, toMillis } from "./groups";
import { fetchUserProfiles } from "./db";

/**
 * Friendship Data Model:
 * 
 * 1. `friendRequests` collection:
 *    - id: auto-generated
 *    - fromUserId: string (user who sent the request)
 *    - toUserId: string (user who will receive the request)
 *    - status: "pending" | "accepted" | "declined"
 *    - createdAt: Timestamp
 *    - updatedAt: Timestamp
 * 
 * 2. `friends` subcollection under each user:
 *    - Document ID = friend's userId
 *    - friendId: string
 *    - since: Timestamp
 * 
 * This symmetric model ensures mutual friendship with efficient querying.
 */

// Types
export type FriendRequestStatus = "pending" | "accepted" | "declined";

export interface UserProfileData {
    id: string;
    uid?: string;
    displayName?: string;
    photoURL?: string;
    email?: string;
    totalMinutes?: number;
}

export interface FriendRequest {
    id: string;
    fromUserId: string;
    toUserId: string;
    status: FriendRequestStatus;
    createdAt: Timestamp | FirebaseTimestampLike;
    updatedAt: Timestamp | FirebaseTimestampLike;
    fromUserData?: UserProfileData | null;
    toUserData?: UserProfileData | null;
}

export interface Friend {
    id: string;
    friendId: string;
    since: Timestamp | FirebaseTimestampLike;
    userData?: UserProfileData | null;
}

export interface CompletedSession {
    id: string;
    userId: string;
    completedAt: Timestamp | FirebaseTimestampLike;
    durationMinutes: number;
    taskTitle?: string;
    displayName?: string;
    photoURL?: string;
}

const getRequestTimeValue = (request: FriendRequest): number => {
    return toMillis(request.updatedAt) || toMillis(request.createdAt) || 0;
};

// --- FRIENDSHIP CACHING LAYER ---
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

const friendsListCache = loadMapFromSession<{ data: Friend[]; timestamp: number }>("dangdoro_friends_list_cache");
const friendsListSimpleCache = loadMapFromSession<{ data: Friend[]; timestamp: number }>("dangdoro_friends_list_simple_cache");
const friendsLeaderboardCache = loadMapFromSession<{ data: UserProfileData[]; timestamp: number }>("dangdoro_friends_leaderboard_cache");
const friendsActivityCache = loadMapFromSession<{ data: CompletedSession[]; timestamp: number }>("dangdoro_friends_activity_cache");

const FRIENDS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const activeFriendsListPromises = new Map<string, Promise<Friend[]>>();
const activeFriendsListSimplePromises = new Map<string, Promise<Friend[]>>();
const activeFriendsLeaderboardPromises = new Map<string, Promise<UserProfileData[]>>();
const activeFriendsActivityPromises = new Map<string, Promise<CompletedSession[]>>();

export const invalidateFriendshipCaches = (userId: string) => {
    for (const key of Array.from(friendsListCache.keys())) {
        if (key.startsWith(userId)) friendsListCache.delete(key);
    }
    for (const key of Array.from(friendsListSimpleCache.keys())) {
        if (key.startsWith(userId)) friendsListSimpleCache.delete(key);
    }
    for (const key of Array.from(friendsLeaderboardCache.keys())) {
        if (key.startsWith(userId)) friendsLeaderboardCache.delete(key);
    }
    for (const key of Array.from(friendsActivityCache.keys())) {
        if (key.startsWith(userId)) friendsActivityCache.delete(key);
    }
    saveMapToSession("dangdoro_friends_list_cache", friendsListCache);
    saveMapToSession("dangdoro_friends_list_simple_cache", friendsListSimpleCache);
    saveMapToSession("dangdoro_friends_leaderboard_cache", friendsLeaderboardCache);
    saveMapToSession("dangdoro_friends_activity_cache", friendsActivityCache);
};

const getRequestsBetweenUsers = async (userId1: string, userId2: string): Promise<FriendRequest[]> => {
    // Query both directions with full pair constraints so Firestore security
    // rules can verify the current user is always a participant.
    const q1 = query(collection(db, "friendRequests"), where("fromUserId", "==", userId1), where("toUserId", "==", userId2));
    const q2 = query(collection(db, "friendRequests"), where("fromUserId", "==", userId2), where("toUserId", "==", userId1));

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

    const docsFromUser1 = snap1.docs
        .map((requestDoc) => ({ id: requestDoc.id, ...requestDoc.data() })) as FriendRequest[];

    const docsFromUser2 = snap2.docs
        .map((requestDoc) => ({ id: requestDoc.id, ...requestDoc.data() })) as FriendRequest[];

    return [...docsFromUser1, ...docsFromUser2].sort((a, b) => getRequestTimeValue(b) - getRequestTimeValue(a));
};

/**
 * Send a friend request from one user to another.
 */
export const sendFriendRequest = async (fromUserId: string, toUserId: string): Promise<boolean> => {
    try {
        // Validate parameters
        if (!fromUserId || typeof fromUserId !== 'string' || !fromUserId.trim()) {
            console.error("Invalid fromUserId:", fromUserId);
            return false;
        }
        
        if (!toUserId || typeof toUserId !== 'string' || !toUserId.trim()) {
            console.error("Invalid toUserId:", toUserId);
            return false;
        }

        // Prevent self-requests
        if (fromUserId === toUserId) {
            console.error("Cannot send friend request to yourself");
            return false;
        }

        // Check if they're already friends
        const friendRef = doc(db, "users", fromUserId, "friends", toUserId);
        const friendSnap = await getDoc(friendRef);
        if (friendSnap.exists()) {
            console.log("Already friends");
            return false;
        }

        // Load all historical requests between the two users.
        const requestHistory = await getRequestsBetweenUsers(fromUserId, toUserId);

        // Any pending request in either direction means this action should be blocked.
        const pendingRequest = requestHistory.find((request) => request.status === "pending");
        if (pendingRequest) {
            console.log("Friend request already pending");
            return false;
        }

        // Re-use the latest declined/accepted request document if available.
        // This avoids creating many duplicate docs for the same pair over time.
        const reusableRequest = requestHistory[0];
        if (reusableRequest) {
            await updateDoc(doc(db, "friendRequests", reusableRequest.id), {
                fromUserId,
                toUserId,
                status: "pending",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            return true;
        }

        // Create new friend request
        await addDoc(collection(db, "friendRequests"), {
            fromUserId,
            toUserId,
            status: "pending",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        return true;
    } catch (error) {
        console.error("Error sending friend request:", error);
        return false;
    }
};

/**
 * Accept a friend request.
 */
export const acceptFriendRequest = async (requestId: string, fromUserId: string, toUserId: string): Promise<boolean> => {
    try {
        // Validate parameters
        if (!requestId || typeof requestId !== 'string' || !requestId.trim()) {
            console.error("Invalid requestId:", requestId);
            return false;
        }

        if (!fromUserId || typeof fromUserId !== 'string' || !fromUserId.trim()) {
            console.error("Invalid fromUserId:", fromUserId);
            return false;
        }

        if (!toUserId || typeof toUserId !== 'string' || !toUserId.trim()) {
            console.error("Invalid toUserId:", toUserId);
            return false;
        }

        const batch = writeBatch(db);

        // Update request status
        const requestRef = doc(db, "friendRequests", requestId);
        batch.update(requestRef, {
            status: "accepted",
            updatedAt: serverTimestamp()
        });

        // Add to both users' friends subcollections
        const friendRef1 = doc(db, "users", fromUserId, "friends", toUserId);
        const friendRef2 = doc(db, "users", toUserId, "friends", fromUserId);

        batch.set(friendRef1, {
            friendId: toUserId,
            since: serverTimestamp()
        });

        batch.set(friendRef2, {
            friendId: fromUserId,
            since: serverTimestamp()
        });

        await batch.commit();

        // Best-effort: notify the original requester that their friend request was accepted.
        // Matches the existing "objective_assignment" notification pattern in GroupWorkspace.
        try {
            await addDoc(collection(db, "notifications"), {
                type: "friend_request_accepted",
                toUserId: fromUserId,
                fromUserId: toUserId,
                friendRequestId: requestId,
                read: false,
                createdAt: serverTimestamp(),
            });
        } catch (notifError) {
            console.error("Failed to create acceptance notification:", notifError);
        }

        invalidateFriendshipCaches(fromUserId);
        invalidateFriendshipCaches(toUserId);
        return true;
    } catch (error) {
        console.error("Error accepting friend request:", error);
        return false;
    }
};

/**
 * Decline a friend request.
 */
export const declineFriendRequest = async (requestId: string): Promise<boolean> => {
    try {
        await updateDoc(doc(db, "friendRequests", requestId), {
            status: "declined",
            updatedAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error("Error declining friend request:", error);
        return false;
    }
};

/**
 * Remove a friend from both users' friend lists.
 */
export const removeFriend = async (userId1: string, userId2: string): Promise<boolean> => {
    try {
        // Validate parameters
        if (!userId1 || typeof userId1 !== 'string' || !userId1.trim()) {
            console.error("Invalid userId1:", userId1);
            return false;
        }

        if (!userId2 || typeof userId2 !== 'string' || !userId2.trim()) {
            console.error("Invalid userId2:", userId2);
            return false;
        }

        const batch = writeBatch(db);

        const friendRef1 = doc(db, "users", userId1, "friends", userId2);
        const friendRef2 = doc(db, "users", userId2, "friends", userId1);

        batch.delete(friendRef1);
        batch.delete(friendRef2);

        await batch.commit();
        invalidateFriendshipCaches(userId1);
        invalidateFriendshipCaches(userId2);
        return true;
    } catch (error) {
        console.error("Error removing friend:", error);
        return false;
    }
};

/**
 * Cancel a pending friend request.
 */
export const cancelFriendRequest = async (requestId: string): Promise<boolean> => {
    try {
        // Validate parameter
        if (!requestId || typeof requestId !== 'string' || !requestId.trim()) {
            console.error("Invalid requestId:", requestId);
            return false;
        }

        await deleteDoc(doc(db, "friendRequests", requestId));
        return true;
    } catch (error) {
        console.error("Error canceling friend request:", error);
        return false;
    }
};

/**
 * Get a specific friend request (in either direction).
 */
export const getFriendRequest = async (userId1: string, userId2: string): Promise<FriendRequest | null> => {
    try {
        const requests = await getRequestsBetweenUsers(userId1, userId2);
        return requests[0] || null;
    } catch (error) {
        console.error("Error getting friend request:", error);
        return null;
    }
};

/**
 * Get all pending friend requests for a user (received).
 */
export const getReceivedFriendRequests = async (userId: string): Promise<FriendRequest[]> => {
    try {
        const q = query(
            collection(db, "friendRequests"),
            where("toUserId", "==", userId)
        );

        const snapshot = await getDocs(q);
        const requests = snapshot.docs
            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as FriendRequest))
            .filter((r) => r.status === "pending")
            .sort((a, b) => {
                const aTime = toMillis(a.createdAt) || 0;
                const bTime = toMillis(b.createdAt) || 0;
                return bTime - aTime;
            });

        const fromUserIds = requests.map(r => r.fromUserId);
        if (fromUserIds.length === 0) return [];

        const profiles = await fetchUserProfiles(fromUserIds);
        const userProfilesMap = new Map<string, UserProfileData>();
        profiles.forEach(p => {
            userProfilesMap.set(p.uid, { id: p.uid, ...p });
        });

        return requests.map(request => ({
            ...request,
            fromUserData: userProfilesMap.get(request.fromUserId) || null
        }));
    } catch (error) {
        console.error("Error getting received friend requests:", error);
        return [];
    }
};

/**
 * Get all pending friend requests sent by a user.
 */
export const getSentFriendRequests = async (userId: string): Promise<FriendRequest[]> => {
    try {
        const q = query(
            collection(db, "friendRequests"),
            where("fromUserId", "==", userId)
        );

        const snapshot = await getDocs(q);
        const requests = snapshot.docs
            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as FriendRequest))
            .filter((r) => r.status === "pending")
            .sort((a, b) => {
                const aTime = toMillis(a.createdAt) || 0;
                const bTime = toMillis(b.createdAt) || 0;
                return bTime - aTime;
            });

        const toUserIds = requests.map(r => r.toUserId);
        if (toUserIds.length === 0) return [];

        const profiles = await fetchUserProfiles(toUserIds);
        const userProfilesMap = new Map<string, UserProfileData>();
        profiles.forEach(p => {
            userProfilesMap.set(p.uid, { id: p.uid, ...p });
        });

        return requests.map(request => ({
            ...request,
            toUserData: userProfilesMap.get(request.toUserId) || null
        }));
    } catch (error) {
        console.error("Error getting sent friend requests:", error);
        return [];
    }
};

/**
 * Get user's friends list with their profile data.
  */
export const getFriendsList = async (userId: string): Promise<Friend[]> => {
    const now = Date.now();
    const cacheKey = userId;
    const cached = friendsListCache.get(cacheKey);
    if (cached && now - cached.timestamp < FRIENDS_CACHE_TTL) {
        if (process.env.NODE_ENV === "development") {
            console.log("CACHE HIT: getFriendsList");
        }
        return cached.data;
    }

    const activePromise = activeFriendsListPromises.get(cacheKey);
    if (activePromise) {
        if (process.env.NODE_ENV === "development") {
            console.log("CACHE HIT: getFriendsList (coalesced)");
        }
        return activePromise;
    }

    if (process.env.NODE_ENV === "development") {
        console.log("FIRESTORE READ: getFriendsList");
    }

    const fetchPromise = (async () => {
        try {
            const friendsRef = collection(db, "users", userId, "friends");
            const snapshot = await getDocs(friendsRef);

            const friends = snapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    friendId: data.friendId || docSnap.id,
                    since: data.since
                };
            }) as Friend[];

            const friendIds = friends.map(f => f.friendId);
            if (friendIds.length === 0) {
                friendsListCache.set(cacheKey, { data: [], timestamp: now });
                saveMapToSession("dangdoro_friends_list_cache", friendsListCache);
                return [];
            }

            const profiles = await fetchUserProfiles(friendIds);
            const userProfilesMap = new Map<string, UserProfileData>();
            profiles.forEach(p => {
                userProfilesMap.set(p.uid, { id: p.uid, ...p });
            });

            const data = friends.map(friend => ({
                ...friend,
                userData: userProfilesMap.get(friend.friendId) || null
            }));

            friendsListCache.set(cacheKey, { data, timestamp: Date.now() });
            saveMapToSession("dangdoro_friends_list_cache", friendsListCache);
            return data;
        } catch (error) {
            console.error("Error getting friends list:", error);
            return [];
        }
    })();

    activeFriendsListPromises.set(cacheKey, fetchPromise);

    try {
        return await fetchPromise;
    } finally {
        activeFriendsListPromises.delete(cacheKey);
    }
};

/**
 * Get simple friends list containing only friend IDs (without fetching full user profiles).
 * Useful for counts and quick lookups to avoid heavy Firestore reads.
 */
export const getFriendsListSimple = async (userId: string): Promise<Friend[]> => {
    const now = Date.now();
    const cacheKey = userId;
    const cached = friendsListSimpleCache.get(cacheKey);
    if (cached && now - cached.timestamp < FRIENDS_CACHE_TTL) {
        if (process.env.NODE_ENV === "development") {
            console.log("CACHE HIT: getFriendsListSimple");
        }
        return cached.data;
    }

    const activePromise = activeFriendsListSimplePromises.get(cacheKey);
    if (activePromise) {
        if (process.env.NODE_ENV === "development") {
            console.log("CACHE HIT: getFriendsListSimple (coalesced)");
        }
        return activePromise;
    }

    if (process.env.NODE_ENV === "development") {
        console.log("FIRESTORE READ: getFriendsListSimple");
    }

    const fetchPromise = (async () => {
        try {
            const friendsRef = collection(db, "users", userId, "friends");
            const snapshot = await getDocs(friendsRef);

            const data = snapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    friendId: data.friendId || docSnap.id,
                    since: data.since,
                    userData: null
                };
            }) as Friend[];

            friendsListSimpleCache.set(cacheKey, { data, timestamp: Date.now() });
            saveMapToSession("dangdoro_friends_list_simple_cache", friendsListSimpleCache);
            return data;
        } catch (error) {
            console.error("Error getting simple friends list:", error);
            return [];
        }
    })();

    activeFriendsListSimplePromises.set(cacheKey, fetchPromise);

    try {
        return await fetchPromise;
    } finally {
        activeFriendsListSimplePromises.delete(cacheKey);
    }
};

/**
 * Subscribe to real-time friend requests (received).
 */
export const subscribeToReceivedFriendRequests = (
    userId: string,
    callback: (requests: FriendRequest[]) => void
) => {
    if (!userId) return () => {};

    const q = query(
        collection(db, "friendRequests"),
        where("toUserId", "==", userId)
    );

    return onSnapshot(q, async (snapshot) => {
        const requests = snapshot.docs
            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as FriendRequest))
            .filter((r) => r.status === "pending")
            .sort((a, b) => {
                const aTime = toMillis(a.createdAt) || 0;
                const bTime = toMillis(b.createdAt) || 0;
                return bTime - aTime;
            });

        const fromUserIds = requests.map(r => r.fromUserId);
        if (fromUserIds.length === 0) {
            callback([]);
            return;
        }

        const profiles = await fetchUserProfiles(fromUserIds);
        const userProfilesMap = new Map<string, UserProfileData>();
        profiles.forEach(p => {
            userProfilesMap.set(p.uid, { id: p.uid, ...p });
        });

        const requestsWithData = requests.map(request => ({
            ...request,
            fromUserData: userProfilesMap.get(request.fromUserId) || null
        }));

        callback(requestsWithData);
    }, (error) => {
        console.error("Error subscribing to friend requests:", error);
    });
};

/**
 * Subscribe to real-time presence (lastActive) updates for a list of friends.
 * Calls `callback` whenever any friend's lastActive changes in Firestore.
 * Returns an unsubscribe function to remove all listeners.
 */
export const subscribeToFriendsPresence = (
    friendIds: string[],
    callback: (uid: string, lastActive: Timestamp | null) => void
) => {
    if (friendIds.length === 0) return () => {};

    const unsubscribes = friendIds.map(uid => {
        const userRef = doc(db, "users", uid);
        return onSnapshot(userRef, (snapshot) => {
            if (snapshot.exists()) {
                const lastActive = snapshot.data()?.lastActive ?? null;
                callback(uid, lastActive);
            }
        });
    });

    return () => {
        unsubscribes.forEach(unsub => unsub());
    };
};

/**
 * Subscribe to real-time friends list updates.
 */
export const subscribeToFriendsList = (
    userId: string,
    callback: (friends: Friend[]) => void
) => {
    if (!userId) return () => {};

    const friendsRef = collection(db, "users", userId, "friends");

    return onSnapshot(friendsRef, async (snapshot) => {
        const friends = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                friendId: data.friendId || docSnap.id,
                since: data.since
            };
        }) as Friend[];

        const friendIds = friends.map(f => f.friendId);
        if (friendIds.length === 0) {
            callback([]);
            return;
        }

        const profiles = await fetchUserProfiles(friendIds);
        const userProfilesMap = new Map<string, UserProfileData>();
        profiles.forEach(p => {
            userProfilesMap.set(p.uid, { id: p.uid, ...p });
        });

        const friendsWithData = friends.map(friend => ({
            ...friend,
            userData: userProfilesMap.get(friend.friendId) || null
        }));

        callback(friendsWithData);
    }, (error) => {
        console.error("Error subscribing to friends list:", error);
    });
};

/**
 * Search for users by nickname, display name, email, or user ID.
 * Returns only public-safe fields (no emails, no sensitive data).
 */
export const searchUsers = async (searchTerm: string, excludeUserId: string, limitCount: number = 20): Promise<UserProfileData[]> => {
    try {
        const term = searchTerm.trim();
        const termLower = term.toLowerCase();

        // If it looks like a full user ID, fetch directly (very fast)
        if (term.length === 28) {
            const userRef = doc(db, "users", term);
            const snap = await getDoc(userRef);
            if (snap.exists() && snap.id !== excludeUserId) {
                const data = snap.data();
                return [{
                    id: snap.id,
                    uid: snap.id,
                    displayName: data?.displayName,
                    photoURL: data?.photoURL,
                    // NO email returned - privacy safe
                }];
            }
            return [];
        }

        // For short searches, use ordered query with limit
        const q = query(
            collection(db, "users"),
            orderBy("displayName"),
            limit(200)
        );

        const snapshot = await getDocs(q);

        return snapshot.docs
            .map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    uid: docSnap.id,
                    displayName: data?.displayName,
                    photoURL: data?.photoURL,
                    // Deliberately excludes: email, settings, isAnonymous, createdAt
                    // Only returns public-safe fields
                } as UserProfileData;
            })
            .filter((user) => {
                if (user.uid === excludeUserId) return false;
                const displayName = (user.displayName || "").toLowerCase();
                const uid = (user.uid || "").toLowerCase();

                return displayName.includes(termLower) || uid.includes(termLower);
            })
            .slice(0, limitCount);
    } catch (error) {
        console.error("Error searching users:", error);
        return [];
    }
};

/**
 * Get friend request status between two users.
 */
export const getFriendRequestStatus = async (userId1: string, userId2: string): Promise<{ status: FriendRequestStatus; direction: "sent" | "received" } | null> => {
    try {
        const request = await getFriendRequest(userId1, userId2);
        if (!request) return null;
        
        // Return status from the perspective of userId1
        if (request.fromUserId === userId1) {
            return { status: request.status, direction: "sent" };
        } else {
            return { status: request.status, direction: "received" };
        }
    } catch (error) {
        console.error("Error getting friend request status:", error);
        return null;
    }
};

/**
 * Check if two users are friends.
 */
export const areFriends = async (userId1: string, userId2: string): Promise<boolean> => {
    try {
        const friendRef = doc(db, "users", userId1, "friends", userId2);
        const snap = await getDoc(friendRef);
        return snap.exists();
    } catch (error) {
        console.error("Error checking friendship:", error);
        return false;
    }
};

/**
 * Get friends leaderboard - rankings among friends only.
 */
export const getFriendsLeaderboard = async (userId: string, limitCount: number = 20): Promise<UserProfileData[]> => {
    const now = Date.now();
    const cacheKey = `${userId}_${limitCount}`;
    const cached = friendsLeaderboardCache.get(cacheKey);
    if (cached && now - cached.timestamp < FRIENDS_CACHE_TTL) {
        if (process.env.NODE_ENV === "development") {
            console.log("CACHE HIT: getFriendsLeaderboard");
        }
        return cached.data;
    }

    const activePromise = activeFriendsLeaderboardPromises.get(cacheKey);
    if (activePromise) {
        if (process.env.NODE_ENV === "development") {
            console.log("CACHE HIT: getFriendsLeaderboard (coalesced)");
        }
        return activePromise;
    }

    if (process.env.NODE_ENV === "development") {
        console.log("FIRESTORE READ: getFriendsLeaderboard");
    }

    const fetchPromise = (async () => {
        try {
            // First get friends list
            const friendsList = await getFriendsListSimple(userId);
            const friendIds = friendsList.map(f => f.friendId);
            
            // Include current user in the leaderboard
            friendIds.push(userId);

            if (friendIds.length <= 1) {
                return []; // Only the user themselves
            }

            // Fetch user data for all friends using cached fetchUserProfiles
            const results = await fetchUserProfiles(friendIds);

            // Sort by totalMinutes descending and map to UserProfileData with id
            const sorted: UserProfileData[] = results
                .map(p => ({ id: p.uid, ...p }))
                .sort((a, b) => (b.totalMinutes || 0) - (a.totalMinutes || 0))
                .slice(0, limitCount);

            friendsLeaderboardCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
            saveMapToSession("dangdoro_friends_leaderboard_cache", friendsLeaderboardCache);
            return sorted;
        } catch (error) {
            console.error("Error getting friends leaderboard:", error);
            return [];
        }
    })();

    activeFriendsLeaderboardPromises.set(cacheKey, fetchPromise);

    try {
        return await fetchPromise;
    } finally {
        activeFriendsLeaderboardPromises.delete(cacheKey);
    }
};

/**
 * Get recent activity from friends (completed sessions).
 */
export const getFriendsActivity = async (userId: string, limitCount: number = 20): Promise<CompletedSession[]> => {
    const now = Date.now();
    const cacheKey = `${userId}_${limitCount}`;
    const cached = friendsActivityCache.get(cacheKey);
    if (cached && now - cached.timestamp < FRIENDS_CACHE_TTL) {
        if (process.env.NODE_ENV === "development") {
            console.log("CACHE HIT: getFriendsActivity");
        }
        return cached.data;
    }

    const activePromise = activeFriendsActivityPromises.get(cacheKey);
    if (activePromise) {
        if (process.env.NODE_ENV === "development") {
            console.log("CACHE HIT: getFriendsActivity (coalesced)");
        }
        return activePromise;
    }

    if (process.env.NODE_ENV === "development") {
        console.log("FIRESTORE READ: getFriendsActivity");
    }

    const fetchPromise = (async () => {
        try {
            // Get friends list
            const friendsList = await getFriendsListSimple(userId);
            const friendIds = friendsList.map(f => f.friendId);

            if (friendIds.length === 0) {
                return [];
            }

            // Get recent sessions from friends
            const sessionsRef = collection(db, "sessions");
            const results: CompletedSession[] = [];

            // Batch query (Firestore "IN" limit is 30)
            for (let i = 0; i < friendIds.length; i += 30) {
                const batchIds = friendIds.slice(i, i + 30);
                const q = query(
                    sessionsRef,
                    where("userId", "in", batchIds),
                    orderBy("completedAt", "desc"),
                    limit(Math.ceil(limitCount / friendIds.length) + 1)
                );

                const snapshot = await getDocs(q);
                snapshot.docs.forEach(docSnap => {
                    results.push({ id: docSnap.id, ...docSnap.data() } as CompletedSession);
                });
            }

            // Sort by completedAt descending and limit
            const sorted = results
                .sort((a, b) => {
                    const timeA = toMillis(a.completedAt) || 0;
                    const timeB = toMillis(b.completedAt) || 0;
                    return timeB - timeA;
                })
                .slice(0, limitCount);

            friendsActivityCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
            saveMapToSession("dangdoro_friends_activity_cache", friendsActivityCache);
            return sorted;
        } catch (error) {
            console.error("Error getting friends activity:", error);
            return [];
        }
    })();

    activeFriendsActivityPromises.set(cacheKey, fetchPromise);

    try {
        return await fetchPromise;
    } finally {
        activeFriendsActivityPromises.delete(cacheKey);
    }
};
