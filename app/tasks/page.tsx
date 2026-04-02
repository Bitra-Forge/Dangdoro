"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    ClipboardList, Plus, Trash2, CheckCircle2, Circle,
    ChevronDown, ChevronRight, Pencil, Check, X, GripVertical,
    Play, Clock, Maximize2
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
    addTask, subscribeToTasks, toggleTask, deleteTask,
    addGroup, renameGroup, deleteGroup as dbDeleteGroup,
    updateGroupPosition, updateGroupDimensions, moveTaskToGroup, subscribeToGroups,
    updateTaskPriority, updateTaskField, type TaskPriority
} from "@/lib/db";
import { useTimerStore } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AuthRequired } from "@/components/auth-required";
import { Button } from "@/components/ui/button";

// ─── Priority config ──────────────────────────────────────────────────────────
const PRIORITIES: { value: TaskPriority; label: string; border: string; dot: string; text: string }[] = [
    { value: "urgent", label: "Urgent", border: "border-l-red-500", dot: "bg-red-500", text: "text-red-400" },
    { value: "high", label: "High", border: "border-l-orange-400", dot: "bg-orange-400", text: "text-orange-400" },
    { value: "normal", label: "Normal", border: "border-l-sky-400", dot: "bg-sky-400", text: "text-sky-400" },
    { value: "natural", label: "Natural", border: "border-l-zinc-700", dot: "bg-zinc-600", text: "text-zinc-500" },
];
const PRIORITY_ORDER: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, natural: 3 };
const getPriority = (v: string) => PRIORITIES.find(p => p.value === v) ?? PRIORITIES[3];

const GENERAL_STORAGE_KEY = "dangdoro-general-pos";
const GENERAL_DIM_KEY = "dangdoro-general-dim";

// ─── Animated dot-grid + light glow background ───────────────────────────────
function AnimatedDotGrid() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        resize();
        window.addEventListener("resize", resize);

        const orbs = [
            { x: 0.15, y: 0.3, r: 420, color: "10,185,129", speed: 0.00016, phase: 0 },
            { x: 0.78, y: 0.5, r: 340, color: "99,102,241", speed: 0.00022, phase: 2.1 },
            { x: 0.45, y: 0.8, r: 280, color: "56,189,248", speed: 0.00019, phase: 4.0 },
            { x: 0.9, y: 0.12, r: 220, color: "168,85,247", speed: 0.00014, phase: 5.8 },
        ];

        let raf: number;
        const draw = (t: number) => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const o of orbs) {
                const cx = o.x * canvas.width + Math.sin(t * o.speed + o.phase) * 70;
                const cy = o.y * canvas.height + Math.cos(t * o.speed + o.phase) * 50;
                const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, o.r);
                g.addColorStop(0, `rgba(${o.color},0.13)`);
                g.addColorStop(1, `rgba(${o.color},0)`);
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(cx, cy, o.r, 0, Math.PI * 2);
                ctx.fill();
            }
            raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);
        return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
    }, []);

    return (
        <>
            <div className="fixed inset-0 z-0 pointer-events-none" style={{
                backgroundColor: "#09090b",
                backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.09) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
            }} />
            <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none z-[1]" />
        </>
    );
}

// ─── Priority picker ──────────────────────────────────────────────────────────
function PriorityPicker({ taskId, priority, onClose }: { taskId: string; priority: TaskPriority; onClose: () => void }) {
    return (
        <div className="absolute left-0 top-6 z-50 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-1 min-w-[116px] animate-in fade-in zoom-in-95 duration-150">
            {PRIORITIES.map(p => (
                <button key={p.value}
                    onClick={async () => { await updateTaskPriority(taskId, p.value); onClose(); }}
                    className={cn("flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors hover:bg-white/5",
                        priority === p.value ? p.text : "text-zinc-400")}
                >
                    <span className={cn("w-2 h-2 rounded-full flex-shrink-0", p.dot)} />
                    {p.label}
                    {priority === p.value && <Check className="w-3 h-3 ml-auto" />}
                </button>
            ))}
        </div>
    );
}

// ─── Task row (with double-click edit) ─────────────────────────────────────────
function TaskRow({ task, onDragStart }: { task: any; onDragStart: (e: React.PointerEvent, task: any) => void }) {
    const router = useRouter();
    const { loadTask } = useTimerStore();
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
            <div className={cn("flex flex-col gap-2 pl-2 pr-2 py-2 rounded-xl border-l-2 bg-white/5", p.border)}>
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
                "flex flex-col gap-0.5 group/row hover:bg-white/5 transition-colors select-none border-l-2 py-2",
                p.border,
                !task.completed && "cursor-pointer"
            )}
        >
            <div className="flex items-center gap-2.5 pl-2 pr-3">
                <span onPointerDown={(e) => onDragStart(e, task)}
                    className="cursor-grab active:cursor-grabbing text-zinc-700 hover:text-zinc-400 transition-colors touch-none flex-shrink-0">
                    <GripVertical className="w-3 h-3" />
                </span>

                <button onClick={() => toggleTask(task.id, !task.completed)} className="transition-transform active:scale-90 flex-shrink-0">
                    {task.completed
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        : <Circle className="w-4 h-4 text-zinc-700 hover:text-emerald-500/60 transition-colors" />}
                </button>

                <span className={cn("flex-1 text-sm font-semibold leading-tight min-w-0 truncate",
                    task.completed ? "text-zinc-600 line-through" : "text-white")}>
                    {task.title}
                </span>

                {task.durationMinutes && !task.completed && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-600 bg-white/5 rounded-md px-1.5 py-0.5 flex-shrink-0">
                        <Clock className="w-2.5 h-2.5" />{task.durationMinutes}m
                    </span>
                )}

                {/* Edit (only if not done) */}
                {!task.completed && (
                    <button onClick={() => setIsEditing(true)}
                        className="opacity-0 group-hover/row:opacity-100 transition-opacity text-zinc-600 hover:text-zinc-300 flex-shrink-0">
                        <Pencil className="w-3 h-3" />
                    </button>
                )}

                {/* Start on timer */}
                {!task.completed && (
                    <button onClick={handleStart} title="Start on timer"
                        className="opacity-0 group-hover/row:opacity-100 transition-opacity text-emerald-500 hover:text-emerald-400 flex-shrink-0">
                        <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                )}

                {/* Priority dot */}
                <div className="relative flex-shrink-0">
                    <button onClick={() => setShowPriority(v => !v)} className="opacity-0 group-hover/row:opacity-100 transition-opacity">
                        <span className={cn("w-2 h-2 rounded-full block", p.dot)} />
                    </button>
                    {showPriority && <PriorityPicker taskId={task.id} priority={task.priority ?? "natural"} onClose={() => setShowPriority(false)} />}
                </div>

                <button onClick={() => deleteTask(task.id)}
                    className="opacity-0 group-hover/row:opacity-100 transition-opacity text-zinc-700 hover:text-red-400 flex-shrink-0">
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>

            {task.notes && !task.completed && (
                <p className="ml-9 pr-3 text-[10px] font-medium text-zinc-500 whitespace-pre-wrap line-clamp-2 italic">
                    {task.notes}
                </p>
            )}
        </div>
    );
}

// ─── Group card ───────────────────────────────────────────────────────────────
const GENERAL_ID = "__general__";

function GroupCard({
    group, tasks, userId, isGeneral, isDragOver, onTaskDragStart, cardRef,
}: {
    group: { id: string; name: string; positionX: number; positionY: number; width?: number; height?: number };
    tasks: any[]; userId: string; isGeneral: boolean; isDragOver: boolean;
    onTaskDragStart: (e: React.PointerEvent, task: any) => void;
    cardRef: (el: HTMLDivElement | null) => void;
}) {
    const [collapsed, setCollapsed] = useState(false);
    const [newTask, setNewTask] = useState("");
    const [newDuration, setNewDuration] = useState("");
    const [newNotes, setNewNotes] = useState("");
    const [showNotesForm, setShowNotesForm] = useState(false);

    const [isRenaming, setIsRenaming] = useState(false);
    const [renameVal, setRenameVal] = useState(group.name);
    const [isDraggingCard, setIsDraggingCard] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    const posRef = useRef({ x: group.positionX, y: group.positionY });
    const dimRef = useRef({ w: group.width ?? 300, h: group.height ?? 400 });
    const dragOffset = useRef({ x: 0, y: 0 });
    const cardEl = useRef<HTMLDivElement | null>(null);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        posRef.current = { x: group.positionX, y: group.positionY };
        dimRef.current = { w: group.width ?? 300, h: group.height ?? 400 };
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
        const newW = Math.max(260, e.clientX - posRef.current.x);
        const newH = Math.max(160, e.clientY - posRef.current.y);
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

    return (
        <div
            ref={(el) => { cardEl.current = el; cardRef(el); }}
            data-group-id={group.id}
            style={{
                position: "absolute",
                left: group.positionX,
                top: group.positionY,
                width: group.width ?? 300,
                height: collapsed ? "auto" : (group.height ?? 400),
                willChange: "left,top,width,height"
            }}
            className={cn(
                "bg-zinc-900/70 backdrop-blur-2xl border rounded-2xl shadow-2xl transition-[box-shadow,border-color] duration-200 flex flex-col",
                isDraggingCard || isResizing ? "border-emerald-500/40 shadow-emerald-500/20 scale-[1.01] z-50" : "border-white/10 z-10",
                isDragOver && "border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
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

                <span className="text-[10px] font-bold text-zinc-700 tabular-nums">{tasks.length}</span>
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
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2.5">
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
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");

    const [generalPos, setGeneralPos] = useState({ x: 40, y: 88 });
    const [generalDim, setGeneralDim] = useState({ w: 300, h: 420 });

    useEffect(() => {
        const savedPos = localStorage.getItem(GENERAL_STORAGE_KEY);
        if (savedPos) { try { setGeneralPos(JSON.parse(savedPos)); } catch { } }
        const savedDim = localStorage.getItem(GENERAL_DIM_KEY);
        if (savedDim) { try { setGeneralDim(JSON.parse(savedDim)); } catch { } }
    }, []);

    const [draggingTask, setDraggingTask] = useState<any | null>(null);
    const [clonePos, setClonePos] = useState({ x: 0, y: 0 });
    const [overGroupId, setOverGroupId] = useState<string | null>(null);
    const [overTrash, setOverTrash] = useState(false);
    const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        if (!user) return;
        let cleanup: (() => void) | undefined;
        const run = async () => {
            if (user.isAnonymous) {
                const { syncUserProfile } = await import("@/lib/db");
                await syncUserProfile(user);
            }
            const u1 = subscribeToTasks(user.uid, setTasks);
            const u2 = subscribeToGroups(user.uid, setGroups);
            cleanup = () => { u1(); u2(); };
        };
        run();
        return () => { if (cleanup) cleanup(); };
    }, [user]);

    const onTaskDragStart = useCallback((e: React.PointerEvent, task: any) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDraggingTask(task);
        setClonePos({ x: e.clientX, y: e.clientY });
    }, []);

    const onCanvasPointerMove = useCallback((e: React.PointerEvent) => {
        if (!draggingTask) return;
        setClonePos({ x: e.clientX, y: e.clientY });
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const trashZone = document.getElementById("trash-drop-zone");
        setOverTrash(!!trashZone?.contains(el));
        let found: string | null = null;
        for (const [gid, ref] of Object.entries(groupRefs.current)) {
            if (ref && ref.contains(el)) { found = gid; break; }
        }
        setOverGroupId(found);
    }, [draggingTask]);

    const onCanvasPointerUp = useCallback(async () => {
        if (!draggingTask) return;
        if (overTrash) {
            await deleteTask(draggingTask.id);
            toast.success("Task deleted.");
        } else if (overGroupId && overGroupId !== (draggingTask.groupId ?? GENERAL_ID)) {
            await moveTaskToGroup(draggingTask.id, overGroupId === GENERAL_ID ? null : overGroupId);
        }
        setDraggingTask(null); setOverGroupId(null); setOverTrash(false);
    }, [draggingTask, overGroupId, overTrash]);

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGroupName.trim() || !user) return;
        const offset = (groups.length + 1) * 28;
        const gid = await addGroup(user.uid, newGroupName.trim(), 360 + offset, 120 + offset);
        if (gid) { setNewGroupName(""); setIsCreatingGroup(false); }
        else toast.error("Failed to create group.");
    };



    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-950">
                <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
            </div>
        );
    }
    if (!user) {
        return (
            <div className="relative flex flex-col flex-1 min-h-screen overflow-hidden">
                <AnimatedDotGrid />
                <main className="relative z-10 flex flex-col items-center justify-center flex-1 pt-24 pb-32 px-4">
                    <AuthRequired title="Arsenal Locked" description="Sign in to access your Task Forge." />
                </main>
            </div>
        );
    }

    const generalGroup = {
        id: GENERAL_ID,
        name: "General",
        positionX: generalPos.x,
        positionY: generalPos.y,
        width: generalDim.w,
        height: generalDim.h
    };
    const tasksByGroup = (gid: string) =>
        gid === GENERAL_ID ? tasks.filter(t => !t.groupId) : tasks.filter(t => t.groupId === gid);

    return (
        <div
            className="relative min-h-screen w-full overflow-hidden"
            onPointerMove={draggingTask ? onCanvasPointerMove : undefined}
            onPointerUp={draggingTask ? onCanvasPointerUp : undefined}
        >
            <AnimatedDotGrid />



            {/* Title */}
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 pointer-events-none">
                <div className="w-7 h-7 bg-white/8 rounded-xl flex items-center justify-center border border-white/10 backdrop-blur-sm">
                    <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <span className="text-lg font-black tracking-tight text-white uppercase italic drop-shadow-lg">Task Forge</span>
            </div>

            <GroupCard
                key={GENERAL_ID} group={generalGroup} tasks={tasksByGroup(GENERAL_ID)}
                userId={user.uid} isGeneral isDragOver={overGroupId === GENERAL_ID}
                onTaskDragStart={onTaskDragStart} cardRef={el => { groupRefs.current[GENERAL_ID] = el; }}
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

            {/* Trash zone */}
            {draggingTask && (
                <div id="trash-drop-zone"
                    className={cn("fixed bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-8 py-4 rounded-2xl border transition-all duration-200",
                        overTrash ? "bg-red-500/20 border-red-500/60 shadow-[0_0_30px_rgba(239,68,68,0.3)] scale-105" : "bg-zinc-900/70 border-white/10 backdrop-blur-xl")}>
                    <Trash2 className={cn("w-4 h-4", overTrash ? "text-red-400" : "text-zinc-600")} />
                    <span className={cn("text-xs font-black uppercase tracking-widest", overTrash ? "text-red-400" : "text-zinc-600")}>Drop to delete</span>
                </div>
            )}

            {/* Drag clone */}
            {draggingTask && (
                <div style={{ position: "fixed", left: clonePos.x + 10, top: clonePos.y + 10, pointerEvents: "none", zIndex: 99 }}
                    className="bg-zinc-800 border border-white/20 rounded-xl px-3 py-2 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-100">
                    <span className="text-xs font-bold text-white">{draggingTask.title}</span>
                </div>
            )}

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
    );
}
