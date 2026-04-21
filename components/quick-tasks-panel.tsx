"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, GripVertical, Plus, X, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuickTasksStore } from "@/lib/quick-tasks-store";
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

  if (!isOpen) return null;

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
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          key="quick-tasks-panel"
          ref={panelRef}
          initial={{ scale: 0.96, x: -14, y: 10 }}
          animate={{ scale: 1, x: 0, y: 0 }}
          exit={{ scale: 0.96, x: -14, y: 10 }}
          transition={{ type: "spring", stiffness: 360, damping: 34, mass: 0.7 }}
          className="fixed left-[4.75rem] bottom-28 w-full max-w-[420px] transform origin-left-bottom z-[61]"
        >
          <div className="bg-slate-950/80 backdrop-blur-3xl border border-white/10 rounded-[10px] shadow-[0_25px_50px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#49B6E5] shadow-[0_0_8px_#49B6E5]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                Quick Tasks
              </span>
            </div>
            <span className="text-[9px] text-white/20 font-medium mt-1 uppercase tracking-wider">
              {pendingCount} pending · {tasks.length} total
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-[10px] hover:bg-white/10 text-white/30 hover:text-white transition-all cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Input */}
        <div className="p-4 border-b border-white/5 bg-black/20 flex items-center gap-2">
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
            className="flex-1 h-10 rounded-[10px] border border-white/10 bg-slate-900/70 px-3 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none focus:border-[#49B6E5]/60 transition-colors"
          />
          <button
            onClick={handleAddTask}
            className="h-10 px-3 rounded-[10px] bg-[#49B6E5] text-slate-950 hover:bg-[#67c4eb] transition-colors inline-flex items-center gap-1.5 font-semibold text-sm"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>

        {/* Task List */}
        <div className="h-64 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden bg-black/20 px-4 py-3 space-y-2">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-zinc-600">
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
                      "group h-11 rounded-[10px] border border-white/10 bg-slate-900/55 px-3 flex items-center gap-3 transition-[border-color,background-color,transform,box-shadow] duration-200 hover:border-white/20 cursor-grab active:cursor-grabbing",
                      draggingTaskId === task.id && "opacity-65 scale-[1.01] border-[#49B6E5]/45 shadow-[0_8px_26px_rgba(73,182,229,0.18)]",
                      overTaskId === task.id && draggingTaskId !== task.id && "border-[#49B6E5]/55 bg-[#49B6E5]/10"
                    )}
                  >
                    <div
                      className="text-zinc-500/70 transition-colors group-hover:text-zinc-300"
                      title="Drag to reorder"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    <button
                      onClick={() => toggleTask(task.id)}
                      className={cn(
                        "w-5 h-5 rounded-[10px] border flex items-center justify-center transition-all",
                        task.completed
                          ? "bg-[#49B6E5] border-[#49B6E5] text-slate-950"
                          : "border-white/30 text-transparent hover:border-[#49B6E5]/60"
                      )}
                    >
                      <Check className="w-3.5 h-3.5" />
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
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-[10px] text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </LayoutGroup>
          )}
        </div>

        {/* Perspective Decoration */}
        <div className="h-1.5 w-full bg-gradient-to-r from-transparent via-[#49B6E5]/20 to-transparent opacity-30" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
