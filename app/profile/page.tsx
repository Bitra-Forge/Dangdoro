"use client";
import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";
import { logOut } from "@/lib/auth";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadProfilePicture, updateProfilePictureBase64, getSessionHistory } from "@/lib/db";
import { 
    Camera, Shield, Zap, Clock, Calendar, LogOut, 
    Trophy, Share2, Pencil, Activity, Award, Flame, 
    Lock, Star, TrendingUp, Info
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { format, differenceInDays, startOfDay, subDays, isSameDay } from "date-fns";
import { toast } from "sonner";
import { AuthRequired } from "@/components/auth-required";
import { motion, AnimatePresence } from "framer-motion";
import Cropper from "react-easy-crop";

// --- Components ---

const StatCard = ({ icon: Icon, label, value, colorClass, delay = 0 }: any) => (
    <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 + delay, duration: 0.8 }}
        className="bg-zinc-900/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 flex flex-col items-center text-center shadow-xl group hover:bg-white/5 transition-all relative overflow-hidden"
    >
        <div className={cn("absolute -top-12 -right-12 w-24 h-24 blur-[50px] opacity-20 pointer-events-none transition-all duration-700 group-hover:opacity-40", colorClass)} />
        <Icon className={cn("w-6 h-6 mb-4 group-hover:scale-110 transition-transform", colorClass?.replace('bg-', 'text-'))} />
        <span className="text-2xl font-black text-white italic tracking-tighter leading-none mb-2">
            {value}
        </span>
        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">{label}</span>
    </motion.div>
);

const ProductivitySquare = ({ level, date }: { level: number; date: Date }) => (
    <div 
        className={cn(
            "w-2.5 h-2.5 rounded-sm transition-all duration-500",
            level === 0 ? "bg-white/5" : "bg-purple-500"
        )}
        style={{ opacity: level === 0 ? 1 : Math.min(0.2 + (level * 0.8), 1) }}
        title={`${format(date, 'MMM d')}: ${Math.floor(level * 120)}m focused`}
    />
);

// --- Page ---

export default function ProfilePage() {
    const { user, loading: authLoading, openAuthVault } = useAuth();
    const [userData, setUserData] = useState<any>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Cropping State
    const [image, setImage] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [showCropper, setShowCropper] = useState(false);

    useEffect(() => {
        if (authLoading) return;
        if (!user) { setLoading(false); return; }

        const fetchData = async () => {
            setLoading(true);
            if (user.isAnonymous) {
                const { syncUserProfile } = await import("@/lib/db");
                await syncUserProfile(user);
            }

            // Sync user data
            const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
                if (docSnap.exists()) setUserData(docSnap.data());
                setLoading(false);
            });

            // Sync sessions info for grid & streak
            const history = await getSessionHistory(user.uid, 365);
            setSessions(history);

            return unsub;
        };

        let unsubscribe: (() => void) | undefined;
        fetchData().then(unsub => { unsubscribe = unsub; });
        return () => { if (unsubscribe) unsubscribe(); };
    }, [user, authLoading]);

    // --- Calculations ---

    const streakCount = useMemo(() => {
        if (!sessions.length) return 0;
        const sortedDates = [...new Set(sessions.map(s => startOfDay(s.completedAt.toDate()).getTime()))]
            .sort((a, b) => b - a);
        
        let streak = 0;
        let today = startOfDay(new Date());
        let currentRef = today;

        // Check if user has focused today or yesterday to continue the streak
        const lastSessionDate = new Date(sortedDates[0]);
        if (differenceInDays(today, lastSessionDate) > 1) return 0;

        for (let i = 0; i < sortedDates.length; i++) {
            const date = new Date(sortedDates[i]);
            const diff = differenceInDays(currentRef, date);
            
            if (diff <= 1) {
                streak++;
                currentRef = date;
            } else {
                break;
            }
        }
        return streak;
    }, [sessions]);

    const productivityData = useMemo(() => {
        const days = 140; // 20 weeks
        const grid = [];
        const now = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = subDays(now, i);
            const daySessions = sessions.filter(s => isSameDay(s.completedAt.toDate(), date));
            const totalMins = daySessions.reduce((acc, curr) => acc + curr.duration, 0);
            grid.push({
                date,
                level: Math.min(totalMins / 120, 1), // Max 2 hours for full purple
                minutes: totalMins
            });
        }
        return grid;
    }, [sessions]);

    // --- Handlers ---

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;
        const objectUrl = URL.createObjectURL(file);
        setImage(objectUrl);
        setShowCropper(true);
    };

    const onCropComplete = (_: any, pixels: any) => setCroppedAreaPixels(pixels);

    const handleUploadCropped = async () => {
        if (!image || !croppedAreaPixels || !user) return;
        try {
            toast.loading("Forging identity...", { id: "upload" });
            const base64Image = await getCroppedImgBase64(image, croppedAreaPixels);
            if (!base64Image) throw new Error();
            await updateProfilePictureBase64(user.uid, base64Image);
            toast.success("Updated!", { id: "upload" });
            setShowCropper(false);
            if (image.startsWith('blob:')) URL.revokeObjectURL(image);
            setImage(null);
        } catch (error) { toast.error("Failed.", { id: "upload" }); }
    };

    const getCroppedImgBase64 = async (imageSrc: string, pixelCrop: any): Promise<string | null> => {
        const img = new Image();
        img.src = imageSrc;
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        canvas.width = 150; canvas.height = 150;
        ctx.drawImage(img, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, 150, 150);
        return canvas.toDataURL("image/jpeg", 0.6);
    };

    // --- Render ---

    if (authLoading || (user && loading)) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-950">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex flex-col flex-1 bg-zinc-950 min-h-screen relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />
                <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 w-full flex-1">
                    <AuthRequired
                        title="Identity Locked"
                        description="Forge your permanent profile to track streaks and productivity history."
                    />
                </main>
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-x-hidden pt-12">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-purple-500/5 to-transparent pointer-events-none" />

            <main className="relative z-10 flex flex-col items-center pb-32 px-6 w-full flex-1 max-w-5xl mx-auto">
                
                {/* Header Section */}
                <div className="flex flex-col items-center mb-16 w-full animate-in fade-in slide-in-from-top-12 duration-1000">
                    <div className="relative group mb-10">
                        {/* Glow Behind PFP */}
                        <div className="absolute -inset-8 bg-purple-600/20 rounded-full blur-[60px] animate-pulse opacity-60 pointer-events-none" />
                        
                        <div className="relative">
                            <Avatar className="w-32 h-32 border-[6px] border-zinc-950 shadow-[0_0_40px_rgba(168,85,247,0.2)] relative z-10 overflow-visible ring-1 ring-white/10 ring-offset-0">
                                <div className="absolute inset-0 rounded-full overflow-hidden">
                                    <AvatarImage 
                                        src={userData?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                                        className="object-cover w-full h-full" 
                                    />
                                    <AvatarFallback className="bg-zinc-900 font-black text-2xl text-white">
                                        {user.displayName?.charAt(0) || "F"}
                                    </AvatarFallback>
                                </div>

                                {!user.isAnonymous && (
                                    <label className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer rounded-full z-20">
                                        <Camera className="w-8 h-8 text-white" />
                                        <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                    </label>
                                )}
                            </Avatar>
                            
                            {/* Rank Badge overlay */}
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-zinc-950 border border-white/10 px-3 py-1 rounded-full shadow-2xl z-20 flex items-center gap-2">
                                <div className={cn("w-2 h-2 rounded-full animate-pulse", user.isAnonymous ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]")} />
                                <span className={cn("text-[8px] font-black uppercase tracking-widest", user.isAnonymous ? "text-amber-500/80" : "text-emerald-500/80")}>
                                    {user.isAnonymous ? "Temporary" : "Permanent"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-center text-center">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-[1px] w-8 bg-zinc-800" />
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-purple-400">Elite Operative</span>
                            <div className="h-[1px] w-8 bg-zinc-800" />
                        </div>
                        
                        <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                            {userData?.displayName || "Guest Master"}
                        </h1>
                        <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-10">
                            Senior Productivity Architect | Sector 7-G
                        </p>

                        <div className="flex items-center gap-3">
                            <Button className="h-10 px-8 rounded-xl bg-purple-600 text-white hover:bg-purple-500 font-bold uppercase tracking-widest text-[10px] shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all flex items-center gap-2">
                                <Pencil className="w-3.5 h-3.5" />
                                Edit Profile
                            </Button>
                            <Button variant="ghost" className="h-10 px-8 rounded-xl border border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 font-bold uppercase tracking-widest text-[10px] transition-all flex items-center gap-2">
                                <Share2 className="w-3.5 h-3.5" />
                                Share Link
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Stat Row */}
                <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
                    <StatCard 
                        icon={Flame} 
                        label="Focus Streak" 
                        value={`${streakCount} Day${streakCount === 1 ? '' : 's'}`} 
                        colorClass="bg-red-500" 
                        delay={0.1}
                    />
                    <StatCard 
                        icon={Zap} 
                        label="Sessions" 
                        value={userData?.totalPomodoros || 0} 
                        colorClass="bg-amber-500" 
                        delay={0.2}
                    />
                    <StatCard 
                        icon={Clock} 
                        label="Total Minutes" 
                        value={userData?.totalMinutes || 0} 
                        colorClass="bg-sky-500" 
                        delay={0.3}
                    />
                    <StatCard 
                        icon={Calendar} 
                        label="Joined Date" 
                        value={userData?.createdAt?.seconds ? format(new Date(userData.createdAt.seconds * 1000), "MMM yyyy") : "---"} 
                        colorClass="bg-purple-500" 
                        delay={0.4}
                    />
                </div>

                {/* Dashboard Grid */}
                <div className="w-full grid grid-cols-1 lg:grid-cols-10 gap-6">
                    {/* Recent Productivity */}
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6, duration: 0.8 }}
                        className="lg:col-span-7 bg-zinc-900/40 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 flex flex-col shadow-xl"
                    >
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-zinc-800 border border-white/5">
                                    <Activity className="w-4 h-4 text-purple-400" />
                                </div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-white italic italic-none">Recent Productivity</h3>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[8px] uppercase text-zinc-600 font-bold">Less</span>
                                <div className="flex gap-1 items-center">
                                    <div className="w-2 h-2 rounded-sm bg-white/5" />
                                    <div className="w-2 h-2 rounded-sm bg-purple-500/20" />
                                    <div className="w-2 h-2 rounded-sm bg-purple-500/50" />
                                    <div className="w-2 h-2 rounded-sm bg-purple-500" />
                                </div>
                                <span className="text-[8px] uppercase text-zinc-600 font-bold">More</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 justify-center">
                            {productivityData.map((day, i) => (
                                <ProductivitySquare key={i} level={day.level} date={day.date} />
                            ))}
                        </div>
                        
                        <div className="mt-8 flex items-center justify-between pt-6 border-t border-white/5">
                            <div className="flex items-center gap-4">
                                <TrendingUp className="w-4 h-4 text-emerald-400" />
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                    Efficiency increased by 12% this week
                                </span>
                            </div>
                            <Button variant="link" className="text-[10px] font-black uppercase tracking-widest text-purple-400 p-0">
                                View Detail
                            </Button>
                        </div>
                    </motion.div>

                    {/* Trophy Cabinet */}
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.7, duration: 0.8 }}
                        className="lg:col-span-3 bg-zinc-900/40 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 flex flex-col shadow-xl"
                    >
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2 rounded-lg bg-zinc-800 border border-white/5">
                                <Trophy className="w-4 h-4 text-amber-400" />
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-white italic">Hall of Fame</h3>
                        </div>

                        <div className="space-y-4">
                            {[
                                { name: "Early Riser", date: "Unlock 5 AM", icon: Award, locked: false, color: "text-amber-500" },
                                { name: "Consistency", date: "7 Day Streak", icon: Star, locked: false, color: "text-purple-500" },
                                { name: "Deep Focus", date: "Locked", icon: Lock, locked: true, color: "text-zinc-700" },
                                { name: "Void Walker", date: "Locked", icon: Lock, locked: true, color: "text-zinc-700" }
                            ].map((trophy, i) => (
                                <div key={i} className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-950 border border-white/5", trophy.color)}>
                                        <trophy.icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white">{trophy.name}</span>
                                        <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">{trophy.date}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </main>

            {/* Cropping Modal */}
            <AnimatePresence>
                {showCropper && image && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-zinc-950/90 backdrop-blur-xl flex items-center justify-center p-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                            className="w-full max-w-xl aspect-square bg-zinc-900 border border-white/10 rounded-[3rem] overflow-hidden relative shadow-2xl"
                        >
                            <div className="absolute inset-0 pb-20">
                                <Cropper image={image} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} cropShape="round" showGrid={false} />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-6 bg-zinc-900/80 backdrop-blur-md flex items-center justify-between border-t border-white/5">
                                <Button variant="ghost" onClick={() => setShowCropper(false)} className="text-zinc-500 hover:text-white uppercase font-black text-xs tracking-widest">Cancel</Button>
                                <Button onClick={handleUploadCropped} className="bg-white text-black hover:bg-zinc-200 font-black uppercase text-xs tracking-widest px-8 rounded-xl">Confirm</Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
