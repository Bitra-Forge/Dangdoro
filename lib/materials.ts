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
