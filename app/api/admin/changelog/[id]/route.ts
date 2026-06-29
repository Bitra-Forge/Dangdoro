import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAdminFromRequest } from "@/lib/admin-check";
import { Timestamp } from "firebase-admin/firestore";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAdminFromRequest(req);
    const { id } = await params;

    await adminDb.collection("changelog").doc(id).delete();

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAdminFromRequest(req);
    const { id } = await params;

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

    const updateData: Record<string, any> = {
      type: itemType,
      title,
      description: itemDescription,
      date: dateTimestamp,
      status: itemType === "upcoming" ? (status || "planned") : null,
      media: media !== undefined ? media : null,
      updatedAt: Timestamp.now(),
    };

    if (typeof order === "number") {
      updateData.order = order;
    }

    await adminDb.collection("changelog").doc(id).update(updateData);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
