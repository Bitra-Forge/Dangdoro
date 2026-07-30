"use client";

import { useStickyNotesStore, type NoteColor } from "@/lib/sticky-notes-store";
import { X, Plus, Trash2, StickyNote, GripVertical, Search, Pin } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Tooltip } from "@/components/ui/tooltip";

// ── Color system ────────────────────────────────────────────────────────────────
const COLOR_MAP: Record<
  NoteColor,
  {
    label: string;
    accent: string;
    paperBg: string;
    paperText: string;
    stripBg: string;
    swatch: string;
    inputBorder: string;
    inputBg: string;
    ghostBg: string;
    ghostGlow: string;
    lines: string;
  }
> = {
  yellow: {
    label: "Yellow",
    accent: "#f59e0b",
    paperBg: "#fef6e5",
    paperText: "#6d4508",
    stripBg: "#fde68a",
    swatch: "#f59e0b",
    inputBorder: "rgba(245,158,11,0.4)",
    inputBg: "rgba(245,158,11,0.08)",
    ghostBg: "#fef6e5",
    ghostGlow: "rgba(245,158,11,0.4)",
    lines: "rgba(109,69,8,0.15)",
  },
  green: {
    label: "Green",
    accent: "#10b981",
    paperBg: "#e0f7fa",
    paperText: "#0d4a34",
    stripBg: "#a7f3d0",
    swatch: "#10b981",
    inputBorder: "rgba(16,185,129,0.4)",
    inputBg: "rgba(16,185,129,0.08)",
    ghostBg: "#e0f7fa",
    ghostGlow: "rgba(16,185,129,0.4)",
    lines: "rgba(13,74,52,0.15)",
  },
  blue: {
    label: "Blue",
    accent: "#38bdf8",
    paperBg: "#e0f2fe",
    paperText: "#0c4a6e",
    stripBg: "#bae6fd",
    swatch: "#38bdf8",
    inputBorder: "rgba(56,189,248,0.4)",
    inputBg: "rgba(56,189,248,0.08)",
    ghostBg: "#e0f2fe",
    ghostGlow: "rgba(56,189,248,0.4)",
    lines: "rgba(12,74,110,0.15)",
  },
  pink: {
    label: "Pink",
    accent: "#ec4899",
    paperBg: "#fcebf3",
    paperText: "#700c3b",
    stripBg: "#fbcfe8",
    swatch: "#ec4899",
    inputBorder: "rgba(244,114,182,0.4)",
    inputBg: "rgba(244,114,182,0.08)",
    ghostBg: "#fcebf3",
    ghostGlow: "rgba(236,72,153,0.4)",
    lines: "rgba(112,12,59,0.15)",
  },
  purple: {
    label: "Purple",
    accent: "#8b5cf6",
    paperBg: "#f3e8ff",
    paperText: "#581c87",
    stripBg: "#ddd6fe",
    swatch: "#8b5cf6",
    inputBorder: "rgba(167,139,250,0.4)",
    inputBg: "rgba(167,139,250,0.08)",
    ghostBg: "#f3e8ff",
    ghostGlow: "rgba(139,92,246,0.4)",
    lines: "rgba(88,28,135,0.15)",
  },
};

const NOTE_COLORS: NoteColor[] = ["yellow", "green", "blue", "pink", "purple"];

// ── Component ────────────────────────────────────────────────────────────────────
export function StickyNotesPanel() {
  const isOpen = useStickyNotesStore((state) => state.isNotesOpen);
  const setIsOpen = useStickyNotesStore((state) => state.setIsNotesOpen);
  const notes = useStickyNotesStore((state) => state.notes);
  const addNote = useStickyNotesStore((state) => state.addNote);
  const removeNote = useStickyNotesStore((state) => state.removeNote);
  const setNoteColor = useStickyNotesStore((state) => state.setNoteColor);
  const moveNote = useStickyNotesStore((state) => state.moveNote);

  const [draft, setDraft] = useState("");
  const [selectedColor, setSelectedColor] = useState<NoteColor>("yellow");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterColor, setFilterColor] = useState<NoteColor | "all">("all");

  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const dragRef = useRef<{ el: HTMLDivElement | null; noteId: string | null; offsetX: number; offsetY: number }>({ el: null, noteId: null, offsetX: 0, offsetY: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const draftInputRef = useRef<HTMLTextAreaElement>(null);

  // ── Click-outside to close ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-quick-action-trigger="true"]')) return;
      if (!panelRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, setIsOpen]);

  // ── Auto-focus edit textarea ─────────────────────────────────────────────────
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.setSelectionRange(editContent.length, editContent.length);
    }
  }, [editingId]);

  // ── Note actions ─────────────────────────────────────────────────────────────
  const handleAddNote = () => {
    const content = draft.trim();
    if (!content) return;
    addNote(content, selectedColor);
    setDraft("");
    if (draftInputRef.current) {
      draftInputRef.current.style.height = "auto";
    }
  };

  const handleStartEdit = (note: { id: string; content: string }) => {
    setEditingId(note.id);
    setEditContent(note.content);
    setColorPickerId(null);
  };

  const handleSaveEdit = async (id: string) => {
    const content = editContent.trim();
    if (!content) {
      await removeNote(id);
    } else {
      const { updateNote } = useStickyNotesStore.getState();
      await updateNote(id, content);
    }
    setEditingId(null);
    setEditContent("");
  };

  // ── Drag to place on page ────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.PointerEvent, noteId: string) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("textarea") || target.closest("input")) return;

    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    setDraggingNoteId(noteId);

    const note = useStickyNotesStore.getState().notes.find((n) => n.id === noteId);
    const c = COLOR_MAP[(note?.color as NoteColor) ?? "yellow"];

    const ghost = document.createElement("div");
    ghost.id = "sticky-note-ghost";
    ghost.style.cssText = `
      position: fixed; pointer-events: none; z-index: 9999;
      width: 210px; border-radius: 18px;
      border: 1.5px solid ${c.accent}66;
      background: ${c.ghostBg};
      box-shadow: 0 0 0 4px ${c.ghostGlow}, 0 24px 56px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.6);
      transform: rotate(-3deg) scale(1.07); overflow: hidden;
    `;

    const strip = document.createElement("div");
    strip.style.cssText = `height: 6px; background: ${c.accent}; opacity: 0.8;`;

    const content = document.createElement("div");
    content.style.cssText = `
      padding: 10px 14px 6px;
      font-family: system-ui,-apple-system,sans-serif;
      font-size: 13px; font-weight: 500; line-height: 1.5;
      color: ${c.paperText}; word-break: break-word;
      white-space: pre-wrap; max-height: 90px; overflow: hidden;
    `;
    content.textContent = note?.content ?? "";

    const badge = document.createElement("div");
    badge.style.cssText = `
      padding: 4px 14px 7px;
      font-family: system-ui,-apple-system,sans-serif;
      font-size: 9px; font-weight: 800; letter-spacing: 0.12em;
      text-transform: uppercase; color: ${c.paperText}; opacity: 0.45;
      border-top: 1px solid rgba(0,0,0,0.08);
    `;
    badge.textContent = "✦  Drop to place";

    ghost.appendChild(strip);
    ghost.appendChild(content);
    ghost.appendChild(badge);
    document.body.appendChild(ghost);

    ghost.style.left = `${e.clientX - 105}px`;
    ghost.style.top = `${e.clientY - 20}px`;
    dragRef.current = { el: ghost, noteId, offsetX: 0, offsetY: 0 };
  }, []);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.el) return;
    dragRef.current.el.style.left = `${e.clientX - 100}px`;
    dragRef.current.el.style.top = `${e.clientY - 20}px`;
  }, []);

  const handleDragEnd = useCallback(
    (e: React.PointerEvent) => {
      const { el, noteId } = dragRef.current;
      if (!el || !noteId) return;
      document.body.removeChild(el);
      dragRef.current = { el: null, noteId: null, offsetX: 0, offsetY: 0 };

      const panel = panelRef.current;
      if (!panel) return;
      const r = panel.getBoundingClientRect();
      const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      if (outside) {
        moveNote(noteId, e.clientX - 110, e.clientY - 40);
        toast.success("Note placed on page");
      }
      setDraggingNoteId(null);
    },
    [moveNote]
  );

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  // ── Filtered notes ───────────────────────────────────────────────────────────
  const filteredNotes = notes.filter((n) => {
    const isPanelNote = n.positionX < 0 || n.positionY < 0;
    const matchesColor = filterColor === "all" || n.color === filterColor;
    const matchesSearch = n.content.toLowerCase().includes(searchQuery.toLowerCase());
    return isPanelNote && matchesColor && matchesSearch;
  });

  const noteCount = notes.filter((n) => n.positionX < 0 || n.positionY < 0).length;
  const selectedC = COLOR_MAP[selectedColor];

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          key="sticky-notes-panel"
          ref={panelRef}
          initial={{ opacity: 1, scale: 0.94, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 14, transition: { duration: 0.15, ease: "easeIn" } }}
          transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.7 }}
          className="fixed left-1/2 -translate-x-1/2 bottom-40 sm:bottom-28 w-[92vw] sm:w-full max-w-[440px] transform origin-bottom z-[60]"
        >
          <div className="bg-[#111318]/97 backdrop-blur-3xl border border-white/[0.07] rounded-[26px] shadow-[0_32px_72px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden h-[530px] max-h-[calc(100dvh-12rem)] sm:max-h-[calc(100dvh-10rem)]">
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white text-slate-950 shadow-[0_4px_12px_rgba(255,255,255,0.15)] shrink-0">
                  <Pin className="w-4.5 h-4.5" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold uppercase tracking-[0.08em] text-white font-serif leading-none">
                    Sticky Notes
                  </span>
                  <span className="text-[11px] text-zinc-500 font-serif italic">
                    {noteCount} {noteCount === 1 ? "note" : "notes"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center bg-[#242528] hover:bg-[#333539] text-[#888a93] hover:text-white transition-all cursor-pointer border border-transparent"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* ── Compose area ───────────────────────────────────────── */}
            <div className="px-5 pb-4 space-y-3">
              {/* Color picker row */}
              <div className="flex items-center justify-between p-1.5 rounded-[14px] bg-[#0c0d0e] border border-zinc-800/80">
                <div className="font-serif text-[11px] font-bold text-zinc-300 bg-white/[0.06] border border-white/[0.08] px-3.5 py-1.5 rounded-full capitalize min-w-[75px] text-center">
                  {selectedColor}
                </div>
                <div className="flex items-center gap-2 pr-1.5">
                  {NOTE_COLORS.map((color) => {
                    const c = COLOR_MAP[color];
                    const isSelected = selectedColor === color;
                    return (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        title={`Select ${c.label}`}
                        className={`w-[18px] h-[18px] rounded-full relative transition-transform duration-155 hover:scale-110 cursor-pointer ${
                          isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-[#0c0d0e]" : ""
                        }`}
                        style={{
                          background: c.accent,
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Textarea + Add button */}
              <div className="flex items-end gap-2">
                <div className="flex-1 rounded-xl overflow-hidden border border-zinc-800/80 bg-[#0c0d0e] transition-all">
                  <textarea
                    ref={draftInputRef}
                    value={draft}
                    onChange={(e) => { setDraft(e.target.value); autoResize(e.currentTarget); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddNote(); }
                    }}
                    onInput={(e) => autoResize(e.currentTarget)}
                    placeholder="Write a sticky note…"
                    rows={1}
                    className="w-full min-h-[44px] max-h-[120px] bg-transparent px-3.5 py-3 text-sm text-zinc-100 placeholder-zinc-650 outline-none resize-none leading-snug font-serif"
                  />
                </div>
                <button
                  onClick={handleAddNote}
                  className="h-[46px] px-5 rounded-xl inline-flex items-center justify-center gap-1 font-bold text-[13px] font-serif cursor-pointer shrink-0 transition-all duration-200 active:scale-95 bg-white text-slate-950 hover:bg-zinc-200 shadow-[0_0_15px_rgba(255,255,255,0.15)]"
                >
                  + Add
                </button>
              </div>
            </div>

            {/* ── Divider ─────────────────────────────────────────────── */}
            <div className="mx-5 h-px bg-white/[0.06]" />

            {/* ── Search + filter bar ─────────────────────────────────── */}
            <div className="px-5 py-3 flex items-center gap-2">
              {/* Search */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notes…"
                  className="w-full h-[38px] px-3.5 rounded-[10px] bg-[#0c0d0e] border border-zinc-800/80 text-[12px] font-serif text-zinc-350 placeholder-zinc-700 outline-none focus:border-zinc-700 transition-all"
                />
              </div>

              {/* Color filter Container */}
              <div className="flex items-center gap-2 p-1 pl-1 rounded-[10px] bg-[#0c0d0e] border border-zinc-800/80 h-[38px] select-none">
                <button
                  onClick={() => setFilterColor("all")}
                  className="bg-[#27282b] hover:bg-zinc-800 text-white text-[9px] font-bold font-serif px-2.5 py-1 rounded-[6px] uppercase tracking-wider cursor-pointer"
                >
                  {filterColor === "all" ? "All" : filterColor}
                </button>
                <div className="flex items-center gap-1.5 pr-1.5">
                  {NOTE_COLORS.map((color) => {
                    const c = COLOR_MAP[color];
                    const isActive = filterColor === color;
                    return (
                      <button
                        key={color}
                        onClick={() => setFilterColor(isActive ? "all" : color)}
                        title={`Filter ${c.label}`}
                        className={`w-2.5 h-2.5 rounded-full relative transition-transform hover:scale-110 cursor-pointer ${
                          isActive ? "ring-1 ring-white ring-offset-1 ring-offset-[#0c0d0e]" : ""
                        }`}
                        style={{
                          background: c.accent,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Notes list ─────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2 scrollbar-none min-h-0">
              {filteredNotes.length === 0 ? (
                <div className="text-center py-8">
                  <StickyNote className="w-8 h-8 mx-auto opacity-20 text-zinc-500 mb-2" />
                  <p className="text-xs text-zinc-600 font-serif">No notes yet</p>
                </div>
              ) : (
                <LayoutGroup>
                  <AnimatePresence mode="popLayout">
                    {filteredNotes.map((note) => {
                      const colors = COLOR_MAP[note.color as NoteColor] ?? COLOR_MAP.yellow;
                      const isEditing = editingId === note.id;
                      return (
                        <motion.div
                          key={note.id}
                          layout
                          initial={{ opacity: 0, y: 8, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.97 }}
                          transition={{
                            layout: { type: "spring", stiffness: 480, damping: 36 },
                            opacity: { duration: 0.15 },
                          }}
                          onPointerDown={(e) => handleDragStart(e, note.id)}
                          onPointerMove={handleDragMove}
                          onPointerUp={handleDragEnd}
                          className={`group relative rounded-[20px] cursor-grab active:cursor-grabbing select-none transition-shadow ${
                            draggingNoteId === note.id ? "opacity-30 scale-95" : "hover:shadow-lg"
                          }`}
                          style={{
                            boxShadow: draggingNoteId === note.id
                              ? "none"
                              : `0 2px 8px rgba(0,0,0,0.06)`,
                          }}
                        >
                          {/* Inner card wrapper (overflow-hidden to crop left strip curvature perfectly) */}
                          <div
                            className="rounded-[20px] overflow-hidden flex w-full border-none"
                            style={{
                              backgroundColor: colors.paperBg,
                              backgroundImage: `repeating-linear-gradient(
                                180deg,
                                transparent,
                                transparent 19px,
                                ${colors.lines} 19px,
                                ${colors.lines} 20px
                              )`,
                              backgroundSize: "100% 20px",
                              backgroundPosition: "0 14px",
                            }}
                          >
                            {/* Left Accent Strip */}
                            <div
                              className="w-2 shrink-0"
                              style={{ background: colors.accent }}
                            />

                            <div className="flex-1 min-w-0">
                              {isEditing ? (
                                <div className="flex flex-col gap-2 px-5 py-4">
                                  <textarea
                                    ref={editInputRef}
                                    value={editContent}
                                    onChange={(e) => { setEditContent(e.target.value); autoResize(e.currentTarget); }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSaveEdit(note.id); }
                                      if (e.key === "Escape") setEditingId(null);
                                    }}
                                    onInput={(e) => autoResize(e.currentTarget)}
                                    className="w-full bg-transparent border-none outline-none text-sm resize-none cursor-text font-medium leading-relaxed font-serif"
                                    style={{ color: colors.paperText }}
                                    rows={2}
                                  />
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleSaveEdit(note.id)}
                                      className="text-xs cursor-pointer px-2.5 py-1 rounded-lg font-semibold transition-all shadow-[0_2px_4px_rgba(0,0,0,0.06)] bg-white text-zinc-900"
                                      style={{ background: colors.accent, color: "#fff" }}
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingId(null)}
                                      className="text-xs cursor-pointer transition-all"
                                      style={{ color: colors.paperText, opacity: 0.5 }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-3 px-5 py-4 min-h-[54px]">
                                  <p
                                    className="text-sm flex-1 whitespace-pre-wrap break-words cursor-pointer leading-relaxed font-medium font-serif min-h-[20px]"
                                    style={{ color: colors.paperText }}
                                    onClick={() => handleStartEdit(note)}
                                  >
                                    {note.content}
                                  </p>
                                  {/* Actions */}
                                  <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {/* Color picker */}
                                    <div className="relative">
                                      <Tooltip content="Change color" side="top">
                                        <button
                                          onClick={() => setColorPickerId(colorPickerId === note.id ? null : note.id)}
                                          className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-black/5 transition-colors cursor-pointer"
                                          style={{ color: colors.paperText }}
                                        >
                                          <span
                                            className="w-3.5 h-3.5 rounded-full"
                                            style={{ background: colors.swatch }}
                                          />
                                        </button>
                                      </Tooltip>
                                    </div>
                                    {/* Delete */}
                                    <Tooltip content="Delete" side="right">
                                      <button
                                        onClick={() => { removeNote(note.id); toast.success("Note deleted"); }}
                                        className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-red-500/15 transition-colors cursor-pointer"
                                        style={{ color: colors.paperText }}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </Tooltip>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Color picker menu outside inner card wrapper to avoid overflow-hidden clipping */}
                          {colorPickerId === note.id && (
                            <div
                              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-xl bg-white shadow-2xl border border-black/10 flex items-center gap-2 animate-in fade-in zoom-in-95 duration-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-1.5">
                                {NOTE_COLORS.map((c) => {
                                  const cc = COLOR_MAP[c];
                                  return (
                                    <button
                                      key={c}
                                      onClick={() => { setNoteColor(note.id, c); setColorPickerId(null); }}
                                      className="w-3.5 h-3.5 rounded-full transition-transform hover:scale-125 cursor-pointer"
                                      style={{
                                        background: cc.swatch,
                                        outline: note.color === c ? `1.5px solid ${cc.accent}` : "none",
                                        outlineOffset: "1.5px",
                                      }}
                                    />
                                  );
                                })}
                              </div>
                              <div className="w-px h-3 bg-zinc-200" />
                              <button
                                onClick={() => setColorPickerId(null)}
                                className="p-0.5 rounded-md hover:bg-black/5 transition-colors cursor-pointer text-zinc-400 hover:text-zinc-650"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </LayoutGroup>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
