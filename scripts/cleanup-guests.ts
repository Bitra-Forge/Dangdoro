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

function initializeAdmin() {
    // 1. Check individual env variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
        console.log("Initialize Firebase Admin using individual Environment Variables...");
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
        return;
    }

    // 2. Check full service account JSON env variable
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountJson) {
        try {
            console.log("Initialize Firebase Admin using FIREBASE_SERVICE_ACCOUNT Environment Variable...");
            const serviceAccount = JSON.parse(serviceAccountJson);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            return;
        } catch (err: any) {
            console.error("❌ Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:", err.message);
        }
    }

    // 3. Fallback: service-account.json file
    const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
        try {
            console.log("Initialize Firebase Admin using service-account.json file...");
            const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            return;
        } catch (err: any) {
            console.error("❌ Failed to parse service-account.json file:", err.message);
            process.exit(1);
        }
    }

    console.error("❌ Error: Firebase credentials not found. Please set FIREBASE_SERVICE_ACCOUNT, individual env variables, or place service-account.json in the project root.");
    process.exit(1);
}

initializeAdmin();

const auth = admin.auth();
const db = admin.firestore();

async function deleteUserFirestoreData(uid: string) {
    // A. Delete Firestore Profile
    await db.collection('users').doc(uid).delete();

    // B. Delete associated Tasks
    const tasksSnapshot = await db.collection('tasks').where('userId', '==', uid).get();
    if (!tasksSnapshot.empty) {
        const taskBatch = db.batch();
        tasksSnapshot.docs.forEach(doc => taskBatch.delete(doc.ref));
        await taskBatch.commit();
    }

    // C. Delete associated Sessions
    const sessionsSnapshot = await db.collection('sessions').where('userId', '==', uid).get();
    if (!sessionsSnapshot.empty) {
        const sessionBatch = db.batch();
        sessionsSnapshot.docs.forEach(doc => sessionBatch.delete(doc.ref));
        await sessionBatch.commit();
    }
}

async function cleanupAnonymousUsers() {
    console.log("🔥 Starting Guest Purge...");
    let authDeletedCount = 0;
    let firestoreDeletedCount = 0;
    const now = new Date();
    const thresholdHours = parseInt(process.env.INACTIVE_HOURS_THRESHOLD || '24', 10);
    console.log(`🕒 Inactivity threshold: ${thresholdHours} hours.`);

    try {
        const processedUids = new Set<string>();

        // Phase 1: Clean up via Firebase Auth list (targets active + empty guest accounts)
        console.log("🔍 Scanning Firebase Auth users...");
        let nextPageToken;
        do {
            const listUsersResult = await auth.listUsers(1000, nextPageToken);

            for (const userRecord of listUsersResult.users) {
                // We only target anonymous users (no providers)
                if (userRecord.providerData.length === 0) {
                    const uid = userRecord.uid;
                    processedUids.add(uid);

                    const lastSignIn = userRecord.metadata.lastSignInTime;
                    const lastSignInDate = new Date(lastSignIn || userRecord.metadata.creationTime);
                    const hoursSinceLastActive = (now.getTime() - lastSignInDate.getTime()) / (1000 * 60 * 60);

                    if (hoursSinceLastActive >= thresholdHours) {
                        console.log(`🧹 Cleaning up guest: ${uid} (Inactive for ${hoursSinceLastActive.toFixed(1)}h)`);

                        // Delete Firestore data
                        await deleteUserFirestoreData(uid);

                        // Delete Auth User
                        await auth.deleteUser(uid);
                        authDeletedCount++;
                    } else {
                        console.log(`⏭️ Skipping active guest user: ${uid} (Last active ${hoursSinceLastActive.toFixed(1)}h ago)`);
                    }
                }
            }
            nextPageToken = listUsersResult.pageToken;
        } while (nextPageToken);

        // Phase 2: Clean up orphaned guest profiles in Firestore
        // (targets Firestore profiles whose Auth accounts are already gone/deleted)
        console.log("🔍 Checking for orphaned guest profiles in Firestore...");
        const usersSnapshot = await db.collection('users').get();
        for (const doc of usersSnapshot.docs) {
            const uid = doc.id;
            // Skip if we already processed this UID in Phase 1
            if (processedUids.has(uid)) continue;

            const data = doc.data();
            const isGuest = !data.email || (data.displayName && data.displayName.startsWith("Guest #"));
            
            if (isGuest) {
                const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt || 0);
                const hoursSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

                if (hoursSinceCreated >= thresholdHours) {
                    console.log(`🧹 Cleaning up orphaned Firestore guest profile: ${uid} (Created ${hoursSinceCreated.toFixed(1)}h ago)`);
                    
                    // Delete Firestore data
                    await deleteUserFirestoreData(uid);

                    // Try to delete Auth user just in case
                    try {
                        await auth.deleteUser(uid);
                        authDeletedCount++;
                    } catch (err: any) {
                        // Expected if the Auth user is indeed missing/orphaned
                        if (err.code !== 'auth/user-not-found') {
                            console.error(`Warning: Failed to delete auth user ${uid}:`, err.message);
                        }
                    }
                    
                    firestoreDeletedCount++;
                }
            }
        }

        console.log(`✅ Success! Purged ${authDeletedCount} Auth accounts and cleaned up ${firestoreDeletedCount} orphaned Firestore guest profiles.`);
    } catch (error) {
        console.error("❌ Cleanup failed:", error);
    }
}

cleanupAnonymousUsers();
