"use client";

import { useStickyNotesStore, type NoteColor } from "@/lib/sticky-notes-store";
import { X, Plus, Trash2, Palette, StickyNote, GripVertical } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Tooltip } from "@/components/ui/tooltip";

const COLOR_MAP: Record<NoteColor, { bg: string; border: string; text: string; dot: string; inputBg: string; placeholder: string }> = {
  yellow: {
    bg: "bg-amber-500/15", border: "border-amber-500/30", text: "text-amber-200",
    dot: "bg-amber-400", inputBg: "bg-amber-500/10", placeholder: "placeholder-amber-700/50",
  },
  green: {
    bg: "bg-emerald-500/15", border: "border-emerald-500/30", text: "text-emerald-200",
    dot: "bg-emerald-400", inputBg: "bg-emerald-500/10", placeholder: "placeholder-emerald-700/50",
  },
  blue: {
    bg: "bg-sky-500/15", border: "border-sky-500/30", text: "text-sky-200",
    dot: "bg-sky-400", inputBg: "bg-sky-500/10", placeholder: "placeholder-sky-700/50",
  },
  pink: {
    bg: "bg-pink-500/15", border: "border-pink-500/30", text: "text-pink-200",
    dot: "bg-pink-400", inputBg: "bg-pink-500/10", placeholder: "placeholder-pink-700/50",
  },
  purple: {
    bg: "bg-violet-500/15", border: "border-violet-500/30", text: "text-violet-200",
    dot: "bg-violet-400", inputBg: "bg-violet-500/10", placeholder: "placeholder-violet-700/50",
  },
};

const NOTE_COLORS: NoteColor[] = ["yellow", "green", "blue", "pink", "purple"];

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

  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const dragRef = useRef<{ el: HTMLDivElement | null; noteId: string | null; offsetX: number; offsetY: number }>({ el: null, noteId: null, offsetX: 0, offsetY: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const draftInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-quick-action-trigger="true"]')) return;
      if (!panelRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, setIsOpen]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.setSelectionRange(editContent.length, editContent.length);
    }
  }, [editingId]);

  const handleAddNote = () => {
    const content = draft.trim();
    if (!content) return;
    addNote(content, selectedColor);
    setDraft("");
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

  // ─── Drag from panel onto page ──────────────────────────────────────

  // Color-matched glow values for the ghost (inline styles, not Tailwind)
  const GHOST_STYLES: Record<NoteColor, { bg: string; border: string; text: string; glow: string }> = {
    yellow: { bg: "rgba(251,191,36,0.92)", border: "rgba(253,230,138,0.6)", text: "#451a03", glow: "rgba(251,191,36,0.5)" },
    green:  { bg: "rgba(52,211,153,0.92)",  border: "rgba(110,231,183,0.6)", text: "#022c22", glow: "rgba(52,211,153,0.5)" },
    blue:   { bg: "rgba(56,189,248,0.92)",  border: "rgba(125,211,252,0.6)", text: "#082f49", glow: "rgba(56,189,248,0.5)" },
    pink:   { bg: "rgba(244,114,182,0.92)", border: "rgba(249,168,212,0.6)", text: "#500724", glow: "rgba(244,114,182,0.5)" },
    purple: { bg: "rgba(167,139,250,0.92)", border: "rgba(196,181,253,0.6)", text: "#2e1065", glow: "rgba(167,139,250,0.5)" },
  };

  const handleDragStart = useCallback((e: React.PointerEvent, noteId: string) => {
    // Skip drag if the user is clicking a button, input, or textarea
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("textarea") || target.closest("input")) return;

    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    setDraggingNoteId(noteId);

    const note = useStickyNotesStore.getState().notes.find(n => n.id === noteId);
    const gs = GHOST_STYLES[(note?.color as NoteColor) ?? "yellow"];

    // Outer wrapper
    const ghost = document.createElement("div");
    ghost.id = "sticky-note-ghost";
    ghost.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 9999;
      width: 210px;
      border-radius: 18px;
      border: 1.5px solid ${gs.border};
      background: ${gs.bg};
      box-shadow: 0 0 0 4px ${gs.glow}, 0 24px 56px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.35);
      transform: rotate(-3deg) scale(1.07);
      transition: none;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      overflow: hidden;
    `;

    // Content area
    const content = document.createElement("div");
    content.style.cssText = `
      padding: 12px 14px 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      font-weight: 500;
      line-height: 1.5;
      color: ${gs.text};
      word-break: break-word;
      white-space: pre-wrap;
      max-height: 90px;
      overflow: hidden;
    `;
    content.textContent = note?.content ?? "";

    // "Drop to place" badge at bottom
    const badge = document.createElement("div");
    badge.style.cssText = `
      padding: 5px 14px 7px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: ${gs.text};
      opacity: 0.55;
      border-top: 1px solid rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      gap: 4px;
    `;
    badge.textContent = "✦  Drop to place";

    ghost.appendChild(content);
    ghost.appendChild(badge);
    document.body.appendChild(ghost);

    // Position immediately at the cursor so it never flashes at (0,0)
    ghost.style.left = `${e.clientX - 105}px`;
    ghost.style.top = `${e.clientY - 20}px`;

    // Store noteId in ref so handleDragEnd always reads the current value (no stale closure)
    dragRef.current = { el: ghost, noteId, offsetX: 0, offsetY: 0 };
  }, []);


  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.el) return;
    dragRef.current.el.style.left = `${e.clientX - 100}px`;
    dragRef.current.el.style.top = `${e.clientY - 20}px`;
  }, []);

  const handleDragEnd = useCallback((e: React.PointerEvent) => {
    const { el, noteId } = dragRef.current;
    if (!el || !noteId) return;
    document.body.removeChild(el);
    dragRef.current = { el: null, noteId: null, offsetX: 0, offsetY: 0 };

    const panel = panelRef.current;
    if (!panel) return;

    const panelRect = panel.getBoundingClientRect();
    const isOutsidePanel =
      e.clientX < panelRect.left ||
      e.clientX > panelRect.right ||
      e.clientY < panelRect.top ||
      e.clientY > panelRect.bottom;

    if (isOutsidePanel) {
      moveNote(noteId, e.clientX - 110, e.clientY - 40);
      toast.success("Note placed on page");
    }

    setDraggingNoteId(null);
  }, [moveNote]);

  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const handleDraftKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddNote();
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit(id);
    }
    if (e.key === "Escape") setEditingId(null);
  };

  const noteCount = notes.length;

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          key="sticky-notes-panel"
          ref={panelRef}
          initial={{ opacity: 1, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.15, ease: "easeIn" } }}
          transition={{ type: "spring", stiffness: 360, damping: 34, mass: 0.7 }}
          className="fixed left-1/2 -translate-x-1/2 bottom-40 sm:bottom-28 w-[92vw] sm:w-full max-w-[420px] transform origin-bottom z-[60]"
        >
          <div className="bg-[#13161C]/95 backdrop-blur-3xl border border-white/[0.06] rounded-[28px] shadow-[0_30px_60px_rgba(0,0,0,0.8)] flex flex-col p-6 gap-6 overflow-hidden h-[530px] max-h-[calc(100dvh-12rem)] sm:max-h-[calc(100dvh-10rem)]">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                  Sticky Notes
                </span>
                <span className="text-[10px] text-white/20 font-bold ml-1">{noteCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip content="Close">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-center p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </Tooltip>
              </div>
            </div>

            {/* Central Graphic */}
            <div className="flex flex-col items-center justify-center my-1">
              <div className="w-20 h-20 rounded-full border border-white/[0.08] bg-white/[0.02] flex items-center justify-center relative shadow-[0_0_20px_rgba(255,255,255,0.02)]">
                <div className="absolute inset-0 rounded-full bg-white/[0.01] blur-md" />
                <StickyNote className="w-8 h-8 text-white/80 relative z-10" />
              </div>
              <div className="w-24 h-1 bg-white rounded-full mt-5 shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
            </div>

            {/* Input Form */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                {NOTE_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-5 h-5 rounded-full transition-all cursor-pointer ${COLOR_MAP[color].dot} ${
                      selectedColor === color
                        ? "ring-2 ring-white/60 ring-offset-1 ring-offset-[#13161C] scale-110"
                        : "opacity-50 hover:opacity-80"
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-start gap-3 w-full">
                <textarea
                  ref={draftInputRef}
                  value={draft}
                  onChange={(e) => { setDraft(e.target.value); autoResize(e.currentTarget); }}
                  onKeyDown={handleDraftKeyDown}
                  onInput={(e) => autoResize(e.currentTarget)}
                  placeholder="Write a sticky note..."
                  rows={1}
                  className={`flex-1 min-h-[44px] max-h-[120px] rounded-xl border ${COLOR_MAP[selectedColor].border} ${COLOR_MAP[selectedColor].inputBg} px-4 py-3 text-sm text-zinc-200 ${COLOR_MAP[selectedColor].placeholder} outline-none resize-none transition-colors`}
                />
                <button
                  onClick={handleAddNote}
                  className="h-[44px] px-5 rounded-xl bg-white text-slate-950 hover:bg-zinc-200 transition-colors inline-flex items-center gap-1.5 font-semibold text-sm shadow-[0_0_15px_rgba(255,255,255,0.15)] cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex flex-col gap-3 py-1 min-h-0">
              {noteCount === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-8 text-zinc-600 bg-white/[0.01] border border-white/[0.03] rounded-xl p-4">
                  <StickyNote className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">No sticky notes yet.</p>
                </div>
              ) : (
                <LayoutGroup>
                  <AnimatePresence initial={false}>
                    {notes.map((note) => {
                      const colors = COLOR_MAP[note.color as NoteColor] ?? COLOR_MAP.yellow;
                      const isEditing = editingId === note.id;

                      return (
                        <motion.div
                          key={note.id}
                          layout
                          initial={{ opacity: 0, y: 10, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.98 }}
                          transition={{
                            layout: { type: "spring", stiffness: 520, damping: 36, mass: 0.5 },
                            opacity: { duration: 0.16 },
                            y: { duration: 0.2 },
                          }}
                          onPointerDown={(e) => handleDragStart(e, note.id)}
                          onPointerMove={handleDragMove}
                          onPointerUp={handleDragEnd}
                          className={`group rounded-xl border ${colors.border} ${colors.bg} transition-all hover:bg-opacity-80 cursor-grab active:cursor-grabbing select-none ${draggingNoteId === note.id ? "opacity-40" : ""}`}
                        >
                          {/* Drag hint — visible on hover */}
                          <div className="flex items-center gap-1.5 px-3 pt-2 pb-0.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <GripVertical className="w-3 h-3" />
                            <span className="text-[9px] font-bold uppercase tracking-widest opacity-50">Drag to page</span>
                          </div>

                          {isEditing ? (
                            <div className="flex flex-col gap-2 px-3 pb-3">
                              <textarea
                                ref={editInputRef}
                                value={editContent}
                                onChange={(e) => { setEditContent(e.target.value); autoResize(e.currentTarget); }}
                                onKeyDown={(e) => handleEditKeyDown(e, note.id)}
                                onInput={(e) => autoResize(e.currentTarget)}
                                className={`w-full bg-transparent border-none outline-none text-sm ${colors.text} resize-none placeholder-zinc-500 cursor-text`}
                                rows={2}
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleSaveEdit(note.id)}
                                  className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer px-2 py-1 rounded-md bg-white/5 hover:bg-white/10"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-2 px-3 pb-3">
                              <p
                                className={`text-sm ${colors.text} flex-1 whitespace-pre-wrap break-words cursor-pointer leading-relaxed`}
                                onClick={() => handleStartEdit(note)}
                              >
                                {note.content}
                              </p>
                              <div className="flex items-center gap-1 shrink-0">
                                <div className="relative">
                                  <button
                                    onClick={() => setColorPickerId(colorPickerId === note.id ? null : note.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                                  >
                                    <Palette className="w-3.5 h-3.5" />
                                  </button>
                                  {colorPickerId === note.id && (
                                    <div className="absolute right-0 top-full mt-2 z-10 flex items-center gap-1.5 p-2 rounded-xl bg-[#1a1e26] border border-white/10 shadow-xl">
                                      {NOTE_COLORS.map((c) => (
                                        <button
                                          key={c}
                                          onClick={() => { setNoteColor(note.id, c); setColorPickerId(null); }}
                                          className={`w-4 h-4 rounded-full ${COLOR_MAP[c].dot} transition-transform hover:scale-125 cursor-pointer ${note.color === c ? "ring-2 ring-white/60" : ""}`}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => { removeNote(note.id); toast.success("Note deleted"); }}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
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
