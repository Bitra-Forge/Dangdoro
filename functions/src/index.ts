import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK once at startup
admin.initializeApp();

// Export the scheduled reset Cloud Function
export { weeklyReset } from "./weeklyReset";
