import {
    doc,
    setDoc,
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
    QuerySnapshot,
    DocumentData,
    limit,
    startAt,
    endAt
} from "firebase/firestore";
import { db } from "./firebase";

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

export interface FriendRequest {
    id: string;
    fromUserId: string;
    toUserId: string;
    status: FriendRequestStatus;
    createdAt: any; // Firestore Timestamp
    updatedAt: any; // Firestore Timestamp
}

export interface Friend {
    friendId: string;
    since: any; // Firestore Timestamp
    userData?: any; // User profile data (joined manually)
}

const getRequestTimeValue = (request: any): number => {
    return request.updatedAt?.toMillis?.() || request.createdAt?.toMillis?.() || 0;
};

const getRequestsBetweenUsers = async (userId1: string, userId2: string): Promise<FriendRequest[]> => {
    // Query each sender direction separately, then filter client-side.
    // This avoids requiring a composite index on (fromUserId, toUserId).
    const q1 = query(collection(db, "friendRequests"), where("fromUserId", "==", userId1));
    const q2 = query(collection(db, "friendRequests"), where("fromUserId", "==", userId2));

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

    const docsFromUser1 = snap1.docs
        .filter((requestDoc) => requestDoc.data().toUserId === userId2)
        .map((requestDoc) => ({ id: requestDoc.id, ...requestDoc.data() })) as FriendRequest[];

    const docsFromUser2 = snap2.docs
        .filter((requestDoc) => requestDoc.data().toUserId === userId1)
        .map((requestDoc) => ({ id: requestDoc.id, ...requestDoc.data() })) as FriendRequest[];

    return [...docsFromUser1, ...docsFromUser2].sort((a, b) => getRequestTimeValue(b) - getRequestTimeValue(a));
};

/**
 * Send a friend request from one user to another.
 */
export const sendFriendRequest = async (fromUserId: string, toUserId: string) => {
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
export const acceptFriendRequest = async (requestId: string, fromUserId: string, toUserId: string) => {
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
        return true;
    } catch (error) {
        console.error("Error accepting friend request:", error);
        return false;
    }
};

/**
 * Decline a friend request.
 */
export const declineFriendRequest = async (requestId: string) => {
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
export const removeFriend = async (userId1: string, userId2: string) => {
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
        return true;
    } catch (error) {
        console.error("Error removing friend:", error);
        return false;
    }
};

/**
 * Cancel a pending friend request.
 */
export const cancelFriendRequest = async (requestId: string) => {
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
export const getReceivedFriendRequests = async (userId: string) => {
    try {
        const q = query(
            collection(db, "friendRequests"),
            where("toUserId", "==", userId)
        );

        const snapshot = await getDocs(q);
        const requests = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter((r: any) => r.status === "pending")
            .sort((a: any, b: any) => {
                const aTime = a.createdAt?.toMillis?.() || 0;
                const bTime = b.createdAt?.toMillis?.() || 0;
                return bTime - aTime;
            });

        return Promise.all(
            requests.map(async (request: any) => {
                const fromUserDoc = await getDoc(doc(db, "users", request.fromUserId));
                return {
                    ...request,
                    fromUserData: fromUserDoc.exists()
                        ? { id: fromUserDoc.id, ...fromUserDoc.data() }
                        : null,
                };
            })
        );
    } catch (error) {
        console.error("Error getting received friend requests:", error);
        return [];
    }
};

/**
 * Get all pending friend requests sent by a user.
 */
export const getSentFriendRequests = async (userId: string) => {
    try {
        const q = query(
            collection(db, "friendRequests"),
            where("fromUserId", "==", userId)
        );

        const snapshot = await getDocs(q);
        const requests = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter((r: any) => r.status === "pending")
            .sort((a: any, b: any) => {
                const aTime = a.createdAt?.toMillis?.() || 0;
                const bTime = b.createdAt?.toMillis?.() || 0;
                return bTime - aTime;
            });

        return Promise.all(
            requests.map(async (request: any) => {
                const toUserDoc = await getDoc(doc(db, "users", request.toUserId));
                return {
                    ...request,
                    toUserData: toUserDoc.exists()
                        ? { id: toUserDoc.id, ...toUserDoc.data() }
                        : null,
                };
            })
        );
    } catch (error) {
        console.error("Error getting sent friend requests:", error);
        return [];
    }
};

/**
 * Get user's friends list with their profile data.
 */
export const getFriendsList = async (userId: string) => {
    try {
        const friendsRef = collection(db, "users", userId, "friends");
        const snapshot = await getDocs(friendsRef);

        const friends = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                friendId: data.friendId || doc.id,
                since: data.since
            };
        }) as Friend[];

        // Fetch user data for each friend
        const friendsWithData = await Promise.all(
            friends.map(async (friend) => {
                const userDoc = await getDoc(doc(db, "users", friend.friendId));
                return {
                    ...friend,
                    userData: userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null
                };
            })
        );

        return friendsWithData;
    } catch (error) {
        console.error("Error getting friends list:", error);
        return [];
    }
};

/**
 * Subscribe to real-time friend requests (received).
 */
export const subscribeToReceivedFriendRequests = (
    userId: string,
    callback: (requests: any[]) => void
) => {
    if (!userId) return () => {};

    const q = query(
        collection(db, "friendRequests"),
        where("toUserId", "==", userId)
    );

    return onSnapshot(q, async (snapshot) => {
        const requests = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter((r: any) => r.status === "pending")
            .sort((a: any, b: any) => {
                const aTime = a.createdAt?.toMillis?.() || 0;
                const bTime = b.createdAt?.toMillis?.() || 0;
                return bTime - aTime;
            });

        const requestsWithData = await Promise.all(
            requests.map(async (request: any) => {
                const fromUserDoc = await getDoc(doc(db, "users", request.fromUserId));
                return {
                    ...request,
                    fromUserData: fromUserDoc.exists()
                        ? { id: fromUserDoc.id, ...fromUserDoc.data() }
                        : null,
                };
            })
        );

        callback(requestsWithData);
    }, (error) => {
        console.error("Error subscribing to friend requests:", error);
    });
};

/**
 * Subscribe to real-time friends list updates.
 */
export const subscribeToFriendsList = (
    userId: string,
    callback: (friends: any[]) => void
) => {
    if (!userId) return () => {};

    const friendsRef = collection(db, "users", userId, "friends");

    return onSnapshot(friendsRef, async (snapshot) => {
        const friends = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                friendId: data.friendId || doc.id,
                since: data.since
            };
        }) as Friend[];

        // Fetch user data for each friend
        const friendsWithData = await Promise.all(
            friends.map(async (friend) => {
                const userDoc = await getDoc(doc(db, "users", friend.friendId));
                return {
                    ...friend,
                    userData: userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null
                };
            })
        );

        callback(friendsWithData);
    }, (error) => {
        console.error("Error subscribing to friends list:", error);
    });
};

/**
 * Search for users by nickname, display name, email, or user ID.
 * Returns only public-safe fields (no emails, no sensitive data).
 */
export const searchUsers = async (searchTerm: string, excludeUserId: string, limitCount: number = 20) => {
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
                    displayName: data.displayName,
                    photoURL: data.photoURL,
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
                    displayName: data.displayName,
                    photoURL: data.photoURL,
                    // Deliberately excludes: email, settings, isAnonymous, createdAt
                    // Only returns public-safe fields
                };
            })
            .filter((user: any) => {
                if (user.id === excludeUserId) return false;
                const displayName = (user.displayName || "").toLowerCase();
                const uid = user.id.toLowerCase();

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
export const getFriendRequestStatus = async (userId1: string, userId2: string) => {
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
export const areFriends = async (userId1: string, userId2: string) => {
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
export const getFriendsLeaderboard = async (userId: string, limitCount: number = 20) => {
    try {
        // First get friends list
        const friendsList = await getFriendsList(userId);
        const friendIds = friendsList.map(f => f.friendId);
        
        // Include current user in the leaderboard
        friendIds.push(userId);

        if (friendIds.length <= 1) {
            return []; // Only the user themselves
        }

        // Fetch user data for all friends
        const usersRef = collection(db, "users");
        const results: any[] = [];

        // Firestore doesn't support "IN" queries with more than 30 items, so batch if needed
        for (let i = 0; i < friendIds.length; i += 30) {
            const batch = friendIds.slice(i, i + 30);
            const q = query(
                usersRef,
                where("__name__", "in", batch)
            );
            
            const snapshot = await getDocs(q);
            snapshot.docs.forEach(doc => {
                results.push({ id: doc.id, ...doc.data() });
            });
        }

        // Sort by totalMinutes descending
        return results
            .sort((a, b) => (b.totalMinutes || 0) - (a.totalMinutes || 0))
            .slice(0, limitCount);
    } catch (error) {
        console.error("Error getting friends leaderboard:", error);
        return [];
    }
};

/**
 * Get recent activity from friends (completed sessions).
 */
export const getFriendsActivity = async (userId: string, limitCount: number = 20) => {
    try {
        // Get friends list
        const friendsList = await getFriendsList(userId);
        const friendIds = friendsList.map(f => f.friendId);

        if (friendIds.length === 0) {
            return [];
        }

        // Get recent sessions from friends
        const sessionsRef = collection(db, "sessions");
        const results: any[] = [];

        // Batch query (Firestore "IN" limit is 30)
        for (let i = 0; i < friendIds.length; i += 30) {
            const batch = friendIds.slice(i, i + 30);
            const q = query(
                sessionsRef,
                where("userId", "in", batch),
                orderBy("completedAt", "desc"),
                limit(Math.ceil(limitCount / friendIds.length) + 1)
            );

            const snapshot = await getDocs(q);
            snapshot.docs.forEach(doc => {
                results.push({ id: doc.id, ...doc.data() });
            });
        }

        // Sort by completedAt descending and limit
        return results
            .sort((a, b) => {
                const timeA = a.completedAt?.toMillis?.() || 0;
                const timeB = b.completedAt?.toMillis?.() || 0;
                return timeB - timeA;
            })
            .slice(0, limitCount);
    } catch (error) {
        console.error("Error getting friends activity:", error);
        return [];
    }
};
