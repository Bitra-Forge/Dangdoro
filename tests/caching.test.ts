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

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  collection: vi.fn((db, path) => ({ path })),
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
import { getLeaderboard, getGroupLeaderboard, fetchUserProfiles } from "@/lib/db";

describe("Caching Layer", () => {
  let testTime = new Date("2026-06-04T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    // Increment time by 1 hour for each test to ensure any previously cached values are expired
    testTime = new Date(testTime.getTime() + 1 * 60 * 60 * 1000);
    vi.setSystemTime(testTime);
    mockGetDocs.mockReset();
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

      // Setup Firestore mock return value
      mockGetDocs.mockResolvedValue({
        docs: mockUsers.map((u) => ({
          id: u.id,
          data: () => ({
            displayName: u.displayName,
            totalMinutes: u.totalMinutes,
            totalPomodoros: u.totalPomodoros,
          }),
        })),
      });

      // 1. First Call: Should fetch from database
      const result1 = await getLeaderboard(2);
      expect(mockGetDocs).toHaveBeenCalledTimes(1);
      expect(result1).toHaveLength(2);
      expect(result1[0].displayName).toBe("Alice");

      // 2. Second Call (Immediate): Should use cache and NOT query Firestore
      const result2 = await getLeaderboard(2);
      expect(mockGetDocs).toHaveBeenCalledTimes(1); // Still 1
      expect(result2).toEqual(result1);

      // 3. Third Call (Within TTL - e.g., 4 minutes later): Should still use cache
      vi.advanceTimersByTime(4 * 60 * 1000);
      const result3 = await getLeaderboard(2);
      expect(mockGetDocs).toHaveBeenCalledTimes(1); // Still 1
      expect(result3).toEqual(result1);

      // 4. Fourth Call (After TTL - 6 minutes total passed): Should query Firestore again
      vi.advanceTimersByTime(2 * 60 * 1000); // 4 + 2 = 6 minutes (> 5 mins TTL)
      
      // Update mock response to simulate database updates
      const updatedMockUsers = [
        ...mockUsers,
        { id: "user-3", totalMinutes: 200, totalPomodoros: 8, displayName: "Charlie" },
      ];
      mockGetDocs.mockResolvedValue({
        docs: updatedMockUsers.map((u) => ({
          id: u.id,
          data: () => ({
            displayName: u.displayName,
            totalMinutes: u.totalMinutes,
            totalPomodoros: u.totalPomodoros,
          }),
        })),
      });

      const result4 = await getLeaderboard(3);
      expect(mockGetDocs).toHaveBeenCalledTimes(2); // Incremented to 2
      expect(result4).toHaveLength(3);
    });

    it("should coalesce concurrent calls to getLeaderboard into a single Firestore query", async () => {
      let resolvePromise: any;
      const dbPromise = new Promise<any>((resolve) => {
        resolvePromise = resolve;
      });
      mockGetDocs.mockReturnValue(dbPromise);

      // Trigger two concurrent requests
      const p1 = getLeaderboard(2);
      const p2 = getLeaderboard(2);

      // Verify getDocs was called only once so far
      expect(mockGetDocs).toHaveBeenCalledTimes(1);

      // Resolve the Firestore query
      resolvePromise({
        docs: [
          { id: "user-1", data: () => ({ displayName: "Alice", totalMinutes: 100 }) },
          { id: "user-2", data: () => ({ displayName: "Bob", totalMinutes: 80 }) },
        ],
      });

      const [res1, res2] = await Promise.all([p1, p2]);
      expect(res1).toHaveLength(2);
      expect(res2).toHaveLength(2);
      expect(res1).toEqual(res2);
      expect(mockGetDocs).toHaveBeenCalledTimes(1);
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
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: "user-1",
            data: () => ({ uid: "user-1", displayName: "Alice" }),
          },
          {
            id: "user-2",
            data: () => ({ uid: "user-2", displayName: "Bob" }),
          },
        ],
      });

      const profiles1 = await fetchUserProfiles(["user-1", "user-2"]);
      expect(mockGetDocs).toHaveBeenCalledTimes(1);
      expect(profiles1).toHaveLength(2);
      expect(profiles1[0].displayName).toBe("Alice");
      expect(profiles1[1].displayName).toBe("Bob");

      // Reset mock docs tracking
      mockGetDocs.mockReset();

      // 2. Call again for user-1 and user-2 immediately: Should be 100% cached
      const profiles2 = await fetchUserProfiles(["user-1", "user-2"]);
      expect(mockGetDocs).toHaveBeenCalledTimes(0); // 0 queries to Firestore
      expect(profiles2).toEqual(profiles1);

      // 3. Request user-1 (cached) and user-3 (missing): Should query only for user-3
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: "user-3",
            data: () => ({ uid: "user-3", displayName: "Charlie" }),
          },
        ],
      });

      const profiles3 = await fetchUserProfiles(["user-1", "user-3"]);
      expect(mockGetDocs).toHaveBeenCalledTimes(1); // 1 query for the chunk containing missing user-3
      expect(profiles3).toHaveLength(2);
      expect(profiles3[0].uid).toBe("user-1"); // Alice (resolved from cache)
      expect(profiles3[1].uid).toBe("user-3"); // Charlie (resolved from DB query)

      // 4. Advance time by 3 minutes (above 2 min TTL)
      vi.advanceTimersByTime(3 * 60 * 1000);
      mockGetDocs.mockReset();
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: "user-1",
            data: () => ({ uid: "user-1", displayName: "Alice Updated" }),
          },
        ],
      });

      // Call for user-1 again: Cache should be stale, so it queries Firestore
      const profiles4 = await fetchUserProfiles(["user-1"]);
      expect(mockGetDocs).toHaveBeenCalledTimes(1);
      expect(profiles4[0].displayName).toBe("Alice Updated");
    });

    it("should coalesce overlapping concurrent fetches for user profiles", async () => {
      let resolvePromise: any;
      const dbPromise = new Promise<any>((resolve) => {
        resolvePromise = resolve;
      });
      mockGetDocs.mockReturnValue(dbPromise);

      // Trigger concurrent fetches with overlapping UIDs (user-1 is fetched in both)
      const p1 = fetchUserProfiles(["user-1", "user-2"]);
      const p2 = fetchUserProfiles(["user-2", "user-3"]);

      // Both user-1, user-2, user-3 are missing and need fetching.
      // Call 1 queries for user-1 and user-2.
      // Call 2 sees user-2 is already in-flight, so it only needs to query for user-3.
      // Total getDocs calls should be 2 (one for user-1 & user-2, one for user-3).
      expect(mockGetDocs).toHaveBeenCalledTimes(2);

      // Resolve the database calls
      resolvePromise({
        docs: [
          { id: "user-1", data: () => ({ uid: "user-1", displayName: "Alice" }) },
          { id: "user-2", data: () => ({ uid: "user-2", displayName: "Bob" }) },
          { id: "user-3", data: () => ({ uid: "user-3", displayName: "Charlie" }) },
        ],
      });

      const [res1, res2] = await Promise.all([p1, p2]);
      expect(res1).toHaveLength(2);
      expect(res2).toHaveLength(2);
      expect(res1[0].displayName).toBe("Alice");
      expect(res1[1].displayName).toBe("Bob");
      expect(res2[0].displayName).toBe("Bob");
      expect(res2[1].displayName).toBe("Charlie");
    });
  });
});
