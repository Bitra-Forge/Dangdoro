import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const snap = await adminDb
      .collection("changelog")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const entries = snap.docs.map((doc) => {
      const data = doc.data();
      let dateIso: string | null = null;

      if (data.date?.toDate) {
        dateIso = data.date.toDate().toISOString();
      } else if (data.createdAt?.toDate) {
        dateIso = data.createdAt.toDate().toISOString();
      } else if (typeof data.date === "string") {
        dateIso = data.date;
      } else if (typeof data.createdAt === "string") {
        dateIso = data.createdAt;
      }

      return {
        id: doc.id,
        type: data.type || "feature",
        title: data.title || "",
        description: data.description || data.content || "",
        date: dateIso,
        imageUrl: data.imageUrl || null,
        order: typeof data.order === "number" ? data.order : undefined,
        createdAt: dateIso,
        content: data.content || "",
      };
    });

    return NextResponse.json({ entries });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching changelog";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
