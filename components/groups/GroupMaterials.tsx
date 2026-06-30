"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/AuthProvider";
import { Material, ChatMessage } from "@/lib/groups";
import { addMaterial } from "@/lib/materials";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { X, Link, Image, FileText, Trash2, Plus, Upload } from "lucide-react";
import { cn, extractFirstUrl } from "@/lib/utils";
import { toast } from "sonner";

interface GroupMaterialsProps {
    groupId: string;
    isHost?: boolean;
    groupName?: string;
}

type MaterialFilter = "all" | "link" | "image" | "file";

const FILE_ICONS: Record<string, string> = {
    pdf: "PDF",
    docx: "DOC",
    pptx: "PPT",
    xlsx: "XLS",
    txt: "TXT",
};

function getFileExtension(url: string, fileName?: string | null): string {
    const name = fileName || url;
    const ext = name.split(".").pop()?.toLowerCase() || "";
    return FILE_ICONS[ext] || "FILE";
}

function formatFileSize(bytes: number | null): string {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function GroupMaterials({ groupId, isHost, groupName }: GroupMaterialsProps) {
    const { user } = useAuth();
    const [materials, setMaterials] = useState<Material[]>([]);
    const [filter, setFilter] = useState<MaterialFilter>("all");
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState<"link" | "image" | "file">("link");
    const [linkUrl, setLinkUrl] = useState("");
    const [linkTitle, setLinkTitle] = useState("");
    const [linkDesc, setLinkDesc] = useState("");
    const [linkTags, setLinkTags] = useState("");
    const [uploading, setUploading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    useEffect(() => {
        const materialsRef = collection(db, `focusGroups/${groupId}/materials`);
        const q = query(materialsRef, orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material));
            setMaterials(items);
        });
        return unsub;
    }, [groupId]);

    const filtered = useMemo(() => {
        if (filter === "all") return materials;
        return materials.filter(m => m.type === filter);
    }, [materials, filter]);

    const handleAddLink = async () => {
        if (!user || !linkUrl.trim()) return;
        const result = await addMaterial(groupId, {
            addedBy: user.uid,
            addedByName: user.displayName || "Anonymous",
            url: linkUrl.trim(),
            title: linkTitle.trim() || linkUrl.trim(),
            description: linkDesc.trim(),
            tags: linkTags.split(",").map(t => t.trim()).filter(Boolean),
        });
        if (result.success) {
            toast.success("Link saved to Materials");
            setShowModal(false);
            setLinkUrl("");
            setLinkTitle("");
            setLinkDesc("");
            setLinkTags("");
        } else {
            toast.error(result.error || "Failed to save link");
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        const isImage = file.type.startsWith("image/");
        const allowedRaw = [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain",
        ];

        if (isImage && file.size > 5 * 1024 * 1024) {
            toast.error("Image must be under 5MB");
            return;
        }
        if (!isImage && !allowedRaw.includes(file.type)) {
            toast.error("File type not allowed. Allowed: PDF, DOCX, PPTX, XLSX, TXT");
            return;
        }
        if (!isImage && file.size > 10 * 1024 * 1024) {
            toast.error("File must be under 10MB");
            return;
        }

        setUploading(true);
        try {
            const idToken = await user.getIdToken();
            const formData = new FormData();
            formData.append("file", file);
            formData.append("resource_type", isImage ? "image" : "raw");

            const res = await fetch("/api/upload", {
                method: "POST",
                headers: { Authorization: `Bearer ${idToken}` },
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Upload failed");
            }

            const data = await res.json();

            const materialData: {
                addedBy: string;
                addedByName: string;
                url: string;
                title: string;
                type: "image" | "file";
                thumbnailUrl?: string;
                fileName?: string;
                fileSize?: number;
            } = {
                addedBy: user.uid,
                addedByName: user.displayName || "Anonymous",
                url: data.url,
                title: file.name,
                type: isImage ? "image" : "file",
                fileName: file.name,
                fileSize: file.size,
            };

            if (isImage) {
                const parts = data.url.split("/upload/");
                materialData.thumbnailUrl = `${parts[0]}/upload/w_300,q_auto/${parts[1]}`;
            }

            const result = await addMaterial(groupId, materialData);
            if (result.success) {
                toast.success(`${isImage ? "Image" : "File"} saved to Materials`);
                setShowModal(false);
            } else {
                toast.error(result.error || "Failed to save");
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Upload failed";
            toast.error(msg);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (materialId: string) => {
        try {
            await deleteDoc(doc(db, `focusGroups/${groupId}/materials`, materialId));
            toast.success("Material deleted");
        } catch (err) {
            console.error("Failed to delete material:", err);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center">
                        <Link className="w-4 h-4 text-zinc-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-white tracking-tighter">Materials</h3>
                        <p className="text-zinc-500 text-[10px] font-bold mt-0.5">Links, images, and files shared with the unit.</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white text-black font-black rounded-xl text-xs relative overflow-hidden hover:bg-zinc-100 transition-all cursor-pointer"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add Material
                </button>
            </div>

            <div className="flex gap-1 p-1 bg-zinc-950/40 rounded-xl w-fit border border-white/5">
                {(["all", "link", "image", "file"] as MaterialFilter[]).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cn(
                            "relative px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors duration-200 cursor-pointer",
                            filter === f ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        {filter === f && (
                            <motion.div
                                layoutId={`material-filter-${groupId}`}
                                className="absolute inset-0 bg-white/10 rounded-lg border border-white/10"
                                transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.8 }}
                            />
                        )}
                        <span className="relative z-10">{f === "all" ? "All" : f === "link" ? "Links" : f === "image" ? "Images" : "Files"}</span>
                    </button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <div className="p-12 text-center bg-zinc-900/20 border border-white/5 border-dashed rounded-[2rem] space-y-4">
                    <div className="w-14 h-14 rounded-full bg-zinc-800/40 flex items-center justify-center mx-auto text-zinc-600">
                        <Link className="w-6 h-6" />
                    </div>
                    <p className="text-sm text-zinc-500 font-medium">No materials yet.</p>
                    <button onClick={() => setShowModal(true)} className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer">
                        Add the first one
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(m => {
                        const canDelete = user?.uid === m.addedBy || isHost;
                        return (
                            <motion.div
                                key={m.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="group bg-zinc-900/60 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all relative"
                            >
                                {m.type === "image" && (
                                    <button onClick={() => setSelectedImage(m.url)} className="w-full aspect-video bg-zinc-950 overflow-hidden cursor-pointer">
                                        <img
                                            src={m.thumbnailUrl || m.url}
                                            alt={m.title}
                                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                                        />
                                    </button>
                                )}
                                {m.type === "file" && (
                                    <div className="w-full aspect-video bg-zinc-950 flex items-center justify-center">
                                        <div className="flex flex-col items-center gap-2 text-zinc-600">
                                            <FileText className="w-10 h-10" />
                                            <span className="text-[10px] font-black uppercase tracking-wider">{getFileExtension(m.url, m.fileName)}</span>
                                        </div>
                                    </div>
                                )}
                                <div className="p-4 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                {m.type === "link" && <Link className="w-3 h-3 text-cyan-400 shrink-0" />}
                                                {m.type === "image" && <Image className="w-3 h-3 text-purple-400 shrink-0" />}
                                                {m.type === "file" && <FileText className="w-3 h-3 text-amber-400 shrink-0" />}
                                                <span className="text-[9px] font-black uppercase tracking-wider text-zinc-600">{m.type}</span>
                                            </div>
                                            <a
                                                href={m.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm font-bold text-white hover:text-cyan-400 transition-colors line-clamp-2"
                                            >
                                                {m.title}
                                            </a>
                                        </div>
                                        {canDelete && (
                                            <button
                                                onClick={() => handleDelete(m.id)}
                                                className="p-1.5 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                    {m.description && (
                                        <div className="text-xs text-zinc-500 line-clamp-3">
                                            <MarkdownRenderer content={m.description} />
                                        </div>
                                    )}
                                    {m.type === "file" && (m.fileName || m.fileSize) && (
                                        <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                                            {m.fileName && <span className="truncate">{m.fileName}</span>}
                                            {m.fileSize && <span>{formatFileSize(m.fileSize)}</span>}
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between pt-1">
                                        <div className="flex items-center gap-1.5">
                                            <Avatar className="w-4 h-4 rounded-full border border-white/10">
                                                <AvatarImage src="" />
                                                <AvatarFallback className="text-[6px] bg-zinc-800">{m.addedByName?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-[10px] text-zinc-600">{m.addedByName}</span>
                                        </div>
                                        {m.tags && m.tags.length > 0 && (
                                            <div className="flex gap-1">
                                                {m.tags.slice(0, 2).map(tag => (
                                                    <span key={tag} className="px-1.5 py-0.5 rounded-full bg-white/5 text-[8px] font-bold text-zinc-500 uppercase tracking-wider">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-sm"
                        onClick={() => setShowModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-zinc-900 border border-white/10 rounded-[10px] p-6 max-w-lg w-full shadow-2xl space-y-5"
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-black text-white">Add Material</h3>
                                <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-500 transition-colors cursor-pointer">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex gap-2">
                                {(["link", "image", "file"] as const).map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setModalType(t)}
                                        className={cn(
                                            "flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border",
                                            modalType === t
                                                ? "bg-white/10 text-white border-white/20"
                                                : "bg-zinc-950/60 text-zinc-500 border-white/5 hover:text-zinc-300"
                                        )}
                                    >
                                        {t === "link" ? "Link" : t === "image" ? "Image" : "File"}
                                    </button>
                                ))}
                            </div>

                            {modalType === "link" && (
                                <div className="space-y-3">
                                    <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="URL *" className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-white/20 transition-all" />
                                    <input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Title" className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-white/20 transition-all" />
                                    <textarea value={linkDesc} onChange={(e) => setLinkDesc(e.target.value)} placeholder="Description (markdown)" rows={3} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-white/20 transition-all resize-none" />
                                    <input value={linkTags} onChange={(e) => setLinkTags(e.target.value)} placeholder="Tags (comma separated)" className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-white/20 transition-all" />
                                    <button onClick={handleAddLink} disabled={!linkUrl.trim()} className="w-full py-3 bg-white text-black font-black rounded-lg text-xs hover:bg-zinc-100 transition-all disabled:opacity-50 cursor-pointer">
                                        Save Link
                                    </button>
                                </div>
                            )}

                            {(modalType === "image" || modalType === "file") && (
                                <div className="space-y-4">
                                    <p className="text-xs text-zinc-500">
                                        {modalType === "image" ? "Max 5MB. JPEG, PNG, GIF, WebP." : "Max 10MB. PDF, DOCX, PPTX, XLSX, TXT."}
                                    </p>
                                    <label className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-white/10 rounded-xl hover:border-white/20 transition-colors cursor-pointer bg-zinc-950/60">
                                        <Upload className="w-8 h-8 text-zinc-500" />
                                        <span className="text-sm font-medium text-zinc-400">{uploading ? "Uploading..." : "Click to select file"}</span>
                                        <input
                                            type="file"
                                            accept={modalType === "image" ? "image/*" : ".pdf,.docx,.pptx,.xlsx,.txt"}
                                            onChange={handleFileUpload}
                                            className="hidden"
                                            disabled={uploading}
                                        />
                                    </label>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {selectedImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
                        onClick={() => setSelectedImage(null)}
                    >
                        <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 p-2 bg-zinc-900/80 rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer z-10">
                            <X className="w-5 h-5" />
                        </button>
                        <motion.img
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            src={selectedImage}
                            alt="Full size"
                            className="max-w-full max-h-full object-contain rounded-2xl"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
