import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
    revalidatePath('/patch-notes');

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

    if (body.title !== undefined || body.description !== undefined) {
      if (!body.title || (!body.description && !body.content)) {
        return NextResponse.json(
          { error: "Title and description are required" },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, any> = {
      updatedAt: Timestamp.now(),
    };

    if (body.type !== undefined) updateData.type = body.type;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined || body.content !== undefined) {
      updateData.description = body.description || body.content || "";
    }
    if (body.date !== undefined) {
      if (body.type !== "upcoming" && body.date) {
        const d = new Date(body.date);
        updateData.date = isNaN(d.getTime()) ? Timestamp.now() : Timestamp.fromDate(d);
      } else if (body.type === "upcoming") {
        updateData.date = null;
      }
    }
    if (body.status !== undefined) updateData.status = body.status;
    if (body.media !== undefined) updateData.media = body.media;
    if (typeof body.order === "number") updateData.order = body.order;

    await adminDb.collection("changelog").doc(id).update(updateData);
    revalidatePath('/patch-notes');

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
