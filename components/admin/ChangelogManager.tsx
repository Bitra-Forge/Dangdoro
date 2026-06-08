"use client";

import React, { useState } from "react";
import { Plus, X, Trash2, Edit3, Eye, FileText, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ChangelogEntry {
  id: string;
  title: string;
  content: string;
  createdAt: string | null;
}

interface ChangelogManagerProps {
  entries: ChangelogEntry[];
  onSubmit: (title: string, content: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
  submitting: boolean;
  deletingId: string | null;
}

export function ChangelogManager({
  entries,
  onSubmit,
  onDelete,
  submitting,
  deletingId,
}: ChangelogManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [featuresText, setFeaturesText] = useState("");
  const [fixesText, setFixesText] = useState("");
  const [upcomingText, setUpcomingText] = useState("");
  const [activeEditorTab, setActiveEditorTab] = useState<"write" | "preview">("write");
  const [activePreviewSection, setActivePreviewSection] = useState<"features" | "fixes" | "upcoming">("features");

  const parseSectionLines = (text: string) => {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => l.replace(/^[-*]\s*/, ""));
  };

  const parsedDraft = {
    features: parseSectionLines(featuresText),
    fixes: parseSectionLines(fixesText),
    upcoming: parseSectionLines(upcomingText),
  };

  const totalParsedItems =
    parsedDraft.features.length +
    parsedDraft.fixes.length +
    parsedDraft.upcoming.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!featuresText.trim() && !fixesText.trim() && !upcomingText.trim()) return;

    let contentMd = "";

    const appendSection = (header: string, text: string) => {
      if (!text.trim()) return;
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((l) => (l.startsWith("-") || l.startsWith("*") ? l : `- ${l}`));
      
      if (lines.length > 0) {
        contentMd += `# ${header}\n${lines.join("\n")}\n\n`;
      }
    };

    appendSection("Features", featuresText);
    appendSection("Fixes", fixesText);
    appendSection("Upcoming", upcomingText);

    const success = await onSubmit(title.trim(), contentMd.trim());
    if (success) {
      setTitle("");
      setFeaturesText("");
      setFixesText("");
      setUpcomingText("");
      setShowForm(false);
      setActiveEditorTab("write");
    }
  };

  const sectionsConfig = [
    { id: "features", title: "New Features", color: "text-yellow-400", dotBg: "bg-yellow-400" },
    { id: "fixes", title: "Fixes & Improvements", color: "text-emerald-400", dotBg: "bg-emerald-400" },
    { id: "upcoming", title: "Upcoming", color: "text-sky-400", dotBg: "bg-sky-400" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">Changelog</h1>
          <p className="text-xs text-zinc-500 mt-1">Publish patch notes for the userbase</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setActiveEditorTab("write");
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all cursor-pointer select-none"
        >
          {showForm ? (
            <>
              <X className="w-3.5 h-3.5" /> Cancel
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" /> New Entry
            </>
          )}
        </button>
      </div>

      {/* Expandable Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-white/5 bg-zinc-900/40 backdrop-blur-md p-5 space-y-4">
              {/* Form Navigation (Write vs Preview) */}
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex gap-1 bg-black/40 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setActiveEditorTab("write")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                      activeEditorTab === "write"
                        ? "bg-white text-black"
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    <Edit3 className="w-3 h-3" /> Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveEditorTab("preview")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                      activeEditorTab === "preview"
                        ? "bg-white text-black"
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    <Eye className="w-3 h-3" /> Live Preview
                  </button>
                </div>

                {activeEditorTab === "preview" && totalParsedItems === 0 && (
                  <div className="flex items-center gap-1.5 text-orange-400 text-[10px] font-bold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>No bullet points parsed</span>
                  </div>
                )}
              </div>

              {/* Form Input Content */}
              {activeEditorTab === "write" ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">
                      Release Tag / Title
                    </label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. v2.1.0 - The Analytics Update"
                      className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-white/10 focus:bg-black/50 transition-all"
                      required
                    />
                  </div>
                  
                  {/* Three separate inputs grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">
                        New Features
                      </label>
                      <textarea
                        value={featuresText}
                        onChange={(e) => setFeaturesText(e.target.value)}
                        placeholder="e.g. Added Focus Zone ceremony&#10;Added collapsible sidebar"
                        rows={6}
                        className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-white/10 focus:bg-black/50 transition-all resize-none font-sans"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">
                        Fixes & Improvements
                      </label>
                      <textarea
                        value={fixesText}
                        onChange={(e) => setFixesText(e.target.value)}
                        placeholder="e.g. Fixed concurrent session logs&#10;Fixed table styling alignment"
                        rows={6}
                        className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-white/10 focus:bg-black/50 transition-all resize-none font-sans"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">
                        Upcoming
                      </label>
                      <textarea
                        value={upcomingText}
                        onChange={(e) => setUpcomingText(e.target.value)}
                        placeholder="e.g. Spotify music widget&#10;Analytics export features"
                        rows={6}
                        className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-white/10 focus:bg-black/50 transition-all resize-none font-sans"
                      />
                    </div>
                  </div>

                  <p className="text-[9px] text-zinc-500 italic mt-1 select-none">
                    Enter each improvement or feature on a new line. Bullet points are formatted automatically.
                  </p>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={submitting || !title.trim() || (!featuresText.trim() && !fixesText.trim() && !upcomingText.trim())}
                      className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all disabled:opacity-50 cursor-pointer select-none"
                    >
                      {submitting ? "Publishing..." : "Publish Notes"}
                    </button>
                  </div>
                </form>
              ) : (

                /* Live Preview Layout */
                <div className="rounded-xl border border-white/5 bg-zinc-950 p-4 space-y-4">
                  {/* Mock Modal Header */}
                  <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/15">
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">{title || "Draft Version"}</h4>
                      <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-0.5">
                        {new Date().toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Mock Modal Tabs */}
                  <div className="flex gap-1">
                    {sectionsConfig.map((sect) => (
                      <button
                        key={sect.id}
                        type="button"
                        onClick={() => setActivePreviewSection(sect.id)}
                        className={cn(
                          "flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer rounded-full border border-white/5",
                          activePreviewSection === sect.id
                            ? "text-white bg-white/10"
                            : "text-zinc-600 hover:text-zinc-400"
                        )}
                      >
                        {sect.title}
                      </button>
                    ))}
                  </div>

                  {/* Mock Modal List Content */}
                  <div className="min-h-[120px] py-1">
                    {parsedDraft[activePreviewSection].length > 0 ? (
                      <ul className="space-y-2">
                        {parsedDraft[activePreviewSection].map((item, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2.5 text-xs text-zinc-300 leading-relaxed"
                          >
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                                sectionsConfig.find((s) => s.id === activePreviewSection)?.dotBg
                              )}
                            />
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <p className="text-xs text-zinc-600 font-medium">Nothing parsed for this section</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Entries List */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-1">
          Historical Entries ({entries.length})
        </h3>
        
        <AnimatePresence mode="popLayout">
          {entries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="group relative rounded-xl border border-white/[0.05] bg-zinc-900/40 backdrop-blur-md p-4 flex items-start justify-between gap-4 hover:border-white/10 transition-colors"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-white group-hover:text-primary transition-colors">
                    {entry.title}
                  </h4>
                  {entry.createdAt && (
                    <span className="text-[8px] text-zinc-600 uppercase tracking-widest tabular-nums">
                      {new Date(entry.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap line-clamp-4 font-mono text-[11px] bg-black/20 rounded-lg p-2.5 border border-white/[0.02] mt-2 select-text">
                  {entry.content}
                </p>
              </div>

              <button
                onClick={() => onDelete(entry.id)}
                disabled={deletingId === entry.id}
                className="p-2.5 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0 cursor-pointer disabled:opacity-50 select-none border border-transparent hover:border-red-500/10"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {entries.length === 0 && (
          <div className="text-center py-16 rounded-xl border border-dashed border-white/5">
            <FileText className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
            <p className="text-xs text-zinc-500 font-bold">No entries found</p>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mt-1">
              Add your first changelog update using the button above
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
