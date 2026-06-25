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
  onUpdate?: (id: string, title: string, content: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
  submitting: boolean;
  deletingId: string | null;
}

export function ChangelogManager({
  entries,
  onSubmit,
  onUpdate,
  onDelete,
  submitting,
  deletingId,
}: ChangelogManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingEntryDate, setEditingEntryDate] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [featuresText, setFeaturesText] = useState("");
  const [fixesText, setFixesText] = useState("");
  const [upcomingText, setUpcomingText] = useState("");
  const [activeEditorTab, setActiveEditorTab] = useState<"write" | "preview">("write");
  const [activePreviewSection, setActivePreviewSection] = useState<"features" | "fixes" | "upcoming">("features");

  const parseChangelogContent = (content: string, stripComments = false) => {
    const sections = {
      features: [] as string[],
      fixes: [] as string[],
      upcoming: [] as string[],
    };

    const lines = content.split("\n");
    let currentSection: "features" | "fixes" | "upcoming" | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.match(/^#+\s*(features|new features|feature|added)/i)) {
        currentSection = "features";
        continue;
      } else if (trimmed.match(/^#+\s*(fixes|improvements|fix|fixed|improved)/i)) {
        currentSection = "fixes";
        continue;
      } else if (trimmed.match(/^#+\s*(upcoming|next|future)/i)) {
        currentSection = "upcoming";
        continue;
      }

      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        let itemContent = trimmed.substring(1).trim();
        if (stripComments) {
          itemContent = itemContent.replace(/\s*<!--.*?-->/g, "").trim();
        }
        if (currentSection) {
          sections[currentSection].push(itemContent);
        } else {
          sections.features.push(itemContent);
        }
      } else if (trimmed.match(/^\d+\.\s/)) {
        let itemContent = trimmed.replace(/^\d+\.\s/, "").trim();
        if (stripComments) {
          itemContent = itemContent.replace(/\s*<!--.*?-->/g, "").trim();
        }
        if (currentSection) {
          sections[currentSection].push(itemContent);
        } else {
          sections.features.push(itemContent);
        }
      }
    }

    return {
      featuresText: sections.features.join("\n"),
      fixesText: sections.fixes.join("\n"),
      upcomingText: sections.upcoming.join("\n"),
    };
  };

  const parseSectionLines = (text: string) => {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => l.replace(/^[-*]\s*/, ""));
  };

  const getPreviewItems = (section: "features" | "fixes" | "upcoming") => {
    const text = section === "features" ? featuresText : section === "fixes" ? fixesText : upcomingText;
    const newLines = parseSectionLines(text);

    if (editingEntryId) {
      return newLines;
    }

    const latestEntry = entries[0];
    const prevParsed = latestEntry ? parseChangelogContent(latestEntry.content, false) : null;
    const prevText = prevParsed ? (section === "features" ? prevParsed.featuresText : section === "fixes" ? prevParsed.fixesText : prevParsed.upcomingText) : "";
    
    const prevLines = prevText
      ? prevText
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
          .map((l) => l.replace(/^[-*]\s*/, ""))
      : [];

    if (newLines.length === 0) {
      return prevLines;
    }

    const prevLinesWithoutDividers = prevLines.filter((l) => {
      const isSep = l.includes("<!-- separator:") || (l.trim().length >= 5 && l.trim().replace(/[-─*]/g, "").length === 0);
      return !isSep;
    });

    if (prevLinesWithoutDividers.length > 0) {
      return [
        "────────────────────────────── <!-- separator:new -->",
        ...newLines,
        "────────────────────────────── <!-- separator:previous -->",
        ...prevLinesWithoutDividers
      ];
    }
    return [
      "────────────────────────────── <!-- separator:new -->",
      ...newLines
    ];
  };

  const parsedDraft = {
    features: getPreviewItems("features"),
    fixes: getPreviewItems("fixes"),
    upcoming: getPreviewItems("upcoming"),
  };

  const totalParsedItems =
    parsedDraft.features.length +
    parsedDraft.fixes.length +
    parsedDraft.upcoming.length;

  const resetForm = () => {
    setTitle("");
    setFeaturesText("");
    setFixesText("");
    setUpcomingText("");
    setEditingEntryDate(null);
  };

  const handleNewEntryClick = () => {
    if (showForm && !editingEntryId) {
      setShowForm(false);
      resetForm();
    } else {
      resetForm();
      setEditingEntryId(null);
      setShowForm(true);
      setActiveEditorTab("write");
    }
  };

  const handleEditClick = (entry: ChangelogEntry) => {
    const parsed = parseChangelogContent(entry.content, true);
    setTitle(entry.title);
    setFeaturesText(parsed.featuresText);
    setFixesText(parsed.fixesText);
    setUpcomingText(parsed.upcomingText);
    setEditingEntryId(entry.id);

    const dateStr = entry.createdAt
      ? new Date(entry.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
    setEditingEntryDate(dateStr);

    setShowForm(true);
    setActiveEditorTab("write");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const appendDateToLines = (text: string, dateStr: string): string => {
    return text
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return "";
        
        // Don't append date to divider lines
        const isSep = trimmed.includes("<!-- separator:") || (trimmed.replace(/^[-\*]\s*/, "").trim().length >= 5 && trimmed.replace(/^[-\*]\s*/, "").trim().replace(/[-─*]/g, "").length === 0);
        if (isSep) return trimmed;

        // Check if it already has a date comment
        if (trimmed.match(/<!--.*?-->/)) {
          return trimmed;
        }
        return `${trimmed} <!-- ${dateStr} -->`;
      })
      .join("\n");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!featuresText.trim() && !fixesText.trim() && !upcomingText.trim()) return;

    let contentMd = "";

    const formatToListLines = (text: string): string[] => {
      let dividerCount = 0;
      return text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((l) => {
          const isSep = l.includes("<!-- separator:") || (l.trim().length >= 5 && l.replace(/[-─*]/g, "").length === 0);
          if (isSep) {
            dividerCount++;
            const type = dividerCount === 1 ? "new" : "previous";
            return `- ────────────────────────────── <!-- separator:${type} -->`;
          }
          return l.startsWith("-") || l.startsWith("*") ? l : `- ${l}`;
        });
    };

    const targetDate = editingEntryDate || new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const finalFeatures = appendDateToLines(featuresText, targetDate);
    const finalFixes = appendDateToLines(fixesText, targetDate);
    const finalUpcoming = appendDateToLines(upcomingText, targetDate);

    if (editingEntryId) {
      const appendSection = (header: string, text: string) => {
        if (!text.trim()) return;
        const lines = formatToListLines(text);
        if (lines.length > 0) {
          contentMd += `# ${header}\n${lines.join("\n")}\n\n`;
        }
      };

      appendSection("Features", finalFeatures);
      appendSection("Fixes", finalFixes);
      appendSection("Upcoming", finalUpcoming);
    } else {
      const latestEntry = entries[0];
      const prevParsed = latestEntry ? parseChangelogContent(latestEntry.content, false) : null;

      const processSection = (header: string, newTextWithDates: string, prevTextWithDates: string | undefined) => {
        const newLines = formatToListLines(newTextWithDates);
        const prevLines = prevTextWithDates ? formatToListLines(prevTextWithDates) : [];

        let finalLines: string[] = [];

        if (newLines.length === 0) {
          finalLines = prevLines;
        } else {
          // Filter out existing dividers from old lines to ensure we only have a single divider
          const prevLinesWithoutDividers = prevLines.filter((l) => {
            const content = l.replace(/^[-*]\s*/, "").trim();
            const isSep = content.includes("<!-- separator:") || (content.length >= 5 && content.replace(/[-─*]/g, "").length === 0);
            return !isSep;
          });

          if (prevLinesWithoutDividers.length > 0) {
            finalLines = [
              "- ────────────────────────────── <!-- separator:new -->",
              ...newLines,
              "- ────────────────────────────── <!-- separator:previous -->",
              ...prevLinesWithoutDividers
            ];
          } else {
            finalLines = [
              "- ────────────────────────────── <!-- separator:new -->",
              ...newLines
            ];
          }
        }

        if (finalLines.length > 0) {
          contentMd += `# ${header}\n${finalLines.join("\n")}\n\n`;
        }
      };

      processSection("Features", finalFeatures, prevParsed?.featuresText);
      processSection("Fixes", finalFixes, prevParsed?.fixesText);
      processSection("Upcoming", finalUpcoming, prevParsed?.upcomingText);
    }

    let success = false;
    if (editingEntryId && onUpdate) {
      success = await onUpdate(editingEntryId, title.trim(), contentMd.trim());
    } else {
      success = await onSubmit(title.trim(), contentMd.trim());
    }

    if (success) {
      resetForm();
      setEditingEntryId(null);
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
          onClick={handleNewEntryClick}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all cursor-pointer select-none"
        >
          {showForm && !editingEntryId ? (
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
                <div className="flex items-center gap-3">
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
                  {editingEntryId && (
                    <span className="text-[10px] font-bold text-yellow-400 bg-yellow-400/10 px-2.5 py-1 rounded-lg border border-yellow-400/20 uppercase tracking-wider">
                      Editing Mode
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {editingEntryId && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        resetForm();
                        setEditingEntryId(null);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold transition-all cursor-pointer"
                    >
                      <X className="w-3 h-3" /> Cancel Edit
                    </button>
                  )}
                  {activeEditorTab === "preview" && totalParsedItems === 0 && (
                    <div className="flex items-center gap-1.5 text-orange-400 text-[10px] font-bold">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>No bullet points parsed</span>
                    </div>
                  )}
                </div>
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
                      {submitting ? (editingEntryId ? "Updating..." : "Publishing...") : (editingEntryId ? "Update Notes" : "Publish Notes")}
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
                  <div className="min-h-[120px] py-1 text-left w-full">
                    {parsedDraft[activePreviewSection].length > 0 ? (
                      <ul className="space-y-2 w-full">
                        {(() => {
                          let dividerCount = 0;
                          return parsedDraft[activePreviewSection].map((item, idx) => {
                            const isSep = item.includes("<!-- separator:") || (item.trim().length >= 5 && item.trim().replace(/[-─*]/g, "").length === 0);

                            if (isSep) {
                              dividerCount++;
                              const label = dividerCount === 1 ? "NEW" : "PREVIOUS";
                              return (
                                <li key={idx} className="w-full py-1">
                                  <div className="flex items-center gap-3 w-full select-none">
                                    <div className="h-px bg-white/10 flex-1" />
                                    <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600 shrink-0">
                                      {label}
                                    </span>
                                    <div className="h-px bg-white/10 flex-1" />
                                  </div>
                                </li>
                              );
                            }

                            const match = item.match(/(.*)\s*<!--\s*(.*?)\s*-->/);
                            const text = match ? match[1].trim() : item;
                            const dateStr = match
                              ? match[2].trim()
                              : (editingEntryId
                                  ? editingEntryDate
                                  : new Date().toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    }));

                            return (
                              <li
                                  key={idx}
                                  className="flex items-start justify-between gap-3 text-xs text-zinc-300 leading-relaxed w-full"
                              >
                                <div className="flex items-start gap-2.5 flex-1">
                                  <span
                                      className={cn(
                                        "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                                        sectionsConfig.find((s) => s.id === activePreviewSection)?.dotBg
                                      )}
                                  />
                                  <span>{text}</span>
                                </div>
                                {dateStr && (
                                  <span className="text-[9px] text-zinc-500 shrink-0 font-medium tabular-nums mt-0.5 select-none">
                                    {dateStr}
                                  </span>
                                )}
                              </li>
                            );
                          });
                        })()}
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

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleEditClick(entry)}
                  disabled={submitting || deletingId === entry.id}
                  className="p-2.5 rounded-xl text-zinc-500 hover:text-white hover:bg-white/10 transition-all shrink-0 cursor-pointer disabled:opacity-50 select-none border border-transparent hover:border-white/10"
                  title="Edit entry"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(entry.id)}
                  disabled={deletingId === entry.id}
                  className="p-2.5 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0 cursor-pointer disabled:opacity-50 select-none border border-transparent hover:border-red-500/10"
                  title="Delete entry"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
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
