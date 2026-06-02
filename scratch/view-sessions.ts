import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

function initializeAdmin() {
    const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        return;
    }
    console.error("service-account.json not found");
    process.exit(1);
}

initializeAdmin();
const db = admin.firestore();

async function run() {
    console.log("=== Querying liveSessions ===");
    const snap = await db.collection("liveSessions").get();
    if (snap.empty) {
        console.log("No live sessions found.");
        return;
    }
    snap.docs.forEach((doc) => {
        const d = doc.data();
        console.log(`ID: ${doc.id}`);
        console.log(`  userId: ${d.userId}`);
        console.log(`  userName: ${d.userName}`);
        console.log(`  groupId: ${d.groupId}`);
        console.log(`  status: ${d.status}`);
        console.log(`  startedAt: ${d.startedAt ? d.startedAt.toDate().toISOString() : "null"}`);
        console.log(`  lastHeartbeat: ${d.lastHeartbeat ? d.lastHeartbeat.toDate().toISOString() : "null"}`);
        console.log("------------------------");
    });
}

run();
