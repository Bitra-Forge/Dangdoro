/**
 * Cleanup Guests Script
 * 
 * This script deletes all anonymous users and their associated data 
 * (profiles, tasks, sessions) from Firebase.
 * 
 * PRE-REQUISITES:
 * 1. Generate a Service Account Key from Firebase Console (Settings -> Service Accounts).
 * 2. Save it as `service-account.json` in the project root (and ensure it's in .gitignore).
 * 3. Run via: npx tsx scripts/cleanup-guests.ts
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Resolve service account
const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
    console.error("❌ Error: service-account.json not found in root directory.");
    console.log("Please download your service account key from the Firebase Console.");
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const db = admin.firestore();

async function cleanupAnonymousUsers() {
    console.log("🔥 Starting Daily Guest Purge...");
    let deletedCount = 0;

    try {
        // 1. Fetch all users from Auth
        let nextPageToken;
        do {
            const listUsersResult = await auth.listUsers(1000, nextPageToken);

            for (const userRecord of listUsersResult.users) {
                // We only target anonymous users (no providers)
                if (userRecord.providerData.length === 0) {
                    const lastSignIn = userRecord.metadata.lastSignInTime;
                    const lastSignInDate = new Date(lastSignIn || userRecord.metadata.creationTime);
                    const now = new Date();
                    const hoursSinceLastActive = (now.getTime() - lastSignInDate.getTime()) / (1000 * 60 * 60);

                    // Only delete if inactive for more than 24 hours
                    if (hoursSinceLastActive >= 24) {
                        const uid = userRecord.uid;
                        console.log(`🧹 Cleaning up guest: ${uid} (Inactive for ${hoursSinceLastActive.toFixed(1)}h)`);

                        // A. Delete Firestore Profile
                        await db.collection('users').doc(uid).delete();

                        // B. Delete associated Tasks
                        const tasksSnapshot = await db.collection('tasks').where('userId', '==', uid).get();
                        const taskBatch = db.batch();
                        tasksSnapshot.docs.forEach(doc => taskBatch.delete(doc.ref));
                        await taskBatch.commit();

                        // C. Delete associated Sessions
                        const sessionsSnapshot = await db.collection('sessions').where('userId', '==', uid).get();
                        const sessionBatch = db.batch();
                        sessionsSnapshot.docs.forEach(doc => sessionBatch.delete(doc.ref));
                        await sessionBatch.commit();

                        // D. Delete from Auth
                        await auth.deleteUser(uid);

                        deletedCount++;
                    } else {
                        console.log(`⏭️ Skipping active guest: ${userRecord.uid} (Last active ${hoursSinceLastActive.toFixed(1)}h ago)`);
                    }
                }
            }
            nextPageToken = listUsersResult.pageToken;
        } while (nextPageToken);

        console.log(`✅ Success! Purged ${deletedCount} guest accounts.`);
    } catch (error) {
        console.error("❌ Cleanup failed:", error);
    }
}

cleanupAnonymousUsers();
