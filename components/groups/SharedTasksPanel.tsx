"use client";

import { useState, useMemo, useEffect, memo } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { 
    Plus, Sparkles, Mail, Target, Users,
    Play, Search, Check, Edit2, X, Save, Trash2, Filter,
    ChevronUp, ChevronDown, GripVertical
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SharedTask } from "@/lib/groups";
import { Tooltip } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string; pillColor: string; icon: any }> = {
    "todo":        { label: "Todo",        color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",    pillColor: "bg-zinc-800/80 text-zinc-400 border-zinc-700/50",        icon: Check },
    "in-progress": { label: "In Progress", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",    pillColor: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",        icon: Play },
    "in-review":   { label: "In Review",   color: "text-amber-400 bg-amber-500/10 border-amber-500/20", pillColor: "bg-amber-500/15 text-amber-300 border-amber-500/30",    icon: Search },
    "done":        { label: "Done",        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", pillColor: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", icon: Check },
};

const STATUS_CYCLE = ["todo", "in-progress", "in-review", "done"] as const;

const PRIORITY_CONFIG: Record<string, { color: string; dot: string }> = {
    "high":   { color: "bg-red-500/15 text-red-400 border-red-500/30",    dot: "bg-red-400" },
    "medium": { color: "bg-amber-500/15 text-amber-400 border-amber-500/30", dot: "bg-amber-400" },
    "low":    { color: "bg-sky-500/15 text-sky-400 border-sky-500/30",    dot: "bg-sky-400" },
};

// Deterministic color palette for task icon boxes
const CARD_COLORS = [
    { iconBg: "bg-violet-600",  bar: "bg-violet-500",  glow: "rgba(139,92,246,0.15)" },
    { iconBg: "bg-emerald-600", bar: "bg-emerald-500", glow: "rgba(16,185,129,0.15)" },
    { iconBg: "bg-amber-600",   bar: "bg-amber-500",   glow: "rgba(245,158,11,0.15)" },
    { iconBg: "bg-red-600",     bar: "bg-red-500",     glow: "rgba(239,68,68,0.15)" },
    { iconBg: "bg-blue-600",    bar: "bg-blue-500",    glow: "rgba(59,130,246,0.15)" },
    { iconBg: "bg-pink-600",    bar: "bg-pink-500",    glow: "rgba(236,72,153,0.15)" },
    { iconBg: "bg-teal-600",    bar: "bg-teal-500",    glow: "rgba(20,184,166,0.15)" },
];

const CARD_ICONS = [Target, Sparkles, Mail, Check, Play, Search];

const PROGRESS_BY_STATUS: Record<string, number> = {
    "todo":        15,
    "in-progress": 45,
    "in-review":   72,
    "done":        100,
};

const TasksListWrapper = ({ children, isAdmin, values, onReorder, className }: any) => {
    if (isAdmin) {
        return (
            <Reorder.Group axis="y" values={values} onReorder={onReorder} className={className}>
                {children}
            </Reorder.Group>
        );
    }
    return (
        <div className={className}>
            {children}
        </div>
    );
};

const TaskWrapper = ({ children, task, isAdmin, ...props }: any) => {
    if (isAdmin) {
        return (
            <Reorder.Item value={task} id={task.id} {...props}>
                {children}
            </Reorder.Item>
        );
    }
    return (
        <motion.div {...props}>
            {children}
        </motion.div>
    );
};

export const SharedTasksPanel = memo(function SharedTasksPanel({ tasks, onAdd, onUpdate, onDelete, isAdmin, groupMembers, currentUserId, prefillTemplate, onPrefillHandled, onTemplateSelect, onReorder }: any) {
    const searchParams = useSearchParams();
    const [openAdd, setOpenAdd] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [prio, setPrio] = useState<any>("medium");
    const [assign, setAssign] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [priorityFilter, setPriorityFilter] = useState<string>("all");
    const [objectiveFilter, setObjectiveFilter] = useState<"all" | "mine">(searchParams.get("tab") === "mine" ? "mine" : "all");
    
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editDesc, setEditDesc] = useState("");
    const [editPrio, setEditPrio] = useState<any>("medium");
    const [editAssign, setEditAssign] = useState("all");

    const [subtasks, setSubtasks] = useState<{ id: string; title: string; completed: boolean }[]>([]);
    const [editSubtasks, setEditSubtasks] = useState<{ id: string; title: string; completed: boolean }[]>([]);
    const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

    const toggleTaskExpanded = (taskId: string) => {
        setExpandedTasks(prev => ({
            ...prev,
            [taskId]: !prev[taskId]
        }));
    };

    const startEditing = (task: SharedTask) => {
        setEditingTaskId(task.id);
        setEditTitle(task.title);
        setEditDesc(task.description);
        setEditPrio(task.priority);
        setEditAssign(task.assignedTo || "all");
        setEditSubtasks(task.subtasks || []);
    };

    const handleSaveEdit = () => {
        if (!editingTaskId || !editTitle.trim()) return;
        const validSubtasks = editSubtasks
            .map(s => ({ ...s, title: s.title.trim() }))
            .filter(s => s.title.length > 0);
        onUpdate(editingTaskId, {
            title: editTitle,
            description: editDesc,
            priority: editPrio,
            assignedTo: editAssign,
            subtasks: validSubtasks
        });
        setEditingTaskId(null);
        setEditSubtasks([]);
    };

    const assigneeNameById = useMemo(() => {
        const map: Record<string, string> = {};
        (groupMembers || []).forEach((m: any) => {
            if (m?.uid) map[m.uid] = m.displayName || "Member";
        });
        return map;
    }, [groupMembers]);

    useEffect(() => {
        if (!prefillTemplate) return;
        setTitle(prefillTemplate.title || "");
        setDescription(prefillTemplate.description || "");
        setPrio(prefillTemplate.priority || "medium");
        setAssign("all");
        setOpenAdd(true);
        if (onPrefillHandled) onPrefillHandled();
    }, [prefillTemplate, onPrefillHandled]);

    const handleAdd = () => {
        if (!title.trim()) return;
        const validSubtasks = subtasks
            .map(s => ({ ...s, title: s.title.trim() }))
            .filter(s => s.title.length > 0);
        onAdd(title, prio, assign, false, description, validSubtasks);
        setTitle("");
        setDescription("");
        setSubtasks([]);
        setOpenAdd(false);
    };

    const renderSubtasksEditor = (isEdit: boolean) => {
        const currentSubtasks = isEdit ? editSubtasks : subtasks;
        const setCurrentSubtasks = isEdit ? setEditSubtasks : setSubtasks;

        return (
            <div className="space-y-2.5 pt-2 border-t border-white/[0.04]">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                    Subtasks Checklist
                </p>
                <div className="space-y-2">
                    {currentSubtasks.map((st, sIdx) => (
                        <div key={st.id} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={st.title}
                                onChange={(e) => {
                                    const next = [...currentSubtasks];
                                    next[sIdx].title = e.target.value;
                                    setCurrentSubtasks(next);
                                }}
                                placeholder={`Subtask #${sIdx + 1}`}
                                className="flex-1 bg-zinc-950/60 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-white/20 focus:bg-zinc-950 transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    setCurrentSubtasks(currentSubtasks.filter((_, idx) => idx !== sIdx));
                                }}
                                className="p-2 text-zinc-500 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={() => {
                            const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
                            setCurrentSubtasks([...currentSubtasks, { id: newId, title: "", completed: false }]);
                        }}
                        className="w-full py-2 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-dashed border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" /> Add Subtask
                    </button>
                </div>
            </div>
        );
    };

    const renderSubtasksProgressAndList = (task: any, canEdit: boolean) => {
        if (!task.subtasks || task.subtasks.length === 0) return null;

        const isExpanded = !!expandedTasks[task.id];

        return (
            <div className="space-y-2 mt-2">
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                            Subtasks Progress
                        </span>
                        <span>{task.completedSubtaskCount || 0}/{task.subtaskCount || 0} Done</span>
                    </div>
                    <div className="w-full h-1 bg-zinc-950 rounded-full overflow-hidden relative">
                        <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                            style={{ width: `${task.progress || 0}%` }}
                        />
                    </div>
                </div>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleTaskExpanded(task.id);
                    }}
                    className="text-[9px] font-black uppercase tracking-wider text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors cursor-pointer select-none"
                >
                    {isExpanded ? (
                        <>Hide Subtasks <ChevronUp className="w-3.5 h-3.5" /></>
                    ) : (
                        <>Show Subtasks ({task.subtaskCount - (task.completedSubtaskCount || 0)} left) <ChevronDown className="w-3.5 h-3.5" /></>
                    )}
                </button>

                <AnimatePresence initial={false}>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15, ease: "easeInOut" }}
                            className="overflow-hidden"
                        >
                            <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.04] mt-2">
                                {task.subtasks.map((st: any) => (
                                    <label
                                        key={st.id}
                                        onClick={(e) => e.stopPropagation()}
                                        className={cn(
                                            "flex items-center gap-2.5 px-3 py-2 rounded-xl bg-zinc-950/40 border border-white/5 hover:border-white/10 transition-all cursor-pointer group/subtask select-none",
                                            st.completed && "opacity-60"
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={st.completed}
                                            onChange={() => {
                                                if (!canEdit) return;
                                                const newSubtasks = task.subtasks.map((s: any) =>
                                                    s.id === st.id ? { ...s, completed: !s.completed } : s
                                                );
                                                onUpdate(task.id, { subtasks: newSubtasks });
                                            }}
                                            disabled={!canEdit}
                                            className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-900 accent-emerald-500 cursor-pointer"
                                        />
                                        <span className={cn(
                                            "text-[11px] text-zinc-300 transition-all",
                                            st.completed && "line-through text-zinc-500"
                                        )}>
                                            {st.title}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    const visibleTasks = useMemo(() => {
        const filtered = tasks.filter((task: any) => {
            const matchesMine = objectiveFilter === "all" || task.assignedTo === "all" || task.assignedTo === currentUserId;
            const matchesSearch = searchTerm.trim() === "" || 
                task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                (task.description || "").toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === "all" || task.status === statusFilter;
            const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
            
            return matchesMine && matchesSearch && matchesStatus && matchesPriority;
        });

        return [...filtered].sort((a: any, b: any) => {
            const aPos = a.position !== undefined ? a.position : 0;
            const bPos = b.position !== undefined ? b.position : 0;
            if (aPos !== bPos) return aPos - bPos;

            // Fallback to createdAt desc
            const aTime = a.createdAt ? (typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : (a.createdAt.seconds || 0) * 1000) : 0;
            const bTime = b.createdAt ? (typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : (b.createdAt.seconds || 0) * 1000) : 0;
            return bTime - aTime;
        });
    }, [tasks, objectiveFilter, currentUserId, searchTerm, statusFilter, priorityFilter]);

    const hasActiveFilters = searchTerm !== "" || statusFilter !== "all" || priorityFilter !== "all" || objectiveFilter !== "all";

    const { incompleteTasks, completedTasks } = useMemo(() => {
        const incomplete = visibleTasks.filter((task: any) => task.status !== "done");
        const completed = visibleTasks.filter((task: any) => task.status === "done");
        return { incompleteTasks: incomplete, completedTasks: completed };
    }, [visibleTasks]);

    const clearFilters = () => {
        setSearchTerm("");
        setStatusFilter("all");
        setPriorityFilter("all");
        setObjectiveFilter("all");
        setIsSearchOpen(false);
        setIsFiltersOpen(false);
    };

    const handleReorderIncomplete = (newIncomplete: any[]) => {
        if (!onReorder) return;
        const merged = [...newIncomplete, ...completedTasks];
        onReorder(merged);
    };

    const handleReorderCompleted = (newCompleted: any[]) => {
        if (!onReorder) return;
        const merged = [...incompleteTasks, ...newCompleted];
        onReorder(merged);
    };

    const handleMoveIncomplete = (task: any, direction: 'up' | 'down') => {
        const idx = incompleteTasks.findIndex(t => t.id === task.id);
        if (idx === -1) return;
        const newIncomplete = [...incompleteTasks];
        if (direction === 'up' && idx > 0) {
            newIncomplete[idx] = newIncomplete[idx - 1];
            newIncomplete[idx - 1] = task;
            handleReorderIncomplete(newIncomplete);
        } else if (direction === 'down' && idx < incompleteTasks.length - 1) {
            newIncomplete[idx] = newIncomplete[idx + 1];
            newIncomplete[idx + 1] = task;
            handleReorderIncomplete(newIncomplete);
        }
    };

    const handleMoveCompleted = (task: any, direction: 'up' | 'down') => {
        const idx = completedTasks.findIndex(t => t.id === task.id);
        if (idx === -1) return;
        const newCompleted = [...completedTasks];
        if (direction === 'up' && idx > 0) {
            newCompleted[idx] = newCompleted[idx - 1];
            newCompleted[idx - 1] = task;
            handleReorderCompleted(newCompleted);
        } else if (direction === 'down' && idx < completedTasks.length - 1) {
            newCompleted[idx] = newCompleted[idx + 1];
            newCompleted[idx + 1] = task;
            handleReorderCompleted(newCompleted);
        }
    };

    return (
        <div className="space-y-6">
            {!openAdd && (
                <button 
                    onClick={() => setOpenAdd(true)} 
                    className="w-full p-5 flex items-center gap-4 bg-zinc-900 border-none rounded-[10px] group/mgt transition-all duration-300 relative overflow-hidden cursor-pointer"
                >
                    {/* Sharp Glass Edge Lights */}
                    <div className="absolute inset-0 rounded-[10px] border-t-[0.5px] border-white/30 pointer-events-none z-10" />
                    <div className="absolute inset-0 rounded-[10px] border-b-[0.5px] border-white/5 pointer-events-none z-10" />
                    
                    {/* Minimal Spread / Depth Glow */}
                    <div className="absolute top-0 inset-x-0 h-[4px] bg-gradient-to-b from-white/10 to-transparent z-10" />
                    
                    <div className="w-10 h-10 rounded-lg bg-zinc-950/50 border border-white/5 flex items-center justify-center text-zinc-500 group-hover/mgt:text-white group-hover/mgt:bg-white/5 group-hover/mgt:border-white/10 transition-all duration-300 relative z-10">
                        <Plus className="w-5 h-5" />
                    </div>
                    <div className="text-left relative z-10">
                        <h3 className="text-sm font-black text-zinc-400 group-hover/mgt:text-white transition-colors">Create New Objective</h3>
                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-0.5">Define a mission for the unit</p>
                    </div>
                </button>
            )}

            {openAdd && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-zinc-900 border border-[white]/30 rounded-3xl space-y-4">
                    <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Objective title..." className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-[white]/40 transition-all" />
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Optional context for this objective..."
                        rows={3}
                        className="w-full resize-none bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-[white]/40 transition-all"
                    />
                    <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-[150px]">
                            <p className="text-[10px] font-black text-zinc-600 uppercase mb-2">Priority</p>
                            <div className="flex gap-2">
                                {["low", "medium", "high"].map(p => (
                                    <button 
                                        key={p} 
                                        onClick={() => setPrio(p)} 
                                        className={cn(
                                            "flex-1 py-1.5 rounded-[10px] text-[10px] font-black uppercase transition-all relative overflow-hidden cursor-pointer", 
                                            prio === p 
                                                ? "bg-white/10 text-white" 
                                                : "text-zinc-600 bg-zinc-950 border border-white/5 hover:text-zinc-400"
                                        )}
                                    >
                                        {/* Premium Light Effect - Sharp Edge Lights Only */}
                                        {prio === p && (
                                            <>
                                                <div className="absolute inset-0 rounded-[10px] border-t-[0.5px] border-white/30 pointer-events-none z-10" />
                                                <div className="absolute inset-0 rounded-[10px] border-b-[0.5px] border-white/5 pointer-events-none z-10" />
                                            </>
                                        )}
                                        <span className="relative z-10">{p}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 min-w-[150px]">
                            <p className="text-[10px] font-black text-zinc-600 uppercase mb-2">Assignment</p>
                            <select value={assign} onChange={(e) => setAssign(e.target.value)} className="w-full bg-zinc-950 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-zinc-400 outline-none">
                                <option value="all">Entire Unit</option>
                                {groupMembers?.map((m: any) => <option key={m.uid} value={m.uid}>{m.displayName}</option>)}
                            </select>
                        </div>
                    </div>
                    {renderSubtasksEditor(false)}
                    <div className="flex gap-3">
                        <button 
                            onClick={handleAdd} 
                            className="flex-1 py-3 bg-white text-black font-black rounded-[10px] text-xs relative overflow-hidden hover:bg-zinc-100 transition-all cursor-pointer"
                        >
                            {/* Curved Light Effect for solid button */}
                            <div className="absolute inset-x-0 top-0 h-[1px] bg-white/60 z-10" />
                            <div className="absolute inset-0 rounded-[10px] border-t-[0.5px] border-white/40 pointer-events-none z-10" />
                            <div className="absolute inset-x-0 bottom-0 h-[2.5px] bg-black/[0.04] z-10" />
                            <span className="relative z-10">Create Objective</span>
                        </button>
                        <button 
                            onClick={() => setOpenAdd(false)} 
                            className="px-8 py-3 bg-white/5 text-zinc-400 font-black rounded-[10px] text-xs relative overflow-hidden hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                        >
                            {/* Curved Glass Edge Lights */}
                            <div className="absolute inset-0 rounded-[10px] border-t-[0.5px] border-white/20 pointer-events-none z-10" />
                            <div className="absolute inset-0 rounded-[10px] border-b-[0.5px] border-white/5 pointer-events-none z-10" />
                            <div className="absolute top-0 inset-x-0 h-[4px] bg-gradient-to-b from-white/5 to-transparent z-10" />
                            <span className="relative z-10">Cancel</span>
                        </button>
                    </div>
                </motion.div>
            )}

            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Objectives</p>
                    
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                            <AnimatePresence mode="popLayout">
                                {isSearchOpen ? (
                                    <motion.div 
                                        key="search-input"
                                        layout
                                        initial={{ width: 0, opacity: 0, x: 20, filter: "blur(8px)" }}
                                        animate={{ width: "auto", opacity: 1, x: 0, filter: "blur(0px)" }}
                                        exit={{ width: 0, opacity: 0, x: 20, filter: "blur(8px)" }}
                                        transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
                                        className="relative flex items-center overflow-hidden"
                                    >
                                        <div className="relative flex items-center min-w-[180px] md:min-w-[280px]">
                                            <motion.div
                                                initial={{ x: -10, opacity: 0 }}
                                                animate={{ x: 0, opacity: 1 }}
                                                transition={{ delay: 0.1, type: "spring", stiffness: 500, damping: 25 }}
                                            >
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                                            </motion.div>
                                            <input 
                                                autoFocus
                                                value={searchTerm}
                                                onChange={e => setSearchTerm(e.target.value)}
                                                placeholder="Search objectives..."
                                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-9 py-2 text-[11px] text-white outline-none focus:border-white/20 focus:bg-white/10 transition-all shadow-lg"
                                                onBlur={() => !searchTerm && setIsSearchOpen(false)}
                                                onKeyDown={(e) => e.key === "Escape" && setIsSearchOpen(false)}
                                            />
                                            <motion.button 
                                                onClick={() => { setSearchTerm(""); setIsSearchOpen(false); }}
                                                className="absolute right-2 p-1.5 text-zinc-500 hover:text-white transition-colors"
                                                whileHover={{ rotate: 90 }}
                                                whileTap={{ scale: 0.85 }}
                                                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </motion.button>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <Tooltip content="Search objectives">
                                        <motion.button 
                                            key="search-toggle"
                                            layout
                                            initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                            exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                            whileHover={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => setIsSearchOpen(true)}
                                            className={cn(
                                                "flex items-center justify-center p-2.5 rounded-[10px] border-none transition-all duration-300 shadow-sm relative overflow-hidden group/btn cursor-pointer",
                                                searchTerm 
                                                    ? "bg-white/15 text-white" 
                                                    : "bg-white/5 text-zinc-500 hover:text-zinc-300"
                                            )}
                                        >
                                            {/* Curved Glass Edge Lights */}
                                            <div className="absolute inset-0 rounded-[10px] border-t-[0.5px] border-white/20 pointer-events-none z-10" />
                                            <div className="absolute inset-0 rounded-[10px] border-b-[0.5px] border-white/5 pointer-events-none z-10" />
                                            
                                            <Search className="w-4 h-4 relative z-10" />
                                        </motion.button>
                                    </Tooltip>
                                )}
                            </AnimatePresence>

                            <Tooltip content="Toggle status & priority filters">
                                <motion.button 
                                    onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                                    className={cn(
                                        "flex items-center justify-center p-2.5 rounded-[10px] border-none shadow-sm flex items-center gap-2 relative overflow-hidden transition-all duration-300 group/btn cursor-pointer",
                                        isFiltersOpen || statusFilter !== "all" || priorityFilter !== "all"
                                            ? "bg-white/15 text-white" 
                                            : "bg-white/5 text-zinc-500 hover:text-zinc-300"
                                    )}
                                    whileTap={{ scale: 0.95 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                                >
                                    {/* Curved Glass Edge Lights */}
                                    <div className="absolute inset-0 rounded-[10px] border-t-[0.5px] border-white/20 pointer-events-none z-10" />
                                    <div className="absolute inset-0 rounded-[10px] border-b-[0.5px] border-white/5 pointer-events-none z-10" />

                                    <motion.div
                                        animate={{ rotate: isFiltersOpen ? 180 : 0 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                        className="relative z-10"
                                    >
                                        <Filter className="w-4 h-4" />
                                    </motion.div>
                                    <AnimatePresence>
                                        {(statusFilter !== "all" || priorityFilter !== "all") && !isFiltersOpen && (
                                            <motion.div 
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                exit={{ scale: 0 }}
                                                className="w-1.5 h-1.5 rounded-full bg-white animate-pulse relative z-10"
                                            />
                                        )}
                                    </AnimatePresence>
                                </motion.button>
                            </Tooltip>
                        </div>

                        <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 h-fit relative">
                            {["all", "mine"].map((val) => (
                                <button 
                                    key={val}
                                    onClick={() => setObjectiveFilter(val as "all" | "mine")} 
                                    className={cn(
                                        "relative z-10 px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors duration-200",
                                        objectiveFilter === val ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                                    )}
                                >
                                    {objectiveFilter === val && (
                                        <motion.div
                                            layoutId="objective-filter-indicator"
                                            className="absolute inset-0 bg-white/10 rounded-lg border border-white/10"
                                            transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.8 }}
                                        />
                                    )}
                                    <span className="relative z-10">{val === "all" ? "All" : "Mine"}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div 
                    className={cn(
                        "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                        isFiltersOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    )}
                >
                    <div className="overflow-hidden">
                        <div className="flex flex-wrap items-center gap-6 pt-1 pb-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-wider mr-1">Status:</span>
                                    {["all", "todo", "in-progress", "in-review", "done"].map(s => {
                                        const cfg = TASK_STATUS_CONFIG[s];
                                        const isActive = statusFilter === s;
                                        return (
                                            <button 
                                                key={s} 
                                                onClick={() => setStatusFilter(s)}
                                                className={cn(
                                                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border",
                                                    isActive 
                                                        ? (s === "all" ? "bg-white/10 text-white border-white/20" : cfg.color)
                                                        : "bg-transparent border-white/5 text-zinc-600 hover:text-zinc-400 hover:border-white/10"
                                                )}
                                            >
                                                {s === "all" ? "All" : cfg.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="h-4 w-[1px] bg-white/5 hidden sm:block" />

                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-wider mr-1">Priority:</span>
                                    {["all", "low", "medium", "high"].map(p => {
                                        const isActive = priorityFilter === p;
                                        let activeClass = "bg-white/10 text-white border-white/20";
                                        
                                        if (isActive) {
                                            if (p === "high") activeClass = "bg-red-500/20 text-red-400 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.1)]";
                                            if (p === "medium") activeClass = "bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.1)]";
                                            if (p === "low") activeClass = "bg-sky-500/20 text-sky-400 border-sky-500/40 shadow-[0_0_10px_rgba(14,165,233,0.1)]";
                                        }

                                        return (
                                            <button 
                                                key={p} 
                                                onClick={() => setPriorityFilter(p)}
                                                className={cn(
                                                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border",
                                                    isActive 
                                                        ? activeClass
                                                        : "bg-transparent border-white/5 text-zinc-600 hover:text-zinc-400 hover:border-white/10"
                                                )}
                                            >
                                                {p}
                                            </button>
                                        );
                                    })}
                                </div>

                                {hasActiveFilters && (
                                    <button 
                                        onClick={clearFilters}
                                        className="ml-auto text-[9px] font-black text-zinc-500 hover:text-red-400 uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Clear
                                    </button>
                                )}
                        </div>
                    </div>
                </div>
            </div>

            {tasks.length === 0 && !openAdd && (
                <div className="p-8 border-2 border-dashed border-white/5 rounded-3xl space-y-6">
                    <div className="text-center space-y-2">
                        <p className="text-xs font-bold text-zinc-500">No active objectives for this unit.</p>
                        <p className="text-[10px] text-zinc-600">Pick a template to prefill the objective form:</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                            { id: "deep-work", title: "Deep Work Session", icon: Sparkles },
                            { id: "review-respond", title: "Review & Respond", icon: Mail },
                            { id: "learning-sprint", title: "Learning Sprint", icon: Target }
                        ].map((tpl) => (
                            <Tooltip
                                key={tpl.id}
                                content={`Use "${tpl.title}" template`}
                            >
                                <button
                                    onClick={() => onTemplateSelect?.(tpl.id)}
                                    className="flex flex-col items-center gap-2 p-4 bg-zinc-900/60 border border-white/5 rounded-2xl transition-all group hover:border-[white]/40 cursor-pointer w-full justify-center"
                                >
                                    <tpl.icon className="w-4 h-4 text-zinc-600 group-hover:text-[white]" />
                                    <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider text-center">{tpl.title}</span>
                                </button>
                            </Tooltip>
                        ))}
                    </div>
                </div>
            )}

            <TasksListWrapper 
                isAdmin={isAdmin} 
                values={incompleteTasks} 
                onReorder={handleReorderIncomplete} 
                className="grid grid-cols-1 gap-3"
            >
                {incompleteTasks.map((task: any, i: number) => {
                    const isEditing = editingTaskId === task.id;
                    const canEdit = isAdmin || task.assignedTo === "all" || task.assignedTo === currentUserId;
                    const statusConfig = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.todo;
                    const StatusIcon = statusConfig.icon;

                    if (isEditing) {
                        return (
                            <motion.div 
                                key={task.id}
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="p-5 bg-zinc-900 border border-[white]/30 rounded-2xl space-y-4 shadow-2xl z-10"
                            >
                                <input autoFocus value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-[white]/40" />
                                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-2 text-white text-xs outline-none focus:border-[white]/40 resize-none" />
                                
                                <div className="flex flex-wrap gap-4">
                                    <div className="flex-1 min-w-[120px]">
                                        <p className="text-[9px] font-black text-zinc-600 uppercase mb-1.5">Priority</p>
                                        <div className="flex gap-1.5">
                                            {["low", "medium", "high"].map(p => (
                                                <button key={p} onClick={() => setEditPrio(p)} className={cn(
                                                    "flex-1 py-2 rounded-[10px] border text-[10px] font-black uppercase transition-all relative overflow-hidden cursor-pointer",
                                                    editPrio === p 
                                                        ? "bg-white/10 text-white border-white/20" 
                                                        : "text-zinc-600 border-white/5 hover:text-zinc-400"
                                                )}>
                                                    {editPrio === p && (
                                                        <>
                                                            <div className="absolute inset-0 rounded-[10px] border-t-[0.5px] border-white/20 pointer-events-none z-10" />
                                                            <div className="absolute inset-0 rounded-[10px] border-b-[0.5px] border-white/5 pointer-events-none z-10" />
                                                            <div className="absolute top-0 inset-x-0 h-[4px] bg-gradient-to-b from-white/5 to-transparent z-10" />
                                                        </>
                                                    )}
                                                    <span className="relative z-10">{p}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-[120px]">
                                        <p className="text-[9px] font-black text-zinc-600 uppercase mb-1.5">Assignment</p>
                                        <select value={editAssign} onChange={(e) => setEditAssign(e.target.value)} className="w-full bg-zinc-950 border border-white/5 rounded-md px-2 py-1 text-[10px] text-zinc-400 outline-none">
                                            <option value="all">Entire Unit</option>
                                            {groupMembers?.map((m: any) => <option key={m.uid} value={m.uid}>{m.displayName}</option>)}
                                        </select>
                                    </div>
                                </div>
                                {renderSubtasksEditor(true)}
                                <div className="flex gap-3 pt-1">
                                    <button onClick={handleSaveEdit} className="flex-1 py-3 bg-white text-black font-black rounded-[10px] text-xs relative overflow-hidden hover:bg-zinc-100 transition-all cursor-pointer">
                                        {/* Curved Light Effect for solid button */}
                                        <div className="absolute inset-x-0 top-0 h-[1px] bg-white/60 z-10" />
                                        <div className="absolute inset-0 rounded-[10px] border-t-[0.5px] border-white/40 pointer-events-none z-10" />
                                        <div className="absolute inset-x-0 bottom-0 h-[2.5px] bg-black/[0.04] z-10" />
                                        <span className="relative z-10 flex items-center justify-center gap-2"><Save className="w-3 h-3" /> Save Changes</span>
                                    </button>
                                    <button onClick={() => setEditingTaskId(null)} className="px-8 py-3 bg-white/5 text-zinc-400 font-black rounded-[10px] text-xs relative overflow-hidden hover:bg-white/10 hover:text-white transition-all cursor-pointer">
                                        <div className="absolute inset-0 rounded-[10px] border-t-[0.5px] border-white/20 pointer-events-none z-10" />
                                        <div className="absolute inset-0 rounded-[10px] border-b-[0.5px] border-white/5 pointer-events-none z-10" />
                                        <div className="absolute top-0 inset-x-0 h-[4px] bg-gradient-to-b from-white/5 to-transparent z-10" />
                                        <span className="relative z-10">Cancel</span>
                                    </button>
                                </div>
                            </motion.div>
                        );
                    }

                    {
                        const prioCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                        const assignee = task.assignedTo !== "all" ? groupMembers?.find((m: any) => m.uid === task.assignedTo) : null;

                        return (
                        <TaskWrapper
                            key={task.id}
                            task={task}
                            isAdmin={isAdmin}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.5 }}
                            className={cn(
                                "flex flex-col gap-3.5 p-5 rounded-2xl border relative group/task transition-all duration-200",
                                task.status === "done"
                                    ? "bg-zinc-900/20 border-white/5 opacity-60"
                                    : "bg-zinc-900/60 border-white/10 hover:border-white/20 active:scale-[0.99]",
                                task.priority === "high" ? "border-l-[3px] border-l-red-500" :
                                task.priority === "medium" ? "border-l-[3px] border-l-amber-500" :
                                "border-l-[3px] border-l-sky-500"
                            )}
                        >
                            {/* Top row: drag + title + actions */}
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    {isAdmin && (
                                        <div className="text-zinc-700 group-hover/task:text-zinc-500 cursor-grab active:cursor-grabbing transition-colors shrink-0">
                                            <GripVertical className="w-3.5 h-3.5" />
                                        </div>
                                    )}
                                    <h4 className={cn(
                                        "text-[13px] font-bold tracking-tight text-white",
                                        task.status === "done" && "text-zinc-500 line-through"
                                    )}>
                                        {task.title}
                                    </h4>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-0.5 opacity-0 group-hover/task:opacity-100 transition-all shrink-0">
                                    {canEdit && (
                                        <>
                                            <Tooltip content="Edit objective">
                                                <button
                                                    onClick={() => startEditing(task)}
                                                    className="p-1 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-all cursor-pointer"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                            </Tooltip>
                                            {isAdmin && (
                                                <>
                                                    <Tooltip content="Move Up">
                                                        <button
                                                            disabled={i === 0}
                                                            onClick={() => handleMoveIncomplete(task, 'up')}
                                                            className="p-1 text-zinc-500 hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:hover:bg-transparent rounded-lg transition-all cursor-pointer"
                                                        >
                                                            <ChevronUp className="w-3.5 h-3.5" />
                                                        </button>
                                                    </Tooltip>
                                                    <Tooltip content="Move Down">
                                                        <button
                                                            disabled={i === incompleteTasks.length - 1}
                                                            onClick={() => handleMoveIncomplete(task, 'down')}
                                                            className="p-1 text-zinc-500 hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:hover:bg-transparent rounded-lg transition-all cursor-pointer"
                                                        >
                                                            <ChevronDown className="w-3.5 h-3.5" />
                                                        </button>
                                                    </Tooltip>
                                                </>
                                            )}
                                            <Tooltip content="Delete objective">
                                                <button
                                                    onClick={() => onDelete(task.id)}
                                                    className="p-1 text-zinc-700 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </Tooltip>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Description if present */}
                            {task.description && (
                                <p className="text-[11px] text-zinc-500 leading-relaxed -mt-1.5">
                                    {task.description}
                                </p>
                            )}

                            {renderSubtasksProgressAndList(task, canEdit)}

                            {/* Middle row: Stages bar */}
                            <div className="flex items-center gap-1 my-1 select-none flex-wrap">
                                {STATUS_CYCLE.map((statusId, idx) => {
                                    const currentIdx = STATUS_CYCLE.indexOf(task.status as any);
                                    const isCompleted = idx < currentIdx;
                                    const isActive = idx === currentIdx;

                                    let dotColor = "";
                                    if (isCompleted) {
                                        dotColor = "bg-emerald-500";
                                    } else if (isActive) {
                                        dotColor = statusId === "todo" ? "bg-emerald-500" :
                                                   statusId === "in-progress" ? "bg-emerald-500" :
                                                   statusId === "in-review" ? "bg-indigo-500" :
                                                   "bg-emerald-500";
                                    } else {
                                        dotColor = "bg-zinc-950 border border-zinc-800";
                                    }

                                    const label = TASK_STATUS_CONFIG[statusId]?.label.toUpperCase();

                                    return (
                                        <div key={statusId} className="flex items-center">
                                            {idx > 0 && (
                                                <div className={cn(
                                                    "w-6 h-[1px] mx-1.5",
                                                    idx <= currentIdx ? "bg-zinc-700" : "bg-zinc-800/60"
                                                )} />
                                            )}
                                            <button
                                                disabled={!canEdit}
                                                onClick={() => canEdit && onUpdate(task.id, {
                                                    status: statusId,
                                                    ...(statusId === "done" ? { completedAt: new Date().toISOString() } : {})
                                                })}
                                                className={cn(
                                                    "flex items-center gap-1.5 text-[9px] font-black tracking-widest transition-all",
                                                    isActive ? "text-zinc-200" : "text-zinc-600 hover:text-zinc-400"
                                                )}
                                            >
                                                <div className={cn("w-2.5 h-2.5 rounded-full transition-all shrink-0", dotColor)} />
                                                <span>{label}</span>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Bottom row: assignees & priority */}
                            <div className="flex items-center justify-between pt-3.5 border-t border-white/[0.04] mt-1">
                                {task.assignedTo === "all" ? (
                                    <div className="flex items-center gap-2">
                                        <div className="flex -space-x-1.5">
                                            {(groupMembers || []).slice(0, 4).map((m: any) => (
                                                <Tooltip key={m.uid} content={m.displayName || "Member"}>
                                                    <Avatar className="w-5 h-5 rounded-full ring-1 ring-zinc-950">
                                                        <AvatarImage src={m.photoURL} className="rounded-full" />
                                                        <AvatarFallback className="bg-zinc-800 text-[8px] font-bold text-zinc-400 rounded-full">
                                                            {(m.displayName || "?")[0].toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                </Tooltip>
                                            ))}
                                            {(groupMembers || []).length > 4 && (
                                                <div className="w-5 h-5 rounded-full bg-zinc-800 ring-1 ring-zinc-950 flex items-center justify-center text-[8px] font-bold text-zinc-400">
                                                    +{(groupMembers || []).length - 4}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">Entire Unit</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Avatar className="w-5 h-5 rounded-full">
                                            <AvatarImage src={assignee?.photoURL} className="rounded-full" />
                                            <AvatarFallback className="bg-zinc-800 text-[8px] font-bold text-zinc-400 rounded-full">
                                                {assignee?.displayName?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-[9px] font-bold text-zinc-500">
                                            {assignee?.displayName || assigneeNameById[task.assignedTo] || "Member"}
                                        </span>
                                    </div>
                                )}

                                {/* Priority badge */}
                                <span className={cn(
                                    "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                                    prioCfg.color
                                )}>
                                    {task.priority === "high" && <span className="w-1 h-1 rounded-full bg-red-400" />}
                                    {task.priority}
                                </span>
                            </div>
                        </TaskWrapper>
                        );
                    }
                })}
            </TasksListWrapper>

            {incompleteTasks.length > 0 && completedTasks.length > 0 && (
                <div className="py-2">
                    <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-white/5" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">Completed</span>
                        <div className="h-px flex-1 bg-white/5" />
                    </div>
                </div>
            )}

            <TasksListWrapper 
                isAdmin={isAdmin} 
                values={completedTasks} 
                onReorder={handleReorderCompleted} 
                className="grid grid-cols-1 gap-3"
            >
                {completedTasks.map((task: any, i: number) => {
                    const isEditing = editingTaskId === task.id;
                    const canEdit = isAdmin || task.assignedTo === "all" || task.assignedTo === currentUserId;
                    const statusConfig = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.todo;
                    const StatusIcon = statusConfig.icon;

                    if (isEditing) {
                        return (
                            <motion.div 
                                key={task.id}
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="p-5 bg-zinc-900 border border-[white]/30 rounded-2xl space-y-4 shadow-2xl z-10"
                            >
                                <input autoFocus value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-[white]/40" />
                                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-2 text-white text-xs outline-none focus:border-[white]/40 resize-none" />
                                
                                <div className="flex flex-wrap gap-4">
                                    <div className="flex-1 min-w-[120px]">
                                        <p className="text-[9px] font-black text-zinc-600 uppercase mb-1.5">Priority</p>
                                        <div className="flex gap-1.5">
                                            {["low", "medium", "high"].map(p => (
                                                <button key={p} onClick={() => setEditPrio(p)} className={cn(
                                                    "flex-1 py-2 rounded-[10px] border text-[10px] font-black uppercase transition-all relative overflow-hidden cursor-pointer",
                                                    editPrio === p 
                                                        ? "bg-white/10 text-white border-white/20" 
                                                        : "text-zinc-600 border-white/5 hover:text-zinc-400"
                                                )}>
                                                    {editPrio === p && (
                                                        <>
                                                            <div className="absolute inset-0 rounded-[10px] border-t-[0.5px] border-white/20 pointer-events-none z-10" />
                                                            <div className="absolute inset-0 rounded-[10px] border-b-[0.5px] border-white/5 pointer-events-none z-10" />
                                                            <div className="absolute top-0 inset-x-0 h-[4px] bg-gradient-to-b from-white/5 to-transparent z-10" />
                                                        </>
                                                    )}
                                                    <span className="relative z-10">{p}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-[120px]">
                                        <p className="text-[9px] font-black text-zinc-600 uppercase mb-1.5">Assignment</p>
                                        <select value={editAssign} onChange={(e) => setEditAssign(e.target.value)} className="w-full bg-zinc-950 border border-white/5 rounded-md px-2 py-1 text-[10px] text-zinc-400 outline-none">
                                            <option value="all">Entire Unit</option>
                                            {groupMembers?.map((m: any) => <option key={m.uid} value={m.uid}>{m.displayName}</option>)}
                                        </select>
                                    </div>
                                </div>
                                {renderSubtasksEditor(true)}
                                <div className="flex gap-3 pt-1">
                                    <button onClick={handleSaveEdit} className="flex-1 py-3 bg-white text-black font-black rounded-[10px] text-xs relative overflow-hidden hover:bg-zinc-100 transition-all cursor-pointer">
                                        {/* Curved Light Effect for solid button */}
                                        <div className="absolute inset-x-0 top-0 h-[1px] bg-white/60 z-10" />
                                        <div className="absolute inset-0 rounded-[10px] border-t-[0.5px] border-white/40 pointer-events-none z-10" />
                                        <div className="absolute inset-x-0 bottom-0 h-[2.5px] bg-black/[0.04] z-10" />
                                        <span className="relative z-10 flex items-center justify-center gap-2"><Save className="w-3 h-3" /> Save Changes</span>
                                    </button>
                                    <button onClick={() => setEditingTaskId(null)} className="px-8 py-3 bg-white/5 text-zinc-400 font-black rounded-[10px] text-xs relative overflow-hidden hover:bg-white/10 hover:text-white transition-all cursor-pointer">
                                        {/* Curved Glass Edge Lights */}
                                        <div className="absolute inset-0 rounded-[10px] border-t-[0.5px] border-white/20 pointer-events-none z-10" />
                                        <div className="absolute inset-0 rounded-[10px] border-b-[0.5px] border-white/5 pointer-events-none z-10" />
                                        <div className="absolute top-0 inset-x-0 h-[4px] bg-gradient-to-b from-white/5 to-transparent z-10" />
                                        <span className="relative z-10">Cancel</span>
                                    </button>
                                </div>
                            </motion.div>
                        );
                    }

                    {
                        const prioCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                        const assignee = task.assignedTo !== "all" ? groupMembers?.find((m: any) => m.uid === task.assignedTo) : null;

                        return (
                        <TaskWrapper
                            key={task.id}
                            task={task}
                            isAdmin={isAdmin}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.5 }}
                            className={cn(
                                "flex flex-col gap-3.5 p-5 rounded-2xl border relative group/task transition-all duration-200",
                                task.status === "done"
                                    ? "bg-zinc-900/20 border-white/5 opacity-60"
                                    : "bg-zinc-900/60 border-white/10 hover:border-white/20 active:scale-[0.99]",
                                task.priority === "high" ? "border-l-[3px] border-l-red-500" :
                                task.priority === "medium" ? "border-l-[3px] border-l-amber-500" :
                                "border-l-[3px] border-l-sky-500"
                            )}
                        >
                            {/* Top row: drag + title + actions */}
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    {isAdmin && (
                                        <div className="text-zinc-700 group-hover/task:text-zinc-500 cursor-grab active:cursor-grabbing transition-colors shrink-0">
                                            <GripVertical className="w-3.5 h-3.5" />
                                        </div>
                                    )}
                                    <h4 className={cn(
                                        "text-[13px] font-bold tracking-tight text-white",
                                        task.status === "done" && "text-zinc-500 line-through"
                                    )}>
                                        {task.title}
                                    </h4>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-0.5 opacity-0 group-hover/task:opacity-100 transition-all shrink-0">
                                    {canEdit && (
                                        <>
                                            <Tooltip content="Edit objective">
                                                <button
                                                    onClick={() => startEditing(task)}
                                                    className="p-1 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-all cursor-pointer"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                            </Tooltip>
                                            {isAdmin && (
                                                <>
                                                    <Tooltip content="Move Up">
                                                        <button
                                                            disabled={i === 0}
                                                            onClick={() => handleMoveCompleted(task, 'up')}
                                                            className="p-1 text-zinc-500 hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:hover:bg-transparent rounded-lg transition-all cursor-pointer"
                                                        >
                                                            <ChevronUp className="w-3.5 h-3.5" />
                                                        </button>
                                                    </Tooltip>
                                                    <Tooltip content="Move Down">
                                                        <button
                                                            disabled={i === completedTasks.length - 1}
                                                            onClick={() => handleMoveCompleted(task, 'down')}
                                                            className="p-1 text-zinc-500 hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:hover:bg-transparent rounded-lg transition-all cursor-pointer"
                                                        >
                                                            <ChevronDown className="w-3.5 h-3.5" />
                                                        </button>
                                                    </Tooltip>
                                                </>
                                            )}
                                            <Tooltip content="Delete objective">
                                                <button
                                                    onClick={() => onDelete(task.id)}
                                                    className="p-1 text-zinc-700 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </Tooltip>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Description if present */}
                            {task.description && (
                                <p className="text-[11px] text-zinc-500 leading-relaxed -mt-1.5">
                                    {task.description}
                                </p>
                            )}

                            {renderSubtasksProgressAndList(task, canEdit)}

                            {/* Middle row: Stages bar */}
                            <div className="flex items-center gap-1 my-1 select-none flex-wrap">
                                {STATUS_CYCLE.map((statusId, idx) => {
                                    const currentIdx = STATUS_CYCLE.indexOf(task.status as any);
                                    const isCompleted = idx < currentIdx;
                                    const isActive = idx === currentIdx;

                                    let dotColor = "";
                                    if (isCompleted) {
                                        dotColor = "bg-emerald-500";
                                    } else if (isActive) {
                                        dotColor = statusId === "todo" ? "bg-emerald-500" :
                                                   statusId === "in-progress" ? "bg-emerald-500" :
                                                   statusId === "in-review" ? "bg-indigo-500" :
                                                   "bg-emerald-500";
                                    } else {
                                        dotColor = "bg-zinc-950 border border-zinc-800";
                                    }

                                    const label = TASK_STATUS_CONFIG[statusId]?.label.toUpperCase();

                                    return (
                                        <div key={statusId} className="flex items-center">
                                            {idx > 0 && (
                                                <div className={cn(
                                                    "w-6 h-[1px] mx-1.5",
                                                    idx <= currentIdx ? "bg-zinc-700" : "bg-zinc-800/60"
                                                )} />
                                            )}
                                            <button
                                                disabled={!canEdit}
                                                onClick={() => canEdit && onUpdate(task.id, {
                                                    status: statusId,
                                                    ...(statusId === "done" ? { completedAt: new Date().toISOString() } : {})
                                                })}
                                                className={cn(
                                                    "flex items-center gap-1.5 text-[9px] font-black tracking-widest transition-all",
                                                    isActive ? "text-zinc-200" : "text-zinc-600 hover:text-zinc-400"
                                                )}
                                            >
                                                <div className={cn("w-2.5 h-2.5 rounded-full transition-all shrink-0", dotColor)} />
                                                <span>{label}</span>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Bottom row: assignees & priority */}
                            <div className="flex items-center justify-between pt-3.5 border-t border-white/[0.04] mt-1">
                                {task.assignedTo === "all" ? (
                                    <div className="flex items-center gap-2">
                                        <div className="flex -space-x-1.5">
                                            {(groupMembers || []).slice(0, 4).map((m: any) => (
                                                <Tooltip key={m.uid} content={m.displayName || "Member"}>
                                                    <Avatar className="w-5 h-5 rounded-full ring-1 ring-zinc-950">
                                                        <AvatarImage src={m.photoURL} className="rounded-full" />
                                                        <AvatarFallback className="bg-zinc-800 text-[8px] font-bold text-zinc-400 rounded-full">
                                                            {(m.displayName || "?")[0].toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                </Tooltip>
                                            ))}
                                            {(groupMembers || []).length > 4 && (
                                                <div className="w-5 h-5 rounded-full bg-zinc-800 ring-1 ring-zinc-950 flex items-center justify-center text-[8px] font-bold text-zinc-400">
                                                    +{(groupMembers || []).length - 4}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">Entire Unit</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Avatar className="w-5 h-5 rounded-full">
                                            <AvatarImage src={assignee?.photoURL} className="rounded-full" />
                                            <AvatarFallback className="bg-zinc-800 text-[8px] font-bold text-zinc-400 rounded-full">
                                                {assignee?.displayName?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-[9px] font-bold text-zinc-500">
                                            {assignee?.displayName || assigneeNameById[task.assignedTo] || "Member"}
                                        </span>
                                    </div>
                                )}

                                {/* Priority badge */}
                                <span className={cn(
                                    "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                                    prioCfg.color
                                )}>
                                    {task.priority === "high" && <span className="w-1 h-1 rounded-full bg-red-400" />}
                                    {task.priority}
                                </span>
                            </div>
                        </TaskWrapper>
                        );
                    }
                })}
            </TasksListWrapper>
                {tasks.length > 0 && visibleTasks.length === 0 && (
                    <div className="py-12 flex flex-col items-center justify-center border border-white/5 rounded-2xl bg-zinc-900/20 space-y-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500">
                            <Search className="w-5 h-5" />
                        </div>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.16em]">No objectives match your filters</p>
                        <button 
                            onClick={clearFilters}
                            className="text-[10px] font-black text-white bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition-all"
                        >
                            Reset Filters
                        </button>
                    </div>
                )}
        </div>
    );
});
