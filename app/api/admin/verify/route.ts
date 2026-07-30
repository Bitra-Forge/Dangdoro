import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ isAdmin: false });
    }
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const adminDoc = await adminDb.collection("admins").doc(decodedToken.uid).get();
    return NextResponse.json({ isAdmin: adminDoc.exists });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}
