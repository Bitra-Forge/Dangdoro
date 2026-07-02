import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const url = searchParams.get("url");
        let filename = searchParams.get("filename") || "download";

        if (!url) {
            return new NextResponse("Missing url parameter", { status: 400 });
        }

        // Fetch the file from the remote URL server-side
        const response = await fetch(url);
        if (!response.ok) {
            return new NextResponse(`Failed to fetch file: ${response.statusText}`, { status: response.status });
        }

        // Get content-type from remote response, fallback to application/octet-stream
        const contentType = response.headers.get("Content-Type") || "application/octet-stream";
        
        // If filename doesn't have an extension, try to infer it from content-type or url
        if (!filename.includes(".") && url.includes(".")) {
            try {
                const urlObj = new URL(url);
                const pathParts = urlObj.pathname.split("/");
                const lastPart = pathParts[pathParts.length - 1];
                if (lastPart.includes(".")) {
                    const ext = lastPart.split(".").pop();
                    if (ext) {
                        filename = `${filename}.${ext}`;
                    }
                }
            } catch {
                // Ignore parsing errors
            }
        }

        const fileBuffer = await response.arrayBuffer();

        // Deliver the file with attachment content disposition
        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `attachment; filename="${filename.replace(/"/g, '\\"')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
                "Cache-Control": "public, max-age=600",
            },
        });
    } catch (error: any) {
        console.error("Error proxying download:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
