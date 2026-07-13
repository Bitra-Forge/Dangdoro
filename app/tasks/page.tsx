"use client";

import { useEffect, useRef, useState, useCallback, createContext, useContext } from "react";
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import { useRouter } from "next/navigation";
import {
    ClipboardList, Plus, Trash2, CheckCircle2, Circle,
    ChevronDown, ChevronRight, Pencil, Check, X, GripVertical,
    Play, Clock, Maximize2, Palette, Settings, Sparkles, Users,
    ArrowUpDown, Hand, HelpCircle, MousePointer, ZoomIn, ZoomOut
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import {
    addTask, subscribeToTasks, toggleTask, deleteTask,
    addGroup, renameGroup, deleteGroup as dbDeleteGroup,
    updateGroupPosition, updateGroupDimensions, moveTaskToGroup, subscribeToGroups,
    updateTaskPriority, updateTaskField, updateGroupColor, type TaskPriority,
    subscribeToAssignedGroupTasks, updateGroupSort, updateTaskPositionAndGroup
} from "@/lib/db";
import { useTimerStore } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AuthRequired } from "@/components/auth-required";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { BG_PALETTES as BG_PALETTES_CONFIG, BG_CONFIG } from "@/lib/background-config";
import { AnimatedDotGrid as AnimatedDotGridComponent } from "@/components/animated-dot-grid";
import { useBackgroundTheme } from "@/lib/use-background-theme";
import { BackgroundTheme } from "@/components/background-theme";
import { TaskAgent } from "@/components/task-agent";
import { useTour, type TourStep } from "@/lib/use-tour";
import { usePlannerStore } from "@/lib/stores/planner-store";

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
    { value: "zinc", label: "Default", bg: "bg-zinc-500", border: "border-zinc-500/40", shadow: "rgba(113,113,122,0.35)", glow: "shadow-zinc-500/25", text: "text-zinc-400", resizeHover: "hover:text-zinc-500/40", resizeActive: "text-zinc-500/40" },
    { value: "emerald", label: "Emerald", bg: "bg-emerald-500", border: "border-emerald-500/40", shadow: "rgba(16,185,129,0.35)", glow: "shadow-emerald-500/25", text: "text-emerald-400", resizeHover: "hover:text-emerald-500/40", resizeActive: "text-emerald-500/40" },
    { value: "sky", label: "Sky", bg: "bg-sky-500", border: "border-sky-500/40", shadow: "rgba(14,165,233,0.35)", glow: "shadow-sky-500/25", text: "text-sky-400", resizeHover: "hover:text-sky-500/40", resizeActive: "text-sky-500/40" },
    { value: "violet", label: "Violet", bg: "bg-violet-500", border: "border-violet-500/40", shadow: "rgba(139,92,246,0.35)", glow: "shadow-violet-500/25", text: "text-violet-400", resizeHover: "hover:text-violet-500/40", resizeActive: "text-violet-500/40" },
    { value: "rose", label: "Rose", bg: "bg-rose-500", border: "border-rose-500/40", shadow: "rgba(244,63,94,0.35)", glow: "shadow-rose-500/25", text: "text-rose-400", resizeHover: "hover:text-rose-500/40", resizeActive: "text-rose-500/40" },
    { value: "amber", label: "Amber", bg: "bg-amber-500", border: "border-amber-500/40", shadow: "rgba(245,158,11,0.35)", glow: "shadow-amber-500/25", text: "text-amber-400", resizeHover: "hover:text-amber-500/40", resizeActive: "text-amber-500/40" },
    { value: "cyan", label: "Cyan", bg: "bg-cyan-500", border: "border-cyan-500/40", shadow: "rgba(6,182,212,0.35)", glow: "shadow-cyan-500/25", text: "text-cyan-400", resizeHover: "hover:text-cyan-500/40", resizeActive: "text-cyan-500/40" },
];
const getGroupColor = (v: string) => GROUP_COLORS.find(c => c.value === v) ?? GROUP_COLORS[0];



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
                <Tooltip key={p.value} content={p.label}>
                    <button
                        onClick={async (e) => {
                            e.stopPropagation();
                            await updateTaskPriority(taskId, p.value);
                            onClose();
                        }}
                        className={cn(
                            "w-4 h-4 rounded-full transition-all flex items-center justify-center",
                            priority === p.value
                                ? "ring-2 ring-white/30 scale-110"
                                : "hover:scale-110 opacity-60 hover:opacity-100"
                        )}
                    >
                        <span className={cn("w-2.5 h-2.5 rounded-full", p.dot)} />
                    </button>
                </Tooltip>
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
    const [isLongPressing, setIsLongPressing] = useState(false);
    const p = getPriority(task.priority ?? "natural");
    const { onTouchDragStart, onTouchDragMove, onTouchDragEnd } = useContext(TouchDragContext);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    const dragStartPos = useRef<{ x: number; y: number } | null>(null);
    const isLongPressDragging = useRef(false);
    const LONG_PRESS_DURATION = 500;
    const LONG_PRESS_MOVE_THRESHOLD = 10;

    const clearLongPress = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (task.completed || isEditing) return;
        // Don't stop propagation for multi-touch (pinch-to-zoom must reach canvas handlers)
        if (e.touches.length >= 2) return;
        e.stopPropagation();
        dragStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        isLongPressDragging.current = false;
        longPressTimer.current = setTimeout(() => {
            isLongPressDragging.current = true;
            setIsLongPressing(true);
            onTouchDragStart?.(task, e.touches[0].clientX, e.touches[0].clientY);
        }, LONG_PRESS_DURATION);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        // Don't interfere with pinch-to-zoom
        if (e.touches.length >= 2) return;
        if (!dragStartPos.current) return;
        e.stopPropagation();
        const dx = e.touches[0].clientX - dragStartPos.current.x;
        const dy = e.touches[0].clientY - dragStartPos.current.y;
        if (!isLongPressDragging.current) {
            if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_THRESHOLD) {
                clearLongPress();
                dragStartPos.current = null;
            }
        } else {
            e.preventDefault();
            onTouchDragMove?.(e.touches[0].clientX, e.touches[0].clientY);
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        // Don't interfere with pinch-to-zoom release
        if (e.touches.length >= 2) return;
        e.stopPropagation();
        clearLongPress();
        if (isLongPressDragging.current) {
            e.preventDefault();
            onTouchDragEnd?.();
        }
        isLongPressDragging.current = false;
        setIsLongPressing(false);
        dragStartPos.current = null;
    };

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
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={cn(
                "task-row group/row flex flex-col gap-0.5 rounded-r-xl px-2 py-2 transition-all duration-200 select-none border-l-2",
                p.border,
                "hover:bg-white/[0.03]",
                !task.completed && "cursor-pointer",
                isLongPressing && "scale-[1.05] opacity-90"
            )}
        >
            <div className="flex items-center gap-2">
                {/* Drag handle */}
                <span
                    onPointerDown={(e) => onDragStart(e, task)}
                    className="cursor-grab active:cursor-grabbing text-zinc-700 hover:text-zinc-400 transition-all duration-200 touch-none flex-shrink-0 opacity-0 group-hover/row:opacity-100"
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
                                <Tooltip content="Edit task">
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="flex items-center justify-center p-1 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-colors flex-shrink-0"
                                    >
                                        <Pencil className="w-3 h-3" />
                                    </button>
                                </Tooltip>

                                {/* Start on timer */}
                                <Tooltip content="Start on timer">
                                    <button
                                        onClick={handleStart}
                                        className="flex items-center justify-center p-1 rounded-md text-emerald-500/70 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors flex-shrink-0"
                                    >
                                        <Play className="w-3 h-3 fill-current" />
                                    </button>
                                </Tooltip>

                                {/* Priority dot (shown when picker is closed) */}
                                {!showPriority && (
                                    <Tooltip content="Set priority">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShowPriority(true); }}
                                            className="flex items-center justify-center p-1 rounded-md hover:bg-white/5 transition-colors flex-shrink-0"
                                        >
                                            <span className={cn("w-2.5 h-2.5 rounded-full block", p.dot)} />
                                        </button>
                                    </Tooltip>
                                )}

                                {/* Delete */}
                                <Tooltip content="Delete task">
                                    <button
                                        onClick={() => deleteTask(task.id)}
                                        className="flex items-center justify-center p-1 rounded-md text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </Tooltip>
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


function GroupCard({
    group, tasks, userId, isDragOver, onTaskDragStart, cardRef,
    overTaskId, overTaskPosition, isMobileMode, zoom = 1
}: {
    group: { id: string; name: string; positionX: number; positionY: number; width?: number; height?: number; color?: string; sortBy?: string };
    tasks: any[]; userId: string; isDragOver: boolean;
    onTaskDragStart: (e: React.PointerEvent, task: any) => void;
    cardRef: (el: HTMLDivElement | null) => void;
    overTaskId: string | null;
    overTaskPosition: "before" | "after" | null;
    isMobileMode?: boolean;
    zoom?: number;
}) {
    const [collapsed, setCollapsed] = useState(false);
    const [newTask, setNewTask] = useState("");
    const [newDuration, setNewDuration] = useState("");
    const [newNotes, setNewNotes] = useState("");
    const [showNotesForm, setShowNotesForm] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showSortPicker, setShowSortPicker] = useState(false);

    const [isRenaming, setIsRenaming] = useState(false);
    const [renameVal, setRenameVal] = useState(group.name);
    const [isDraggingCard, setIsDraggingCard] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    const groupColor = getGroupColor(group.color ?? "zinc");
    const pickerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!showColorPicker && !showSortPicker) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setShowColorPicker(false);
                setShowSortPicker(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showColorPicker, showSortPicker]);

    // Size constraints
    const MIN_WIDTH = 280;
    const MAX_WIDTH = 600;
    const MIN_HEIGHT = 200;
    const MAX_HEIGHT = 800;
    const clampW = (w: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w));
    const clampH = (h: number) => Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, h));

    const posRef = useRef({ x: group.positionX, y: group.positionY });
    const dimRef = useRef({ w: clampW(group.width ?? 300), h: clampH(group.height ?? 400) });
    const startPointer = useRef({ x: 0, y: 0 });
    const startPos = useRef({ x: 0, y: 0 });
    const startDim = useRef({ w: 0, h: 0 });
    const cardEl = useRef<HTMLDivElement | null>(null);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const zoomRef = useRef(zoom)
    useEffect(() => { zoomRef.current = zoom }, [zoom])

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

    const sortBy = group.sortBy || "priority";

    const getTaskOrder = (t: any) => {
        if (typeof t.order === "number") return t.order;
        if (t.createdAt?.seconds) return t.createdAt.seconds;
        if (t.createdAt?.toMillis) return t.createdAt.toMillis() / 1000;
        if (t.createdAt instanceof Date) return t.createdAt.getTime() / 1000;
        return 0;
    };

    const sortTasks = (taskList: any[]) => {
        return [...taskList].sort((a, b) => {
            if (sortBy === "priority") {
                return PRIORITY_ORDER[a.priority as TaskPriority ?? "natural"] - PRIORITY_ORDER[b.priority as TaskPriority ?? "natural"];
            }
            if (sortBy === "title") {
                return (a.title || "").localeCompare(b.title || "");
            }
            if (sortBy === "date-desc") {
                return getTaskOrder(b) - getTaskOrder(a);
            }
            if (sortBy === "date-asc") {
                return getTaskOrder(a) - getTaskOrder(b);
            }
            if (sortBy === "custom") {
                return getTaskOrder(a) - getTaskOrder(b);
            }
            return 0;
        });
    };

    const activeTasks = sortTasks(tasks.filter(t => !t.completed));
    const doneTasks = sortTasks(tasks.filter(t => t.completed));

    // Draggable header logic
    const onHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest("button, input")) return;
        e.stopPropagation(); // Stop propagation to prevent TransformWrapper panning
        e.currentTarget.setPointerCapture(e.pointerId);
        startPointer.current = { x: e.clientX, y: e.clientY };
        startPos.current = { x: posRef.current.x, y: posRef.current.y };
        setIsDraggingCard(true);
    };
    const onHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingCard) return;
        const deltaX = (e.clientX - startPointer.current.x) / zoomRef.current;
        const deltaY = (e.clientY - startPointer.current.y) / zoomRef.current;
        const x = startPos.current.x + deltaX;
        const y = startPos.current.y + deltaY;
        posRef.current = { x, y };
        if (cardEl.current) { cardEl.current.style.left = `${x}px`; cardEl.current.style.top = `${y}px`; }
    };
    const onHeaderPointerUp = () => {
        if (!isDraggingCard) return;
        setIsDraggingCard(false);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            updateGroupPosition(group.id, posRef.current.x, posRef.current.y);
        }, 400);
    };

    // Resizing logic
    const onResizePointerDown = (e: React.PointerEvent) => {
        if (isMobileMode) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        startPointer.current = { x: e.clientX, y: e.clientY };
        startDim.current = { w: dimRef.current.w, h: dimRef.current.h };
        setIsResizing(true);
    };
    const onResizePointerMove = (e: React.PointerEvent) => {
        if (isMobileMode || !isResizing || !cardEl.current) return;
        const deltaX = (e.clientX - startPointer.current.x) / zoomRef.current;
        const deltaY = (e.clientY - startPointer.current.y) / zoomRef.current;
        const newW = clampW(startDim.current.w + deltaX);
        const newH = clampH(startDim.current.h + deltaY);
        dimRef.current = { w: newW, h: newH };
        cardEl.current.style.width = `${newW}px`;
        if (!collapsed) cardEl.current.style.height = `${newH}px`;
    };
    const onResizePointerUp = () => {
        if (isMobileMode || !isResizing) return;
        setIsResizing(false);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            updateGroupDimensions(group.id, dimRef.current.w, dimRef.current.h);
        }, 400);
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.trim()) return;
        const gid = group.id;
        const dur = newDuration ? parseInt(newDuration) : null;
        const maxOrder = activeTasks.length > 0 ? Math.max(...activeTasks.map(getTaskOrder)) : Date.now();
        const ok = await addTask(userId, newTask.trim(), gid, "natural", 1, dur, newNotes.trim(), maxOrder + 1000);
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
        await updateGroupColor(group.id, color);
        setShowColorPicker(false);
    };

    const handleSortChange = async (sortOption: string) => {
        await updateGroupSort(group.id, sortOption);
        setShowSortPicker(false);
    };

    return (
        <div
            ref={(el) => { cardEl.current = el; cardRef(el); }}
            data-group-card="true"
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
                "task-group-card bg-zinc-900/95 border rounded-2xl shadow-2xl transition-[box-shadow,border-color,transform] duration-200 flex flex-col",
                (isDraggingCard || isResizing)
                    ? cn(groupColor.border, groupColor.glow, "scale-[1.01] z-50")
                    : isDragOver
                        ? cn(groupColor.border, groupColor.glow, "scale-[1.005] z-30")
                        : "border-white/10 z-10"
            )}
        >
            {/* Draggable Header */}
            <div
                onPointerDown={onHeaderPointerDown}
                onPointerMove={onHeaderPointerMove}
                onPointerUp={onHeaderPointerUp}
                style={{ touchAction: "none" }}
                className="drag-header flex items-center gap-2 px-3 py-2.5 border-b border-white/5 select-none flex-shrink-0 cursor-grab active:cursor-grabbing"
            >
                <button onClick={() => setCollapsed(v => !v)} className="text-zinc-600 hover:text-white transition-colors">
                    {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {isRenaming ? (
                    <input autoFocus value={renameVal}
                        onChange={e => setRenameVal(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setIsRenaming(false); }}
                        onBlur={handleRename}
                        className="flex-1 bg-transparent text-xs font-black text-white outline-none border-b border-emerald-500/50" />
                ) : (
                    <span className="flex-1 text-xs font-black uppercase tracking-widest text-white truncate">{group.name}</span>
                )}

                {/* Action buttons with click-outside wrapper */}
                <div ref={pickerRef} className="flex items-center gap-0.5">
                    {/* Color picker */}
                    <div className="relative">
                        {showColorPicker ? (
                            <div className="flex items-center gap-1 bg-zinc-900/95 backdrop-blur-md rounded-lg p-1 border border-white/10 shadow-xl absolute right-0 bottom-full mb-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                                {GROUP_COLORS.map(c => (
                                    <Tooltip key={c.value} content={c.label}>
                                        <button
                                            onClick={() => handleColorChange(c.value)}
                                            className={cn(
                                                "w-4 h-4 rounded-full transition-all flex items-center justify-center",
                                                (group.color ?? "zinc") === c.value
                                                    ? "ring-2 ring-white/30 scale-110"
                                                    : "hover:scale-110 opacity-60 hover:opacity-100"
                                            )}
                                        >
                                            <span className={cn("w-2.5 h-2.5 rounded-full", c.bg)} />
                                        </button>
                                    </Tooltip>
                                ))}
                                <button
                                    onClick={() => setShowColorPicker(false)}
                                    className="ml-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ) : (
                            <Tooltip content="Change color">
                                <button
                                    onClick={() => { setShowColorPicker(v => !v); setShowSortPicker(false); }}
                                    className="text-zinc-500 hover:text-zinc-200 transition-colors p-1.5 hover:bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0"
                                >
                                    <span className={cn("w-3.5 h-3.5 rounded-full block border border-white/15", groupColor.bg)} />
                                </button>
                            </Tooltip>
                        )}
                    </div>

                    {/* Sort picker */}
                    <div className="relative">
                        {showSortPicker ? (
                            <div className="flex items-center gap-1 bg-zinc-900/95 backdrop-blur-md rounded-lg p-1 border border-white/10 shadow-xl absolute right-0 bottom-full mb-1.5 z-50 whitespace-nowrap text-[9px] font-bold uppercase tracking-wider animate-in fade-in slide-in-from-bottom-2 duration-150">
                                <Tooltip content="Custom manual order">
                                    <button
                                        onClick={() => handleSortChange("custom")}
                                        className={cn("px-1.5 py-0.5 rounded transition-all flex items-center gap-0.5", sortBy === "custom" ? "bg-white/15 text-white" : "text-zinc-400 hover:text-white")}
                                    >
                                        {sortBy === "custom" && <Check className="w-2.5 h-2.5" />}
                                        Custom
                                    </button>
                                </Tooltip>
                                <Tooltip content="Sort by Priority">
                                    <button
                                        onClick={() => handleSortChange("priority")}
                                        className={cn("px-1.5 py-0.5 rounded transition-all flex items-center gap-0.5", sortBy === "priority" ? "bg-white/15 text-white" : "text-zinc-400 hover:text-white")}
                                    >
                                        {sortBy === "priority" && <Check className="w-2.5 h-2.5" />}
                                        Priority
                                    </button>
                                </Tooltip>
                                <Tooltip content="Sort A-Z">
                                    <button
                                        onClick={() => handleSortChange("title")}
                                        className={cn("px-1.5 py-0.5 rounded transition-all flex items-center gap-0.5", sortBy === "title" ? "bg-white/15 text-white" : "text-zinc-400 hover:text-white")}
                                    >
                                        {sortBy === "title" && <Check className="w-2.5 h-2.5" />}
                                        A-Z
                                    </button>
                                </Tooltip>
                                <Tooltip content="Sort Newest">
                                    <button
                                        onClick={() => handleSortChange("date-desc")}
                                        className={cn("px-1.5 py-0.5 rounded transition-all flex items-center gap-0.5", sortBy === "date-desc" ? "bg-white/15 text-white" : "text-zinc-400 hover:text-white")}
                                    >
                                        {sortBy === "date-desc" && <Check className="w-2.5 h-2.5" />}
                                        Newest
                                    </button>
                                </Tooltip>
                                <Tooltip content="Sort Oldest">
                                    <button
                                        onClick={() => handleSortChange("date-asc")}
                                        className={cn("px-1.5 py-0.5 rounded transition-all flex items-center gap-0.5", sortBy === "date-asc" ? "bg-white/15 text-white" : "text-zinc-400 hover:text-white")}
                                    >
                                        {sortBy === "date-asc" && <Check className="w-2.5 h-2.5" />}
                                        Oldest
                                    </button>
                                </Tooltip>
                                <button
                                    onClick={() => setShowSortPicker(false)}
                                    className="ml-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ) : (
                            <Tooltip content={`Sort order: ${sortBy}`}>
                                <button
                                    onClick={() => { setShowSortPicker(v => !v); setShowColorPicker(false); }}
                                    className={cn(
                                        "text-zinc-500 hover:text-zinc-200 transition-colors p-1.5 hover:bg-white/5 rounded-lg flex items-center justify-center relative flex-shrink-0",
                                        sortBy !== "priority" && cn(groupColor.text, "bg-white/5")
                                    )}
                                >
                                    <ArrowUpDown className="w-4 h-4" />
                                    {sortBy !== "priority" && (
                                        <span className={cn("absolute top-1 right-1 w-1.5 h-1.5 rounded-full animate-pulse", groupColor.bg)} />
                                    )}
                                </button>
                            </Tooltip>
                        )}
                    </div>

                    <Tooltip content="Rename group">
                        <button onClick={() => { setIsRenaming(true); setRenameVal(group.name); }} className="text-zinc-500 hover:text-zinc-200 transition-colors p-1.5 hover:bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                    </Tooltip>

                    <Tooltip content="Delete group">
                        <button onClick={handleDelete} className="text-zinc-500 hover:text-red-400 transition-colors p-1.5 hover:bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </Tooltip>
                </div>
            </div>

            {/* Scrollable Body */}
            {!collapsed && (
                <div data-scroll-container className="flex-1 min-h-0 overflow-y-auto p-2.5 data-scroll-container" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <form onSubmit={handleAddTask} className="flex flex-col gap-2 mb-4 bg-white/5 p-2 rounded-xl border border-white/5">
                        <div className="flex items-center gap-1.5">
                            <input value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="Task title…"
                                className="flex-1 text-xs bg-transparent border-none rounded-lg px-2 py-1.5 text-white placeholder:text-zinc-700 outline-none font-semibold min-w-0" />
                            <Tooltip content="Duration (minutes)">
                                <input value={newDuration} onChange={e => setNewDuration(e.target.value.replace(/\D/g, "").slice(0, 3))}
                                    placeholder="m"
                                    className="w-10 text-xs bg-white/5 border border-white/5 rounded-lg px-1.5 py-1 text-zinc-400 placeholder:text-zinc-700 outline-none text-center" />
                            </Tooltip>
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
                                {activeTasks.map(task => (
                                    <div key={task.id} data-task-id={task.id} className="relative">
                                        {/* Drop Indicator - Before */}
                                        {isDragOver && overTaskId === task.id && overTaskPosition === "before" && (
                                            <div className="relative py-1 z-10 transition-all duration-150">
                                                <div className={cn("h-[3px] w-full rounded-full animate-pulse shadow-lg", groupColor.bg)}
                                                    style={{ boxShadow: `0 0 10px 2px ${groupColor.shadow || "rgba(255,255,255,0.2)"}` }} />
                                            </div>
                                        )}
                                        <TaskRow task={task} onDragStart={onTaskDragStart} />
                                        {/* Drop Indicator - After */}
                                        {isDragOver && overTaskId === task.id && overTaskPosition === "after" && (
                                            <div className="relative py-1 z-10 transition-all duration-150">
                                                <div className={cn("h-[3px] w-full rounded-full animate-pulse shadow-lg", groupColor.bg)}
                                                    style={{ boxShadow: `0 0 10px 2px ${groupColor.shadow || "rgba(255,255,255,0.2)"}` }} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {doneTasks.length > 0 && (
                                    <>
                                        <div className="flex items-center gap-2 my-2.5">
                                            <div className="flex-1 h-px bg-white/5" />
                                            <span className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest">Done</span>
                                            <div className="flex-1 h-px bg-white/5" />
                                        </div>
                                        {doneTasks.map(task => (
                                            <div key={task.id} data-task-id={task.id} className="relative">
                                                {/* Drop Indicator - Before */}
                                                {isDragOver && overTaskId === task.id && overTaskPosition === "before" && (
                                                    <div className="relative py-1 z-10 transition-all duration-150">
                                                        <div className={cn("h-[3px] w-full rounded-full animate-pulse shadow-lg", groupColor.bg)}
                                                            style={{ boxShadow: `0 0 10px 2px ${groupColor.shadow || "rgba(255,255,255,0.2)"}` }} />
                                                    </div>
                                                )}
                                                <TaskRow task={task} onDragStart={onTaskDragStart} />
                                                {/* Drop Indicator - After */}
                                                {isDragOver && overTaskId === task.id && overTaskPosition === "after" && (
                                                    <div className="relative py-1 z-10 transition-all duration-150">
                                                        <div className={cn("h-[3px] w-full rounded-full animate-pulse shadow-lg", groupColor.bg)}
                                                            style={{ boxShadow: `0 0 10px 2px ${groupColor.shadow || "rgba(255,255,255,0.2)"}` }} />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Resize Handle */}
            {!isMobileMode && (
                <Tooltip content="Resize Group">
                    <div
                        onPointerDown={onResizePointerDown}
                        onPointerMove={onResizePointerMove}
                        onPointerUp={onResizePointerUp}
                        className="absolute bottom-1 right-1 cursor-nwse-resize p-1 text-white/5 hover:text-emerald-500/40 transition-colors"
                    >
                        <Maximize2 className="w-3 h-3 rotate-90" />
                    </div>
                </Tooltip>
            )}
        </div>
    );
}

// ─── Assigned Tasks Card ─────────────────────────────────────────────────────
function AssignedTasksCard({
    tasks, userId, isDragOver, onTaskDragStart, isMobileMode, zoom = 1,
}: {
    tasks: any[]; userId: string; isDragOver: boolean;
    onTaskDragStart: (e: React.PointerEvent, task: any) => void;
    isMobileMode?: boolean;
    zoom?: number;
}) {
    const [collapsed, setCollapsed] = useState(false);
    const [groupNames, setGroupNames] = useState<Record<string, string>>({});
    const [isDraggingCard, setIsDraggingCard] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showSortPicker, setShowSortPicker] = useState(false);

    const loadSavedColor = () => {
        try {
            return localStorage.getItem("assigned-tasks-color") ?? "violet";
        } catch { }
        return "violet";
    };

    const [assignedColor, setAssignedColor] = useState(loadSavedColor);
    const assignedGroupColor = getGroupColor(assignedColor);
    const pickerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!showColorPicker && !showSortPicker) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setShowColorPicker(false);
                setShowSortPicker(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showColorPicker, showSortPicker]);

    const loadSavedDimensions = () => {
        try {
            const saved = localStorage.getItem("assigned-tasks-dimensions");
            if (saved) {
                const parsed = JSON.parse(saved);
                return { w: parsed.w ?? 320, h: parsed.h ?? 500 };
            }
        } catch { }
        return { w: 320, h: 500 };
    };

    const loadSavedPosition = () => {
        try {
            const saved = localStorage.getItem("assigned-tasks-position");
            if (saved) {
                const parsed = JSON.parse(saved);
                return { x: parsed.x ?? 40, y: parsed.y ?? 40 };
            }
        } catch { }
        return { x: 40, y: 40 };
    };

    const posRef = useRef(loadSavedPosition());
    const dimRef = useRef(loadSavedDimensions());
    const startPointer = useRef({ x: 0, y: 0 });
    const startPos = useRef({ x: 0, y: 0 });
    const startDim = useRef({ w: 0, h: 0 });
    const cardEl = useRef<HTMLDivElement | null>(null);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (cardEl.current) {
            cardEl.current.style.left = `${posRef.current.x}px`;
            cardEl.current.style.top = `${posRef.current.y}px`;
            cardEl.current.style.width = `${dimRef.current.w}px`;
            cardEl.current.style.height = collapsed ? "auto" : `${dimRef.current.h}px`;
        }
    }, [collapsed]);

    const saveDimensions = () => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            localStorage.setItem("assigned-tasks-dimensions", JSON.stringify(dimRef.current));
        }, 400);
    };

    const savePosition = () => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            localStorage.setItem("assigned-tasks-position", JSON.stringify(posRef.current));
        }, 400);
    };

    const handleColorChange = (color: string) => {
        setAssignedColor(color);
        localStorage.setItem("assigned-tasks-color", color);
        setShowColorPicker(false);
    };

    const loadSavedSort = () => {
        try {
            return localStorage.getItem("assigned-tasks-sort") ?? "priority";
        } catch { }
        return "priority";
    };
    const [assignedSort, setAssignedSort] = useState(loadSavedSort);

    const handleSortChange = (sortOption: string) => {
        setAssignedSort(sortOption);
        localStorage.setItem("assigned-tasks-sort", sortOption);
        setShowSortPicker(false);
    };

    useEffect(() => {
        const fetchGroupNames = async () => {
            const ids = [...new Set(tasks.map(t => t.sourceGroupId).filter(Boolean))];
            if (ids.length === 0) return;

            const names: Record<string, string> = {};
            for (const id of ids) {
                const snap = await getDoc(doc(db, "focusGroups", id));
                if (snap.exists()) {
                    names[id] = snap.data().name || "Unknown Group";
                }
            }
            setGroupNames(names);
        };
        fetchGroupNames();
    }, [tasks]);

    const getTaskOrder = (t: any) => {
        if (typeof t.order === "number") return t.order;
        if (t.createdAt?.seconds) return t.createdAt.seconds;
        if (t.createdAt?.toMillis) return t.createdAt.toMillis() / 1000;
        if (t.createdAt instanceof Date) return t.createdAt.getTime() / 1000;
        return 0;
    };

    const sortTasks = (taskList: any[]) => {
        return [...taskList].sort((a, b) => {
            if (assignedSort === "priority") {
                return PRIORITY_ORDER[a.priority as TaskPriority ?? "natural"] - PRIORITY_ORDER[b.priority as TaskPriority ?? "natural"];
            }
            if (assignedSort === "title") {
                return (a.title || "").localeCompare(b.title || "");
            }
            if (assignedSort === "date-desc") {
                return getTaskOrder(b) - getTaskOrder(a);
            }
            if (assignedSort === "date-asc") {
                return getTaskOrder(a) - getTaskOrder(b);
            }
            return 0;
        });
    };

    const activeTasks = sortTasks(tasks.filter(t => t.status !== "done"));
    const doneTasks = sortTasks(tasks.filter(t => t.status === "done"));

    const toggleAssignedTask = async (taskId: string, groupId: string, isDone: boolean) => {
        await updateDoc(doc(db, `focusGroups/${groupId}/tasks`, taskId), {
            status: isDone ? "done" : "todo",
            updatedAt: serverTimestamp()
        });
    };

    const onHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest("button")) return;
        e.stopPropagation(); // Stop propagation to prevent TransformWrapper panning
        e.currentTarget.setPointerCapture(e.pointerId);
        startPointer.current = { x: e.clientX, y: e.clientY };
        startPos.current = { x: posRef.current.x, y: posRef.current.y };
        setIsDraggingCard(true);
    };
    const onHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingCard) return;
        const deltaX = (e.clientX - startPointer.current.x) / zoom;
        const deltaY = (e.clientY - startPointer.current.y) / zoom;
        const x = startPos.current.x + deltaX;
        const y = startPos.current.y + deltaY;
        posRef.current = { x, y };
        if (cardEl.current) { cardEl.current.style.left = `${x}px`; cardEl.current.style.top = `${y}px`; }
    };
    const onHeaderPointerUp = () => {
        if (!isDraggingCard) return;
        setIsDraggingCard(false);
        savePosition();
    };

    const onResizePointerDown = (e: React.PointerEvent) => {
        if (isMobileMode) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        startPointer.current = { x: e.clientX, y: e.clientY };
        startDim.current = { w: dimRef.current.w, h: dimRef.current.h };
        setIsResizing(true);
    };
    const onResizePointerMove = (e: React.PointerEvent) => {
        if (isMobileMode || !isResizing || !cardEl.current) return;
        const deltaX = (e.clientX - startPointer.current.x) / zoom;
        const deltaY = (e.clientY - startPointer.current.y) / zoom;
        const newW = Math.min(600, Math.max(280, startDim.current.w + deltaX));
        const newH = Math.min(800, Math.max(200, startDim.current.h + deltaY));
        dimRef.current = { w: newW, h: newH };
        cardEl.current.style.width = `${newW}px`;
        if (!collapsed) cardEl.current.style.height = `${newH}px`;
    };
    const onResizePointerUp = () => {
        if (isMobileMode || !isResizing) return;
        setIsResizing(false);
        saveDimensions();
    };

    return (
        <div
            ref={cardEl}
            data-group-id="assigned-tasks"
            style={{
                position: "absolute",
                left: posRef.current.x,
                top: posRef.current.y,
                width: dimRef.current.w,
                height: collapsed ? "auto" : dimRef.current.h,
                willChange: "left,top,width,height",
                zIndex: isDraggingCard || isResizing ? 50 : 10
            }}
            className={cn(
                "bg-zinc-900/95 border rounded-2xl shadow-2xl flex flex-col transition-[box-shadow,border-color] duration-200",
                (isDraggingCard || isResizing)
                    ? cn(assignedGroupColor.border, assignedGroupColor.glow, "scale-[1.01]")
                    : isDragOver
                        ? cn(assignedGroupColor.border, assignedGroupColor.glow)
                        : "border-white/10"
            )}
        >
            {/* Draggable Header */}
            <div
                onPointerDown={onHeaderPointerDown}
                onPointerMove={onHeaderPointerMove}
                onPointerUp={onHeaderPointerUp}
                style={{ touchAction: "none" }}
                className="drag-header flex items-center gap-2 px-3 py-2.5 border-b border-white/5 select-none flex-shrink-0 cursor-grab active:cursor-grabbing"
            >
                <button onClick={() => setCollapsed(v => !v)} className="text-zinc-600 hover:text-white transition-colors">
                    {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <span className="flex-1 text-xs font-black uppercase tracking-widest text-white truncate flex items-center gap-2">
                    <Users className={cn("w-3.5 h-3.5", assignedGroupColor.text)} /> Assigned Tasks
                </span>
                <div ref={pickerRef} className="flex items-center gap-0.5">
                    {/* Color picker */}
                    <div className="relative">
                        {showColorPicker ? (
                            <div className="flex items-center gap-1 bg-zinc-900/95 backdrop-blur-md rounded-lg p-1 border border-white/10 shadow-xl absolute right-0 bottom-full mb-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                                {GROUP_COLORS.map(c => (
                                    <Tooltip key={c.value} content={c.label}>
                                        <button
                                            onClick={() => handleColorChange(c.value)}
                                            className={cn(
                                                "w-4 h-4 rounded-full transition-all flex items-center justify-center",
                                                assignedColor === c.value
                                                    ? "ring-2 ring-white/30 scale-110"
                                                    : "hover:scale-110 opacity-60 hover:opacity-100"
                                            )}
                                        >
                                            <span className={cn("w-2.5 h-2.5 rounded-full", c.bg)} />
                                        </button>
                                    </Tooltip>
                                ))}
                                <button
                                    onClick={() => setShowColorPicker(false)}
                                    className="ml-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ) : (
                            <Tooltip content="Change color">
                                <button
                                    onClick={() => { setShowColorPicker(v => !v); setShowSortPicker(false); }}
                                    className="cursor-pointer text-zinc-500 hover:text-zinc-200 transition-colors p-1.5 hover:bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0"
                                >
                                    <span className={cn("w-3.5 h-3.5 rounded-full block border border-white/15", assignedGroupColor.bg)} />
                                </button>
                            </Tooltip>
                        )}
                    </div>

                    {/* Sort picker */}
                    <div className="relative">
                        {showSortPicker ? (
                            <div className="flex items-center gap-1 bg-zinc-900/95 backdrop-blur-md rounded-lg p-1 border border-white/10 shadow-xl absolute right-0 bottom-full mb-1.5 z-50 whitespace-nowrap text-[9px] font-bold uppercase tracking-wider animate-in fade-in slide-in-from-bottom-2 duration-150">
                                <Tooltip content="Sort by Priority">
                                    <button
                                        onClick={() => handleSortChange("priority")}
                                        className={cn("px-1.5 py-0.5 rounded transition-all flex items-center gap-0.5", assignedSort === "priority" ? "bg-white/15 text-white" : "text-zinc-400 hover:text-white")}
                                    >
                                        {assignedSort === "priority" && <Check className="w-2.5 h-2.5" />}
                                        Priority
                                    </button>
                                </Tooltip>
                                <Tooltip content="Sort A-Z">
                                    <button
                                        onClick={() => handleSortChange("title")}
                                        className={cn("px-1.5 py-0.5 rounded transition-all flex items-center gap-0.5", assignedSort === "title" ? "bg-white/15 text-white" : "text-zinc-400 hover:text-white")}
                                    >
                                        {assignedSort === "title" && <Check className="w-2.5 h-2.5" />}
                                        A-Z
                                    </button>
                                </Tooltip>
                                <Tooltip content="Sort Newest">
                                    <button
                                        onClick={() => handleSortChange("date-desc")}
                                        className={cn("px-1.5 py-0.5 rounded transition-all flex items-center gap-0.5", assignedSort === "date-desc" ? "bg-white/15 text-white" : "text-zinc-400 hover:text-white")}
                                    >
                                        {assignedSort === "date-desc" && <Check className="w-2.5 h-2.5" />}
                                        Newest
                                    </button>
                                </Tooltip>
                                <Tooltip content="Sort Oldest">
                                    <button
                                        onClick={() => handleSortChange("date-asc")}
                                        className={cn("px-1.5 py-0.5 rounded transition-all flex items-center gap-0.5", assignedSort === "date-asc" ? "bg-white/15 text-white" : "text-zinc-400 hover:text-white")}
                                    >
                                        {assignedSort === "date-asc" && <Check className="w-2.5 h-2.5" />}
                                        Oldest
                                    </button>
                                </Tooltip>
                                <button
                                    onClick={() => setShowSortPicker(false)}
                                    className="ml-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ) : (
                            <Tooltip content={`Sort order: ${assignedSort}`}>
                                <button
                                    onClick={() => { setShowSortPicker(v => !v); setShowColorPicker(false); }}
                                    className={cn(
                                        "cursor-pointer text-zinc-500 hover:text-zinc-200 transition-colors p-1.5 hover:bg-white/5 rounded-lg flex items-center justify-center relative flex-shrink-0",
                                        assignedSort !== "priority" && cn(assignedGroupColor.text, "bg-white/5")
                                    )}
                                >
                                    <ArrowUpDown className="w-4 h-4" />
                                    {assignedSort !== "priority" && (
                                        <span className={cn("absolute top-1 right-1 w-1.5 h-1.5 rounded-full animate-pulse", assignedGroupColor.bg)} />
                                    )}
                                </button>
                            </Tooltip>
                        )}
                    </div>
                </div>
            </div>

            {/* Scrollable Body */}
            {!collapsed && (
                <div data-scroll-container className="flex-1 min-h-0 overflow-y-auto p-2.5 rounded-b-2xl data-scroll-container" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <div className="space-y-0.5">
                        {tasks.length === 0 ? (
                            <p className="text-[10px] text-zinc-700 uppercase tracking-widest font-bold text-center py-8">No assigned tasks</p>
                        ) : (
                            <>
                                {activeTasks.map(task => (
                                    <AssignedTaskRow
                                        key={task.id}
                                        task={task}
                                        groupName={groupNames[task.sourceGroupId]}
                                        groupTextColor={assignedGroupColor.text}
                                        onToggle={toggleAssignedTask}
                                        onDragStart={onTaskDragStart}
                                    />
                                ))}
                                {doneTasks.length > 0 && (
                                    <>
                                        <div className="flex items-center gap-2 my-2.5">
                                            <div className="flex-1 h-px bg-white/5" />
                                            <span className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest">Done</span>
                                            <div className="flex-1 h-px bg-white/5" />
                                        </div>
                                        {doneTasks.map(task => (
                                            <AssignedTaskRow
                                                key={task.id}
                                                task={task}
                                                groupName={groupNames[task.sourceGroupId]}
                                                groupTextColor={assignedGroupColor.text}
                                                onToggle={toggleAssignedTask}
                                                onDragStart={onTaskDragStart}
                                            />
                                        ))}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Resize Handle */}
            {!isMobileMode && (
                <Tooltip content="Resize">
                    <div
                        onPointerDown={onResizePointerDown}
                        onPointerMove={onResizePointerMove}
                        onPointerUp={onResizePointerUp}
                        className={cn("absolute bottom-1 right-1 cursor-nwse-resize p-1 text-white/5 transition-colors", isResizing ? assignedGroupColor.resizeActive : assignedGroupColor.resizeHover)}
                    >
                        <Maximize2 className="w-3 h-3 rotate-90" />
                    </div>
                </Tooltip>
            )}
        </div>
    );
}

// ─── Assigned Task Row ───────────────────────────────────────────────────────
function AssignedTaskRow({
    task, groupName, groupTextColor, onToggle, onDragStart
}: {
    task: any;
    groupName: string | undefined;
    groupTextColor: string;
    onToggle: (taskId: string, groupId: string, isDone: boolean) => void;
    onDragStart: (e: React.PointerEvent, task: any) => void;
}) {
    const router = useRouter();
    const loadTask = useTimerStore((state) => state.loadTask);
    const mappedPriority =
        task.priority === "high" ? "urgent" :
            task.priority === "medium" ? "high" :
                task.priority === "low" ? "normal" :
                    (task.priority ?? "natural");
    const p = getPriority(mappedPriority);
    const isDone = task.status === "done";

    const handleStart = () => {
        const duration = task.durationMinutes ? task.durationMinutes * 60 : 25 * 60;
        loadTask(task.id, task.title, duration, task.priority ?? "natural", task.description ?? "", true, task.sourceGroupId);
        router.push("/");
    };

    const handleDelete = async () => {
        await deleteDoc(doc(db, `focusGroups/${task.sourceGroupId}/tasks`, task.id));
    };

    return (
        <div
            className={cn(
                "group/row flex flex-col gap-0.5 rounded-r-xl px-2 py-2 transition-all duration-200 select-none border-l-2",
                p.border,
                "hover:bg-white/[0.03]",
                !isDone && "cursor-pointer"
            )}
        >
            <div className="flex items-center gap-2">
                {/* Checkbox */}
                <button
                    onClick={(e) => { e.stopPropagation(); onToggle(task.id, task.sourceGroupId, !isDone); }}
                    className="transition-transform active:scale-90 flex-shrink-0"
                >
                    {isDone
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        : <Circle className="w-4 h-4 text-zinc-700 hover:text-emerald-500/60 transition-colors" />}
                </button>

                {/* Title */}
                <span className={cn(
                    "flex-1 text-sm font-medium leading-tight min-w-0 truncate transition-colors",
                    isDone ? "text-zinc-600 line-through" : "text-zinc-200"
                )}>
                    {task.title}
                </span>

                {/* Right section */}
                <div className="flex items-center gap-1.5 ml-auto">
                    {!isDone && (
                        <div className="flex items-center gap-1 overflow-hidden max-w-0 group-hover/row:max-w-[80px] transition-all duration-200 ease-out">
                            {/* Start on timer */}
                            <Tooltip content="Start on timer">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleStart(); }}
                                    className="flex items-center justify-center p-1 rounded-md text-emerald-500/70 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors flex-shrink-0"
                                >
                                    <Play className="w-3 h-3 fill-current" />
                                </button>
                            </Tooltip>

                            {/* Delete task */}
                            <Tooltip content="Delete task">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                                    className="flex items-center justify-center p-1 rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </Tooltip>
                        </div>
                    )}

                    {isDone && (
                        <Tooltip content="Delete task">
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                                className="flex items-center justify-center p-1 rounded-md text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover/row:opacity-100"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </Tooltip>
                    )}
                </div>
            </div>

            {/* Group name badge */}
            {groupName && (
                <p className={cn("ml-9 pr-3 text-[9px] font-bold uppercase tracking-wider truncate opacity-50", groupTextColor)}>
                    {groupName}
                </p>
            )}

            {/* Description */}
            {task.description && !isDone && (
                <p className="ml-9 pr-3 text-[10px] font-medium text-zinc-600 whitespace-pre-wrap line-clamp-2 italic">
                    {task.description}
                </p>
            )}
        </div>
    );
}


// ─── Touch Drag Context (for mobile long-press drag) ─────────────────────
type TouchDragContextType = {
    onTouchDragStart?: (task: any, clientX: number, clientY: number) => void;
    onTouchDragMove?: (clientX: number, clientY: number) => void;
    onTouchDragEnd?: () => void;
};
const TouchDragContext = createContext<TouchDragContextType>({});

// ─── CanvasControls ────────────────────────────────────────────────────────────
// Must be a child of TransformWrapper so it can call useControls()
function CanvasControls({
    isMobileMode,
    toolMode,
    setToolMode,
    zoom,
}: {
    isMobileMode: boolean;
    toolMode: "default" | "hand";
    setToolMode: React.Dispatch<React.SetStateAction<"default" | "hand">>;
    zoom: number;
}) {
    const { zoomIn, zoomOut, setTransform } = useControls();

    const handleResetZoom = () => {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        const defaultScale = isMobile ? 0.5 : 1;
        const defaultX = isMobile ? 16 : 0;
        const defaultY = isMobile ? 80 : 0;
        setTransform(defaultX, defaultY, defaultScale, 200, "easeOut");
    };

    return (
        <>
            {/* Desktop toolbar: top-right vertical stack */}
            {!isMobileMode && (
                <div id="canvas-controls" className="canvas-controls fixed z-50 flex flex-col items-center gap-2 top-24 right-4 sm:right-8">
                    <div className="flex items-center gap-1">
                        <Tooltip content="Select tool" side="left">
                            <button onClick={() => setToolMode("default")}
                                className={cn("p-1.5 rounded-lg transition-colors", toolMode === "default" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-200")}>
                                <MousePointer className="w-4 h-4" />
                            </button>
                        </Tooltip>
                        <Tooltip content="Hand tool (H or hold Space)" side="left">
                            <button onClick={() => setToolMode(t => t === "hand" ? "default" : "hand")}
                                className={cn("p-1.5 rounded-lg transition-colors", toolMode === "hand" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-200")}>
                                <Hand className="w-4 h-4" />
                            </button>
                        </Tooltip>
                    </div>
                    <button onClick={() => zoomOut(0.1)} className="text-zinc-400 hover:text-white transition-colors p-1">
                        <ZoomOut className="w-5 h-5" />
                    </button>
                    <Tooltip content="Reset zoom (Ctrl+0)" side="left">
                        <button onClick={handleResetZoom}
                            className="text-xs font-black text-zinc-400 min-w-[3.5rem] text-center select-none hover:text-white transition-colors py-1">
                            {Math.round(zoom * 100)}%
                        </button>
                    </Tooltip>
                    <button onClick={() => zoomIn(0.1)} className="text-zinc-400 hover:text-white transition-colors p-1">
                        <ZoomIn className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Mobile zoom controls: top-left pill (notification dock is at top-right) */}
            {isMobileMode && (
                <div id="canvas-controls" className="canvas-controls fixed z-50 top-4 left-4 flex items-center gap-1 bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-2xl px-2 py-1.5 shadow-xl">
                    <Tooltip content="Zoom out" side="bottom">
                        <button onClick={() => zoomOut(0.1)}
                            className="p-1.5 text-zinc-400 hover:text-white transition-colors rounded-xl hover:bg-white/10 active:scale-90">
                            <ZoomOut className="w-4 h-4" />
                        </button>
                    </Tooltip>
                    <Tooltip content="Reset zoom" side="bottom">
                        <button onClick={handleResetZoom}
                            className="text-[11px] font-black text-zinc-400 min-w-[2.75rem] text-center select-none hover:text-white transition-colors py-1 hover:bg-white/10 rounded-xl">
                            {Math.round(zoom * 100)}%
                        </button>
                    </Tooltip>
                    <Tooltip content="Zoom in" side="bottom">
                        <button onClick={() => zoomIn(0.1)}
                            className="p-1.5 text-zinc-400 hover:text-white transition-colors rounded-xl hover:bg-white/10 active:scale-90">
                            <ZoomIn className="w-4 h-4" />
                        </button>
                    </Tooltip>
                </div>
            )}
        </>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TasksPage() {
    const tourSteps: TourStep[] = [
        {
            popover: {
                title: "Hey there! Welcome to Tasks",
                description: "This is your workspace board. Think of it as your command center where you can organize tasks, prioritize what matters, and lay out your boards.",
            },
        },
        {
            element: "#btn-new-group",
            popover: {
                title: "Create a new board",
                description: "Click here to add a new custom group. You can use boards to group tasks by project, category, or whatever workflow works best for you.",
                side: "left",
                align: "center",
            },
        },
        {
            element: "#btn-planner",
            popover: {
                title: "Meet your AI Planner",
                description: "Not sure where to start? Let the AI Task Agent draft your checklist, break down big tasks, and structure your day in seconds.",
                side: "left",
                align: "center",
            },
        },
        {
            element: "#canvas-controls",
            popover: {
                title: "Canvas & Shortcuts",
                description: "Pan around the board using the Hand tool, and zoom with +/- or your mouse wheel.<br/><br/><b>Shortcuts:</b><br/>• Hold <b>Space</b> to pan/drag the canvas<br/>• Press <b>H</b> to toggle tools<br/>• Press <b>Ctrl + 0</b> to reset zoom",
                side: "left",
                align: "center",
            },
        },
    ];

    const { resetTour, startTour } = useTour({ pageName: "tasks", steps: tourSteps });
    const handleRestartTour = () => {
        resetTour();
        startTour();
    };

    const { user, loading: authLoading } = useAuth();
    const [tasks, setTasks] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [assignedTasks, setAssignedTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [showAgent, setShowAgent] = useState(false);
    const sessionActive = usePlannerStore((s) => s.sessionActive);
    const [isMobileMode, setIsMobileMode] = useState(false);

    useEffect(() => {
        if (sessionActive) setShowAgent(true);
    }, [sessionActive]);

    useEffect(() => {
        const checkMobile = () => setIsMobileMode(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // ─── react-zoom-pan-pinch state ───────────────────────────────────────────
    // Persisted zoom/pan used as initialState for TransformWrapper
    const savedZoom = (() => {
        try { const s = localStorage.getItem("tasks-zoom"); if (s) return +s; } catch {}
        return typeof window !== 'undefined' && window.innerWidth < 768 ? 0.5 : 1;
    })();
    const savedPan = (() => {
        try { const s = localStorage.getItem("tasks-pan"); if (s) return JSON.parse(s); } catch {}
        return typeof window !== 'undefined' && window.innerWidth < 768
            ? { x: 16, y: 80 } : { x: 0, y: 0 };
    })();

    // Current zoom mirrored from library state (used for GroupCard drag math)
    const [zoom, setZoom] = useState(savedZoom);

    type ToolMode = "default" | "hand"
    const [toolMode, setToolMode] = useState<ToolMode>("default")

    // Simple ref to capture the library's resetTransform method (set via onInit)
    const resetTransformRef = useRef<(() => void) | null>(null);

    // Keyboard: Space/H for tool mode, Ctrl+0 to reset via transformRef
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLElement && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable)) return
            if (e.code === "Space") { e.preventDefault(); setToolMode("hand") }
            if (e.code === "KeyH") setToolMode(t => t === "hand" ? "default" : "hand")
            if (e.code === "Digit0" && e.ctrlKey) {
                e.preventDefault()
                resetTransformRef.current?.()
            }
        }
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.code === "Space") setToolMode("default")
        }
        window.addEventListener("keydown", onKeyDown)
        window.addEventListener("keyup", onKeyUp)
        return () => {
            window.removeEventListener("keydown", onKeyDown)
            window.removeEventListener("keyup", onKeyUp)
        }
    }, [])

    // Use the custom hook for background theme
    const { showDots, bgPalette } = useBackgroundTheme();

    const [draggingTask, setDraggingTask] = useState<any | null>(null);
    const [dragTaskColor, setDragTaskColor] = useState<string>("zinc");
    const [clonePos, setClonePos] = useState({ x: 0, y: 0 });
    const [overGroupId, setOverGroupId] = useState<string | null>(null);
    const [overTaskId, setOverTaskId] = useState<string | null>(null);
    const [overTaskPosition, setOverTaskPosition] = useState<"before" | "after" | null>(null);
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

        let active = true;
        let u1: (() => void) | null = null;
        let u2: (() => void) | null = null;
        let u3: (() => void) | null = null;

        const run = async () => {
            if (user.isAnonymous) {
                const { syncUserProfile } = await import("@/lib/db");
                await syncUserProfile(user);
            }

            if (!active) return;

            u1 = subscribeToTasks(user.uid, (t) => {
                setTasks(t);
                setLoading(false);
            });
            u2 = subscribeToGroups(user.uid, setGroups);
            u3 = subscribeToAssignedGroupTasks(user.uid, setAssignedTasks);
        };
        run();

        return () => {
            active = false;
            if (u1) u1();
            if (u2) u2();
            if (u3) u3();
        };
    }, [user, authLoading]);

    // mouse pan is now handled by TransformWrapper (panning.disabled based on toolMode)

    // Helper to get task's group color
    const getTaskGroupColor = useCallback((task: any) => {
        const group = groups.find(g => g.id === task.groupId);
        return group?.color ?? "zinc";
    }, [groups]);

    const onTaskDragStart = useCallback((e: React.PointerEvent, task: any) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDraggingTask(task);
        setDragTaskColor(getTaskGroupColor(task));
        setClonePos({ x: e.clientX, y: e.clientY });
    }, [getTaskGroupColor]);

    const handleTouchDragStart = useCallback((task: any, clientX: number, clientY: number) => {
        setDraggingTask(task);
        setDragTaskColor(getTaskGroupColor(task));
        setClonePos({ x: clientX, y: clientY });
    }, [getTaskGroupColor]);

    const handleTouchDragMove = useCallback((clientX: number, clientY: number) => {
        if (!draggingTask) return;
        setClonePos({ x: clientX, y: clientY });
        const el = document.elementFromPoint(clientX, clientY);
        const groupCardEl = el?.closest("[data-group-id]");
        const foundGroupId = groupCardEl?.getAttribute("data-group-id") || null;
        setOverGroupId(foundGroupId);
        const taskRowEl = el?.closest("[data-task-id]");
        const foundTaskId = taskRowEl?.getAttribute("data-task-id") || null;
        setOverTaskId(foundTaskId);
        if (taskRowEl && foundTaskId) {
            const rect = taskRowEl.getBoundingClientRect();
            const relativeY = clientY - rect.top;
            setOverTaskPosition(relativeY < rect.height / 2 ? "before" : "after");
        } else {
            setOverTaskPosition(null);
        }
        const isOverEmpty = !foundGroupId;
        setOverTrash(isOverEmpty);
        if (isOverEmpty && !deleteTimerRef.current) {
            deleteTimerRef.current = setTimeout(() => { setDeleteReady(true); }, 600);
        } else if (!isOverEmpty) {
            if (deleteTimerRef.current) { clearTimeout(deleteTimerRef.current); deleteTimerRef.current = null; }
            setDeleteReady(false);
        }
    }, [draggingTask]);

    const onCanvasPointerMove = useCallback((e: React.PointerEvent) => {
        if (!draggingTask) return;
        setClonePos({ x: e.clientX, y: e.clientY });
        const el = document.elementFromPoint(e.clientX, e.clientY);

        // Find which group card we are over
        const groupCardEl = el?.closest("[data-group-id]");
        const foundGroupId = groupCardEl?.getAttribute("data-group-id") || null;
        setOverGroupId(foundGroupId);

        // Find which task row we are over
        const taskRowEl = el?.closest("[data-task-id]");
        const foundTaskId = taskRowEl?.getAttribute("data-task-id") || null;
        setOverTaskId(foundTaskId);

        // Determine if we are hovering on upper or lower half of the task row
        if (taskRowEl && foundTaskId) {
            const rect = taskRowEl.getBoundingClientRect();
            const relativeY = e.clientY - rect.top;
            const isUpperHalf = relativeY < rect.height / 2;
            setOverTaskPosition(isUpperHalf ? "before" : "after");
        } else {
            setOverTaskPosition(null);
        }

        // When not over any group, we're in "delete zone" (empty space)
        const isOverEmpty = !foundGroupId;
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
        const wasOverTaskId = overTaskId;
        const wasOverTaskPosition = overTaskPosition;
        const currentPos = clonePos;
        const currentColor = dragTaskColor;

        // Clear drag state IMMEDIATELY for smooth UX
        setDraggingTask(null);
        setOverGroupId(null);
        setOverTaskId(null);
        setOverTaskPosition(null);
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
        } else if (wasOverGroupId) {
            // Drop target group
            const targetGroup = groups.find(g => g.id === wasOverGroupId);
            const isAssignedTasks = wasOverGroupId === "assigned-tasks";

            // Reordering tasks within user groups
            if (!isAssignedTasks) {
                // If dropping in the same group without hovering over any task, we can do nothing to avoid extra updates
                if (task.groupId === wasOverGroupId && !wasOverTaskId) {
                    return;
                }

                // Get current sorting mode (default to priority)
                const currentSort = targetGroup?.sortBy || "priority";

                const getTaskOrder = (t: any) => {
                    if (typeof t.order === "number") return t.order;
                    if (t.createdAt?.seconds) return t.createdAt.seconds;
                    if (t.createdAt?.toMillis) return t.createdAt.toMillis() / 1000;
                    if (t.createdAt instanceof Date) return t.createdAt.getTime() / 1000;
                    return 0;
                };

                // Sort all other active tasks in target group by custom order to locate neighbors
                const groupActiveTasks = tasks
                    .filter(t => t.groupId === wasOverGroupId && t.id !== task.id && !t.completed)
                    .sort((a, b) => getTaskOrder(a) - getTaskOrder(b));

                let newOrder = Date.now();

                if (groupActiveTasks.length === 0) {
                    newOrder = 1000;
                } else if (wasOverTaskId) {
                    const hoveredIdx = groupActiveTasks.findIndex(t => t.id === wasOverTaskId);
                    if (hoveredIdx !== -1) {
                        if (wasOverTaskPosition === "before") {
                            if (hoveredIdx === 0) {
                                newOrder = getTaskOrder(groupActiveTasks[0]) - 1000;
                            } else {
                                const prevOrder = getTaskOrder(groupActiveTasks[hoveredIdx - 1]);
                                const nextOrder = getTaskOrder(groupActiveTasks[hoveredIdx]);
                                newOrder = (prevOrder + nextOrder) / 2;
                            }
                        } else { // "after"
                            if (hoveredIdx === groupActiveTasks.length - 1) {
                                newOrder = getTaskOrder(groupActiveTasks[groupActiveTasks.length - 1]) + 1000;
                            } else {
                                const prevOrder = getTaskOrder(groupActiveTasks[hoveredIdx]);
                                const nextOrder = getTaskOrder(groupActiveTasks[hoveredIdx + 1]);
                                newOrder = (prevOrder + nextOrder) / 2;
                            }
                        }
                    }
                } else {
                    // Default to appending to the end
                    newOrder = getTaskOrder(groupActiveTasks[groupActiveTasks.length - 1]) + 1000;
                }

                // Update task position and group in DB
                await updateTaskPositionAndGroup(task.id, wasOverGroupId, newOrder);

                // If sorting was not custom, automatically switch to custom manual sorting!
                if (currentSort !== "custom") {
                    await updateGroupSort(wasOverGroupId, "custom");
                    toast.success(`Switched sorting to custom manual order.`);
                }
            }
        }
    }, [draggingTask, overGroupId, overTaskId, overTaskPosition, deleteReady, clonePos, dragTaskColor, tasks, groups]);

    const handleApplyAgentGroups = async (agentGroups: { name: string; color: string; tasks: { title: string; priority: "urgent" | "high" | "normal" | "natural"; durationMinutes: number | null; notes: string }[] }[]) => {
        if (!user) return;
        const baseOffset = groups.length;
        for (let i = 0; i < agentGroups.length; i++) {
            const g = agentGroups[i];
            const x = 360 + (baseOffset + i) * 340;
            const y = 120;
            const gid = await addGroup(user.uid, g.name, x, y, 300, 400, g.color);
            if (gid) {
                for (const t of g.tasks) {
                    await addTask(user.uid, t.title, gid, t.priority, 1, t.durationMinutes, t.notes);
                }
            }
        }
    };

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
                    <AuthRequired title="Tasks restricted" description="Sign in to create and manage your focus tasks." />
                </main>
            </BackgroundTheme>
        );
    }

    const tasksByGroup = (gid: string) => tasks.filter(t => t.groupId === gid);

    const canvasContent = (
        <>
            {groups.map(g => (
                <GroupCard key={g.id} group={g} tasks={tasksByGroup(g.id)}
                    userId={user.uid} isDragOver={overGroupId === g.id}
                    onTaskDragStart={onTaskDragStart} cardRef={el => { groupRefs.current[g.id] = el; }}
                    overTaskId={overTaskId}
                    overTaskPosition={overTaskPosition}
                    zoom={zoom}
                />
            ))}

            {/* Assigned Tasks Group */}
            {assignedTasks.length > 0 && (
                <AssignedTasksCard
                    tasks={assignedTasks}
                    userId={user.uid}
                    isDragOver={false}
                    onTaskDragStart={onTaskDragStart}
                    zoom={zoom}
                />
            )}
        </>
    );

    return (
        <BackgroundTheme showSettings={true}>
            {/* Canvas area – pan/pinch/zoom managed by react-zoom-pan-pinch */}
            <TouchDragContext.Provider value={{
                onTouchDragStart: handleTouchDragStart,
                onTouchDragMove: handleTouchDragMove,
                onTouchDragEnd: onCanvasPointerUp,
            }}>
                <TransformWrapper
                    initialScale={savedZoom}
                    initialPositionX={savedPan.x}
                    initialPositionY={savedPan.y}
                    minScale={0.1}
                    maxScale={5}
                    limitToBounds={false}
                    centerZoomedOut={false}
                    panning={{
                        disabled: !isMobileMode && toolMode !== "hand",
                        velocityDisabled: true,
                        excluded: ["data-scroll-container", "drag-header", "resize-handle", "task-row", "canvas-controls"]
                    }}
                    pinch={{ step: 5 }}
                    wheel={{
                        step: 0.0001,
                        excluded: ["data-scroll-container", "drag-header", "resize-handle", "task-row", "canvas-controls"]
                    }}
                    doubleClick={{ disabled: true }}
                    onInit={(ref) => {
                        resetTransformRef.current = () => {
                            const isMobile = window.innerWidth < 768;
                            const defaultScale = isMobile ? 0.5 : 1;
                            const defaultX = isMobile ? 16 : 0;
                            const defaultY = isMobile ? 80 : 0;
                            ref.setTransform(defaultX, defaultY, defaultScale, 200, "easeOut");
                        };
                    }}
                    onTransform={(ref) => {
                        setZoom(ref.state.scale);
                        try {
                            localStorage.setItem("tasks-zoom", String(ref.state.scale));
                            localStorage.setItem("tasks-pan", JSON.stringify({ x: ref.state.positionX, y: ref.state.positionY }));
                        } catch {}
                    }}
                >
                    {/* CanvasControls gets access to useControls() for keyboard shortcuts & zoom buttons */}
                    <CanvasControls
                        isMobileMode={isMobileMode}
                        toolMode={toolMode}
                        setToolMode={setToolMode}
                        zoom={zoom}
                    />
                    <TransformComponent
                        wrapperStyle={{
                            width: '100%',
                            height: '100dvh',
                            overflow: 'hidden',
                            cursor: !isMobileMode
                                ? toolMode === "hand" ? 'grab' : 'default'
                                : 'default',
                        }}
                        contentStyle={{
                            position: 'absolute',
                            inset: 0,
                            pointerEvents: (toolMode === "hand" && !isMobileMode) ? 'none' : undefined,
                        }}
                    >
                        <div
                            style={{ position: 'absolute', inset: 0 }}
                            onPointerMove={draggingTask ? onCanvasPointerMove : undefined}
                            onPointerUp={draggingTask ? onCanvasPointerUp : undefined}
                        >
                            {canvasContent}
                        </div>
                    </TransformComponent>
                </TransformWrapper>
            </TouchDragContext.Provider>

            {/* FAB */}
            <div className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-30 flex flex-col items-end gap-3">
                {isCreatingGroup && (
                    <form onSubmit={handleCreateGroup} className="flex items-center gap-2 animate-in slide-in-from-bottom-4 fade-in duration-200 max-w-[100vw]">
                        <input autoFocus value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                            onKeyDown={e => e.key === "Escape" && setIsCreatingGroup(false)} placeholder="Group name…"
                            className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-bold outline-none focus:border-emerald-500/40 transition-colors w-40 xs:w-48" />
                        <button type="submit" className="p-2.5 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 transition-colors"><Check className="w-4 h-4" /></button>
                        <button type="button" onClick={() => setIsCreatingGroup(false)} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                    </form>
                )}
                <button id="btn-planner" onClick={() => setShowAgent(v => !v)}
                    className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 text-zinc-400 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-white/10 hover:text-white transition-all backdrop-blur-xl shadow-lg">
                    <Sparkles className="w-4 h-4" /> Planner
                </button>
                <button id="btn-new-group" onClick={() => setIsCreatingGroup(v => !v)}
                    className="flex items-center gap-2 px-5 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-500/20 transition-all backdrop-blur-xl shadow-lg">
                    <Plus className="w-4 h-4" /> New Group
                </button>
            </div>

            {/* AI Task Agent */}
            {showAgent && <TaskAgent onApply={handleApplyAgentGroups} onClose={() => setShowAgent(false)} />}

            {/* Drag clone */}
            {draggingTask && (() => {
                const colorConfig = getGroupColor(dragTaskColor);
                const showDeleteWarning = overTrash && !overGroupId;
                return (
                    <div
                        style={{
                            position: "fixed",
                            left: clonePos.x + 12,
                            top: clonePos.y + 12,
                            pointerEvents: "none",
                            zIndex: 99,
                            animation: showDeleteWarning ? "shake 0.3s ease-in-out infinite" : undefined,
                            boxShadow: deleteReady
                                ? "0 0 22px 5px rgba(239,68,68,0.55), 0 12px 28px rgba(0,0,0,0.5)"
                                : `0 0 18px 3px ${colorConfig.shadow}, 0 12px 28px rgba(0,0,0,0.5)`,
                            transform: "rotate(3.5deg) scale(1.04)",
                            transformOrigin: "top left",
                            transition: "transform 0.15s ease-out"
                        }}
                        className={cn(
                            "rounded-xl px-3.5 py-2.5 backdrop-blur-xl border transition-colors flex flex-col gap-1 min-w-[200px] max-w-[285px]",
                            deleteReady ? "border-red-500/60 bg-red-950/80" : colorConfig.border,
                            !deleteReady && "bg-zinc-900/95"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            {deleteReady ? (
                                <Trash2 className="w-3.5 h-3.5 text-red-400 animate-bounce" />
                            ) : (
                                <span className={cn("w-2 h-2 rounded-full", getPriority(draggingTask.priority).dot)} />
                            )}
                            <span className={cn("text-xs font-bold truncate", deleteReady ? "text-red-300" : "text-white")}>
                                {deleteReady ? "Release to delete" : draggingTask.title}
                            </span>
                        </div>
                        {!deleteReady && (draggingTask.durationMinutes || draggingTask.notes) && (
                            <div className="flex items-center gap-2 mt-0.5 text-[9px] text-zinc-400 font-semibold uppercase tracking-wider">
                                {draggingTask.durationMinutes && (
                                    <span className="flex items-center gap-1 bg-white/5 rounded px-1 py-0.5">
                                        <Clock className="w-2.5 h-2.5" />{draggingTask.durationMinutes}m
                                    </span>
                                )}
                                {draggingTask.notes && (
                                    <span className="flex items-center gap-1 bg-white/5 rounded px-1 py-0.5 max-w-[120px] truncate">
                                        {draggingTask.notes}
                                    </span>
                                )}
                            </div>
                        )}
                        {showDeleteWarning && !deleteReady && (
                            <div className="text-[9px] text-red-400/80 font-bold mt-1 uppercase tracking-widest animate-pulse">Hold to delete...</div>
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

            {/* CSS Animations */}
            <style jsx global>{`
                
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
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-700 whitespace-normal sm:whitespace-nowrap max-w-[calc(100vw-2rem)] sm:max-w-none flex-wrap sm:flex-nowrap justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-center sm:text-left">Your tasks are saved on this device. Sign in or register to keep them everywhere.</p>
                    <Button variant="ghost" onClick={() => window.location.href = "/profile"}
                        className="text-emerald-500 hover:text-emerald-400 font-black uppercase tracking-widest text-[10px] h-auto p-0 flex-shrink-0">
                        Sign In | Register
                    </Button>
                </div>
            )}
            {/* Floating Help/Tour Button */}
            <div className="fixed bottom-6 left-6 z-50">
                <button
                    onClick={handleRestartTour}
                    className="p-3 rounded-full bg-zinc-900/80 hover:bg-zinc-800/80 border border-white/10 hover:border-white/20 text-zinc-400 hover:text-white transition-all backdrop-blur-md shadow-2xl flex items-center justify-center cursor-pointer"
                    title="Restart Page Tour"
                >
                    <HelpCircle className="w-5 h-5" />
                </button>
            </div>

            {/* Toolbar is now rendered inside CanvasControls (child of TransformWrapper) */}
        </BackgroundTheme>
    );
}
