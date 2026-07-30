import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const snap = await adminDb
      .collection("changelog")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const entries = snap.docs.map((doc) => {
      const data = doc.data();
      let dateIso: string | null = null;
      let createdAtIso: string | null = null;
      let updatedAtIso: string | null = null;

      if (data.date?.toDate) {
        dateIso = data.date.toDate().toISOString();
      } else if (typeof data.date === "string") {
        dateIso = data.date;
      }

      if (data.createdAt?.toDate) {
        createdAtIso = data.createdAt.toDate().toISOString();
      } else if (typeof data.createdAt === "string") {
        createdAtIso = data.createdAt;
      }

      if (data.updatedAt?.toDate) {
        updatedAtIso = data.updatedAt.toDate().toISOString();
      } else if (typeof data.updatedAt === "string") {
        updatedAtIso = data.updatedAt;
      }

      return {
        id: doc.id,
        type: data.type || "feature",
        title: data.title || "",
        description: data.description || data.content || "",
        date: dateIso || createdAtIso,
        status: data.status || null,
        media: data.media || (data.imageUrl ? { url: data.imageUrl, type: "image" } : null),
        order: typeof data.order === "number" ? data.order : undefined,
        createdAt: createdAtIso,
        updatedAt: updatedAtIso,
        content: data.content || "",
      };
    });

    return NextResponse.json({ entries });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching changelog";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
