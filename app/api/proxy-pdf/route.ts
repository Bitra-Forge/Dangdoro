import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const url = searchParams.get("url");

        if (!url) {
            return new NextResponse("Missing url parameter", { status: 400 });
        }

        // Fetch the PDF from the remote URL server-side
        const response = await fetch(url);
        if (!response.ok) {
            return new NextResponse(`Failed to fetch PDF: ${response.statusText}`, { status: response.status });
        }

        const pdfBuffer = await response.arrayBuffer();

        // Deliver the PDF with inline content disposition
        return new NextResponse(pdfBuffer, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": "inline",
                "Cache-Control": "public, max-age=600",
            },
        });
    } catch (error: any) {
        console.error("Error proxying PDF:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
