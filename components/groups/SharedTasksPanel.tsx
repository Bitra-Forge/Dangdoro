"use client";

import { useState, useMemo, useEffect, memo } from "react";
import { motion } from "framer-motion";
import { 
    Plus, Sparkles, Mail, Target, 
    Play, Search, Check, Edit2, X, Save 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SharedTask } from "@/lib/groups";

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    "todo":        { label: "Todo",        color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",    icon: Check },
    "in-progress": { label: "In Progress", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",    icon: Play },
    "in-review":   { label: "In Review",   color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: Search },
    "done":        { label: "Done",        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: Check },
};

export const SharedTasksPanel = memo(function SharedTasksPanel({ tasks, onAdd, onUpdate, onDelete, isAdmin, groupMembers, currentUserId, prefillTemplate, onPrefillHandled, onTemplateSelect }: any) {
    const [openAdd, setOpenAdd] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [prio, setPrio] = useState<any>("medium");
    const [assign, setAssign] = useState("all");
    const [objectiveFilter, setObjectiveFilter] = useState<"all" | "mine">("all");
    
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editDesc, setEditDesc] = useState("");
    const [editPrio, setEditPrio] = useState<any>("medium");
    const [editAssign, setEditAssign] = useState("all");

    const startEditing = (task: SharedTask) => {
        setEditingTaskId(task.id);
        setEditTitle(task.title);
        setEditDesc(task.description);
        setEditPrio(task.priority);
        setEditAssign(task.assignedTo || "all");
    };

    const handleSaveEdit = () => {
        if (!editingTaskId || !editTitle.trim()) return;
        onUpdate(editingTaskId, {
            title: editTitle,
            description: editDesc,
            priority: editPrio,
            assignedTo: editAssign
        });
        setEditingTaskId(null);
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
        onAdd(title, prio, assign, false, description);
        setTitle("");
        setDescription("");
        setOpenAdd(false);
    };

    const visibleTasks = objectiveFilter === "mine"
        ? tasks.filter((task: any) => task.assignedTo === "all" || task.assignedTo === currentUserId)
        : tasks;

    return (
        <div className="space-y-4">
            {isAdmin && !openAdd && (
                <button onClick={() => setOpenAdd(true)} className="w-full p-5 flex items-center gap-3 bg-[white]/5 border border-[white]/10 rounded-2xl group hover:bg-[white]/10 transition-all">
                    <div className="w-8 h-8 rounded-lg bg-[white]/20 flex items-center justify-center text-[white] group-hover:scale-110 transition-all"><Plus className="w-5 h-5" /></div>
                    <span className="text-sm font-bold text-[white]/80">Create New Objective...</span>
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
                                    <button key={p} onClick={() => setPrio(p)} className={cn("flex-1 py-1.5 rounded-lg border text-[10px] font-black uppercase transition-all", prio === p ? "bg-white/10 text-white" : "text-zinc-600 border-white/5")}>{p}</button>
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
                    <div className="flex gap-3">
                        <button onClick={handleAdd} className="flex-1 py-3 bg-[white] text-black font-black rounded-xl text-xs">Create Objective</button>
                        <button onClick={() => setOpenAdd(false)} className="px-6 py-3 bg-zinc-800 text-white font-bold rounded-xl text-xs">Cancel</button>
                    </div>
                </motion.div>
            )}

            <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Objectives</p>
                <div className="flex p-1 bg-white/5 rounded-lg border border-white/5">
                    <button onClick={() => setObjectiveFilter("all")} className={cn("px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all", objectiveFilter === "all" ? "bg-white/10 text-white" : "text-zinc-500")}>All</button>
                    <button onClick={() => setObjectiveFilter("mine")} className={cn("px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all", objectiveFilter === "mine" ? "bg-white/10 text-white" : "text-zinc-500")}>Assigned to me</button>
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
                            <button
                                key={tpl.id}
                                disabled={!isAdmin}
                                onClick={() => onTemplateSelect?.(tpl.id)}
                                className={cn(
                                    "flex flex-col items-center gap-2 p-4 bg-zinc-900/60 border border-white/5 rounded-2xl transition-all group",
                                    isAdmin ? "hover:border-[white]/40" : "opacity-55 cursor-not-allowed"
                                )}
                                title={isAdmin ? `Use "${tpl.title}" template` : "Only hosts/admins can create shared objectives"}
                            >
                                <tpl.icon className="w-4 h-4 text-zinc-600 group-hover:text-[white]" />
                                <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider text-center">{tpl.title}</span>
                            </button>
                        ))}
                    </div>
                    {!isAdmin && (
                        <p className="text-center text-[10px] text-zinc-600">
                            Shared objective templates are available to hosts and admins.
                        </p>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 gap-3">
                {visibleTasks.map((task: any, i: number) => {
                    const isEditing = editingTaskId === task.id;
                    const canEdit = isAdmin || task.assignedTo === currentUserId;
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
                                                <button key={p} onClick={() => setEditPrio(p)} className={cn("flex-1 py-1 rounded-md border text-[9px] font-black uppercase transition-all", editPrio === p ? "bg-white/10 text-white border-white/20" : "text-zinc-600 border-white/5")}>{p}</button>
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

                                <div className="flex gap-2 pt-1">
                                    <button onClick={handleSaveEdit} className="flex-1 py-2 bg-white text-black font-black rounded-lg text-[10px] uppercase tracking-wider flex items-center justify-center gap-2">
                                        <Save className="w-3 h-3" /> Save Changes
                                    </button>
                                    <button onClick={() => setEditingTaskId(null)} className="px-4 py-2 bg-zinc-800 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider">Cancel</button>
                                </div>
                            </motion.div>
                        );
                    }

                    return (
                        <motion.div 
                            key={task.id} 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: i * 0.05 }}
                            className={cn(
                                "flex flex-col gap-3 p-5 rounded-2xl transition-all duration-300 border relative group/task", 
                                task.status === "done" 
                                    ? "bg-zinc-900/20 border-white/5 opacity-60" 
                                    : "bg-zinc-900/60 border-white/10 hover:border-white/20 active:scale-[0.99]"
                            )}
                        >
                            <div className="flex items-start gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className={cn(
                                            "text-[13px] font-black tracking-tight transition-all duration-500 truncate", 
                                            task.status === "done" ? "text-zinc-600 line-through" : "text-white group-hover/task:text-[white]"
                                        )}>
                                            {task.title}
                                        </h4>
                                        {isAdmin && (
                                            <button onClick={() => startEditing(task)} className="opacity-0 group-hover/task:opacity-100 p-1 text-zinc-600 hover:text-white transition-all">
                                                <Edit2 className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                    {task.description && (
                                        <p className="text-[11px] text-zinc-500 line-clamp-2">{task.description}</p>
                                    )}
                                </div>

                                {isAdmin && (
                                    <button
                                        onClick={() => onDelete(task.id)}
                                        title="Delete objective"
                                        className="w-7 h-7 rounded-lg text-zinc-700 hover:bg-red-500/10 hover:text-red-500 transition-all flex items-center justify-center opacity-0 group-hover/task:opacity-100"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-white/5">
                                <div className="flex items-center gap-2">
                                    {["todo", "in-progress", "in-review", "done"].map((status) => {
                                        const cfg = TASK_STATUS_CONFIG[status];
                                        const isActive = task.status === status;
                                        const Icon = cfg.icon;
                                        
                                        return (
                                            <button
                                                key={status}
                                                disabled={!canEdit}
                                                onClick={() => onUpdate(task.id, { status })}
                                                className={cn(
                                                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border",
                                                    isActive 
                                                        ? cfg.color 
                                                        : "bg-white/5 border-transparent text-zinc-600 hover:bg-white/10 hover:text-zinc-400 disabled:hover:bg-white/5 disabled:hover:text-zinc-600"
                                                )}
                                                title={canEdit ? `Mark as ${cfg.label}` : "Only assignee or admins can change status"}
                                            >
                                                <Icon className="w-2.5 h-2.5" />
                                                <span className={cn(isActive ? "inline" : "hidden sm:inline")}>{cfg.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                                        task.priority === "high" ? "bg-red-500/10 text-red-500 border border-red-500/20" : 
                                        task.priority === "medium" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : 
                                        "bg-sky-500/10 text-sky-500 border border-sky-500/20"
                                    )}>
                                        {task.priority}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[8px] font-bold text-zinc-600 uppercase tracking-widest">
                                        <div className="w-1 h-1 rounded-full bg-zinc-800" />
                                        {task.assignedTo === "all" ? "All" : assigneeNameById[task.assignedTo] || "Member"}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
                {tasks.length > 0 && visibleTasks.length === 0 && (
                    <div className="py-10 text-center border border-white/10 rounded-2xl bg-zinc-950/30">
                        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.16em]">No objectives match this filter</p>
                    </div>
                )}
            </div>
        </div>
    );
});
