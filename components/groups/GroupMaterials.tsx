"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/AuthProvider";
import { Material, ChatMessage } from "@/lib/groups";
import { addMaterial, updateMaterial, MAX_MATERIALS } from "@/lib/materials";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { X, Link, Image, FileText, Trash2, Plus, Upload, Download, Pencil, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface GroupMaterialsProps {
    groupId: string;
    isHost?: boolean;
    groupName?: string;
    groupMembers?: any[];
}

type MaterialFilter = "all" | "link" | "image" | "file";

const FILE_ICONS: Record<string, string> = {
    pdf: "PDF",
    docx: "DOC",
    pptx: "PPT",
    xlsx: "XLS",
    txt: "TXT",
    md: "MD",
};

function getFileExtension(url: string, fileName?: string | null): string {
    const name = fileName || url;
    const ext = name.split(".").pop()?.toLowerCase() || "";
    return ext.toUpperCase();
}

function formatFileSize(bytes: number | null): string {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getInlinePdfUrl(url: string): string {
    if (url.includes("cloudinary.com") && url.includes("/raw/upload/")) {
        return url.replace("/raw/upload/", "/image/upload/");
    }
    return url;
}

export function GroupMaterials({ groupId, isHost, groupName, groupMembers = [] }: GroupMaterialsProps) {
    const { user } = useAuth();
    const memberPhotoMap = useMemo(() => {
        const map: Record<string, string> = {};
        groupMembers.forEach(m => {
            if (m.uid && m.photoURL) {
                map[m.uid] = m.photoURL;
            }
        });
        return map;
    }, [groupMembers]);

    const [materials, setMaterials] = useState<Material[]>([]);
    const [filter, setFilter] = useState<MaterialFilter>("all");
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState<"link" | "image" | "file">("link");

    // Form fields
    const [linkUrl, setLinkUrl] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [tags, setTags] = useState("");
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
    const [fetchingOg, setFetchingOg] = useState(false);

    // File upload details
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    // Edit material state
    const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

    // Downloading ID state
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    // Preview click states
    const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null);
    const [previewOgData, setPreviewOgData] = useState<{ title: string | null; description: string | null; image: string | null } | null>(null);
    const [previewOgLoading, setPreviewOgLoading] = useState(false);
    const [previewTxtContent, setPreviewTxtContent] = useState<string | null>(null);
    const [previewTxtLoading, setPreviewTxtLoading] = useState(false);


    useEffect(() => {
        const materialsRef = collection(db, `focusGroups/${groupId}/materials`);
        const q = query(materialsRef, orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material));
            setMaterials(items);
        });
        return unsub;
    }, [groupId]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setPreviewMaterial(null);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    useEffect(() => {
        if (modalType !== "link") return;
        const trimmed = linkUrl.trim();
        if (!trimmed) {
            setThumbnailUrl(null);
            return;
        }
        try {
            new URL(trimmed);
        } catch {
            return;
        }

        const fetchOg = async () => {
            setFetchingOg(true);
            try {
                const res = await fetch(`/api/og-preview?url=${encodeURIComponent(trimmed)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.title && !title) {
                        setTitle(data.title);
                    }
                    if (data.description && !description) {
                        setDescription(data.description);
                    }
                    if (data.image) {
                        setThumbnailUrl(data.image);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch og preview:", err);
            } finally {
                setFetchingOg(false);
            }
        };

        const debounceTimer = setTimeout(fetchOg, 500);
        return () => clearTimeout(debounceTimer);
    }, [linkUrl, modalType]);

    const filtered = useMemo(() => {
        if (filter === "all") return materials;
        return materials.filter(m => m.type === filter);
    }, [materials, filter]);

    const handleCloseModal = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setShowModal(false);
        setSelectedFile(null);
        setPreviewUrl(null);
        setTitle("");
        setDescription("");
        setTags("");
        setLinkUrl("");
        setThumbnailUrl(null);
        setFetchingOg(false);
    };

    const handleCloseEditModal = () => {
        setEditingMaterial(null);
        setTitle("");
        setDescription("");
        setTags("");
        setLinkUrl("");
        setThumbnailUrl(null);
        setFetchingOg(false);
    };

    const handleAddLink = async () => {
        if (!user || !linkUrl.trim()) return;
        if (!title.trim()) {
            toast.error("Title is required");
            return;
        }
        const result = await addMaterial(groupId, {
            addedBy: user.uid,
            addedByName: user.displayName || "Anonymous",
            url: linkUrl.trim(),
            title: title.trim(),
            description: description.trim(),
            tags: tags.split(",").map(t => t.trim()).filter(Boolean),
            type: "link",
            thumbnailUrl: thumbnailUrl || undefined
        });
        if (result.success) {
            toast.success("Link saved to Materials");
            handleCloseModal();
        } else {
            toast.error(result.error || "Failed to save link");
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isImage = modalType === "image";
        const allowedRaw = [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain",
            "text/markdown",
        ];

        if (isImage) {
            if (!file.type.startsWith("image/")) {
                toast.error("Please select an image file");
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                toast.error("Image must be under 5MB");
                return;
            }
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        } else {
            const ext = file.name.split(".").pop()?.toLowerCase();
            const allowedExts = ["pdf", "docx", "pptx", "xlsx", "txt", "md"];
            const isAllowedType = allowedRaw.includes(file.type) || (ext && allowedExts.includes(ext));
            if (!isAllowedType) {
                toast.error("File type not allowed. Allowed: PDF, DOCX, PPTX, XLSX, TXT, MD");
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                toast.error("File must be under 10MB");
                return;
            }
        }

        setSelectedFile(file);
        setTitle(file.name); // Autofill title
    };

    const handleConfirmUpload = async () => {
        if (!selectedFile || !user) return;
        if (!title.trim()) {
            toast.error("Title is required");
            return;
        }

        setUploading(true);
        try {
            const isImage = modalType === "image";
            const isPDF = selectedFile.type === "application/pdf" || selectedFile.name.toLowerCase().endsWith(".pdf");
            const resourceType = (isImage || isPDF) ? "image" : "raw";
            const idToken = await user.getIdToken();
            const formData = new FormData();
            formData.append("file", selectedFile);
            formData.append("resource_type", resourceType);

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
                description: string;
                tags: string[];
                type: "image" | "file";
                thumbnailUrl?: string;
                fileName?: string;
                fileSize?: number;
            } = {
                addedBy: user.uid,
                addedByName: user.displayName || "Anonymous",
                url: data.url,
                title: title.trim(),
                description: description.trim(),
                tags: tags.split(",").map(t => t.trim()).filter(Boolean),
                type: isImage ? "image" : "file",
                fileName: selectedFile.name,
                fileSize: selectedFile.size,
            };

            if (isImage) {
                const parts = data.url.split("/upload/");
                materialData.thumbnailUrl = `${parts[0]}/upload/w_300,q_auto/${parts[1]}`;
            }

            const result = await addMaterial(groupId, materialData);
            if (result.success) {
                toast.success(`${isImage ? "Image" : "File"} saved to Materials`);
                handleCloseModal();
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

    const handleDownload = async (m: Material) => {
        setDownloadingId(m.id);
        try {
            // Fetch via server-side proxy-download to bypass CORS and force direct attachment headers
            const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(m.url)}&filename=${encodeURIComponent(m.fileName || m.title || "download")}`;
            const res = await fetch(proxyUrl);
            if (!res.ok) {
                throw new Error(`Failed to fetch from proxy: ${res.statusText}`);
            }
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = m.fileName || m.title || 'download';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
            toast.success("Download completed");
        } catch (err) {
            console.warn("Proxy download failed, falling back to direct link:", err);
            const a = document.createElement('a');
            a.href = m.url;
            a.target = "_blank";
            a.download = m.fileName || m.title || 'download';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            toast.success("Opening download in new tab");
        } finally {
            setDownloadingId(null);
        }
    };

    const handleEditClick = (m: Material) => {
        setEditingMaterial(m);
        setTitle(m.title);
        setDescription(m.description || "");
        setTags(m.tags ? m.tags.join(", ") : "");
        setLinkUrl(m.url || "");
    };

    const handleSaveChanges = async () => {
        if (!editingMaterial || !user) return;
        if (!title.trim()) {
            toast.error("Title is required");
            return;
        }
        if (editingMaterial.type === "link" && !linkUrl.trim()) {
            toast.error("URL is required");
            return;
        }

        const updates: Partial<Pick<Material, "title" | "description" | "tags" | "url">> = {
            title: title.trim(),
            description: description.trim(),
            tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        };

        if (editingMaterial.type === "link") {
            updates.url = linkUrl.trim();
        }

        const result = await updateMaterial(groupId, editingMaterial.id, updates);
        if (result.success) {
            toast.success("Material updated successfully");
            handleCloseEditModal();
        } else {
            toast.error(result.error || "Failed to update material");
        }
    };

    const handleCardClick = async (m: Material) => {
        setPreviewMaterial(m);
        const ext = getFileExtension(m.url, m.fileName);
        const isTextOrCode = ["TXT", "JS", "JSX", "TS", "TSX", "HTML", "CSS", "JSON", "PY", "GO", "RS", "JAVA", "CPP", "C", "SH", "YAML", "YML", "XML", "INI", "CONF", "SQL"].includes(ext);
        const isMarkdown = ["MD", "MARKDOWN"].includes(ext);

        if (m.type === "link") {
            setPreviewOgLoading(true);
            setPreviewOgData(null);
            try {
                const res = await fetch(`/api/og-preview?url=${encodeURIComponent(m.url)}`);
                const data = await res.json();
                setPreviewOgData(data);
            } catch (err) {
                console.error("OG Preview failed:", err);
            } finally {
                setPreviewOgLoading(false);
            }
        } else if (m.type === "file" && (isTextOrCode || isMarkdown)) {
            setPreviewTxtLoading(true);
            setPreviewTxtContent(null);
            try {
                const proxyUrl = `/api/proxy-text?url=${encodeURIComponent(m.url)}`;
                const res = await fetch(proxyUrl);
                if (!res.ok) {
                    throw new Error(`Failed to fetch from text proxy: ${res.statusText}`);
                }
                const txt = await res.text();
                setPreviewTxtContent(txt);
            } catch (err) {
                console.error("Content fetch failed:", err);
                setPreviewTxtContent("Failed to load text content.");
            } finally {
                setPreviewTxtLoading(false);
            }
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
                        <h3 className="text-lg font-black text-white tracking-tighter">
                            Materials ({materials.length}/{MAX_MATERIALS})
                        </h3>
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
                <motion.div
                    layout
                    className="grid gap-4"
                    style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
                >
                    <AnimatePresence mode="popLayout">
                        {filtered.map(m => {
                            const canDelete = user?.uid === m.addedBy || isHost;
                            const canEdit = user?.uid === m.addedBy || isHost;
                            return (
                                <motion.div
                                    key={m.id}
                                    layout="position"
                                    layoutId={m.id}
                                    initial={{ opacity: 0, scale: 0.94, y: 12 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.92, y: -8, transition: { duration: 0.18, ease: "easeIn" } }}
                                    transition={{
                                        layout: { type: "spring", stiffness: 300, damping: 30 },
                                        opacity: { duration: 0.22, ease: "easeOut" },
                                        scale: { duration: 0.22, ease: "easeOut" },
                                        y: { duration: 0.22, ease: "easeOut" },
                                    }}
                                    onClick={() => handleCardClick(m)}
                                    className="group bg-zinc-900/60 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-colors relative flex flex-col h-[360px] max-h-[360px] w-full cursor-pointer"
                                >
                                    {/* Media / Thumbnail area */}
                                    {m.type === "image" && (
                                        <div className="w-full aspect-video bg-zinc-950 overflow-hidden shrink-0 relative border-b border-white/5">
                                            <img
                                                src={m.thumbnailUrl || m.url}
                                                alt={m.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        </div>
                                    )}
                                    {m.type === "file" && (
                                        <div className="w-full aspect-video bg-zinc-950 flex items-center justify-center shrink-0 border-b border-white/5">
                                            <div className="flex flex-col items-center gap-2 text-zinc-600">
                                                <FileText className="w-10 h-10" />
                                                <span className="text-[10px] font-black uppercase tracking-wider">{getFileExtension(m.url, m.fileName)}</span>
                                            </div>
                                        </div>
                                    )}
                                    {m.type === "link" && (
                                        <div className="w-full aspect-video bg-gradient-to-br from-zinc-950 to-zinc-900 overflow-hidden shrink-0 relative border-b border-white/5 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                                            {m.thumbnailUrl ? (
                                                <img
                                                    src={m.thumbnailUrl}
                                                    alt={m.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-[2px]">
                                                    <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-2 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                                                        <Link className="w-4 h-4 text-cyan-400" />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-center truncate max-w-full">
                                                        {(() => {
                                                            try {
                                                                return new URL(m.url).hostname.replace("www.", "");
                                                            } catch {
                                                                return "LINK";
                                                            }
                                                        })()}
                                                    </span>
                                                </div>
                                            )}
                                            {/* Subtle overlay grid lines */}
                                            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
                                        </div>
                                    )}

                                    {/* Action Buttons overlay */}
                                    <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-zinc-950/80 backdrop-blur-sm p-1 rounded-lg border border-white/10">
                                        {m.type === "link" && (
                                            <a
                                                href={m.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
                                                title="Open Link"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                        {(m.type === "image" || m.type === "file") && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDownload(m); }}
                                                className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                                title="Download"
                                                disabled={downloadingId === m.id}
                                            >
                                                {downloadingId === m.id ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Download className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        )}
                                        {canEdit && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleEditClick(m); }}
                                                className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                                title="Edit"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        {canDelete && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}
                                                className="p-1 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Card Body */}
                                    <div className="p-4 flex flex-col flex-1 min-h-0 justify-between">
                                        <div className="space-y-1.5 min-h-0 flex-1 flex flex-col justify-start">
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {m.type === "link" && <Link className="w-3 h-3 text-cyan-400 shrink-0" />}
                                                {m.type === "image" && <Image className="w-3 h-3 text-purple-400 shrink-0" />}
                                                {m.type === "file" && <FileText className="w-3 h-3 text-amber-400 shrink-0" />}
                                                <span className="text-[9px] font-black uppercase tracking-wider text-zinc-600">{m.type}</span>
                                            </div>

                                            <div className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors truncate shrink-0">
                                                {m.title}
                                            </div>

                                            {m.description ? (
                                                <div className="text-xs text-zinc-500 line-clamp-2 overflow-hidden flex-1 leading-normal">
                                                    <MarkdownRenderer content={m.description} />
                                                </div>
                                            ) : (
                                                <div className="text-xs text-zinc-600 italic line-clamp-2 overflow-hidden flex-1">
                                                    No description provided.
                                                </div>
                                            )}

                                            {m.type === "file" && (m.fileName || m.fileSize) && (
                                                <div className="flex items-center gap-2 text-[10px] text-zinc-600 shrink-0 pt-0.5">
                                                    {m.fileName && <span className="truncate flex-1 min-w-0">{m.fileName}</span>}
                                                    {m.fileSize && <span className="shrink-0">{formatFileSize(m.fileSize)}</span>}
                                                </div>
                                            )}
                                        </div>

                                        {/* Footer */}
                                        <div className="flex items-center justify-between pt-2 border-t border-white/5 shrink-0 mt-2">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <Avatar className="w-4 h-4 rounded-full border border-white/10 shrink-0">
                                                    <AvatarImage src={memberPhotoMap[m.addedBy]} />
                                                    <AvatarFallback className="text-[6px] bg-zinc-800">{m.addedByName?.[0]}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-[10px] text-zinc-600 truncate max-w-[80px]">{m.addedByName}</span>
                                            </div>
                                            {m.tags && m.tags.length > 0 && (
                                                <div className="flex gap-1 shrink-0">
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
                    </AnimatePresence>
                </motion.div>
            )}

            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-sm"
                        onClick={handleCloseModal}
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
                                <button onClick={handleCloseModal} className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-500 transition-colors cursor-pointer">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex gap-2">
                                {(["link", "image", "file"] as const).map(t => (
                                    <button
                                        key={t}
                                        onClick={() => {
                                            setModalType(t);
                                            if (previewUrl) URL.revokeObjectURL(previewUrl);
                                            setSelectedFile(null);
                                            setPreviewUrl(null);
                                            setTitle("");
                                            setDescription("");
                                            setTags("");
                                        }}
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
                                    <div className="relative">
                                        <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="URL *" className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-white/20 transition-all pr-10" />
                                        {fetchingOg && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                            </div>
                                        )}
                                    </div>

                                    {thumbnailUrl && (
                                        <div className="w-full h-32 rounded-lg overflow-hidden border border-white/10 bg-zinc-950 relative group">
                                            <img src={thumbnailUrl} alt="Link cover" className="w-full h-full object-cover" />
                                            <button
                                                onClick={() => setThumbnailUrl(null)}
                                                className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}

                                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title *" className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-white/20 transition-all" />
                                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (markdown)" rows={3} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-white/20 transition-all resize-none" />
                                    <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma separated)" className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-white/20 transition-all" />
                                    <button onClick={handleAddLink} disabled={!linkUrl.trim() || !title.trim() || fetchingOg} className="w-full py-3 bg-white text-black font-black rounded-lg text-xs hover:bg-zinc-100 transition-all disabled:opacity-50 cursor-pointer">
                                        Save Link
                                    </button>
                                </div>
                            )}

                            {(modalType === "image" || modalType === "file") && (
                                <div className="space-y-4">
                                    {!selectedFile ? (
                                        <div className="space-y-4">
                                            <p className="text-xs text-zinc-500">
                                                {modalType === "image" ? "Max 5MB. JPEG, PNG, GIF, WebP." : "Max 10MB. PDF, DOCX, PPTX, XLSX, TXT, MD."}
                                            </p>
                                            <label className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-white/10 rounded-xl hover:border-white/20 transition-colors cursor-pointer bg-zinc-950/60">
                                                <Upload className="w-8 h-8 text-zinc-500" />
                                                <span className="text-sm font-medium text-zinc-400">Click to select file</span>
                                                <input
                                                    type="file"
                                                    accept={modalType === "image" ? "image/*" : ".pdf,.docx,.pptx,.xlsx,.txt,.md"}
                                                    onChange={handleFileSelect}
                                                    className="hidden"
                                                />
                                            </label>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Preview block */}
                                            {modalType === "image" && previewUrl && (
                                                <div className="relative w-full aspect-video bg-zinc-950 rounded-xl overflow-hidden border border-white/10">
                                                    <img src={previewUrl} alt="Upload preview" className="w-full h-full object-cover" />
                                                    <button onClick={() => { setSelectedFile(null); setPreviewUrl(null); }} className="absolute top-2 right-2 p-1 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}

                                            {modalType === "file" && (
                                                <div className="p-4 bg-zinc-950 border border-white/10 rounded-xl flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center text-zinc-400 font-bold text-xs uppercase shrink-0">
                                                            {getFileExtension(selectedFile.name)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold text-white truncate max-w-[200px]">{selectedFile.name}</p>
                                                            <p className="text-xs text-zinc-500">{formatFileSize(selectedFile.size)}</p>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => { setSelectedFile(null); }} className="p-1 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}

                                            {/* Title, tags and description fields */}
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Title *</label>
                                                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title *" className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-white/20 transition-all" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Tags (comma separated)</label>
                                                    <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. math, notes" className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-white/20 transition-all" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Description (markdown)</label>
                                                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Provide context about this file..." rows={3} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-white/20 transition-all resize-none" />
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleConfirmUpload}
                                                    disabled={uploading || !title.trim()}
                                                    className="flex-1 py-3 bg-white text-black font-black rounded-lg text-xs hover:bg-zinc-100 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                                                >
                                                    {uploading ? (
                                                        <>
                                                            <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                                            Uploading...
                                                        </>
                                                    ) : (
                                                        "Confirm Upload"
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => { setSelectedFile(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}
                                                    disabled={uploading}
                                                    className="px-4 py-3 bg-zinc-800 text-zinc-300 font-bold rounded-lg text-xs hover:bg-zinc-700 transition-colors disabled:opacity-50"
                                                >
                                                    Change File
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {editingMaterial && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-sm"
                        onClick={handleCloseEditModal}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-zinc-900 border border-white/10 rounded-[10px] p-6 max-w-lg w-full shadow-2xl space-y-5"
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-black text-white">Edit Material</h3>
                                <button onClick={handleCloseEditModal} className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-500 transition-colors cursor-pointer">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {editingMaterial.type === "link" && (
                                    <div>
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">URL *</label>
                                        <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="URL *" className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-white/20 transition-all" />
                                    </div>
                                )}

                                <div>
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Title *</label>
                                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title *" className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-white/20 transition-all" />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Tags (comma separated)</label>
                                    <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. math, notes" className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-white/20 transition-all" />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Description (markdown)</label>
                                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description..." rows={3} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-white/20 transition-all resize-none" />
                                </div>

                                <button onClick={handleSaveChanges} disabled={!title.trim() || (editingMaterial.type === "link" && !linkUrl.trim())} className="w-full py-3 bg-white text-black font-black rounded-lg text-xs hover:bg-zinc-100 transition-all disabled:opacity-50 cursor-pointer">
                                    Save Changes
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {previewMaterial && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
                        onClick={() => setPreviewMaterial(null)}
                    >
                        <button onClick={() => setPreviewMaterial(null)} className="absolute top-4 right-4 p-2 bg-zinc-900/80 rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer z-10">
                            <X className="w-5 h-5" />
                        </button>

                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                            className="max-w-4xl w-full bg-zinc-900 border border-white/10 rounded-[20px] overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]"
                        >
                            {/* Left Side: Media preview */}
                            <div className="flex-1 bg-zinc-950 flex items-center justify-center min-h-[300px] md:min-h-[500px] overflow-hidden">
                                {previewMaterial.type === "image" && (
                                    <img src={previewMaterial.url} alt={previewMaterial.title} className="max-w-full max-h-[70vh] object-contain" />
                                )}

                                {previewMaterial.type === "file" && (() => {
                                    const ext = getFileExtension(previewMaterial.url, previewMaterial.fileName);
                                    const isTextOrCode = ["TXT", "JS", "JSX", "TS", "TSX", "HTML", "CSS", "JSON", "PY", "GO", "RS", "JAVA", "CPP", "C", "SH", "YAML", "YML", "XML", "INI", "CONF", "SQL"].includes(ext);
                                    const isMarkdown = ["MD", "MARKDOWN"].includes(ext);
                                    const isAudio = ["MP3", "WAV", "OGG", "M4A", "AAC"].includes(ext);
                                    const isVideo = ["MP4", "WEBM", "OGV", "MOV"].includes(ext);
                                    const isPdf = ext === "PDF";

                                    if (isMarkdown) {
                                        return (
                                            <div className="w-full h-full p-6 overflow-y-auto max-h-[70vh] flex flex-col select-text bg-zinc-950">
                                                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">MARKDOWN PREVIEW</h4>
                                                {previewTxtLoading ? (
                                                    <div className="flex-1 flex items-center justify-center py-12">
                                                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-zinc-300 prose prose-invert max-w-none bg-zinc-900/40 p-4 rounded-xl border border-white/5 flex-1 overflow-auto max-h-[400px]">
                                                        <MarkdownRenderer content={previewTxtContent || ""} />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }

                                    if (isTextOrCode) {
                                        return (
                                            <div className="w-full h-full p-6 overflow-y-auto max-h-[70vh] flex flex-col select-text bg-zinc-950">
                                                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">{ext} FILE CONTENT</h4>
                                                {previewTxtLoading ? (
                                                    <div className="flex-1 flex items-center justify-center py-12">
                                                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    </div>
                                                ) : (
                                                    <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap bg-zinc-900 p-4 rounded-xl border border-white/5 flex-1 overflow-auto max-h-[400px] leading-relaxed">
                                                        {previewTxtContent}
                                                    </pre>
                                                )}
                                            </div>
                                        );
                                    }

                                    if (isAudio) {
                                        return (
                                            <div className="flex flex-col items-center gap-6 py-12 px-6 w-full max-w-sm">
                                                <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 font-bold text-3xl shadow-xl">
                                                    🎧
                                                </div>
                                                <div className="text-center w-full">
                                                    <p className="text-sm font-bold text-white truncate">{previewMaterial.fileName || previewMaterial.title}</p>
                                                    <p className="text-xs text-zinc-500 mt-1">{previewMaterial.fileSize ? formatFileSize(previewMaterial.fileSize) : ""}</p>
                                                </div>
                                                <audio controls src={previewMaterial.url} className="w-full mt-2" />
                                            </div>
                                        );
                                    }

                                    if (isVideo) {
                                        return (
                                            <div className="w-full h-full min-h-[350px] md:min-h-[500px] flex flex-col p-4 bg-zinc-950 justify-center">
                                                <video controls src={previewMaterial.url} className="max-w-full max-h-[70vh] rounded-xl border border-white/5 shadow-2xl" />
                                            </div>
                                        );
                                    }

                                    if (isPdf) {
                                        return (
                                            <div className="w-full h-full min-h-[500px] flex flex-col p-4 bg-zinc-950">
                                                <iframe
                                                    src={`/api/proxy-pdf?url=${encodeURIComponent(previewMaterial.url)}`}
                                                    className="w-full h-full min-h-[460px] border-0 rounded-xl bg-zinc-900"
                                                    title="PDF Preview"
                                                />
                                            </div>
                                        );
                                    }

                                    // Default fallback
                                    return (
                                        <div className="flex flex-col items-center gap-4 py-12">
                                            <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center text-zinc-500 font-bold text-lg uppercase shadow-xl">
                                                {ext}
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-bold text-white max-w-[300px] truncate">{previewMaterial.fileName || previewMaterial.title}</p>
                                                <p className="text-xs text-zinc-500 mt-1">{previewMaterial.fileSize ? formatFileSize(previewMaterial.fileSize) : ""}</p>
                                            </div>
                                            <button
                                                onClick={() => handleDownload(previewMaterial)}
                                                className="px-6 py-2.5 bg-white text-black font-black text-xs rounded-xl hover:bg-zinc-100 transition-colors flex items-center gap-2 mt-2 cursor-pointer"
                                                disabled={downloadingId === previewMaterial.id}
                                            >
                                                {downloadingId === previewMaterial.id ? (
                                                    <>
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        Downloading...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Download className="w-3.5 h-3.5" />
                                                        Download File
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    );
                                })()}

                                {previewMaterial.type === "link" && (
                                    <div className="w-full p-6 flex flex-col justify-center items-center">
                                        {previewOgLoading ? (
                                            <div className="py-12">
                                                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                            </div>
                                        ) : (
                                            <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-lg flex flex-col">
                                                {(previewOgData?.image || previewMaterial.thumbnailUrl) && (
                                                    <div className="w-full aspect-video bg-zinc-950 overflow-hidden border-b border-white/5">
                                                        <img src={(previewOgData?.image || previewMaterial.thumbnailUrl) || undefined} alt="OG Preview" className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <div className="p-4 space-y-2">
                                                    <span className="text-[8px] font-black uppercase tracking-wider text-cyan-400 px-1.5 py-0.5 rounded-full bg-cyan-950/50 border border-cyan-900/30">LINK PREVIEW</span>
                                                    <h4 className="text-sm font-bold text-white mt-1 leading-snug">{previewOgData?.title || previewMaterial.title || previewMaterial.url}</h4>
                                                    <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">{previewOgData?.description || previewMaterial.description || "No link description parsed."}</p>

                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Right Side: Metadata Panel */}
                            <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-white/10 p-6 flex flex-col justify-between max-h-[500px] md:max-h-none overflow-y-auto">
                                <div className="space-y-6">
                                    {/* Title / Type Header */}
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="space-y-1 flex-1">
                                            <span className={cn(
                                                "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border w-fit block",
                                                previewMaterial.type === "link" ? "text-cyan-400 bg-cyan-950/30 border-cyan-900/30" :
                                                    previewMaterial.type === "image" ? "text-purple-400 bg-purple-950/30 border-purple-900/30" :
                                                        "text-amber-400 bg-amber-950/30 border-amber-900/30"
                                            )}>
                                                {previewMaterial.type}
                                            </span>
                                            <h3 className="text-base font-black text-white leading-tight tracking-tight pt-1 select-all">{previewMaterial.title}</h3>
                                        </div>

                                        {/* Edit/Delete Icons at the top of the card/modal */}
                                        {(user?.uid === previewMaterial.addedBy || isHost) && (
                                            <div className="flex items-center gap-1 bg-zinc-950/60 p-1 rounded-xl border border-white/10 shrink-0">
                                                <button
                                                    onClick={() => {
                                                        handleEditClick(previewMaterial);
                                                        setPreviewMaterial(null);
                                                    }}
                                                    className="p-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                                    title="Edit"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        handleDelete(previewMaterial.id);
                                                        setPreviewMaterial(null);
                                                    }}
                                                    className="p-1.5 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Details Grid */}
                                    <div className="space-y-3 border-t border-white/5 pt-4 text-xs">
                                        <div className="flex justify-between items-start gap-4">
                                            <span className="text-zinc-500 font-bold uppercase text-[9px] tracking-wider shrink-0 mt-0.5">Name</span>
                                            <span className="text-zinc-300 font-medium text-right select-all break-all">{previewMaterial.fileName || previewMaterial.title}</span>
                                        </div>
                                        <div className="flex justify-between items-center gap-4">
                                            <span className="text-zinc-500 font-bold uppercase text-[9px] tracking-wider shrink-0">Type</span>
                                            <span className="text-zinc-300 font-medium capitalize">{previewMaterial.type === "file" ? `${getFileExtension(previewMaterial.url, previewMaterial.fileName)} File` : previewMaterial.type}</span>
                                        </div>
                                        {previewMaterial.fileSize && (
                                            <div className="flex justify-between items-center gap-4">
                                                <span className="text-zinc-500 font-bold uppercase text-[9px] tracking-wider shrink-0">Size</span>
                                                <span className="text-zinc-300 font-medium">{formatFileSize(previewMaterial.fileSize)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center gap-4">
                                            <span className="text-zinc-500 font-bold uppercase text-[9px] tracking-wider shrink-0">Added By</span>
                                            <div className="flex items-center gap-1.5 font-semibold text-white">
                                                <Avatar className="w-4 h-4 rounded-full border border-white/10 shrink-0">
                                                    <AvatarImage src={memberPhotoMap[previewMaterial.addedBy]} />
                                                    <AvatarFallback className="text-[6px] bg-zinc-800">{previewMaterial.addedByName?.[0]}</AvatarFallback>
                                                </Avatar>
                                                <span className="max-w-[120px] truncate font-bold">{previewMaterial.addedByName}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center gap-4">
                                            <span className="text-zinc-500 font-bold uppercase text-[9px] tracking-wider shrink-0">Added At</span>
                                            <span className="text-zinc-300 font-medium text-right">
                                                {previewMaterial.createdAt ? (
                                                    new Date((previewMaterial.createdAt as any).toDate ? (previewMaterial.createdAt as any).toDate() : (previewMaterial.createdAt as any)).toLocaleDateString(undefined, {
                                                        month: "short",
                                                        day: "numeric",
                                                        year: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit"
                                                    })
                                                ) : "N/A"}
                                            </span>
                                        </div>
                                        {previewMaterial.tags && previewMaterial.tags.length > 0 && (
                                            <div className="flex justify-between items-start gap-4 border-t border-white/5 pt-3">
                                                <span className="text-zinc-500 font-bold uppercase text-[9px] tracking-wider shrink-0 mt-0.5">Tags</span>
                                                <div className="flex flex-wrap gap-1 justify-end max-w-[160px]">
                                                    {previewMaterial.tags.map(tag => (
                                                        <span key={tag} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {previewMaterial.description && (
                                        <div className="text-xs text-zinc-400 leading-relaxed border-t border-white/5 pt-4">
                                            <div className="text-zinc-500 font-bold uppercase text-[9px] tracking-wider mb-1.5">Description</div>
                                            <div className="bg-zinc-950/40 p-3 rounded-lg border border-white/5 select-text overflow-y-auto max-h-[120px]">
                                                <MarkdownRenderer content={previewMaterial.description} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                {previewMaterial.type === "link" ? (
                                    <div className="border-t border-white/5 pt-4 flex flex-col gap-3">
                                        <div className="flex gap-2">
                                            <a
                                                href={previewMaterial.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full py-2 bg-white text-black font-black text-[10px] uppercase tracking-wider rounded-lg hover:bg-zinc-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                Open Link
                                            </a>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="border-t border-white/5 pt-4 flex flex-col gap-3">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleDownload(previewMaterial)}
                                                className="w-full py-2 bg-white text-black font-black text-[10px] uppercase tracking-wider rounded-lg hover:bg-zinc-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                                disabled={downloadingId === previewMaterial.id}
                                            >
                                                {downloadingId === previewMaterial.id ? (
                                                    <>
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        Downloading...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Download className="w-3.5 h-3.5" />
                                                        Download
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}




                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
