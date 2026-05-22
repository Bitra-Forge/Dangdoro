import * as admin from "firebase-admin";

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Private keys in env files often have escaped newlines like \n. We must replace them.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } else {
    // Fallback to service-account.json in local development if present
    try {
      const fs = require("fs");
      const path = require("path");
      const saPath = path.resolve(process.cwd(), "service-account.json");
      if (fs.existsSync(saPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(saPath, "utf8"));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      } else {
        console.warn("Firebase Admin SDK credentials missing. Token verification may fail.");
      }
    } catch (err) {
      console.error("Failed to load local service-account.json fallback:", err);
    }
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export { admin };
