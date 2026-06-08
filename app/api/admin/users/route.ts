import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAdminFromRequest } from "@/lib/admin-check";

export async function GET(req: Request) {
  try {
    await getAdminFromRequest(req);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.toLowerCase() || "";

    if (search) {
      const usersSnap = await adminDb.collection("users").get();
      const filtered = usersSnap.docs.filter((doc) => {
        const d = doc.data();
        const name = (d.displayName || "").toLowerCase();
        const email = (d.email || "").toLowerCase();
        return name.includes(search) || email.includes(search);
      });

      const users = filtered.map((doc) => {
        const d = doc.data();
        return {
          uid: doc.id,
          displayName: d.displayName || "",
          email: d.email || "",
          photoURL: d.photoURL || null,
          isAnonymous: d.isAnonymous || false,
          totalPomodoros: d.totalPomodoros || 0,
          totalMinutes: d.totalMinutes || 0,
          banned: d.banned || false,
          createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
          lastActive: d.lastActive?.toDate?.()?.toISOString() || null,
        };
      });

      return NextResponse.json({ users });
    }

    const snap = await adminDb
      .collection("users")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const users = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        uid: doc.id,
        displayName: d.displayName || "",
        email: d.email || "",
        photoURL: d.photoURL || null,
        isAnonymous: d.isAnonymous || false,
        totalPomodoros: d.totalPomodoros || 0,
        totalMinutes: d.totalMinutes || 0,
        banned: d.banned || false,
        createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
        lastActive: d.lastActive?.toDate?.()?.toISOString() || null,
      };
    });

    return NextResponse.json({ users });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const decoded = await getAdminFromRequest(req);

    const body = await req.json();
    const { uid, banned } = body;

    if (!uid) {
      return NextResponse.json({ error: "uid is required" }, { status: 400 });
    }

    await adminDb.collection("users").doc(uid).update({
      banned: !!banned,
      bannedBy: decoded.uid,
      bannedAt: new Date(),
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
