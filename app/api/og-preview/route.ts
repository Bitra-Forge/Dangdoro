import { NextResponse } from "next/server";

interface CacheEntry {
    data: {
        title: string | null;
        description: string | null;
        image: string | null;
    };
    expiresAt: number;
}

const ogCache = new Map<string, CacheEntry>();

function extractMetaTag(html: string, nameOrProperty: string): string | null {
    const regex1 = new RegExp(`<meta[^>]*(?:property|name)=["']${nameOrProperty}["'][^>]*content=["']([^"']*)["']`, 'i');
    const regex2 = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${nameOrProperty}["']`, 'i');
    
    const match1 = html.match(regex1);
    if (match1) return decodeHtmlEntities(match1[1]);
    
    const match2 = html.match(regex2);
    if (match2) return decodeHtmlEntities(match2[1]);
    
    return null;
}

function extractTitleTag(html: string): string | null {
    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return match ? decodeHtmlEntities(match[1].trim()) : null;
}

function decodeHtmlEntities(str: string): string {
    return str
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const url = searchParams.get("url");

        if (!url) {
            return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
        }

        // Validate URL format
        try {
            new URL(url);
        } catch {
            return NextResponse.json({ title: null, description: null, image: null });
        }

        const now = Date.now();
        const cached = ogCache.get(url);
        if (cached && now < cached.expiresAt) {
            return NextResponse.json(cached.data);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, 3000);

        try {
            const res = await fetch(url, {
                signal: controller.signal,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                },
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
                throw new Error("HTTP error " + res.status);
            }

            const html = await res.text();
            const title = extractMetaTag(html, "og:title") || extractTitleTag(html);
            const description = extractMetaTag(html, "og:description") || extractMetaTag(html, "description");
            let image = extractMetaTag(html, "og:image");

            if (image && !image.startsWith("http://") && !image.startsWith("https://")) {
                try {
                    if (image.startsWith("//")) {
                        image = "https:" + image;
                    } else {
                        const parsedUrl = new URL(url);
                        const baseUrl = parsedUrl.origin;
                        if (image.startsWith("/")) {
                            image = baseUrl + image;
                        } else {
                            image = baseUrl + "/" + image;
                        }
                    }
                } catch (e) {
                    console.error("Failed resolving relative image URL:", image, e);
                }
            }

            const data = { title, description, image };
            ogCache.set(url, {
                data,
                expiresAt: now + 10 * 60 * 1000,
            });

            return NextResponse.json(data);
        } catch (fetchErr) {
            clearTimeout(timeoutId);
            console.error("Fetch/parse failed for", url, fetchErr);
            // Return null metadata gracefully
            return NextResponse.json({ title: null, description: null, image: null });
        }
    } catch (err) {
        console.error("OG Preview API error:", err);
        return NextResponse.json({ title: null, description: null, image: null });
    }
}
