import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { sessionId } = body;
    if (!sessionId || typeof sessionId !== "string") {
      return Response.json({ error: "Session ID is required" }, { status: 400 });
    }

    const docRef = adminDb.collection("liveSessions").doc(sessionId);
    await docRef.delete();

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error ending live session via API:", error);
    return Response.json(
      { error: "An unexpected error occurred while ending the session" },
      { status: 500 }
    );
  }
}
