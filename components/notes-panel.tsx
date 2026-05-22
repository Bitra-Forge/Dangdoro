"use client";

import { useNotesStore } from "@/lib/notes-store";
import {
  X,
  Trash2,
  Copy,
  Check,
  Bold,
  Italic,
  Underline,
} from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import DOMPurify from "dompurify";

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

  const [copied, setCopied] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const didOpenFocusRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(notes);
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
    <AnimatePresence initial={false} mode="wait">
      {isOpen && (
        <motion.div
          key="quick-notes-panel"
          ref={panelRef}
          initial={{ scale: 0.96, x: -14, y: 10 }}
          animate={{ scale: 1, x: 0, y: 0 }}
          transition={{ type: "spring", stiffness: 360, damping: 34, mass: 0.7 }}
          className="fixed left-[4.75rem] bottom-28 w-full max-w-[420px] transform origin-left-bottom z-[60]"
        >
          <div className="bg-slate-950/80 backdrop-blur-3xl border border-white/10 rounded-[10px] shadow-[0_25px_50px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#49B6E5] shadow-[0_0_8px_#49B6E5]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                Quick Notes
              </span>
            </div>
            <span className="text-[9px] text-white/20 font-medium mt-1 uppercase tracking-wider">
              {wordCount} words · {charCount} chars
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-2 rounded-[10px] hover:bg-white/10 text-white/30 hover:text-white transition-all cursor-pointer group relative"
              title="Copy all"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleClear}
              className="p-2 rounded-[10px] hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all cursor-pointer group"
              title="Clear notes"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-[10px] hover:bg-white/10 text-white/30 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Editor Toolbar */}
        <div className="px-4 pt-3 pb-2 border-b border-white/5 bg-black/20">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onMouseDown={keepSelectionOnToolbarMouseDown}
              onClick={() => applyFormat("bold")}
              className="p-1.5 rounded-[10px] hover:bg-white/10 text-white/40 hover:text-white transition-all"
              title="Bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              onMouseDown={keepSelectionOnToolbarMouseDown}
              onClick={() => applyFormat("italic")}
              className="p-1.5 rounded-[10px] hover:bg-white/10 text-white/40 hover:text-white transition-all"
              title="Italic"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              onMouseDown={keepSelectionOnToolbarMouseDown}
              onClick={() => applyFormat("underline")}
              className="p-1.5 rounded-[10px] hover:bg-white/10 text-white/40 hover:text-white transition-all"
              title="Underline"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button
              onMouseDown={keepSelectionOnToolbarMouseDown}
              onClick={() => applyFormat("fontSize", "2")}
              className="px-2 py-1.5 rounded-[10px] hover:bg-white/10 text-[10px] font-semibold leading-none tracking-wide text-white/40 hover:text-white transition-all"
              title="Extra small text"
            >
              A
            </button>
            <button
              onMouseDown={keepSelectionOnToolbarMouseDown}
              onClick={() => applyFormat("fontSize", "3")}
              className="px-2 py-1.5 rounded-[10px] hover:bg-white/10 text-xs font-semibold leading-none tracking-wide text-white/40 hover:text-white transition-all"
              title="Small text"
            >
              A
            </button>
            <button
              onMouseDown={keepSelectionOnToolbarMouseDown}
              onClick={() => applyFormat("fontSize", "4")}
              className="px-2 py-1.5 rounded-[10px] hover:bg-white/10 text-sm font-semibold leading-none tracking-wide text-white/40 hover:text-white transition-all"
              title="Medium text"
            >
              A
            </button>
            <button
              onMouseDown={keepSelectionOnToolbarMouseDown}
              onClick={() => applyFormat("fontSize", "5")}
              className="px-2 py-1.5 rounded-[10px] hover:bg-white/10 text-base font-semibold leading-none tracking-wide text-white/40 hover:text-white transition-all"
              title="Large text"
            >
              A
            </button>
          </div>
        </div>

        {/* Rich Text Editor */}
        <div className="p-4 bg-black/20 relative">
          {!plainText && (
            <p className="absolute left-4 top-4 text-zinc-600 pointer-events-none text-sm font-[family-name:var(--font-jetbrains)]">
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
            className="w-full h-64 bg-transparent border-none outline-none text-zinc-200 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden font-[family-name:var(--font-jetbrains)] text-sm leading-relaxed"
          />
        </div>

        {/* Perspective Decoration */}
        <div className="h-1.5 w-full bg-gradient-to-r from-transparent via-[#49B6E5]/20 to-transparent opacity-30" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
