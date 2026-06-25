"use client";

import { useNotesStore } from "@/lib/notes-store";
import { useTimerStore } from "@/lib/store";
import {
  X,
  Trash2,
  Copy,
  Check,
  Pencil,
  Play,
  Pause,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import DOMPurify from "dompurify";
import { Tooltip } from "@/components/ui/tooltip";

/** Sanitize HTML to prevent XSS via stored notes */
const sanitizeHtml = (html: string): string => {
  if (typeof window === "undefined") return html;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["b", "i", "u", "br", "div", "span", "p", "font", "strong", "em"],
    ALLOWED_ATTR: ["style", "size", "color"],
  });
};

export function NotesPanel() {
  const isOpen = useNotesStore((state) => state.isNotesOpen);
  const setIsOpen = useNotesStore((state) => state.setIsNotesOpen);
  const notes = useNotesStore((state) => state.notes);
  const setNotes = useNotesStore((state) => state.setNotes);

  const timerIsActive = useTimerStore((state) => state.isActive);
  const timerStart = useTimerStore((state) => state.start);
  const timerPause = useTimerStore((state) => state.pause);

  const [copied, setCopied] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const didOpenFocusRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(notes) || /&[a-z0-9#]{2,8};/i.test(notes);
  const htmlFromPlainText = notes
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  const getPlainText = () => {
    const tmp = document.createElement("div");
    tmp.innerHTML = sanitizeHtml(notes);
    return (tmp.textContent || "").trim();
  };

  const plainText = hasHtmlTags ? getPlainText() : notes.trim();

  const saveSelection = () => {
    const selection = window.getSelection();
    const editor = editorRef.current;
    if (!selection || !editor || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedSelectionRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    const selection = window.getSelection();
    const savedRange = savedSelectionRef.current;
    if (!selection || !savedRange) return;

    selection.removeAllRanges();
    selection.addRange(savedRange);
  };

  useEffect(() => {
    if (!isOpen) {
      didOpenFocusRef.current = false;
      return;
    }

    if (!editorRef.current) return;

    const sanitizedContent = sanitizeHtml(hasHtmlTags ? notes : htmlFromPlainText);
    if (editorRef.current.innerHTML !== sanitizedContent) {
      editorRef.current.innerHTML = sanitizedContent;
    }

    // Only force focus/caret placement once when opening.
    if (!didOpenFocusRef.current) {
      editorRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      didOpenFocusRef.current = true;
    }
  }, [isOpen, notes, hasHtmlTags, htmlFromPlainText]);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (document.activeElement === editorRef.current) {
        saveSelection();
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-quick-action-trigger="true"]')) {
        return;
      }
      if (!panelRef.current) return;
      if (!panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, setIsOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(plainText);
    setCopied(true);
    toast.success("Notes copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    if (notes.trim() && !confirm("Are you sure you want to clear your notes?")) return;
    setNotes("");
    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }
    toast.success("Notes cleared");
  };

  const handleEditorInput = () => {
    if (!editorRef.current) return;
    setNotes(editorRef.current.innerHTML);
  };

  const applyFormat = (command: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    restoreSelection();
    const didApply = document.execCommand(command, false, value);
    if (!didApply && command === "formatBlock") {
      document.execCommand("formatBlock", false, value?.replace(/[<>]/g, ""));
    }
    saveSelection();
    setNotes(editorRef.current.innerHTML);
  };

  const keepSelectionOnToolbarMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const wordCount = plainText ? plainText.split(/\s+/).length : 0;
  const charCount = plainText.length;

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          key="quick-notes-panel"
          ref={panelRef}
          initial={{ opacity: 1, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ 
            opacity: 0, 
            scale: 0.96, 
            y: 10,
            transition: { duration: 0.15, ease: "easeIn" }
          }}
          transition={{ type: "spring", stiffness: 360, damping: 34, mass: 0.7 }}
          className="fixed left-1/2 -translate-x-1/2 bottom-40 sm:bottom-28 w-[92vw] sm:w-full max-w-[420px] transform origin-bottom z-[60]"
        >
          <div className="bg-[#13161C]/95 backdrop-blur-3xl border border-white/[0.06] rounded-[28px] shadow-[0_30px_60px_rgba(0,0,0,0.8)] flex flex-col p-6 gap-6 overflow-hidden h-[530px] max-h-[calc(100dvh-12rem)] sm:max-h-[calc(100dvh-10rem)]">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                  Quick Notes
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Tooltip content="Copy all">
                  <button
                    onClick={handleCopy}
                    className="flex items-center justify-center p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer group relative"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </Tooltip>
                <Tooltip content="Clear notes">
                  <button
                    onClick={handleClear}
                    className="flex items-center justify-center p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer group"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </Tooltip>
                <Tooltip content={timerIsActive ? "Pause Timer" : "Start Timer"}>
                  <button
                    onClick={() => {
                      if (timerIsActive) {
                        timerPause();
                      } else {
                        timerStart();
                      }
                    }}
                    className="flex items-center justify-center p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                  >
                    {timerIsActive ? (
                      <Pause className="w-4 h-4 text-white/80" />
                    ) : (
                      <Play className="w-4 h-4 text-white/80 fill-current ml-0.5" />
                    )}
                  </button>
                </Tooltip>
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
                <Pencil className="w-8 h-8 text-white/80 relative z-10" />
              </div>
              <div className="w-24 h-1 bg-white rounded-full mt-5 shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
            </div>

            {/* Rich Text Editor Container */}
            <div className="p-5 bg-black/20 rounded-[20px] border border-white/[0.04] relative flex-1 min-h-0">
              {!plainText && (
                <p className="absolute left-5 top-5 text-zinc-600 pointer-events-none text-sm font-[family-name:var(--font-jetbrains)] leading-relaxed italic">
                  Capture your thoughts here and keep your flow uninterrupted...
                </p>
              )}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleEditorInput}
                onMouseUp={saveSelection}
                onKeyUp={saveSelection}
                className="w-full h-full bg-transparent border-none outline-none text-zinc-200 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden font-[family-name:var(--font-jetbrains)] text-sm leading-relaxed"
              />
            </div>

            {/* Formatting Toolbar */}
            <div className="flex items-center justify-center gap-2">
              <Tooltip content="Bold">
                <button
                  onMouseDown={keepSelectionOnToolbarMouseDown}
                  onClick={() => applyFormat("bold")}
                  className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] transition-all flex items-center justify-center text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  B
                </button>
              </Tooltip>
              <Tooltip content="Italic">
                <button
                  onMouseDown={keepSelectionOnToolbarMouseDown}
                  onClick={() => applyFormat("italic")}
                  className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] transition-all flex items-center justify-center text-xs italic font-semibold text-zinc-400 hover:text-white"
                >
                  I
                </button>
              </Tooltip>
              <Tooltip content="Underline">
                <button
                  onMouseDown={keepSelectionOnToolbarMouseDown}
                  onClick={() => applyFormat("underline")}
                  className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] transition-all flex items-center justify-center text-xs underline font-semibold text-zinc-400 hover:text-white"
                >
                  U
                </button>
              </Tooltip>
              <div className="w-px h-5 bg-white/10 mx-1" />
              <Tooltip content="Extra small text">
                <button
                  onMouseDown={keepSelectionOnToolbarMouseDown}
                  onClick={() => applyFormat("fontSize", "2")}
                  className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] transition-all flex items-center justify-center text-[10px] font-bold text-zinc-400 hover:text-white"
                >
                  A
                </button>
              </Tooltip>
              <Tooltip content="Small text">
                <button
                  onMouseDown={keepSelectionOnToolbarMouseDown}
                  onClick={() => applyFormat("fontSize", "3")}
                  className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] transition-all flex items-center justify-center text-xs font-bold text-zinc-400 hover:text-white"
                >
                  A
                </button>
              </Tooltip>
              <Tooltip content="Medium text">
                <button
                  onMouseDown={keepSelectionOnToolbarMouseDown}
                  onClick={() => applyFormat("fontSize", "4")}
                  className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] transition-all flex items-center justify-center text-sm font-bold text-zinc-400 hover:text-white"
                >
                  A
                </button>
              </Tooltip>
              <Tooltip content="Large text">
                <button
                  onMouseDown={keepSelectionOnToolbarMouseDown}
                  onClick={() => applyFormat("fontSize", "5")}
                  className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] transition-all flex items-center justify-center text-base font-bold text-zinc-400 hover:text-white"
                >
                  A
                </button>
              </Tooltip>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
