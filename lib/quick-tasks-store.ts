import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface QuickTask {
  id: string;
  title: string;
  completed: boolean;
}

interface QuickTasksState {
  tasks: QuickTask[];
  isTasksOpen: boolean;
  setIsTasksOpen: (open: boolean) => void;
  addTask: (title: string) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  moveTask: (fromId: string, toId: string) => void;
  clearCompleted: () => void;
}

export const useQuickTasksStore = create<QuickTasksState>()(
  persist(
    (set) => ({
      tasks: [],
      isTasksOpen: false,
      setIsTasksOpen: (isTasksOpen) => set({ isTasksOpen }),
      addTask: (title) =>
        set((state) => ({
          tasks: [
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              title: title.trim(),
              completed: false,
            },
            ...state.tasks,
          ],
        })),
      toggleTask: (id) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, completed: !task.completed } : task
          ),
        })),
      removeTask: (id) =>
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
        })),
      moveTask: (fromId, toId) =>
        set((state) => {
          if (fromId === toId) {
            return state;
          }

          const fromIndex = state.tasks.findIndex((task) => task.id === fromId);
          const toIndex = state.tasks.findIndex((task) => task.id === toId);

          if (fromIndex === -1 || toIndex === -1) {
            return state;
          }

          const reordered = [...state.tasks];
          const [movedTask] = reordered.splice(fromIndex, 1);
          reordered.splice(toIndex, 0, movedTask);

          return { tasks: reordered };
        }),
      clearCompleted: () =>
        set((state) => ({
          tasks: state.tasks.filter((task) => !task.completed),
        })),
    }),
    {
      name: "dangdoro-quick-tasks-storage",
    }
  )
);
