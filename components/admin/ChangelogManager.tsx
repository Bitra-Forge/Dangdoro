"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Trash2,
  Edit3,
  Upload,
  X,
  Loader2,
  Sparkles,
  Wrench,
  Calendar,
  ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  ChangelogItem,
  ChangelogType,
  UpcomingStatus,
  ChangelogMedia,
  TabFilter,
  typeConfig,
  formatDate,
} from "@/components/changelog/changelog-types";
import { ChangelogTabs } from "@/components/changelog/ChangelogTabs";
import { ChangelogTimeline } from "@/components/changelog/ChangelogTimeline";

interface ChangelogManagerProps {
  entries: ChangelogItem[];
  onSubmit: (data: Partial<ChangelogItem>) => Promise<boolean>;
  onUpdate: (id: string, data: Partial<ChangelogItem>) => Promise<boolean>;
  onSilentUpdate?: (id: string, data: Partial<ChangelogItem>) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
  submitting: boolean;
  deletingId: string | null;
}

export function ChangelogManager({
  entries,
  onSubmit,
  onUpdate,
  onSilentUpdate,
  onDelete,
  submitting,
  deletingId,
}: ChangelogManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localEntries, setLocalEntries] = useState<ChangelogItem[]>(entries);

  useEffect(() => {
    setLocalEntries(entries);
  }, [entries]);

  // Form state
  const [type, setType] = useState<ChangelogType>("feature");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [status, setStatus] = useState<UpcomingStatus>("planned");
  const [media, setMedia] = useState<ChangelogMedia | null>(null);
  const [uploading, setUploading] = useState(false);

  // Preview state
  const [previewTab, setPreviewTab] = useState<TabFilter>("all");

  const resetForm = () => {
    setEditingId(null);
    setType("feature");
    setTitle("");
    setDescription("");
    setDate(new Date().toISOString().split("T")[0]);
    setStatus("planned");
    setMedia(null);
  };

  const handleEditClick = (entry: ChangelogItem) => {
    setEditingId(entry.id);
    setType(entry.type);
    setTitle(entry.title);
    setDescription(entry.description);
    if (entry.date) {
      try {
        setDate(new Date(entry.date).toISOString().split("T")[0]);
      } catch {
        setDate(new Date().toISOString().split("T")[0]);
      }
    } else {
      setDate(new Date().toISOString().split("T")[0]);
    }
    setStatus(entry.status || "planned");
    setMedia(
      entry.media ||
        (entry.imageUrl ? { url: entry.imageUrl, type: "image" } : null)
    );
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10MB limit.");
      return;
    }

    const isGif = file.type === "image/gif";

    // 1. Instant local preview (0ms delay)
    const localBlobUrl = URL.createObjectURL(file);
    setMedia({
      url: localBlobUrl,
      type: isGif ? "gif" : "image",
    });

    setUploading(true);
    try {
      const { getAuth } = await import("firebase/auth");
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          setMedia({
            url: data.url,
            type: data.type || (isGif ? "gif" : "image"),
          });
        }
      } else {
        console.warn("Server upload failed, keeping local preview.");
      }
    } catch (err) {
      console.error("Failed to upload media to Firebase Storage:", err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    if (type !== "upcoming" && !date) return;

    const existingEntry = editingId ? localEntries.find((item) => item.id === editingId) : null;
    let existingOrder = existingEntry?.order;

    if (editingId && existingOrder === undefined) {
      const idx = localEntries.findIndex((item) => item.id === editingId);
      if (idx !== -1) {
        existingOrder = (idx + 1) * 10;
      }
    }

    const payload: Partial<ChangelogItem> = {
      type,
      title: title.trim(),
      description: description.trim(),
      date: type === "upcoming" ? null : new Date(date).toISOString(),
      status: type === "upcoming" ? status : null,
      media: media,
    };

    if (existingOrder !== undefined) {
      payload.order = existingOrder;
    }

    let ok = false;
    if (editingId) {
      setLocalEntries((prev) =>
        prev.map((item) =>
          item.id === editingId ? ({ ...item, ...payload } as ChangelogItem) : item
        )
      );
      ok = await onUpdate(editingId, payload);
    } else {
      ok = await onSubmit(payload);
    }

    if (ok) {
      resetForm();
    }
  };

  /* Draft item computed live for the preview */
  const draftItem: ChangelogItem = useMemo(() => {
    return {
      id: editingId || "draft-preview",
      type,
      title: title || "Your Update Title",
      description:
        description ||
        "Enter a description on the left to see live preview updates...",
      date: type === "upcoming" ? null : new Date(date || Date.now()).toISOString(),
      status: type === "upcoming" ? status : null,
      media,
    };
  }, [editingId, type, title, description, date, status, media]);

  /* Combined entries for Live Preview */
  const previewEntries = useMemo(() => {
    const list = localEntries.filter((e) => e.id !== editingId);
    return [draftItem, ...list];
  }, [localEntries, editingId, draftItem]);

  /* Reorder handler for live preview up/down arrows (silent and local) */
  const handleReorder = async (entryId: string, direction: "up" | "down") => {
    let list = [...previewEntries];
    if (previewTab !== "all") {
      list = list.filter((item) => item.type === previewTab);
    }
    list.sort((a, b) => {
      const isDraftA = a.id === "draft-preview" || a.id === editingId;
      const isDraftB = b.id === "draft-preview" || b.id === editingId;
      if (isDraftA) return -1;
      if (isDraftB) return 1;

      if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
      if (a.type === "upcoming" && b.type !== "upcoming") return -1;
      if (a.type !== "upcoming" && b.type === "upcoming") return 1;
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      return timeB - timeA;
    });

    const index = list.findIndex((item) => item.id === entryId);
    if (index === -1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const minIndex = (list[0]?.id === "draft-preview" || list[0]?.id === editingId) ? 1 : 0;
    if (targetIndex < minIndex || targetIndex >= list.length) return;

    const item1 = list[index];
    const item2 = list[targetIndex];

    const order1 = item2.order !== undefined ? item2.order : (targetIndex + 1) * 10;
    const order2 = item1.order !== undefined ? item1.order : (index + 1) * 10;

    const finalOrder1 = order1 === order2 ? order1 - 1 : order1;
    const finalOrder2 = order2;

    setLocalEntries((prev) =>
      prev.map((item) => {
        if (item.id === item1.id) return { ...item, order: finalOrder1 };
        if (item.id === item2.id) return { ...item, order: finalOrder2 };
        return item;
      })
    );

    const updateFn = onSilentUpdate || onUpdate;
    if (item1.id !== "draft-preview") {
      updateFn(item1.id, { order: finalOrder1 });
    }
    if (item2.id !== "draft-preview") {
      updateFn(item2.id, { order: finalOrder2 });
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Split Screen 50/50 Layout with Middle Divider Line */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0 h-full relative">
        {/* LEFT COLUMN: Form + Entries List (6 cols on lg, with right border line) */}
        <div className="lg:col-span-6 h-full overflow-y-auto flex flex-col space-y-6 lg:pr-8 lg:border-r lg:border-white/10 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]">
          {/* Entry Form Window */}
          <div className="rounded-[10px] border border-white/10 bg-[#121110] overflow-hidden shadow-2xl shrink-0">
            {editingId && (
              <div className="flex items-center justify-between bg-[#C9B037]/10 border-b border-[#C9B037]/20 px-4 py-2 text-[#C9B037]">
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 font-pixelify">
                  <Edit3 className="w-3.5 h-3.5" /> Editing Entry ({editingId.slice(0, 8)})
                </span>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-[5px] bg-black/40 hover:bg-black/60 text-zinc-300 text-xs font-bold transition-all cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" /> Exit
                </button>
              </div>
            )}

            {/* Top Segmented Type Selector Tabs */}
            <div className="grid grid-cols-3 border-b border-white/10 bg-[#181716] divide-x divide-white/10">
              {[
                { id: "feature", label: "Feature", Icon: Sparkles, activeColor: "text-emerald-400 bg-emerald-500/10", barColor: "bg-emerald-500 shadow-[0_0_8px_#10b981]" },
                { id: "fix", label: "Fix", Icon: Wrench, activeColor: "text-red-400 bg-red-500/10", barColor: "bg-red-500 shadow-[0_0_8px_#ef4444]" },
                { id: "upcoming", label: "Upcoming", Icon: Calendar, activeColor: "text-blue-400 bg-blue-500/10", barColor: "bg-blue-500 shadow-[0_0_8px_#3b82f6]" },
              ].map((tab) => {
                const isActive = type === tab.id;
                const { Icon } = tab;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setType(tab.id as ChangelogType)}
                    className={cn(
                      "py-3.5 px-3 font-pixelify text-sm font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer relative select-none",
                      isActive
                        ? tab.activeColor
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02]"
                    )}
                  >
                    {isActive && (
                      <div className={cn("absolute top-0 inset-x-0 h-[3px]", tab.barColor)} />
                    )}
                    <Icon
                      className={cn(
                        "w-4 h-4 transition-transform duration-300",
                        isActive ? "scale-110" : "text-zinc-400"
                      )}
                    />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Form Fields Container */}
            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
              {/* Title & Date / Status Side-by-Side Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 block font-pixelify tracking-wide">
                    Title
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Focus Zone Ambient Soundscapes"
                    className="w-full bg-[#181716] border border-white/10 rounded-[5px] px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#C9B037]/60 focus:bg-[#1c1b1a] transition-all shadow-inner"
                    required
                  />
                </div>

                {/* Release Date or Progress Status */}
                {type !== "upcoming" ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-300 block font-pixelify tracking-wide">
                      Release Date
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-[#181716] border border-white/10 rounded-[5px] px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#C9B037]/60 transition-all shadow-inner [color-scheme:dark]"
                      required
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-300 block font-pixelify tracking-wide">
                      Progress Status
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-[#181716] p-1 rounded-[5px] border border-white/10">
                      {(["planned", "in-progress"] as UpcomingStatus[]).map(
                        (st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setStatus(st)}
                            className={cn(
                              "py-1.5 rounded-[5px] text-xs font-bold uppercase tracking-wider transition-all cursor-pointer font-pixelify",
                              status === st
                                ? st === "in-progress"
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                  : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                : "text-zinc-500 hover:text-zinc-300"
                            )}
                          >
                            {st === "in-progress" ? "In Progress" : "Planned"}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Description Textarea */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 block font-pixelify tracking-wide">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the update details clearly..."
                  rows={4}
                  className="w-full bg-[#181716] border border-white/10 rounded-[5px] px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#C9B037]/60 focus:bg-[#1c1b1a] transition-all resize-y min-h-[90px] leading-relaxed shadow-inner"
                  required
                />
              </div>

              {/* Media Attachment Dropzone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 block font-pixelify tracking-wide">
                  Media Attachment (optional image / GIF)
                </label>

                {media?.url ? (
                  <div className="relative rounded-[5px] overflow-hidden border border-white/10 group aspect-video bg-black/50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={media.url}
                      alt="Uploaded media preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <span className="text-[10px] font-bold uppercase text-zinc-300 bg-black/60 px-2.5 py-1 rounded-[5px] border border-white/10 font-pixelify">
                        {media.type}
                      </span>
                      <button
                        type="button"
                        onClick={() => setMedia(null)}
                        className="p-2 rounded-[5px] bg-red-500/80 hover:bg-red-600 text-white text-xs font-bold transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/10 rounded-[5px] bg-[#181716]/60 hover:bg-[#181716] hover:border-white/20 transition-all cursor-pointer text-center group">
                    {uploading ? (
                      <div className="flex items-center gap-2 py-3 text-xs text-[#C9B037] font-bold font-pixelify">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading to Firebase Storage...
                      </div>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-2.5 text-zinc-400 group-hover:text-white group-hover:bg-white/10 transition-all shadow-sm">
                          <Upload className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-zinc-200">
                          Drop an image or GIF here, or click to browse
                        </span>
                        <span className="text-[10px] text-zinc-500 mt-1">
                          PNG, JPG, WEBP, or GIF (max 10MB)
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*,.gif"
                      onChange={handleMediaUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={
                    submitting || uploading || !title.trim() || !description.trim()
                  }
                  className="w-full py-3.5 rounded-[5px] bg-[#C9B037] hover:bg-[#d9c147] text-black font-pixelify text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-[#C9B037]/15 flex items-center justify-center active:scale-[0.99]"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving Doc...
                    </span>
                  ) : (
                    <span>{editingId ? "Update Patch Note" : "Publish Patch Note"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Existing Saved Entries Section */}
          <div className="space-y-3 shrink-0 pb-4">
            <div className="flex items-center gap-2 px-1">
              <h3 className="text-xs font-bold text-zinc-400 font-pixelify tracking-wide">
                Existing Saved Entries
              </h3>
              <span className="bg-white/10 text-zinc-300 text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums font-pixelify">
                {localEntries.length}
              </span>
            </div>

            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1 [scrollbar-width:thin]">
              <AnimatePresence mode="popLayout">
                {localEntries.map((entry) => {
                  const cfg = typeConfig[entry.type] || typeConfig.feature;
                  const { Icon } = cfg;

                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      className={cn(
                        "group relative rounded-[10px] border p-3.5 flex items-center justify-between gap-3.5 transition-all bg-[#121110] overflow-hidden",
                        editingId === entry.id
                          ? "border-[#C9B037]/60 shadow-[0_0_15px_rgba(201,176,55,0.15)]"
                          : "border-white/10 hover:border-white/20"
                      )}
                    >
                      {/* Left vertical colored indicator bar */}
                      <div
                        className="absolute left-0 inset-y-0 w-1"
                        style={{ backgroundColor: cfg.dot }}
                      />

                      <div className="flex items-center gap-3.5 min-w-0 flex-1 pl-1">
                        {/* Icon Container inside rounded square */}
                        <div
                          className="w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0 border border-white/10 bg-[#181716]"
                          style={{ color: cfg.dot }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>

                        {/* Text Content */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="px-1.5 py-0.5 rounded-[5px] text-[9px] font-bold uppercase tracking-wider font-pixelify border"
                              style={{
                                color: cfg.textColor,
                                backgroundColor: cfg.accentBg,
                                borderColor: cfg.borderColor,
                              }}
                            >
                              {entry.type}
                            </span>
                            <h4 className="text-xs font-bold text-white truncate">
                              {entry.title}
                            </h4>
                            {(entry.media?.url || entry.imageUrl) && (
                              <ImageIcon className="w-3 h-3 text-zinc-400" />
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 line-clamp-1 leading-relaxed">
                            {entry.description}
                          </p>
                        </div>
                      </div>

                      {/* Right Date + Actions */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-[11px] text-zinc-500 font-medium tabular-nums select-none font-pixelify mr-1">
                          {formatDate(entry)}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditClick(entry)}
                            disabled={submitting || deletingId === entry.id}
                            className="w-8 h-8 rounded-[5px] border border-white/10 bg-[#181716] hover:bg-white/15 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-30"
                            title="Edit entry"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(entry.id)}
                            disabled={deletingId === entry.id}
                            className="w-8 h-8 rounded-[5px] border border-white/10 bg-[#181716] hover:bg-red-500/20 text-zinc-400 hover:text-red-400 hover:border-red-500/30 flex items-center justify-center transition-all cursor-pointer disabled:opacity-30"
                            title="Remove entry"
                          >
                            {deletingId === entry.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {localEntries.length === 0 && (
                <div className="text-center py-10 rounded-[10px] border border-dashed border-white/10 bg-[#121110]">
                  <p className="text-xs text-zinc-500 font-bold font-pixelify">
                    No saved entries in Firestore
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live 50/50 Split Preview Window (6 cols on lg) */}
        <div className="lg:col-span-6 h-full flex flex-col min-h-0">
          <div className="h-full flex flex-col min-h-0 rounded-[10px] border border-white/15 bg-[#0b0b0a] shadow-2xl overflow-hidden">
            {/* Scrollable Public Page Mirror Container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]">
              {/* Public Page Mock Header */}
              <div className="text-center space-y-2 py-2 border-b border-white/5 pb-6">
                <h2 className="font-pixelify text-3xl sm:text-4xl font-bold text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]">
                  Patch Notes
                </h2>
                <p className="font-pixelify text-xs text-zinc-400 max-w-xs mx-auto">
                  Every feature, fix, and improvement starts with you.
                </p>
              </div>

              {/* Shared Tabs Component */}
              <ChangelogTabs
                activeTab={previewTab}
                onTabChange={setPreviewTab}
                entries={previewEntries}
                compact={true}
              />

              {/* Shared Timeline Component */}
              <ChangelogTimeline
                entries={previewEntries}
                activeTab={previewTab}
                previewMode={true}
                onReorder={handleReorder}
                draftId={editingId || "draft-preview"}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
