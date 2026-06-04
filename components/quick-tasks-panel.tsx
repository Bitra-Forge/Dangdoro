"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, GripVertical, Plus, X, ListTodo, Pause, Play, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuickTasksStore } from "@/lib/quick-tasks-store";
import { useTimerStore } from "@/lib/store";
import { toast } from "sonner";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";

export function QuickTasksPanel() {
  const isOpen = useQuickTasksStore((state) => state.isTasksOpen);
  const setIsOpen = useQuickTasksStore((state) => state.setIsTasksOpen);
  const tasks = useQuickTasksStore((state) => state.tasks);
  const addTask = useQuickTasksStore((state) => state.addTask);
  const toggleTask = useQuickTasksStore((state) => state.toggleTask);
  const removeTask = useQuickTasksStore((state) => state.removeTask);
  const moveTask = useQuickTasksStore((state) => state.moveTask);
  const clearCompleted = useQuickTasksStore((state) => state.clearCompleted);

  const timerIsActive = useTimerStore((state) => state.isActive);
  const timerStart = useTimerStore((state) => state.start);
  const timerPause = useTimerStore((state) => state.pause);

  const [draft, setDraft] = useState("");
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [overTaskId, setOverTaskId] = useState<string | null>(null);
  const lastReorderRef = useRef<string>("");
  const panelRef = useRef<HTMLDivElement>(null);

  const pendingCount = useMemo(
    () => tasks.filter((task) => !task.completed).length,
    [tasks]
  );

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

  const handleAddTask = () => {
    const title = draft.trim();
    if (!title) return;
    addTask(title);
    setDraft("");
  };

  const handleClearCompleted = () => {
    const doneCount = tasks.length - pendingCount;
    if (doneCount === 0) return;
    clearCompleted();
    toast.success("Completed tasks cleared");
  };

  const handleDragOverTask = (targetTaskId: string) => {
    if (!draggingTaskId || draggingTaskId === targetTaskId) {
      return;
    }

    const reorderSignature = `${draggingTaskId}->${targetTaskId}`;
    if (lastReorderRef.current === reorderSignature) {
      return;
    }

    setOverTaskId(targetTaskId);
    moveTask(draggingTaskId, targetTaskId);
    lastReorderRef.current = reorderSignature;
  };

  const resetDragState = () => {
    setDraggingTaskId(null);
    setOverTaskId(null);
    lastReorderRef.current = "";
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="quick-tasks-panel"
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
          className="fixed left-1/2 -translate-x-1/2 bottom-40 sm:bottom-28 w-[92vw] sm:w-full max-w-[420px] transform origin-bottom z-[61]"
        >
          <div className="bg-[#13161C]/95 backdrop-blur-3xl border border-white/[0.06] rounded-[28px] shadow-[0_30px_60px_rgba(0,0,0,0.8)] flex flex-col p-6 gap-6 overflow-hidden h-[530px]">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                    Quick Tasks
                  </span>
                </div>
                <span className="text-[8px] text-white/20 font-bold mt-1 uppercase tracking-widest pl-[18px]">
                  {pendingCount} Pending · {tasks.length} Total
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                {tasks.length - pendingCount > 0 && (
                  <button
                    onClick={handleClearCompleted}
                    className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer group"
                    title="Clear completed tasks"
                  >
                    <Trash2 className="w-4 h-4 text-zinc-500 group-hover:text-red-400" />
                  </button>
                )}
                <button
                  onClick={() => {
                    if (timerIsActive) {
                      timerPause();
                    } else {
                      timerStart();
                    }
                  }}
                  className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                  title={timerIsActive ? "Pause Timer" : "Start Timer"}
                >
                  {timerIsActive ? (
                    <Pause className="w-4 h-4 text-white/80" />
                  ) : (
                    <Play className="w-4 h-4 text-white/80 fill-current ml-0.5" />
                  )}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Central Graphic */}
            <div className="flex flex-col items-center justify-center my-1">
              <div className="w-20 h-20 rounded-full border border-white/[0.08] bg-white/[0.02] flex items-center justify-center relative shadow-[0_0_20px_rgba(255,255,255,0.02)]">
                <div className="absolute inset-0 rounded-full bg-white/[0.01] blur-md" />
                <Check className="w-8 h-8 text-white/80 relative z-10" />
              </div>
              <div className="w-24 h-1 bg-white rounded-full mt-5 shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
            </div>

            {/* Input Form */}
            <div className="flex items-center gap-3 w-full">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddTask();
                  }
                }}
                placeholder="Add a quick task..."
                className="flex-1 h-12 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none focus:border-zinc-400/60 transition-colors"
              />
              <button
                onClick={handleAddTask}
                className="h-12 px-5 rounded-xl bg-white text-slate-950 hover:bg-zinc-200 transition-colors inline-flex items-center gap-1.5 font-semibold text-sm shadow-[0_0_15px_rgba(255,255,255,0.15)] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex flex-col gap-3 py-1 min-h-0">
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-8 text-zinc-600 bg-white/[0.01] border border-white/[0.03] rounded-xl p-4">
                  <ListTodo className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">No tasks yet. Momentum starts with one.</p>
                </div>
              ) : (
                <LayoutGroup>
                  <AnimatePresence initial={false}>
                    {tasks.map((task) => (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.98 }}
                        transition={{
                          layout: { type: "spring", stiffness: 520, damping: 36, mass: 0.5 },
                          opacity: { duration: 0.16 },
                          y: { duration: 0.2 },
                        }}
                        draggable
                        onDragStart={(event: any) => {
                          event.dataTransfer.effectAllowed = "move";
                          setDraggingTaskId(task.id);
                        }}
                        onDragOver={(event: any) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          handleDragOverTask(task.id);
                        }}
                        onDrop={(event: any) => {
                          event.preventDefault();
                          if (draggingTaskId && draggingTaskId !== task.id) {
                            moveTask(draggingTaskId, task.id);
                          }
                          resetDragState();
                        }}
                        onDragEnd={resetDragState}
                        className={cn(
                          "group h-[52px] rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 flex items-center gap-4 transition-[border-color,background-color,transform,box-shadow] duration-200 hover:bg-white/[0.04] hover:border-white/[0.08] cursor-grab active:cursor-grabbing",
                          draggingTaskId === task.id && "opacity-65 scale-[1.01] border-white/30 shadow-[0_8px_26px_rgba(255,255,255,0.08)]",
                          overTaskId === task.id && draggingTaskId !== task.id && "border-white/30 bg-white/5"
                        )}
                      >
                        <div
                          className="text-zinc-600 transition-colors group-hover:text-zinc-400"
                          title="Drag to reorder"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        <button
                          onClick={() => toggleTask(task.id)}
                          className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center transition-all cursor-pointer",
                            task.completed
                              ? "bg-white text-slate-950 shadow-[0_0_10px_rgba(255,255,255,0.4)]"
                              : "border-2 border-zinc-600 text-transparent hover:border-zinc-400"
                          )}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </button>

                        <p
                          className={cn(
                            "flex-1 text-sm truncate",
                            task.completed
                              ? "text-zinc-500 line-through"
                              : "text-zinc-200"
                          )}
                        >
                          {task.title}
                        </p>

                        <button
                          onClick={() => removeTask(task.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    ))}
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
