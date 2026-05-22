import * as admin from "firebase-admin";

function initializeAdmin() {
  if (admin.apps.length) return;

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Private keys in env files often have escaped newlines like \\n. We must replace them.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    return;
  }

  // Fallback: try service-account.json (works in local dev and during build)
  try {
    const fs = require("fs");
    const path = require("path");
    const saPath = path.resolve(process.cwd(), "service-account.json");
    if (fs.existsSync(saPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(saPath, "utf8"));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      return;
    }
  } catch {
    // Ignore — will fall through to the warning below
  }

  if (process.env.NODE_ENV === "production") {
    console.error(
      "🚨 CRITICAL: Firebase Admin SDK credentials are not configured. " +
      "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY " +
      "in your hosting platform's environment variables."
    );
  } else {
    console.warn(
      "⚠️  Firebase Admin SDK credentials missing. " +
      "Set env vars or place a service-account.json in the project root."
    );
  }
}

// Initialize eagerly — but guard the exports so they don't throw at import time
initializeAdmin();

/**
 * Lazy accessors that throw a clear error at call-site rather than module load.
 * This prevents `next build` from crashing during static page collection.
 */
function getAdminAuth() {
  if (!admin.apps.length) {
    throw new Error(
      "Firebase Admin is not initialized. Ensure credentials are configured."
    );
  }
  return admin.auth();
}

function getAdminDb() {
  if (!admin.apps.length) {
    throw new Error(
      "Firebase Admin is not initialized. Ensure credentials are configured."
    );
  }
  return admin.firestore();
}

// Export getters that are safe to import even when admin isn't initialized.
// The actual auth()/firestore() calls are deferred to first use.
export const adminAuth = new Proxy({} as ReturnType<typeof admin.auth>, {
  get(_, prop) {
    return (getAdminAuth() as any)[prop];
  },
});

export const adminDb = new Proxy({} as ReturnType<typeof admin.firestore>, {
  get(_, prop) {
    return (getAdminDb() as any)[prop];
  },
});

export { admin };
