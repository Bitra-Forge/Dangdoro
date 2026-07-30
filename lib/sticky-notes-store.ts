import { create } from "zustand";
import { persist } from "zustand/middleware";
import { auth, db } from "./firebase";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

export interface StickyNote {
  id: string;
  content: string;
  color: string;
  order: number;
  positionX: number;
  positionY: number;
}

const NOTE_COLORS = ["yellow", "green", "blue", "pink", "purple"] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

interface StickyNotesState {
  notes: StickyNote[];
  isNotesOpen: boolean;
  loaded: boolean;
  setIsNotesOpen: (open: boolean) => void;
  addNote: (content: string, color?: NoteColor, x?: number, y?: number) => Promise<void>;
  updateNote: (id: string, content: string) => Promise<void>;
  removeNote: (id: string) => Promise<void>;
  recallNote: (id: string) => Promise<void>;
  setNoteColor: (id: string, color: NoteColor) => Promise<void>;
  moveNote: (id: string, x: number, y: number) => Promise<void>;
  loadFromFirestore: () => Promise<void>;
  pushLocalToFirestore: () => Promise<void>;
  clearNotes: () => void;
}

export const useStickyNotesStore = create<StickyNotesState>()(
  persist(
    (set, get) => ({
      notes: [],
      isNotesOpen: false,
      loaded: false,

      setIsNotesOpen: (isNotesOpen) => set({ isNotesOpen }),

      addNote: async (content, color = "yellow", x?: number, y?: number) => {
        const user = auth.currentUser;
        const order = Date.now();
        const px = x ?? -1;
        const py = y ?? -1;
        let id: string;

        if (user) {
          const ref = doc(collection(db, "stickyNotes"));
          id = ref.id;
          try {
            await setDoc(ref, {
              id,
              userId: user.uid,
              content,
              color,
              order,
              positionX: px,
              positionY: py,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            console.error("Failed to sync sticky note to Firestore:", err);
            id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          }
        } else {
          id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        }

        set((state) => ({
          notes: [
            {
              id,
              content,
              color,
              order,
              positionX: px,
              positionY: py,
            },
            ...state.notes,
          ],
        }));
      },

      updateNote: async (id, content) => {
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, content } : n
          ),
        }));

        const user = auth.currentUser;
        if (!user) return;

        try {
          const snap = await getDocs(
            query(
              collection(db, "stickyNotes"),
              where("userId", "==", user.uid),
              where("id", "==", id)
            )
          );
          if (!snap.empty) {
            await updateDoc(doc(db, "stickyNotes", snap.docs[0].id), {
              content,
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          console.error("Failed to update sticky note in Firestore:", err);
        }
      },

      removeNote: async (id) => {
        set((state) => ({
          notes: state.notes.filter((n) => n.id !== id),
        }));

        const user = auth.currentUser;
        if (!user) return;

        try {
          const snap = await getDocs(
            query(
              collection(db, "stickyNotes"),
              where("userId", "==", user.uid),
              where("id", "==", id)
            )
          );
          if (!snap.empty) {
            await deleteDoc(doc(db, "stickyNotes", snap.docs[0].id));
          }
        } catch (err) {
          console.error("Failed to delete sticky note from Firestore:", err);
        }
      },

      // Unplace a note from the background back into the panel list (does NOT delete)
      recallNote: async (id) => {
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, positionX: -1, positionY: -1 } : n
          ),
        }));

        const user = auth.currentUser;
        if (!user) return;

        try {
          const snap = await getDocs(
            query(
              collection(db, "stickyNotes"),
              where("userId", "==", user.uid),
              where("id", "==", id)
            )
          );
          if (!snap.empty) {
            await updateDoc(doc(db, "stickyNotes", snap.docs[0].id), {
              positionX: -1,
              positionY: -1,
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          console.error("Failed to recall sticky note from Firestore:", err);
        }
      },

      setNoteColor: async (id, color) => {
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, color } : n
          ),
        }));

        const user = auth.currentUser;
        if (!user) return;

        try {
          const snap = await getDocs(
            query(
              collection(db, "stickyNotes"),
              where("userId", "==", user.uid),
              where("id", "==", id)
            )
          );
          if (!snap.empty) {
            await updateDoc(doc(db, "stickyNotes", snap.docs[0].id), {
              color,
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          console.error("Failed to update sticky note color in Firestore:", err);
        }
      },

      moveNote: async (id, x, y) => {
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, positionX: x, positionY: y } : n
          ),
        }));

        const user = auth.currentUser;
        if (!user) return;

        try {
          const snap = await getDocs(
            query(
              collection(db, "stickyNotes"),
              where("userId", "==", user.uid),
              where("id", "==", id)
            )
          );
          if (!snap.empty) {
            await updateDoc(doc(db, "stickyNotes", snap.docs[0].id), {
              positionX: x,
              positionY: y,
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          console.error("Failed to move sticky note in Firestore:", err);
        }
      },

      loadFromFirestore: async () => {
        const user = auth.currentUser;
        if (!user) return;

        try {
          const snap = await getDocs(
            query(
              collection(db, "stickyNotes"),
              where("userId", "==", user.uid)
            )
          );

          if (!snap.empty) {
            const notes = snap.docs
              .map((d) => {
                const data = d.data() as StickyNote;
                return {
                  ...data,
                  order: data.order ?? 0,
                  positionX: data.positionX ?? -1,
                  positionY: data.positionY ?? -1,
                };
              })
              .sort((a, b) => b.order - a.order);
            set({ notes, loaded: true });
          } else {
            set({ loaded: true });
          }
        } catch (err) {
          console.error("Failed to load sticky notes from Firestore:", err);
          set({ loaded: true });
        }
      },

      clearNotes: () => set({ notes: [], loaded: false }),

      pushLocalToFirestore: async () => {
        const user = auth.currentUser;
        if (!user) return;

        const { notes, loaded } = get();
        if (!notes.length) return;

        const batch = writeBatch(db);
        const seenIds = new Set<string>();
        let hasWrites = false;

        for (const note of notes) {
          if (seenIds.has(note.id)) continue;
          seenIds.add(note.id);

          const ref = doc(collection(db, "stickyNotes"));
          batch.set(ref, {
            id: note.id,
            userId: user.uid,
            content: note.content,
            color: note.color,
            order: note.order ?? Date.now(),
            positionX: note.positionX ?? 60,
            positionY: note.positionY ?? 120,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          hasWrites = true;
        }

        if (hasWrites) {
          try {
            await batch.commit();
            set({ loaded: true });
          } catch (err) {
            console.error("Failed to push local notes to Firestore:", err);
          }
        }
      },
    }),
    {
      name: "dangdoro-sticky-notes-storage",
    }
  )
);
