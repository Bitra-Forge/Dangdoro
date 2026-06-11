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
    const { title, content } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    await adminDb.collection("changelog").doc(id).update({
      title,
      content,
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}

