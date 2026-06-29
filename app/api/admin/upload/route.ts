import { NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/admin-check";
import { adminStorage } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    await getAdminFromRequest(req);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const isGif = file.type === "image/gif";
    const extension = file.name.split(".").pop() || (isGif ? "gif" : "png");
    const uuid = Math.random().toString(36).substring(2, 9);
    const filename = `changelog/${Date.now()}_${uuid}.${extension}`;

    const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";
    const bucketName = useEmulator
      ? "demo-dangdoro"
      : (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "dangdoro-7579a.firebasestorage.app");

    const bucket = adminStorage.bucket(bucketName);
    const fileRef = bucket.file(filename);

    const downloadToken =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type || (isGif ? "image/gif" : "image/png"),
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    let publicUrl = "";
    if (useEmulator) {
      const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST || "127.0.0.1:9199";
      publicUrl = `http://${emulatorHost}/v0/b/${bucketName}/o/${encodeURIComponent(filename)}?alt=media`;
    } else {
      publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filename)}?alt=media&token=${downloadToken}`;
    }

    return NextResponse.json({
      url: publicUrl,
      type: isGif ? "gif" : "image",
    });
  } catch (err: unknown) {
    console.error("Upload route error:", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
