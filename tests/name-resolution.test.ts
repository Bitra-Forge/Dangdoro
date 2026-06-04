import { vi, describe, it, expect } from "vitest";

// Mock Firebase client library to prevent real initialization errors
vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => [{}]),
  getApp: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  collection: vi.fn(),
  addDoc: vi.fn(),
}));

vi.mock("@/lib/firebase", () => ({
  db: {},
  auth: {},
  storage: {},
}));

import { resolveUserDisplayName } from "@/lib/db";

describe("resolveUserDisplayName", () => {
  it("resolves to Google name when a guest user links to Google", () => {
    const providerData = [{ displayName: "محمد" }];
    const authDisplayName = "Guest #8FZZ";
    const existingDisplayName = "Guest #8FZZ";

    const resolved = resolveUserDisplayName(providerData, authDisplayName, existingDisplayName);
    expect(resolved).toBe("محمد");
  });

  it("resolves to Auth name when a guest user links to Email/Password with a custom name", () => {
    const providerData: { displayName: string | null }[] = [];
    const authDisplayName = "John Doe";
    const existingDisplayName = "Guest #8FZZ";

    const resolved = resolveUserDisplayName(providerData, authDisplayName, existingDisplayName);
    expect(resolved).toBe("John Doe");
  });

  it("resolves to Google name even if the Auth displayName has already been updated to Google name", () => {
    const providerData = [{ displayName: "محمد" }];
    const authDisplayName = "محمد";
    const existingDisplayName = "محمد";

    const resolved = resolveUserDisplayName(providerData, authDisplayName, existingDisplayName);
    expect(resolved).toBe("محمد");
  });

  it("retains the existing name from the database if provider and auth names are not set", () => {
    const providerData: { displayName: string | null }[] = [];
    const authDisplayName = null;
    const existingDisplayName = "Original Pilot Name";

    const resolved = resolveUserDisplayName(providerData, authDisplayName, existingDisplayName);
    expect(resolved).toBe("Original Pilot Name");
  });

  it("falls back to 'Focus Hero' if absolutely no name is available", () => {
    const providerData: { displayName: string | null }[] = [];
    const authDisplayName = null;
    const existingDisplayName = null;

    const resolved = resolveUserDisplayName(providerData, authDisplayName, existingDisplayName);
    expect(resolved).toBe("Focus Hero");
  });

  it("ignores Guest display names returned by a provider check", () => {
    const providerData = [{ displayName: "Guest #ABCD" }];
    const authDisplayName = "Guest #8FZZ";
    const existingDisplayName = "Saved Name";

    const resolved = resolveUserDisplayName(providerData, authDisplayName, existingDisplayName);
    expect(resolved).toBe("Saved Name");
  });

  it("prioritizes custom existing database name over provider name", () => {
    const providerData = [{ displayName: "Google Name" }];
    const authDisplayName = "Google Name";
    const existingDisplayName = "My Custom Name";

    const resolved = resolveUserDisplayName(providerData, authDisplayName, existingDisplayName);
    expect(resolved).toBe("My Custom Name");
  });

  it("prioritizes custom auth display name over provider name if database has default name", () => {
    const providerData = [{ displayName: "Google Name" }];
    const authDisplayName = "My Custom Name";
    const existingDisplayName = "Focus Hero";

    const resolved = resolveUserDisplayName(providerData, authDisplayName, existingDisplayName);
    expect(resolved).toBe("My Custom Name");
  });
});
