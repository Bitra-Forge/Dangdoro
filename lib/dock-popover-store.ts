import { create } from "zustand";

type DockPopoverId = "feedback" | "notifications" | null;

interface DockPopoverState {
  active: DockPopoverId;
  open: (id: Exclude<DockPopoverId, null>) => void;
  close: (id: Exclude<DockPopoverId, null>) => void;
  toggle: (id: Exclude<DockPopoverId, null>) => void;
}

export const useDockPopoverStore = create<DockPopoverState>((set, get) => ({
  active: null,
  open: (id) => set({ active: id }),
  close: (id) =>
    set((state) => (state.active === id ? { active: null } : state)),
  toggle: (id) =>
    set((state) => ({
      active: state.active === id ? null : id,
    })),
}));
