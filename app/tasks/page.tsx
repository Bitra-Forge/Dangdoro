"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Plus, Trash2, CheckCircle2, Circle } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { addTask, subscribeToTasks, toggleTask, deleteTask } from "@/lib/db";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function TasksPage() {
    const { user } = useAuth();
    const [tasks, setTasks] = useState<any[]>([]);
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        if (user) {
            const unsubscribe = subscribeToTasks(user.uid, (fetchedTasks) => {
                setTasks(fetchedTasks || []);
            });
            return () => unsubscribe();
        }
    }, [user]);

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim() || !user) return;

        setIsAdding(true);
        const success = await addTask(user.uid, newTaskTitle);
        if (success) {
            setNewTaskTitle("");
            toast.success("Task added!");
        } else {
            toast.error("Failed to add task.");
        }
        setIsAdding(false);
    };

    const handleToggle = async (taskId: string, completed: boolean) => {
        const success = await toggleTask(taskId, !completed);
        if (!success) toast.error("Failed to update task.");
    };

    const handleDelete = async (taskId: string) => {
        const success = await deleteTask(taskId);
        if (success) toast.success("Task deleted.");
        else toast.error("Failed to delete task.");
    };

    return (
        <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

            <main className="relative z-10 flex flex-col items-center pt-24 pb-32 px-4 w-full flex-1">
                <header className="flex flex-col items-center gap-4 text-center mb-12">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center border border-white/20">
                            <ClipboardList className="w-4 h-4 text-emerald-400" />
                        </div>
                        <span className="text-2xl font-black tracking-tight text-white uppercase italic">Task Forge</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white uppercase italic leading-none drop-shadow-lg">
                        Manage Your Focus
                    </h1>
                    <p className="text-zinc-500 text-sm font-medium uppercase tracking-[0.2em]">
                        Organize your work for maximum efficiency
                    </p>
                </header>

                <div className="w-full max-w-2xl bg-zinc-900/40 backdrop-blur-3xl border border-white/10 rounded-3xl p-8 shadow-2xl">
                    <form onSubmit={handleAddTask} className="flex items-center gap-2 mb-8">
                        <input
                            type="text"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="What needs focus?"
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50 transition-all font-bold"
                        />
                        <button
                            type="submit"
                            disabled={isAdding}
                            className="flex items-center gap-2 px-6 py-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 hover:bg-emerald-500/20 transition-all font-bold text-xs uppercase tracking-widest disabled:opacity-50"
                        >
                            <Plus className="w-4 h-4" /> Add
                        </button>
                    </form>

                    <div className="space-y-4">
                        {tasks.length === 0 ? (
                            <div className="text-center py-12 text-zinc-600 font-bold uppercase tracking-widest text-xs">
                                No active tasks. Start forging!
                            </div>
                        ) : (
                            tasks.map((task) => (
                                <div key={task.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4 group hover:bg-white/10 transition-all">
                                    <button
                                        onClick={() => handleToggle(task.id, task.completed)}
                                        className="transition-transform active:scale-90"
                                    >
                                        {task.completed ? (
                                            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                        ) : (
                                            <Circle className="w-6 h-6 text-zinc-700 hover:text-emerald-500/50 transition-colors" />
                                        )}
                                    </button>
                                    <div className="flex-1">
                                        <h3 className={cn(
                                            "font-bold text-white transition-all",
                                            task.completed && "text-zinc-500 line-through"
                                        )}>
                                            {task.title}
                                        </h3>
                                        <p className="text-[10px] text-zinc-500 uppercase tracking-tighter font-black">
                                            {task.completed ? "Mission Complete" : "In Progress"}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(task.id)}
                                        className="p-2 text-zinc-700 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
