import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAdminFromRequest } from "@/lib/admin-check";
import { Timestamp } from "firebase-admin/firestore";

export async function GET(req: Request) {
  try {
    await getAdminFromRequest(req);

    const snap = await adminDb
      .collection("changelog")
      .orderBy("createdAt", "desc")
      .get();

    const entries = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
    }));

    return NextResponse.json({ entries });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const decoded = await getAdminFromRequest(req);

    const body = await req.json();
    const { title, content } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    const docRef = await adminDb.collection("changelog").add({
      title,
      content,
      createdBy: decoded.uid,
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({ id: docRef.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
