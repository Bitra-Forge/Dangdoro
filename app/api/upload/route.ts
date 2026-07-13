import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { adminAuth } from "@/lib/firebase-admin";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split("Bearer ")[1];
    await adminAuth.verifyIdToken(token);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const resourceType = (formData.get("resource_type") as string) || "auto";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowedMimeTypes: Record<string, string[]> = {
      image: [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/x-icon",
        "image/vnd.microsoft.icon",
        "image/svg+xml",
        "application/pdf"
      ],
      raw: [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
        "text/markdown",
      ],
    };

    const typeGroup = resourceType === "raw" ? "raw" : "image";
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const isAllowedExt = resourceType === "raw"
      ? ["pdf", "docx", "pptx", "xlsx", "txt", "md"].includes(ext)
      : ["jpg", "jpeg", "png", "gif", "webp", "pdf", "ico", "svg"].includes(ext);

    if (!allowedMimeTypes[typeGroup].includes(file.type) && !isAllowedExt) {
      return NextResponse.json(
        { error: `File type ${file.type} is not allowed for ${typeGroup} uploads` },
        { status: 400 }
      );
    }

    const uploadId = formData.get("uploadId") as string | null;
    const contentRange = formData.get("contentRange") as string | null;

    let totalSize = file.size;
    if (contentRange) {
      const match = contentRange.match(/\/(\d+|\*)$/);
      if (match && match[1] !== "*") {
        totalSize = parseInt(match[1], 10);
      }
    }

    const maxSize = resourceType === "raw" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (totalSize > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB` },
        { status: 400 }
      );
    }

    if (uploadId && contentRange) {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const timestamp = Math.round(new Date().getTime() / 1000);
      
      const paramsToSign = {
        folder: "dangdoro_materials",
        timestamp: timestamp,
      };
      
      const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET!);
      
      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType === "raw" ? "raw" : "image"}/upload`;
      
      const cloudinaryFormData = new FormData();
      const bytes = await file.arrayBuffer();
      const blob = new Blob([bytes], { type: file.type });
      
      cloudinaryFormData.append("file", blob, file.name);
      cloudinaryFormData.append("api_key", process.env.CLOUDINARY_API_KEY!);
      cloudinaryFormData.append("timestamp", timestamp.toString());
      cloudinaryFormData.append("signature", signature);
      cloudinaryFormData.append("folder", "dangdoro_materials");
      
      const response = await fetch(cloudinaryUrl, {
        method: "POST",
        headers: {
          "X-Unique-Upload-Id": uploadId,
          "Content-Range": contentRange,
        },
        body: cloudinaryFormData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Cloudinary chunk upload raw error:", errorText);
        let errorMsg = "Cloudinary chunk upload failed";
        try {
          const parsed = JSON.parse(errorText);
          errorMsg = parsed.error?.message || errorMsg;
        } catch {}
        return NextResponse.json({ error: errorMsg }, { status: 400 });
      }
      
      const data = await response.json();
      
      return NextResponse.json({
        url: data.secure_url || null,
        type: typeGroup,
        done: data.done !== undefined ? data.done : true,
      });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await new Promise<{ secure_url: string; resource_type: string }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "dangdoro_materials",
          resource_type: resourceType as "auto" | "raw" | "image" | "video",
        },
        (error, result) => {
          if (error || !result) return reject(error || new Error("Cloudinary upload failed"));
          resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    return NextResponse.json({
      url: result.secure_url,
      type: typeGroup,
    });
  } catch (err: unknown) {
    console.error("Upload error:", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
