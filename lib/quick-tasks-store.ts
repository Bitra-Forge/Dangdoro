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

export interface QuickTask {
  id: string;
  title: string;
  completed: boolean;
  order: number;
}

interface QuickTasksState {
  tasks: QuickTask[];
  isTasksOpen: boolean;
  loaded: boolean;
  setIsTasksOpen: (open: boolean) => void;
  addTask: (title: string) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  moveTask: (fromId: string, toId: string) => void;
  clearCompleted: () => Promise<void>;
  loadFromFirestore: () => Promise<void>;
  pushLocalToFirestore: () => Promise<void>;
  clearTasks: () => void;
}

export const useQuickTasksStore = create<QuickTasksState>()(
  persist(
    (set, get) => ({
      tasks: [],
      isTasksOpen: false,
      loaded: false,

      setIsTasksOpen: (isTasksOpen) => set({ isTasksOpen }),

      addTask: async (title) => {
        const user = auth.currentUser;
        const order = Date.now();
        let id: string;

        if (user) {
          const ref = doc(collection(db, "quickTasks"));
          id = ref.id;
          try {
            await setDoc(ref, {
              id,
              userId: user.uid,
              title: title.trim(),
              completed: false,
              order,
              createdAt: serverTimestamp(),
            });
          } catch (err) {
            console.error("Failed to sync quick task to Firestore:", err);
            id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          }
        } else {
          id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        }

        set((state) => ({
          tasks: [
            { id, title: title.trim(), completed: false, order },
            ...state.tasks,
          ],
        }));
      },

      toggleTask: async (id) => {
        let newCompleted = false;
        set((state) => {
          const updated = state.tasks.map((task) => {
            if (task.id === id) {
              newCompleted = !task.completed;
              return { ...task, completed: newCompleted };
            }
            return task;
          });
          return { tasks: updated };
        });

        const user = auth.currentUser;
        if (!user) return;

        try {
          const snap = await getDocs(
            query(
              collection(db, "quickTasks"),
              where("userId", "==", user.uid),
              where("id", "==", id)
            )
          );
          if (!snap.empty) {
            await updateDoc(doc(db, "quickTasks", snap.docs[0].id), {
              completed: newCompleted,
            });
          }
        } catch (err) {
          console.error("Failed to toggle quick task in Firestore:", err);
        }
      },

      removeTask: async (id) => {
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
        }));

        const user = auth.currentUser;
        if (!user) return;

        try {
          const snap = await getDocs(
            query(
              collection(db, "quickTasks"),
              where("userId", "==", user.uid),
              where("id", "==", id)
            )
          );
          if (!snap.empty) {
            await deleteDoc(doc(db, "quickTasks", snap.docs[0].id));
          }
        } catch (err) {
          console.error("Failed to delete quick task from Firestore:", err);
        }
      },

      moveTask: (fromId, toId) => {
        set((state) => {
          if (fromId === toId) return state;

          const fromIndex = state.tasks.findIndex((task) => task.id === fromId);
          const toIndex = state.tasks.findIndex((task) => task.id === toId);

          if (fromIndex === -1 || toIndex === -1) return state;

          const reordered = [...state.tasks];
          const [movedTask] = reordered.splice(fromIndex, 1);
          reordered.splice(toIndex, 0, movedTask);

          return { tasks: reordered };
        });
      },

      clearCompleted: async () => {
        const completedIds: string[] = [];
        set((state) => {
          completedIds.push(
            ...state.tasks.filter((t) => t.completed).map((t) => t.id)
          );
          return { tasks: state.tasks.filter((task) => !task.completed) };
        });

        const user = auth.currentUser;
        if (!user || !completedIds.length) return;

        try {
          const snap = await getDocs(
            query(
              collection(db, "quickTasks"),
              where("userId", "==", user.uid),
              where("completed", "==", true)
            )
          );
          const batch = writeBatch(db);
          snap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        } catch (err) {
          console.error("Failed to clear completed tasks from Firestore:", err);
        }
      },

      loadFromFirestore: async () => {
        const user = auth.currentUser;
        if (!user) return;

        try {
          const snap = await getDocs(
            query(
              collection(db, "quickTasks"),
              where("userId", "==", user.uid)
            )
          );

          if (!snap.empty) {
            const tasks = snap.docs
              .map((d) => {
                const data = d.data() as QuickTask;
                return { ...data, order: data.order ?? 0 };
              })
              .sort((a, b) => b.order - a.order);
            set({ tasks, loaded: true });
          } else {
            set({ loaded: true });
          }
        } catch (err) {
          console.error("Failed to load quick tasks from Firestore:", err);
          set({ loaded: true });
        }
      },

      clearTasks: () => set({ tasks: [], loaded: false }),

      pushLocalToFirestore: async () => {
        const user = auth.currentUser;
        if (!user) return;

        const { tasks, loaded } = get();
        if (!tasks.length || loaded) return;

        const batch = writeBatch(db);
        const seenIds = new Set<string>();
        let hasWrites = false;

        for (const task of tasks) {
          if (seenIds.has(task.id)) continue;
          seenIds.add(task.id);

          const ref = doc(collection(db, "quickTasks"));
          batch.set(ref, {
            id: task.id,
            userId: user.uid,
            title: task.title,
            completed: task.completed,
            order: task.order ?? Date.now(),
            createdAt: serverTimestamp(),
          });
          hasWrites = true;
        }

        if (hasWrites) {
          try {
            await batch.commit();
            set({ loaded: true });
          } catch (err) {
            console.error("Failed to push local tasks to Firestore:", err);
          }
        }
      },
    }),
    {
      name: "dangdoro-quick-tasks-storage",
    }
  )
);
