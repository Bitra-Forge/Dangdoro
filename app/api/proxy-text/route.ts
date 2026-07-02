import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const url = searchParams.get("url");

        if (!url) {
            return new NextResponse("Missing url parameter", { status: 400 });
        }

        // Fetch the file content server-side to bypass CORS
        const response = await fetch(url);
        if (!response.ok) {
            return new NextResponse(`Failed to fetch text: ${response.statusText}`, { status: response.status });
        }

        const text = await response.text();

        return new NextResponse(text, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "public, max-age=600",
            },
        });
    } catch (error: any) {
        console.error("Error proxying text:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
