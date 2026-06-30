import {
    collection, addDoc, getDocs, serverTimestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Material } from "@/lib/groups";

const MAX_MATERIALS = 20;

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
