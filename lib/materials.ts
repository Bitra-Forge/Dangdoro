import {
    collection, addDoc, getDocs, serverTimestamp, doc, updateDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Material } from "@/lib/groups";

export const MAX_MATERIALS = 10;

export async function addMaterial(
    groupId: string,
    data: {
        addedBy: string;
        addedByName: string;
        url: string;
        title: string;
        description?: string;
        tags?: string[];
        type?: "link" | "image" | "file";
        thumbnailUrl?: string;
        fileName?: string;
        fileSize?: number;
    }
): Promise<{ success: boolean; error?: string }> {
    const materialsRef = collection(db, `focusGroups/${groupId}/materials`);
    const countSnap = await getDocs(materialsRef);
    if (countSnap.size >= MAX_MATERIALS) {
        return { success: false, error: `Materials limit reached (${MAX_MATERIALS}). Ask the host to remove older items.` };
    }

    await addDoc(materialsRef, {
        addedBy: data.addedBy,
        addedByName: data.addedByName,
        type: data.type || "link",
        url: data.url,
        thumbnailUrl: data.thumbnailUrl || null,
        fileName: data.fileName || null,
        fileSize: data.fileSize || null,
        title: data.title,
        description: data.description || "",
        tags: data.tags || [],
        createdAt: serverTimestamp(),
    } as Omit<Material, "id">);

    return { success: true };
}

export async function updateMaterial(
    groupId: string,
    materialId: string,
    updates: Partial<Pick<Material, "title" | "description" | "tags" | "url">>
): Promise<{ success: boolean; error?: string }> {
    try {
        const materialRef = doc(db, `focusGroups/${groupId}/materials`, materialId);
        await updateDoc(materialRef, updates);
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message || "Failed to update material" };
    }
}

export async function downloadMaterial(
    url: string,
    fileName: string,
    onProgress: (percent: number) => void,
    signal: AbortSignal
): Promise<void> {
    const res = await fetch(url, { signal });
    if (!res.ok) {
        throw new Error(`Failed to download: ${res.statusText}`);
    }

    const contentLength = res.headers.get("content-length");
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

    if (!res.body) {
        throw new Error("Response body is not readable");
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        if (value) {
            chunks.push(value);
            receivedBytes += value.length;
            if (totalBytes > 0) {
                onProgress(Math.round((receivedBytes / totalBytes) * 100));
            } else {
                onProgress(-1); // Content-Length missing
            }
        }
    }

    if (typeof window !== "undefined") {
        const contentType = res.headers.get("content-type") || "";
        const blob = new Blob(chunks as any[], { type: contentType });
        const blobUrl = window.URL.createObjectURL(blob);

        try {
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } finally {
            window.URL.revokeObjectURL(blobUrl);
        }
    }
}
