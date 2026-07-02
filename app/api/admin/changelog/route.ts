import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
    const { type, title, description, date, status, media, order } = body;

    if (!title || (!description && !body.content)) {
      return NextResponse.json(
        { error: "Title and description are required" },
        { status: 400 }
      );
    }

    const itemType = type || "feature";
    const itemDescription = description || body.content || "";
    let dateTimestamp: Timestamp | null = null;

    if (itemType !== "upcoming") {
      const d = date ? new Date(date) : new Date();
      dateTimestamp = isNaN(d.getTime()) ? Timestamp.now() : Timestamp.fromDate(d);
    }

    const now = Timestamp.now();
    const docData = {
      type: itemType,
      title,
      description: itemDescription,
      date: dateTimestamp,
      status: itemType === "upcoming" ? (status || "planned") : null,
      media: media || null,
      order: typeof order === "number" ? order : Date.now(),
      createdBy: decoded.uid,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await adminDb.collection("changelog").add(docData);
    revalidatePath('/patch-notes');

    return NextResponse.json({ id: docRef.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
