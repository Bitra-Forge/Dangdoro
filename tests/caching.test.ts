import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// Mock Firebase libraries to prevent real initialization and network requests
vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => [{}]),
  getApp: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("firebase/storage", () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));

vi.mock("@/lib/firebase", () => ({
  db: {},
  auth: {},
  storage: {},
}));

vi.mock("@/lib/session-telemetry", () => ({
  trackSessionEvent: vi.fn(),
}));

// Setup Firestore mocks
const mockGetDocs = vi.fn();
const mockGetDoc = vi.fn();

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(),
  doc: vi.fn((db, ...paths) => ({ paths })),
  getDoc: (ref: any) => mockGetDoc(ref),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  collection: vi.fn((db, ...paths) => ({ path: paths.join("/") })),
  addDoc: vi.fn(),
  query: vi.fn((ref, ...constraints) => ({ ref, constraints })),
  orderBy: vi.fn((field, dir) => ({ type: "orderBy", field, dir })),
  limit: vi.fn((n) => ({ type: "limit", value: n })),
  where: vi.fn((field, op, val) => ({ type: "where", field, op, val })),
  arrayRemove: vi.fn(),
  writeBatch: vi.fn(() => ({
    delete: vi.fn(),
    commit: vi.fn(),
  })),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  Timestamp: {
    now: () => ({ toMillis: () => Date.now() }),
  },
  increment: vi.fn(),
  getDocs: (q: any) => mockGetDocs(q),
}));

// Now import the functions we want to test
import { getLeaderboard, getGroupLeaderboard, fetchUserProfiles, getSessionHistory } from "@/lib/db";
import { getFriendsList, getFriendsListSimple, getFriendsLeaderboard, getFriendsActivity } from "@/lib/friendship";

describe("Caching Layer", () => {
  let testTime = new Date("2026-06-04T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    // Increment time by 1 hour for each test to ensure any previously cached values are expired
    testTime = new Date(testTime.getTime() + 1 * 60 * 60 * 1000);
    vi.setSystemTime(testTime);
    mockGetDocs.mockReset();
    mockGetDoc.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getLeaderboard Cache", () => {
    it("should query Firestore on first call, cache the results, and reuse them within TTL", async () => {
      const mockUsers = [
        { id: "user-1", totalMinutes: 120, totalPomodoros: 5, displayName: "Alice" },
        { id: "user-2", totalMinutes: 90, totalPomodoros: 3, displayName: "Bob" },
      ];

      // Setup Firestore mock return value for single doc read
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          players: mockUsers.map((u) => ({
            id: u.id,
            uid: u.id,
            displayName: u.displayName,
            totalMinutes: u.totalMinutes,
            totalPomodoros: u.totalPomodoros,
          })),
        }),
      });

      // 1. First Call: Should fetch from database
      const result1 = await getLeaderboard(2);
      expect(mockGetDoc).toHaveBeenCalledTimes(1);
      expect(result1).toHaveLength(2);
      expect(result1[0].displayName).toBe("Alice");

      // 2. Second Call (Immediate): Should use cache and NOT query Firestore
      const result2 = await getLeaderboard(2);
      expect(mockGetDoc).toHaveBeenCalledTimes(1); // Still 1
      expect(result2).toEqual(result1);

      // 3. Third Call (Within TTL - e.g., 4 minutes later): Should still use cache
      vi.advanceTimersByTime(4 * 60 * 1000);
      const result3 = await getLeaderboard(2);
      expect(mockGetDoc).toHaveBeenCalledTimes(1); // Still 1
      expect(result3).toEqual(result1);

      // 4. Fourth Call (After TTL - 6 minutes total passed): Should query Firestore again
      vi.advanceTimersByTime(2 * 60 * 1000); // 4 + 2 = 6 minutes (> 5 mins TTL)
      
      // Update mock response to simulate database updates
      const updatedMockUsers = [
        ...mockUsers,
        { id: "user-3", totalMinutes: 200, totalPomodoros: 8, displayName: "Charlie" },
      ];
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          players: updatedMockUsers.map((u) => ({
            id: u.id,
            uid: u.id,
            displayName: u.displayName,
            totalMinutes: u.totalMinutes,
            totalPomodoros: u.totalPomodoros,
          })),
        }),
      });

      const result4 = await getLeaderboard(3);
      expect(mockGetDoc).toHaveBeenCalledTimes(2); // Incremented to 2
      expect(result4).toHaveLength(3);
    });

    it("should coalesce concurrent calls to getLeaderboard into a single Firestore query", async () => {
      let resolvePromise: any;
      const dbPromise = new Promise<any>((resolve) => {
        resolvePromise = resolve;
      });
      mockGetDoc.mockReturnValue(dbPromise);

      // Trigger two concurrent requests
      const p1 = getLeaderboard(2);
      const p2 = getLeaderboard(2);

      // Verify getDoc was called only once so far
      expect(mockGetDoc).toHaveBeenCalledTimes(1);

      // Resolve the Firestore query
      resolvePromise({
        exists: () => true,
        data: () => ({
          players: [
            { id: "user-1", uid: "user-1", displayName: "Alice", totalMinutes: 100 },
            { id: "user-2", uid: "user-2", displayName: "Bob", totalMinutes: 80 },
          ],
        }),
      });

      const [res1, res2] = await Promise.all([p1, p2]);
      expect(res1).toHaveLength(2);
      expect(res2).toHaveLength(2);
      expect(res1).toEqual(res2);
      expect(mockGetDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe("getGroupLeaderboard Cache", () => {
    it("should cache results based on options and fetch from DB when TTL expires", async () => {
      const mockGroups = [
        { id: "group-1", name: "Coders", totalMinutes: 1000, privacy: "public", memberCount: 5 },
      ];

      mockGetDocs.mockResolvedValue({
        docs: mockGroups.map((g) => ({
          id: g.id,
          data: () => ({
            name: g.name,
            totalMinutes: g.totalMinutes,
            privacy: g.privacy,
            memberCount: g.memberCount,
          }),
        })),
      });

      // 1. First Call: Query Firestore
      const options1 = { userId: "u123", filter: "all" as const };
      const res1 = await getGroupLeaderboard(options1);
      expect(mockGetDocs).toHaveBeenCalledTimes(1);
      expect(res1).toHaveLength(1);

      // 2. Second Call (Immediate, same options): Reuse cache
      const res2 = await getGroupLeaderboard(options1);
      expect(mockGetDocs).toHaveBeenCalledTimes(1); // Still 1
      expect(res2).toEqual(res1);

      // 3. Third Call (Different options): Query Firestore again (cache miss due to key mismatch)
      const options2 = { userId: "u123", filter: "discover" as const };
      await getGroupLeaderboard(options2);
      expect(mockGetDocs).toHaveBeenCalledTimes(2); // Incremented to 2

      // 4. Fourth Call (After TTL): Query Firestore again
      vi.advanceTimersByTime(6 * 60 * 1000); // > 5 mins TTL
      await getGroupLeaderboard(options1);
      expect(mockGetDocs).toHaveBeenCalledTimes(3); // Incremented to 3
    });
  });

  describe("fetchUserProfiles Cache", () => {
    it("should fetch missing profiles, cache them, and only query for uncached profiles", async () => {
      // 1. Fetch user-1 and user-2 (both missing from cache initially)
      mockGetDoc.mockImplementation(async (ref) => {
        const uid = ref.paths[ref.paths.length - 1];
        if (uid === "user-1") {
          return {
            id: "user-1",
            exists: () => true,
            data: () => ({ displayName: "Alice" }),
          };
        } else if (uid === "user-2") {
          return {
            id: "user-2",
            exists: () => true,
            data: () => ({ displayName: "Bob" }),
          };
        } else if (uid === "user-3") {
          return {
            id: "user-3",
            exists: () => true,
            data: () => ({ displayName: "Charlie" }),
          };
        }
        return { exists: () => false };
      });

      const profiles1 = await fetchUserProfiles(["user-1", "user-2"]);
      expect(mockGetDoc).toHaveBeenCalledTimes(2);
      expect(profiles1).toHaveLength(2);
      expect(profiles1[0].displayName).toBe("Alice");
      expect(profiles1[1].displayName).toBe("Bob");

      // Reset mock docs tracking
      mockGetDoc.mockClear();

      // 2. Call again for user-1 and user-2 immediately: Should be 100% cached
      const profiles2 = await fetchUserProfiles(["user-1", "user-2"]);
      expect(mockGetDoc).toHaveBeenCalledTimes(0); // 0 queries to Firestore
      expect(profiles2).toEqual(profiles1);

      // 3. Request user-1 (cached) and user-3 (missing): Should query only for user-3
      mockGetDoc.mockClear();
      const profiles3 = await fetchUserProfiles(["user-1", "user-3"]);
      expect(mockGetDoc).toHaveBeenCalledTimes(1); // 1 query for missing user-3
      expect(profiles3).toHaveLength(2);
      expect(profiles3[0].uid).toBe("user-1"); // Alice (resolved from cache)
      expect(profiles3[1].uid).toBe("user-3"); // Charlie (resolved from DB query)

      // 4. Advance time by 11 minutes (above 10 min TTL)
      vi.advanceTimersByTime(11 * 60 * 1000);
      mockGetDoc.mockClear();
      mockGetDoc.mockImplementation(async (ref) => {
        const uid = ref.paths[ref.paths.length - 1];
        if (uid === "user-1") {
          return {
            id: "user-1",
            exists: () => true,
            data: () => ({ displayName: "Alice Updated" }),
          };
        }
        return { exists: () => false };
      });

      // Call for user-1 again: Cache should be stale, so it queries Firestore
      const profiles4 = await fetchUserProfiles(["user-1"]);
      expect(mockGetDoc).toHaveBeenCalledTimes(1);
      expect(profiles4[0].displayName).toBe("Alice Updated");
    });

    it("should coalesce overlapping concurrent fetches for user profiles", async () => {
      let resolvePromise: any;
      const dbPromise = new Promise<any>((resolve) => {
        resolvePromise = resolve;
      });
      mockGetDoc.mockReturnValue(dbPromise);

      // Trigger concurrent fetches with overlapping UIDs (user-1 is fetched in both)
      const p1 = fetchUserProfiles(["user-1", "user-2"]);
      const p2 = fetchUserProfiles(["user-2", "user-3"]);

      // Both user-1, user-2, user-3 are missing and need fetching.
      // Total getDoc calls should be 3 (one for each missing user: user-1, user-2, user-3).
      expect(mockGetDoc).toHaveBeenCalledTimes(3);

      // Resolve the database calls
      resolvePromise({
        exists: () => true,
        data: () => ({ displayName: "Placeholder" }),
      });
    });
  });

  describe("getSessionHistory Cache", () => {
    it("should cache session history, reuse it, and invalidate on session completion", async () => {
      const mockSessions = [
        { id: "s1", duration: 25, status: "completed" },
      ];

      mockGetDocs.mockResolvedValue({
        docs: mockSessions.map(s => ({
          id: s.id,
          data: () => s
        }))
      });

      // 1. Initial Call: Query Firestore
      const res1 = await getSessionHistory("user-1");
      expect(mockGetDocs).toHaveBeenCalledTimes(1);
      expect(res1).toHaveLength(1);

      // 2. Immediate Call: Cache hit
      const res2 = await getSessionHistory("user-1");
      expect(mockGetDocs).toHaveBeenCalledTimes(1);
      expect(res2).toEqual(res1);

      // 3. Complete a session: Invalidation happens
      const { invalidateSessionHistoryCache } = await import("@/lib/db");
      invalidateSessionHistoryCache("user-1");

      // 4. Call again after invalidation: Query Firestore again
      mockGetDocs.mockResolvedValue({
        docs: [
          ...mockSessions.map(s => ({ id: s.id, data: () => s })),
          { id: "s2", data: () => ({ duration: 25, status: "completed" }) }
        ]
      });
      const res3 = await getSessionHistory("user-1");
      expect(mockGetDocs).toHaveBeenCalledTimes(2);
      expect(res3).toHaveLength(2);
    });
  });

  describe("Friendship Caching", () => {
    it("should cache getFriendsList, getFriendsListSimple, getFriendsLeaderboard, and getFriendsActivity and invalidate them", async () => {
      // Setup mock database behavior for friends lists and profile resolutions
      mockGetDocs.mockImplementation(async (q: any) => {
        const path = q.path || (q.ref && q.ref.path) || "";
        if (path.includes("friends")) {
          return {
            docs: [
              { id: "friend-1", data: () => ({ friendId: "friend-1", since: null }) }
            ]
          };
        }
        return {
          docs: [
            { id: "friend-1", data: () => ({ uid: "friend-1", displayName: "Alice", totalMinutes: 100 }) },
            { id: "user-1", data: () => ({ uid: "user-1", displayName: "Self", totalMinutes: 50 }) }
          ]
        };
      });

      mockGetDoc.mockImplementation(async (ref) => {
        const uid = ref.paths[ref.paths.length - 1];
        if (uid === "friend-1") {
          return {
            id: "friend-1",
            exists: () => true,
            data: () => ({ uid: "friend-1", displayName: "Alice", totalMinutes: 100 }),
          };
        }
        if (uid === "user-1") {
          return {
            id: "user-1",
            exists: () => true,
            data: () => ({ uid: "user-1", displayName: "Self", totalMinutes: 50 }),
          };
        }
        return { exists: () => false };
      });

      // 1. Test getFriendsList
      const list1 = await getFriendsList("user-1");
      expect(list1).toHaveLength(1);
      expect(list1[0].userData?.displayName).toBe("Alice");

      // Verify cache hit
      const list2 = await getFriendsList("user-1");
      expect(list2).toEqual(list1);

      // 2. Test getFriendsListSimple
      const simple1 = await getFriendsListSimple("user-1");
      expect(simple1).toHaveLength(1);
      expect(simple1[0].friendId).toBe("friend-1");

      // Verify cache hit
      const simple2 = await getFriendsListSimple("user-1");
      expect(simple2).toEqual(simple1);

      // 3. Test getFriendsLeaderboard
      const leaderboard1 = await getFriendsLeaderboard("user-1");
      expect(leaderboard1).toHaveLength(2); // Friend + Self
      expect(leaderboard1[0].displayName).toBe("Alice");

      // Verify cache hit
      const leaderboard2 = await getFriendsLeaderboard("user-1");
      expect(leaderboard2).toEqual(leaderboard1);

      // 4. Test getFriendsActivity
      mockGetDocs.mockImplementation(async (q: any) => {
        const path = q.path || (q.ref && q.ref.path) || "";
        if (path.includes("friends")) {
          return {
            docs: [
              { id: "friend-1", data: () => ({ friendId: "friend-1", since: null }) }
            ]
          };
        }
        if (path.includes("sessions")) {
          return {
            docs: [
              { id: "sess-1", data: () => ({ userId: "friend-1", duration: 25, completedAt: null }) }
            ]
          };
        }
        return { docs: [] };
      });

      const act1 = await getFriendsActivity("user-1");
      expect(act1).toHaveLength(1);
      expect(act1[0].id).toBe("sess-1");

      // Verify cache hit
      const act2 = await getFriendsActivity("user-1");
      expect(act2).toEqual(act1);

      // 5. Test Cache Invalidation
      const { invalidateFriendshipCaches } = await import("@/lib/friendship");
      invalidateFriendshipCaches("user-1");

      // Reset mock tracking and verify cache miss after invalidation
      mockGetDocs.mockClear();
      const act3 = await getFriendsActivity("user-1");
      expect(mockGetDocs).toHaveBeenCalled();
      expect(act3).toHaveLength(1);
    });
  });
});
