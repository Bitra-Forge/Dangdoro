"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    ClipboardList, Plus, Trash2, CheckCircle2, Circle,
    ChevronDown, ChevronRight, Pencil, Check, X, GripVertical,
    Play, Clock, Maximize2, Palette, Settings
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
    addTask, subscribeToTasks, toggleTask, deleteTask,
    addGroup, renameGroup, deleteGroup as dbDeleteGroup,
    updateGroupPosition, updateGroupDimensions, moveTaskToGroup, subscribeToGroups,
    updateTaskPriority, updateTaskField, updateGroupColor, type TaskPriority
} from "@/lib/db";
import { useTimerStore } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AuthRequired } from "@/components/auth-required";
import { Button } from "@/components/ui/button";
import { BG_PALETTES as BG_PALETTES_CONFIG, BG_CONFIG } from "@/lib/background-config";
import { AnimatedDotGrid as AnimatedDotGridComponent } from "@/components/animated-dot-grid";
import { useBackgroundTheme } from "@/lib/use-background-theme";
import { BackgroundTheme } from "@/components/background-theme";

// ─── Priority config ──────────────────────────────────────────────────────────
const PRIORITIES: { value: TaskPriority; label: string; border: string; dot: string; text: string }[] = [
    { value: "urgent", label: "Urgent", border: "border-l-red-500", dot: "bg-red-500", text: "text-red-400" },
    { value: "high", label: "High", border: "border-l-orange-400", dot: "bg-orange-400", text: "text-orange-400" },
    { value: "normal", label: "Normal", border: "border-l-sky-400", dot: "bg-sky-400", text: "text-sky-400" },
    { value: "natural", label: "Natural", border: "border-l-zinc-700", dot: "bg-zinc-600", text: "text-zinc-500" },
];
const PRIORITY_ORDER: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, natural: 3 };
const getPriority = (v: string) => PRIORITIES.find(p => p.value === v) ?? PRIORITIES[3];

// ─── Group colors config ──────────────────────────────────────────────────────
const GROUP_COLORS = [
    { value: "zinc", label: "Default", bg: "bg-zinc-500", border: "border-zinc-500/40", shadow: "rgba(113,113,122,0.35)", glow: "shadow-zinc-500/25" },
    { value: "emerald", label: "Emerald", bg: "bg-emerald-500", border: "border-emerald-500/40", shadow: "rgba(16,185,129,0.35)", glow: "shadow-emerald-500/25" },
    { value: "sky", label: "Sky", bg: "bg-sky-500", border: "border-sky-500/40", shadow: "rgba(14,165,233,0.35)", glow: "shadow-sky-500/25" },
    { value: "violet", label: "Violet", bg: "bg-violet-500", border: "border-violet-500/40", shadow: "rgba(139,92,246,0.35)", glow: "shadow-violet-500/25" },
    { value: "rose", label: "Rose", bg: "bg-rose-500", border: "border-rose-500/40", shadow: "rgba(244,63,94,0.35)", glow: "shadow-rose-500/25" },
    { value: "amber", label: "Amber", bg: "bg-amber-500", border: "border-amber-500/40", shadow: "rgba(245,158,11,0.35)", glow: "shadow-amber-500/25" },
    { value: "cyan", label: "Cyan", bg: "bg-cyan-500", border: "border-cyan-500/40", shadow: "rgba(6,182,212,0.35)", glow: "shadow-cyan-500/25" },
];
const getGroupColor = (v: string) => GROUP_COLORS.find(c => c.value === v) ?? GROUP_COLORS[0];

const GENERAL_STORAGE_KEY = "dangdoro-general-pos";
const GENERAL_DIM_KEY = "dangdoro-general-dim";
const GENERAL_COLOR_KEY = "dangdoro-general-color";

// Background palette options (kept for compatibility with GROUP_COLORS)
// ─── Priority picker (inline) ─────────────────────────────────────────────────
function PriorityPicker({ taskId, priority, onClose }: { 
    taskId: string; 
    priority: TaskPriority; 
    onClose: () => void;
}) {
    return (
        <div className="flex items-center gap-1 bg-zinc-800/90 rounded-lg p-1 border border-white/10 shadow-lg">
            {PRIORITIES.map(p => (
                <button 
                    key={p.value}
                    onClick={async (e) => { 
                        e.stopPropagation();
                        await updateTaskPriority(taskId, p.value); 
                        onClose(); 
                    }}
                    title={p.label}
                    className={cn(
                        "w-4 h-4 rounded-full transition-all flex items-center justify-center",
                        priority === p.value 
                            ? "ring-2 ring-white/30 scale-110" 
                            : "hover:scale-110 opacity-60 hover:opacity-100"
                    )}
                >
                    <span className={cn("w-2.5 h-2.5 rounded-full", p.dot)} />
                </button>
            ))}
            <button 
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="ml-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
                <X className="w-3 h-3" />
            </button>
        </div>
    );
}

// ─── Task row (with double-click edit) ─────────────────────────────────────────
function TaskRow({ task, onDragStart }: { task: any; onDragStart: (e: React.PointerEvent, task: any) => void }) {
    const router = useRouter();
    const loadTask = useTimerStore((state) => state.loadTask);
    const [showPriority, setShowPriority] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(task.title);
    const [editDur, setEditDur] = useState(task.durationMinutes?.toString() ?? "");
    const [editNotes, setEditNotes] = useState(task.notes ?? "");
    const p = getPriority(task.priority ?? "natural");

    const handleStart = () => {
        const duration = task.durationMinutes ? task.durationMinutes * 60 : 25 * 60;
        loadTask(task.id, task.title, duration, task.priority ?? "natural", task.notes ?? "");
        router.push("/");
    };

    const saveEdit = async () => {
        const title = editTitle.trim();
        const dur = editDur ? parseInt(editDur) : null;
        if (title) await updateTaskField(task.id, { title, durationMinutes: dur, notes: editNotes.trim() });
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className={cn("flex flex-col gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10", p.border)}>
                <div className="flex items-center gap-2">
                    <input
                        autoFocus
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setIsEditing(false); }}
                        className="flex-1 bg-transparent text-sm font-semibold text-white outline-none min-w-0"
                    />
                    <input
                        value={editDur}
                        onChange={e => setEditDur(e.target.value.replace(/\D/g, "").slice(0, 3))}
                        placeholder="min"
                        className="w-10 bg-transparent text-xs font-semibold text-zinc-400 outline-none text-center border-b border-white/10"
                    />
                </div>
                <textarea
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    placeholder="Add notes..."
                    rows={2}
                    className="w-full bg-transparent text-[11px] font-medium text-zinc-400 outline-none resize-none border-t border-white/5 pt-1.5"
                />
                <div className="flex justify-end gap-2">
                    <button onClick={() => setIsEditing(false)} className="text-zinc-600 hover:text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Cancel</button>
                    <button onClick={saveEdit} className="text-emerald-400 hover:text-emerald-300 text-[10px] font-bold uppercase tracking-widest">Save</button>
                </div>
            </div>
        );
    }

    return (
        <div
            onDoubleClick={() => !task.completed && setIsEditing(true)}
            className={cn(
                "group/row flex flex-col gap-0.5 rounded-r-xl px-2 py-2 transition-all duration-200 select-none border-l-2",
                p.border,
                "hover:bg-white/[0.03]",
                !task.completed && "cursor-pointer"
            )}
        >
            <div className="flex items-center gap-2">
                {/* Drag handle */}
                <span 
                    onPointerDown={(e) => onDragStart(e, task)}
                    className="cursor-grab active:cursor-grabbing text-zinc-700 hover:text-zinc-400 transition-colors touch-none flex-shrink-0"
                >
                    <GripVertical className="w-3 h-3" />
                </span>

                {/* Checkbox */}
                <button 
                    onClick={() => toggleTask(task.id, !task.completed)} 
                    className="transition-transform active:scale-90 flex-shrink-0"
                >
                    {task.completed
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        : <Circle className="w-4 h-4 text-zinc-700 hover:text-emerald-500/60 transition-colors" />}
                </button>

                {/* Title */}
                <span className={cn(
                    "flex-1 text-sm font-medium leading-tight min-w-0 truncate transition-colors",
                    task.completed ? "text-zinc-600 line-through" : "text-zinc-200"
                )}>
                    {task.title}
                </span>

                {/* Right section: Duration + Actions */}
                <div className="flex items-center gap-1.5 ml-auto">
                    {/* Duration badge - always visible, gets pushed left by actions */}
                    {task.durationMinutes && !task.completed && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 bg-white/5 rounded-md px-1.5 py-0.5 flex-shrink-0 transition-all duration-200">
                            <Clock className="w-2.5 h-2.5" />{task.durationMinutes}m
                        </span>
                    )}

                    {/* Actions container - expands on hover */}
                    {!task.completed && (
                        <>
                            <div className="flex items-center gap-1 overflow-hidden max-w-0 group-hover/row:max-w-[100px] transition-all duration-200 ease-out">
                                {/* Edit */}
                                <button 
                                    onClick={() => setIsEditing(true)}
                                    className="p-1 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-colors flex-shrink-0"
                                >
                                    <Pencil className="w-3 h-3" />
                                </button>

                                {/* Start on timer */}
                                <button 
                                    onClick={handleStart} 
                                    title="Start on timer"
                                    className="p-1 rounded-md text-emerald-500/70 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors flex-shrink-0"
                                >
                                    <Play className="w-3 h-3 fill-current" />
                                </button>

                                {/* Priority dot (shown when picker is closed) */}
                                {!showPriority && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setShowPriority(true); }} 
                                        className="p-1 rounded-md hover:bg-white/5 transition-colors flex-shrink-0"
                                    >
                                        <span className={cn("w-2.5 h-2.5 rounded-full block", p.dot)} />
                                    </button>
                                )}

                                {/* Delete */}
                                <button 
                                    onClick={() => deleteTask(task.id)}
                                    className="p-1 rounded-md text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>

                            {/* Priority picker - outside overflow-hidden container */}
                            {showPriority && (
                                <PriorityPicker 
                                    taskId={task.id} 
                                    priority={task.priority ?? "natural"} 
                                    onClose={() => setShowPriority(false)}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Notes */}
            {task.notes && !task.completed && (
                <p className="ml-9 pr-3 text-[10px] font-medium text-zinc-600 whitespace-pre-wrap line-clamp-2 italic">
                    {task.notes}
                </p>
            )}
        </div>
    );
}

// ─── Group card ───────────────────────────────────────────────────────────────
const GENERAL_ID = "__general__";

function GroupCard({
    group, tasks, userId, isGeneral, isDragOver, onTaskDragStart, cardRef, onColorChange,
}: {
    group: { id: string; name: string; positionX: number; positionY: number; width?: number; height?: number; color?: string };
    tasks: any[]; userId: string; isGeneral: boolean; isDragOver: boolean;
    onTaskDragStart: (e: React.PointerEvent, task: any) => void;
    cardRef: (el: HTMLDivElement | null) => void;
    onColorChange?: (color: string) => void;
}) {
    const [collapsed, setCollapsed] = useState(false);
    const [newTask, setNewTask] = useState("");
    const [newDuration, setNewDuration] = useState("");
    const [newNotes, setNewNotes] = useState("");
    const [showNotesForm, setShowNotesForm] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);

    const [isRenaming, setIsRenaming] = useState(false);
    const [renameVal, setRenameVal] = useState(group.name);
    const [isDraggingCard, setIsDraggingCard] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    
    const groupColor = getGroupColor(group.color ?? "zinc");

    // Size constraints
    const MIN_WIDTH = 280;
    const MAX_WIDTH = 600;
    const MIN_HEIGHT = 200;
    const MAX_HEIGHT = 800;
    const clampW = (w: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w));
    const clampH = (h: number) => Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, h));

    const posRef = useRef({ x: group.positionX, y: group.positionY });
    const dimRef = useRef({ w: clampW(group.width ?? 300), h: clampH(group.height ?? 400) });
    const dragOffset = useRef({ x: 0, y: 0 });
    const cardEl = useRef<HTMLDivElement | null>(null);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        posRef.current = { x: group.positionX, y: group.positionY };
        dimRef.current = { w: clampW(group.width ?? 300), h: clampH(group.height ?? 400) };
        if (cardEl.current) {
            cardEl.current.style.left = `${group.positionX}px`;
            cardEl.current.style.top = `${group.positionY}px`;
            cardEl.current.style.width = `${dimRef.current.w}px`;
            cardEl.current.style.height = collapsed ? "auto" : `${dimRef.current.h}px`;
        }
    }, [group.positionX, group.positionY, group.width, group.height, collapsed]);

    const activeTasks = tasks
        .filter(t => !t.completed)
        .sort((a, b) => PRIORITY_ORDER[a.priority as TaskPriority ?? "natural"] - PRIORITY_ORDER[b.priority as TaskPriority ?? "natural"]);
    const doneTasks = tasks.filter(t => t.completed);

    // Draggable header logic
    const onHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest("button, input")) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragOffset.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y };
        setIsDraggingCard(true);
    };
    const onHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingCard) return;
        const x = Math.max(0, e.clientX - dragOffset.current.x);
        const y = Math.max(0, e.clientY - dragOffset.current.y);
        posRef.current = { x, y };
        if (cardEl.current) { cardEl.current.style.left = `${x}px`; cardEl.current.style.top = `${y}px`; }
    };
    const onHeaderPointerUp = () => {
        if (!isDraggingCard) return;
        setIsDraggingCard(false);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            if (isGeneral) {
                localStorage.setItem(GENERAL_STORAGE_KEY, JSON.stringify(posRef.current));
            } else {
                updateGroupPosition(group.id, posRef.current.x, posRef.current.y);
            }
        }, 400);
    };

    // Resizing logic
    const onResizePointerDown = (e: React.PointerEvent) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsResizing(true);
    };
    const onResizePointerMove = (e: React.PointerEvent) => {
        if (!isResizing || !cardEl.current) return;
        const newW = clampW(e.clientX - posRef.current.x);
        const newH = clampH(e.clientY - posRef.current.y);
        dimRef.current = { w: newW, h: newH };
        cardEl.current.style.width = `${newW}px`;
        if (!collapsed) cardEl.current.style.height = `${newH}px`;
    };
    const onResizePointerUp = () => {
        if (!isResizing) return;
        setIsResizing(false);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            if (isGeneral) {
                localStorage.setItem(GENERAL_DIM_KEY, JSON.stringify(dimRef.current));
            } else {
                updateGroupDimensions(group.id, dimRef.current.w, dimRef.current.h);
            }
        }, 400);
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.trim()) return;
        const gid = isGeneral ? null : group.id;
        const dur = newDuration ? parseInt(newDuration) : null;
        const ok = await addTask(userId, newTask.trim(), gid, "natural", 1, dur, newNotes.trim());
        if (ok) { setNewTask(""); setNewDuration(""); setNewNotes(""); setShowNotesForm(false); }
        else toast.error("Failed to add task.");
    };

    const handleRename = async () => {
        if (renameVal.trim() && renameVal !== group.name) await renameGroup(group.id, renameVal.trim());
        setIsRenaming(false);
    };

    const handleDelete = () => {
        toast.warning(`Delete "${group.name}" and all its tasks?`, {
            action: { label: "Delete", onClick: () => dbDeleteGroup(group.id, userId) },
        });
    };

    const handleColorChange = async (color: string) => {
        if (isGeneral) {
            localStorage.setItem(GENERAL_COLOR_KEY, color);
            onColorChange?.(color);
        } else {
            await updateGroupColor(group.id, color);
        }
        setShowColorPicker(false);
    };

    return (
        <div
            ref={(el) => { cardEl.current = el; cardRef(el); }}
            data-group-id={group.id}
            data-group-color={group.color ?? "zinc"}
            style={{
                position: "absolute",
                left: group.positionX,
                top: group.positionY,
                width: clampW(group.width ?? 300),
                height: collapsed ? "auto" : clampH(group.height ?? 400),
                willChange: "left,top,width,height"
            }}
            className={cn(
                "bg-zinc-900/70 backdrop-blur-2xl border rounded-2xl shadow-2xl transition-[box-shadow,border-color] duration-200 flex flex-col",
                isDraggingCard || isResizing 
                    ? cn(groupColor.border, groupColor.glow, "scale-[1.01] z-50") 
                    : "border-white/10 z-10",
                isDragOver && cn(groupColor.border, groupColor.glow)
            )}
        >
            {/* Draggable Header */}
            <div
                onPointerDown={onHeaderPointerDown}
                onPointerMove={onHeaderPointerMove}
                onPointerUp={onHeaderPointerUp}
                className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5 select-none cursor-grab active:cursor-grabbing flex-shrink-0"
            >
                <button onClick={() => setCollapsed(v => !v)} className="text-zinc-600 hover:text-white transition-colors">
                    {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {isRenaming && !isGeneral ? (
                    <input autoFocus value={renameVal}
                        onChange={e => setRenameVal(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setIsRenaming(false); }}
                        onBlur={handleRename}
                        className="flex-1 bg-transparent text-xs font-black text-white outline-none border-b border-emerald-500/50" />
                ) : (
                    <span className="flex-1 text-xs font-black uppercase tracking-widest text-white truncate">{group.name}</span>
                )}
                
                {/* Color picker */}
                <div className="relative">
                    {showColorPicker ? (
                        <div className="flex items-center gap-1 bg-zinc-800/90 rounded-lg p-1 border border-white/10 shadow-lg">
                            {GROUP_COLORS.map(c => (
                                <button 
                                    key={c.value}
                                    onClick={() => handleColorChange(c.value)}
                                    title={c.label}
                                    className={cn(
                                        "w-4 h-4 rounded-full transition-all flex items-center justify-center",
                                        (group.color ?? "zinc") === c.value 
                                            ? "ring-2 ring-white/30 scale-110" 
                                            : "hover:scale-110 opacity-60 hover:opacity-100"
                                    )}
                                >
                                    <span className={cn("w-2.5 h-2.5 rounded-full", c.bg)} />
                                </button>
                            ))}
                            <button 
                                onClick={() => setShowColorPicker(false)}
                                className="ml-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setShowColorPicker(true)} 
                            className="text-zinc-700 hover:text-zinc-300 transition-colors"
                        >
                            <span className={cn("w-2.5 h-2.5 rounded-full block", groupColor.bg)} />
                        </button>
                    )}
                </div>

                {!isGeneral && (
                    <>
                        <button onClick={() => { setIsRenaming(true); setRenameVal(group.name); }} className="text-zinc-700 hover:text-zinc-300 transition-colors">
                            <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={handleDelete} className="text-zinc-700 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </>
                )}
            </div>

            {/* Scrollable Body */}
            {!collapsed && (
                <div className="flex-1 min-h-0 overflow-y-auto p-2.5" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <form onSubmit={handleAddTask} className="flex flex-col gap-2 mb-4 bg-white/5 p-2 rounded-xl border border-white/5">
                        <div className="flex items-center gap-1.5">
                            <input value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="Task title…"
                                className="flex-1 text-xs bg-transparent border-none rounded-lg px-2 py-1.5 text-white placeholder:text-zinc-700 outline-none font-semibold min-w-0" />
                            <input value={newDuration} onChange={e => setNewDuration(e.target.value.replace(/\D/g, "").slice(0, 3))}
                                placeholder="m" title="Duration"
                                className="w-10 text-xs bg-white/5 border border-white/5 rounded-lg px-1.5 py-1 text-zinc-400 placeholder:text-zinc-700 outline-none text-center" />
                            <button type="button" onClick={() => setShowNotesForm(v => !v)} className={cn("p-1.5 rounded-lg transition-colors", showNotesForm ? "bg-white/10 text-white" : "text-zinc-600 hover:text-zinc-400")}>
                                <Pencil className="w-3 h-3" />
                            </button>
                            <button type="submit" className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors">
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        {showNotesForm && (
                            <textarea
                                value={newNotes} onChange={e => setNewNotes(e.target.value)}
                                placeholder="Additional notes..."
                                rows={2}
                                className="text-xs bg-transparent border-none rounded-lg px-2 py-1.5 text-zinc-400 placeholder:text-zinc-800 outline-none font-medium resize-none border-t border-white/5 mt-1"
                            />
                        )}
                    </form>

                    <div className="space-y-0.5">
                        {tasks.length === 0 ? (
                            <p className="text-[10px] text-zinc-700 uppercase tracking-widest font-bold text-center py-8">No tasks yet</p>
                        ) : (
                            <>
                                {activeTasks.map(task => <TaskRow key={task.id} task={task} onDragStart={onTaskDragStart} />)}
                                {doneTasks.length > 0 && (
                                    <>
                                        <div className="flex items-center gap-2 my-2.5">
                                            <div className="flex-1 h-px bg-white/5" />
                                            <span className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest">Done</span>
                                            <div className="flex-1 h-px bg-white/5" />
                                        </div>
                                        {doneTasks.map(task => <TaskRow key={task.id} task={task} onDragStart={onTaskDragStart} />)}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Resize Handle */}
            <div
                onPointerDown={onResizePointerDown}
                onPointerMove={onResizePointerMove}
                onPointerUp={onResizePointerUp}
                className="absolute bottom-1 right-1 cursor-nwse-resize p-1 text-white/5 hover:text-emerald-500/40 transition-colors"
                title="Resize Group"
            >
                <Maximize2 className="w-3 h-3 rotate-90" />
            </div>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TasksPage() {
    const { user, loading: authLoading } = useAuth();
    const [tasks, setTasks] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");

    const [generalPos, setGeneralPos] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(GENERAL_STORAGE_KEY);
            if (saved) { try { return JSON.parse(saved); } catch { } }
        }
        return { x: 40, y: 88 };
    });
    const [generalDim, setGeneralDim] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(GENERAL_DIM_KEY);
            if (saved) { try { return JSON.parse(saved); } catch { } }
        }
        return { w: 300, h: 420 };
    });
    const [generalColor, setGeneralColor] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(GENERAL_COLOR_KEY);
            if (saved) { return saved; }
        }
        return "zinc";
    });
    
    // Use the custom hook for background theme
    const { showDots, bgPalette } = useBackgroundTheme();

    const [draggingTask, setDraggingTask] = useState<any | null>(null);
    const [dragTaskColor, setDragTaskColor] = useState<string>("zinc");
    const [clonePos, setClonePos] = useState({ x: 0, y: 0 });
    const [overGroupId, setOverGroupId] = useState<string | null>(null);
    const [overTrash, setOverTrash] = useState(false);
    const [deleteReady, setDeleteReady] = useState(false);
    const [deletingTask, setDeletingTask] = useState<{ id: string; title: string; pos: { x: number; y: number }; color: string } | null>(null);
    const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (authLoading) return;
        
        if (!user) {
            setLoading(false);
            return;
        }
        
        let cleanup: (() => void) | undefined;
        const run = async () => {
            if (user.isAnonymous) {
                const { syncUserProfile } = await import("@/lib/db");
                await syncUserProfile(user);
            }
            const u1 = subscribeToTasks(user.uid, (t) => {
                setTasks(t);
                setLoading(false);
            });
            const u2 = subscribeToGroups(user.uid, setGroups);
            cleanup = () => { u1(); u2(); };
        };
        run();
        return () => { if (cleanup) cleanup(); };
    }, [user, authLoading]);

    // Helper to get task's group color
    const getTaskGroupColor = useCallback((task: any) => {
        if (!task.groupId) return generalColor;
        const group = groups.find(g => g.id === task.groupId);
        return group?.color ?? "zinc";
    }, [groups, generalColor]);

    const onTaskDragStart = useCallback((e: React.PointerEvent, task: any) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDraggingTask(task);
        setDragTaskColor(getTaskGroupColor(task));
        setClonePos({ x: e.clientX, y: e.clientY });
    }, [getTaskGroupColor]);

    const onCanvasPointerMove = useCallback((e: React.PointerEvent) => {
        if (!draggingTask) return;
        setClonePos({ x: e.clientX, y: e.clientY });
        const el = document.elementFromPoint(e.clientX, e.clientY);
        let found: string | null = null;
        for (const [gid, ref] of Object.entries(groupRefs.current)) {
            if (ref && ref.contains(el)) { found = gid; break; }
        }
        setOverGroupId(found);
        
        // When not over any group, we're in "delete zone" (empty space)
        const isOverEmpty = !found;
        setOverTrash(isOverEmpty);
        
        // Start/clear delete timer based on position
        if (isOverEmpty && !deleteTimerRef.current) {
            deleteTimerRef.current = setTimeout(() => {
                setDeleteReady(true);
            }, 600); // Hold for 600ms to enable delete
        } else if (!isOverEmpty) {
            if (deleteTimerRef.current) {
                clearTimeout(deleteTimerRef.current);
                deleteTimerRef.current = null;
            }
            setDeleteReady(false);
        }
    }, [draggingTask]);

    const onCanvasPointerUp = useCallback(async () => {
        if (!draggingTask) return;
        
        const task = draggingTask;
        const wasDeleteReady = deleteReady;
        const wasOverGroupId = overGroupId;
        const currentPos = clonePos;
        const currentColor = dragTaskColor;
        
        // Clear drag state IMMEDIATELY for smooth UX
        setDraggingTask(null);
        setOverGroupId(null);
        setOverTrash(false);
        setDeleteReady(false);
        if (deleteTimerRef.current) {
            clearTimeout(deleteTimerRef.current);
            deleteTimerRef.current = null;
        }
        
        // If dropped in empty space AND held long enough, delete the task
        if (wasDeleteReady && !wasOverGroupId) {
            // Trigger delete animation
            setDeletingTask({ id: task.id, title: task.title, pos: currentPos, color: currentColor });
            // Wait for animation then delete
            setTimeout(async () => {
                await deleteTask(task.id);
                setDeletingTask(null);
                toast.success("Task deleted.");
            }, 400);
        } else if (wasOverGroupId && wasOverGroupId !== (task.groupId ?? GENERAL_ID)) {
            // Move task to new group (fire and forget for instant feedback)
            moveTaskToGroup(task.id, wasOverGroupId === GENERAL_ID ? null : wasOverGroupId);
        }
    }, [draggingTask, overGroupId, deleteReady, clonePos, dragTaskColor]);

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGroupName.trim() || !user) return;
        const offset = (groups.length + 1) * 28;
        const gid = await addGroup(user.uid, newGroupName.trim(), 360 + offset, 120 + offset);
        if (gid) { setNewGroupName(""); setIsCreatingGroup(false); }
        else toast.error("Failed to create group.");
    };



    if (authLoading || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-950">
                <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
            </div>
        );
    }
    if (!user) {
        return (
            <BackgroundTheme showSettings={true}>
                <main className="relative z-10 flex flex-col items-center justify-center min-h-screen pt-24 pb-32 px-4 overflow-hidden">
                    <AuthRequired title="Arsenal Locked" description="Sign in to access your Task Forge." />
                </main>
            </BackgroundTheme>
        );
    }

    const generalGroup = {
        id: GENERAL_ID,
        name: "General",
        positionX: generalPos.x,
        positionY: generalPos.y,
        width: generalDim.w,
        height: generalDim.h,
        color: generalColor
    };
    const tasksByGroup = (gid: string) =>
        gid === GENERAL_ID ? tasks.filter(t => !t.groupId) : tasks.filter(t => t.groupId === gid);

    return (
        <BackgroundTheme>
            <div
                className="relative min-h-screen w-full overflow-hidden"
                onPointerMove={draggingTask ? onCanvasPointerMove : undefined}
                onPointerUp={draggingTask ? onCanvasPointerUp : undefined}
            >

            <GroupCard
                key={GENERAL_ID} group={generalGroup} tasks={tasksByGroup(GENERAL_ID)}
                userId={user.uid} isGeneral isDragOver={overGroupId === GENERAL_ID}
                onTaskDragStart={onTaskDragStart} cardRef={el => { groupRefs.current[GENERAL_ID] = el; }}
                onColorChange={setGeneralColor}
            />
            {groups.map(g => (
                <GroupCard key={g.id} group={g} tasks={tasksByGroup(g.id)}
                    userId={user.uid} isGeneral={false} isDragOver={overGroupId === g.id}
                    onTaskDragStart={onTaskDragStart} cardRef={el => { groupRefs.current[g.id] = el; }}
                />
            ))}

            {/* FAB */}
            <div className="fixed bottom-8 right-8 z-30 flex flex-col items-end gap-3">
                {isCreatingGroup && (
                    <form onSubmit={handleCreateGroup} className="flex items-center gap-2 animate-in slide-in-from-bottom-4 fade-in duration-200">
                        <input autoFocus value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                            onKeyDown={e => e.key === "Escape" && setIsCreatingGroup(false)} placeholder="Group name…"
                            className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-bold outline-none focus:border-emerald-500/40 transition-colors w-48" />
                        <button type="submit" className="p-2.5 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 transition-colors"><Check className="w-4 h-4" /></button>
                        <button type="button" onClick={() => setIsCreatingGroup(false)} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                    </form>
                )}
                <button onClick={() => setIsCreatingGroup(v => !v)}
                    className="flex items-center gap-2 px-5 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-500/20 transition-all backdrop-blur-xl shadow-lg">
                    <Plus className="w-4 h-4" /> New Group
                </button>
            </div>

            {/* Drag clone */}
            {draggingTask && (() => {
                const colorConfig = getGroupColor(dragTaskColor);
                const showDeleteWarning = overTrash && !overGroupId;
                return (
                    <div 
                        style={{ 
                            position: "fixed", 
                            left: clonePos.x + 10, 
                            top: clonePos.y + 10, 
                            pointerEvents: "none", 
                            zIndex: 99,
                            animation: showDeleteWarning ? "shake 0.3s ease-in-out infinite" : undefined,
                            boxShadow: deleteReady 
                                ? "0 0 20px 4px rgba(239,68,68,0.5), 0 8px 24px rgba(0,0,0,0.4)"
                                : `0 0 16px 2px ${colorConfig.shadow}, 0 8px 24px rgba(0,0,0,0.4)`
                        }}
                        className={cn(
                            "rounded-xl px-3 py-2 backdrop-blur-xl border transition-colors",
                            deleteReady ? "border-red-500/60 bg-red-950/80" : colorConfig.border,
                            !deleteReady && "bg-zinc-800/90"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            {deleteReady && <Trash2 className="w-3 h-3 text-red-400" />}
                            <span className={cn("text-xs font-bold", deleteReady ? "text-red-300" : "text-white")}>
                                {deleteReady ? "Release to delete" : draggingTask.title}
                            </span>
                        </div>
                        {showDeleteWarning && !deleteReady && (
                            <div className="text-[9px] text-zinc-500 mt-0.5">Hold to delete...</div>
                        )}
                    </div>
                );
            })()}

            {/* Delete animation */}
            {deletingTask && (() => {
                const colorConfig = getGroupColor(deletingTask.color);
                return (
                    <div 
                        style={{ 
                            position: "fixed", 
                            left: deletingTask.pos.x + 10, 
                            top: deletingTask.pos.y + 10, 
                            pointerEvents: "none", 
                            zIndex: 99,
                            animation: "deleteTask 0.4s ease-out forwards",
                            boxShadow: `0 0 30px ${colorConfig.shadow}`
                        }}
                        className={cn(
                            "rounded-xl px-3 py-2 backdrop-blur-xl border",
                            colorConfig.border,
                            "bg-zinc-800/90"
                        )}
                    >
                        <span className="text-xs font-bold text-white">{deletingTask.title}</span>
                    </div>
                );
            })()}

            {/* CSS Animations & Hide Scrollbar */}
            <style jsx global>{`
                /* Hide scrollbar for all group card scrollable areas */
                .overflow-y-auto::-webkit-scrollbar {
                    display: none;
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-2px) rotate(-1deg); }
                    75% { transform: translateX(2px) rotate(1deg); }
                }
                @keyframes deleteTask {
                    0% { 
                        opacity: 1; 
                        transform: scale(1) rotate(0deg); 
                    }
                    50% { 
                        opacity: 0.8; 
                        transform: scale(0.8) rotate(-5deg); 
                    }
                    100% { 
                        opacity: 0; 
                        transform: scale(0) rotate(-15deg); 
                    }
                }
            `}</style>

            {/* Guest nudge */}
            {user.isAnonymous && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-700 whitespace-nowrap">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Guest tasks are local. Sign in to sync.</p>
                    <Button variant="ghost" onClick={() => window.location.href = "/profile"}
                        className="text-emerald-500 hover:text-emerald-400 font-black uppercase tracking-widest text-[10px] h-auto p-0 flex-shrink-0">
                        Sync Now
                    </Button>
                </div>
            )}
            </div>
        </BackgroundTheme>
    );
}
