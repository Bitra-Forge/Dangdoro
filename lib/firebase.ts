import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, Auth } from "firebase/auth";
import { 
    initializeFirestore, 
    getFirestore, 
    persistentLocalCache, 
    persistentMultipleTabManager,
    Firestore,
    connectFirestoreEmulator
} from "firebase/firestore";
import { getStorage, connectStorageEmulator, FirebaseStorage } from "firebase/storage";

const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-key",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-dangdoro.firebaseapp.com",
    projectId: useEmulator ? "demo-dangdoro" : (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-dangdoro"),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-dangdoro.appspot.com",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:123456789",
};

// Use global cache to prevent HMR from re-initializing and losing emulator connections
interface GlobalFirebase {
    app?: FirebaseApp;
    auth?: Auth;
    db?: Firestore;
    storage?: FirebaseStorage;
    emulatorsConnected?: boolean;
}

const g = (typeof window !== "undefined" ? window : global) as any as { firebaseCache?: GlobalFirebase };
if (!g.firebaseCache) {
    g.firebaseCache = {};
}

const cache = g.firebaseCache;

if (!cache.app) {
    // Check if app already exists in firebase manager before initializing
    const apps = getApps();
    cache.app = apps.length ? apps[0] : initializeApp(firebaseConfig);
}
const app = cache.app;

if (!cache.auth) {
    cache.auth = getAuth(app);
}
const auth = cache.auth;

if (!cache.db) {
    if (typeof window !== "undefined") {
        try {
            // Disable persistent local cache in emulator mode to prevent sync conflicts with prod DB
            cache.db = initializeFirestore(app, {
                localCache: useEmulator ? undefined : persistentLocalCache({
                    tabManager: persistentMultipleTabManager(),
                }),
            });
        } catch {
            cache.db = getFirestore(app);
        }
    } else {
        cache.db = getFirestore(app);
    }
}
const db = cache.db;

if (!cache.storage) {
    cache.storage = getStorage(app);
}
const storage = cache.storage;

// Connect to Firebase Emulators once per initialized instance
if (useEmulator && !cache.emulatorsConnected) {
    try {
        connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
        connectFirestoreEmulator(db, "127.0.0.1", 8080);
        connectStorageEmulator(storage, "127.0.0.1", 9199);
        cache.emulatorsConnected = true;
        if (typeof window !== "undefined") {
            console.log("🔌 Connected Client SDK to local Emulators (Auth: 9099, Firestore: 8080, Storage: 9199)");
        }
    } catch (error) {
        console.warn("⚠️ Failed to connect to some Firebase Emulators:", error);
    }
}

export { app, auth, db, storage };
