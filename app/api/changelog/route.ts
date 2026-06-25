import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const snap = await adminDb
      .collection("changelog")
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();

    const entries = snap.docs.map((doc) => ({
      id: doc.id,
      title: doc.data().title || "",
      content: doc.data().content || "",
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
    }));

    return NextResponse.json({ entries });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching changelog";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
