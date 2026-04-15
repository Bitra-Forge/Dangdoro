import { create } from "zustand";
import { persist } from "zustand/middleware";

interface NotesState {
  notes: string;
  isNotesOpen: boolean;
  setNotes: (notes: string) => void;
  setIsNotesOpen: (open: boolean) => void;
  toggleNotes: () => void;
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set) => ({
      notes: "",
      isNotesOpen: false,
      setNotes: (notes) => set({ notes }),
      setIsNotesOpen: (isNotesOpen) => set({ isNotesOpen }),
      toggleNotes: () => set((state) => ({ isNotesOpen: !state.isNotesOpen })),
    }),
    {
      name: "dangdoro-notes-storage",
    }
  )
);
