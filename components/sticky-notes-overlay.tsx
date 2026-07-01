"use client";

import { useStickyNotesStore, type NoteColor } from "@/lib/sticky-notes-store";
import { Palette, Trash2, CornerUpLeft } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Tooltip } from "@/components/ui/tooltip";

// Paper-look color palette: warm, physical-feeling backgrounds
const COLOR_STYLES: Record<NoteColor, { bg: string; text: string; border: string; glow: string; lines: string; fold: string; dotBg: string }> = {
  yellow: {
    bg: "#fef6e5",
    text: "#6d4508",
    border: "transparent",
    glow: "rgba(245,158,11,0.15)",
    lines: "rgba(109,69,8,0.15)",
    fold: "transparent",
    dotBg: "#f59e0b",
  },
  green: {
    bg: "#e0f7fa",
    text: "#0d4a34",
    border: "transparent",
    glow: "rgba(16,185,129,0.15)",
    lines: "rgba(13,74,52,0.15)",
    fold: "transparent",
    dotBg: "#10b981",
  },
  blue: {
    bg: "#e0f2fe",
    text: "#0c4a6e",
    border: "transparent",
    glow: "rgba(56,189,248,0.15)",
    lines: "rgba(12,74,110,0.15)",
    fold: "transparent",
    dotBg: "#38bdf8",
  },
  pink: {
    bg: "#fcebf3",
    text: "#700c3b",
    border: "transparent",
    glow: "rgba(236,72,153,0.15)",
    lines: "rgba(112,12,59,0.15)",
    fold: "transparent",
    dotBg: "#ec4899",
  },
  purple: {
    bg: "#f3e8ff",
    text: "#581c87",
    border: "transparent",
    glow: "rgba(139,92,246,0.15)",
    lines: "rgba(88,28,135,0.15)",
    fold: "transparent",
    dotBg: "#8b5cf6",
  },
};

const NOTE_COLORS: NoteColor[] = ["yellow", "green", "blue", "pink", "purple"];

function isPlaced(note: { positionX: number; positionY: number }) {
  return note.positionX >= 0 && note.positionY >= 0;
}

export function StickyNotesOverlay() {
  const notes = useStickyNotesStore((state) => state.notes);
  const removeNote = useStickyNotesStore((state) => state.removeNote);
  const recallNote = useStickyNotesStore((state) => state.recallNote);
  const setNoteColor = useStickyNotesStore((state) => state.setNoteColor);
  const moveNote = useStickyNotesStore((state) => state.moveNote);

  const [colorPickerId, setColorPickerId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const placedNotes = notes.filter(isPlaced);

  if (placedNotes.length === 0) return null;

  return (
    <AnimatePresence>
      {placedNotes.map((note) => (
        <FloatingNoteCard
          key={note.id}
          note={note}
          colorPickerId={colorPickerId}
          saveTimer={saveTimer}
          onColorPickerToggle={(id) => setColorPickerId(colorPickerId === id ? null : id)}
          onDelete={removeNote}
          onRecall={recallNote}
          onSetColor={setNoteColor}
          onMove={moveNote}
        />
      ))}
    </AnimatePresence>
  );
}

// ─── Individual floating note ──────────────────────────────────────────────────

function FloatingNoteCard({
  note, colorPickerId, saveTimer, onColorPickerToggle, onDelete, onRecall, onSetColor, onMove,
}: {
  note: { id: string; content: string; color: string; positionX: number; positionY: number };
  colorPickerId: string | null;
  saveTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  onColorPickerToggle: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onRecall: (id: string) => Promise<void>;
  onSetColor: (id: string, color: NoteColor) => Promise<void>;
  onMove: (id: string, x: number, y: number) => Promise<void>;
}) {
  const colors = COLOR_STYLES[note.color as NoteColor] ?? COLOR_STYLES.yellow;

  const posRef = useRef({ x: note.positionX, y: note.positionY });
  const dragOffset = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const cardEl = useRef<HTMLDivElement | null>(null);
  // Track whether this note was just freshly placed (for wobble)
  const [justPlaced, setJustPlaced] = useState(true);

  useEffect(() => {
    // After the entry wobble, mark as settled
    const t = setTimeout(() => setJustPlaced(false), 700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    posRef.current = { x: note.positionX, y: note.positionY };
    if (cardEl.current) {
      cardEl.current.style.left = `${note.positionX}px`;
      cardEl.current.style.top = `${note.positionY}px`;
    }
  }, [note.positionX, note.positionY]);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragOffset.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y };
    isDragging.current = true;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const x = Math.max(0, e.clientX - dragOffset.current.x);
    const y = Math.max(0, e.clientY - dragOffset.current.y);
    posRef.current = { x, y };
    if (cardEl.current) {
      cardEl.current.style.left = `${x}px`;
      cardEl.current.style.top = `${y}px`;
    }
  };

  const onPointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onMove(note.id, posRef.current.x, posRef.current.y);
    }, 400);
  };

  return (
    <motion.div
      ref={(el) => { cardEl.current = el; }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      initial={{ opacity: 0, scale: 0.75, rotate: -6 }}
      animate={
        justPlaced
          ? {
              opacity: 1,
              scale: [0.75, 1.08, 0.97, 1.03, 1],
              rotate: [-6, 3, -2, 1.5, -2],
            }
          : { opacity: 1, scale: 1, rotate: -2.5 }
      }
      exit={{ opacity: 0, scale: 0.8, rotate: -4 }}
      transition={
        justPlaced
          ? { duration: 0.6, ease: "easeOut" }
          : { type: "spring", stiffness: 280, damping: 28 }
      }
      style={{
        position: "fixed",
        left: note.positionX,
        top: note.positionY,
        zIndex: 58,
        filter: `drop-shadow(0 8px 28px ${colors.glow}) drop-shadow(0 2px 6px rgba(0,0,0,0.18))`,
        transformOrigin: "top right",
      }}
      className="w-[220px] cursor-grab active:cursor-grabbing select-none"
    >
      {/* Translucent scotch tape at top right */}
      <div
        className="absolute -top-3 right-6 w-11 h-4 bg-white/20 backdrop-blur-[0.5px] border border-white/5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] rotate-[-12deg] pointer-events-none z-10"
        style={{
          boxShadow: "inset 0 0 3px rgba(255,255,255,0.15)",
        }}
      />

      {/* Paper note card */}
      <div className="relative group w-full">
        {/* Inner card with overflow-hidden to crop left strip curvature */}
        <div
          className="rounded-[20px] overflow-hidden flex w-full border-none"
          style={{
            backgroundColor: colors.bg,
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
            style={{ background: colors.dotBg }}
          />
          {/* ── Content ─────────────────────────────────────────────── */}
          <div className="relative z-[1] p-4 pr-7 pb-7 flex-1 min-w-0">
            <p
              className="text-sm whitespace-pre-wrap break-words leading-relaxed font-medium font-serif"
              style={{ color: colors.text }}
            >
              {note.content}
            </p>
          </div>
        </div>

        {/* ── Action buttons — appear on hover ────────────────────── */}
        <div className="absolute bottom-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-[3]">
          {/* Color picker */}
          <div className="relative">
            <Tooltip content="Change color" side="top">
              <button
                onClick={() => onColorPickerToggle(note.id)}
                className="p-1 rounded-lg hover:bg-black/10 transition-colors cursor-pointer"
                style={{ color: colors.text }}
                tabIndex={-1}
              >
                <Palette className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
            {colorPickerId === note.id && (
              <div className="absolute right-0 bottom-full mb-1 z-[70] flex items-center gap-1.5 p-2 rounded-xl bg-white/95 backdrop-blur-sm border border-black/10 shadow-xl">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => { onSetColor(note.id, c); onColorPickerToggle(""); }}
                    className="w-4 h-4 rounded-full transition-transform hover:scale-125 cursor-pointer"
                    style={{
                      background: COLOR_STYLES[c].dotBg,
                      outline: note.color === c ? `2px solid ${COLOR_STYLES[c].text}` : "none",
                      outlineOffset: "2px",
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Recall — send back to panel */}
          <Tooltip content="Send back to panel" side="top">
            <button
              onClick={() => onRecall(note.id)}
              className="p-1 rounded-lg hover:bg-black/10 transition-colors cursor-pointer"
              style={{ color: colors.text }}
              tabIndex={-1}
            >
              <CornerUpLeft className="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          {/* Delete */}
          <Tooltip content="Delete note" side="top">
            <button
              onClick={() => onDelete(note.id)}
              className="p-1 rounded-lg hover:bg-red-500/20 transition-colors cursor-pointer"
              style={{ color: colors.text }}
              tabIndex={-1}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>
    </motion.div>
  );
}
