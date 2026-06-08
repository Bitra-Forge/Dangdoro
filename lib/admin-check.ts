import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function verifyAdminFromToken(token: string) {
  const decodedToken = await adminAuth.verifyIdToken(token);
  const adminDoc = await adminDb.collection("admins").doc(decodedToken.uid).get();
  if (!adminDoc.exists) {
    throw new Error("Unauthorized");
  }
  return decodedToken;
}

export async function getAdminFromRequest(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.split("Bearer ")[1];
  return verifyAdminFromToken(token);
}
