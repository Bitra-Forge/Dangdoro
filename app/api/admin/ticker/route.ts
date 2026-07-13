import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase-admin";
import { getAdminFromRequest } from "@/lib/admin-check";
import { Timestamp } from "firebase-admin/firestore";

export async function GET() {
  try {
    const snap = await adminDb.collection("config").doc("ticker").get();
    if (!snap.exists) {
      return NextResponse.json({ users: 231, hours: 934, sessions: 1746 });
    }
    const data = snap.data();
    return NextResponse.json({
      users: typeof data?.users === "number" ? data.users : 231,
      hours: typeof data?.hours === "number" ? data.hours : 934,
      sessions: typeof data?.sessions === "number" ? data.sessions : 1746,
    });
  } catch {
    return NextResponse.json({ users: 231, hours: 934, sessions: 1746 });
  }
}

export async function POST(req: Request) {
  try {
    await getAdminFromRequest(req);
    const body = await req.json();
    const { users, hours, sessions } = body;

    if (
      typeof users !== "number" || users < 0 ||
      typeof hours !== "number" || hours < 0 ||
      typeof sessions !== "number" || sessions < 0
    ) {
      return NextResponse.json(
        { error: "users, hours, and sessions must be numeric and >= 0" },
        { status: 400 }
      );
    }

    await adminDb.collection("config").doc("ticker").set({
      users,
      hours,
      sessions,
      updatedAt: Timestamp.now(),
    });

    revalidatePath("/welcome");

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
