"use client";

import { useStickyNotesStore, type NoteColor } from "@/lib/sticky-notes-store";
import { Palette, Trash2, CornerUpLeft } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Tooltip } from "@/components/ui/tooltip";

const COLOR_STYLES: Record<NoteColor, { bg: string; text: string; border: string; glow: string }> = {
  yellow: { bg: "bg-amber-400/90", text: "text-amber-950", border: "border-amber-300/60", glow: "rgba(251,191,36,0.35)" },
  green:  { bg: "bg-emerald-400/90", text: "text-emerald-950", border: "border-emerald-300/60", glow: "rgba(52,211,153,0.35)" },
  blue:   { bg: "bg-sky-400/90", text: "text-sky-950", border: "border-sky-300/60", glow: "rgba(56,189,248,0.35)" },
  pink:   { bg: "bg-pink-400/90", text: "text-pink-950", border: "border-pink-300/60", glow: "rgba(244,114,182,0.35)" },
  purple: { bg: "bg-violet-400/90", text: "text-violet-950", border: "border-violet-300/60", glow: "rgba(167,139,250,0.35)" },
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
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      style={{
        position: "fixed",
        left: note.positionX,
        top: note.positionY,
        zIndex: 50,
        filter: `drop-shadow(0 8px 24px ${colors.glow})`,
      }}
      className="w-[220px] cursor-grab active:cursor-grabbing select-none"
    >
      <div className={`${colors.bg} ${colors.border} border rounded-2xl p-3 shadow-xl backdrop-blur-sm relative group`}>
        <p className={`text-sm ${colors.text} whitespace-pre-wrap break-words leading-relaxed pr-6`}>
          {note.content}
        </p>

        {/* Action buttons — appear on hover */}
        <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Color picker */}
          <div className="relative">
            <Tooltip content="Change color" side="top">
              <button
                onClick={() => onColorPickerToggle(note.id)}
                className={`p-1 rounded-lg ${colors.text} hover:bg-black/10 transition-colors cursor-pointer`}
                tabIndex={-1}
              >
                <Palette className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
            {colorPickerId === note.id && (
              <div className="absolute right-0 top-full mt-1 z-[70] flex items-center gap-1 p-1.5 rounded-xl bg-[#1a1e26] border border-white/10 shadow-xl">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => { onSetColor(note.id, c); onColorPickerToggle(""); }}
                    className={`w-4 h-4 rounded-full ${COLOR_STYLES[c].bg.replace("/90", "")} transition-transform hover:scale-125 cursor-pointer ${note.color === c ? "ring-2 ring-white/60" : ""}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Recall — send back to panel, keep note */}
          <Tooltip content="Send back to panel" side="top">
            <button
              onClick={() => onRecall(note.id)}
              className={`p-1 rounded-lg ${colors.text} hover:bg-black/10 transition-colors cursor-pointer`}
              tabIndex={-1}
            >
              <CornerUpLeft className="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          {/* Delete — permanently removes */}
          <Tooltip content="Delete note" side="top">
            <button
              onClick={() => onDelete(note.id)}
              className={`p-1 rounded-lg ${colors.text} hover:bg-red-500/20 hover:text-red-700 transition-colors cursor-pointer`}
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
