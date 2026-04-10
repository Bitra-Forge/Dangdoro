"use client";
import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";
import { logOut } from "@/lib/auth";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadProfilePicture, updateProfilePictureBase64, getSessionHistory, updateUserProfile } from "@/lib/db";
import {
    Camera, Shield, Zap, Clock, Calendar, LogOut,
    Trophy, Share2, Pencil, Activity, Award, Flame,
    Lock, Star, TrendingUp, Info, CheckCircle2
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { format, differenceInDays, startOfDay, subDays, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";
import { toast } from "sonner";
import { AuthRequired } from "@/components/auth-required";
import { motion, AnimatePresence } from "framer-motion";
import Cropper from "react-easy-crop";
import { DotLottiePlayer } from '@dotlottie/react-player';

// --- Components ---

const Noise = () => (
    <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-[100]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />
);

const StatCard = ({ icon: Icon, label, value, colorClass, delay = 0, horizontal = false, lottie = null }: any) => {
    const getThemeAnimations = () => {
        if (colorClass.includes('red')) return { 
            glow: "rgba(239,68,68,0.1)",
            border: "rgba(239,68,68,0.2)",
            particles: "bg-red-500",
            shadow: "0 0 20px rgba(239,68,68,0.1)"
        };
        if (colorClass.includes('amber')) return { 
            glow: "rgba(245,158,11,0.1)",
            border: "rgba(245,158,11,0.2)",
            particles: "bg-amber-500",
            shadow: "0 0 20px rgba(245,158,11,0.1)"
        };
        if (colorClass.includes('sky')) return { 
            glow: "rgba(14,165,233,0.1)",
            border: "rgba(14,165,233,0.2)",
            particles: "bg-sky-500",
            shadow: "0 0 20px rgba(14,165,233,0.1)"
        };
        return { 
            glow: "rgba(168,85,247,0.1)",
            border: "rgba(168,85,247,0.2)",
            particles: "bg-purple-500",
            shadow: "0 0 20px rgba(168,85,247,0.1)"
        };
    };

    const theme = getThemeAnimations();

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -2 }}
            transition={{ delay: 0.2 + delay, duration: 0.8 }}
            className={cn(
                "relative group bg-zinc-900/10 backdrop-blur-2xl border border-white/5 rounded-[5px] flex shadow-2xl transition-all duration-500 overflow-hidden cursor-default",
                horizontal ? "flex-row items-center p-4 gap-4" : "flex-col items-center text-center p-4"
            )}
        >
            {/* 1. Static Inner Glow Effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-0">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-transparent" />
            </div>

            {/* 2. Theme Specific Ambient Glow */}
            <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-700 blur-[30px] -z-10"
                style={{ backgroundColor: theme.glow }}
            />

            {/* 3. Dynamic Particle Themes */}
            <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000 overflow-hidden">
                {lottie && (
                    <div className={cn(
                        "absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-700",
                        colorClass.includes('red') ? "justify-end opacity-40 group-hover:opacity-60" : "opacity-30 group-hover:opacity-50"
                    )}>
                        <div className={cn(
                            "h-full p-2 flex items-center justify-center",
                            colorClass.includes('red') ? "absolute right-0 w-[150px] -rotate-90 translate-x-[20%] scale-[2]" : "w-full scale-[1.6]"
                        )}>
                            <DotLottiePlayer
                                src={lottie}
                                autoplay
                                loop
                                style={{ width: '100%', height: '100%' }}
                            />
                        </div>
                    </div>
                )}
                {colorClass.includes('red') && [...Array(6)].map((_, i) => (
                    <motion.div 
                        key={i} 
                        animate={{ 
                            x: [0, -120], 
                            y: [(Math.random() - 0.5) * 40, (Math.random() - 0.5) * 60],
                            opacity: [0, 0.4, 0], 
                            scale: [1, 0.3] 
                        }} 
                        transition={{ 
                            duration: 1.5 + Math.random(), 
                            repeat: Infinity, 
                            delay: i * 0.3 
                        }} 
                        className="absolute right-0 w-0.5 h-0.5 bg-red-400 rounded-full blur-[0.5px]" 
                        style={{ top: `${20 + (i * 12)}%` }} 
                    />
                ))}
                {colorClass.includes('amber') && [...Array(6)].map((_, i) => (
                    <motion.div key={i} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.1, repeat: Infinity, delay: Math.random() }} className="absolute w-[1px] h-[1px] bg-amber-400" style={{ left: `${Math.random()*100}%`, top: `${Math.random()*100}%` }} />
                ))}
                {colorClass.includes('sky') && (
                    <motion.div animate={{ rotate: [0, 360], scale: [0.8, 1.2, 0.8] }} transition={{ duration: 4, repeat: Infinity }} className="absolute -inset-8 border border-sky-500/10 rounded-full blur-[2px]" />
                )}
                {colorClass.includes('purple') && [...Array(5)].map((_, i) => (
                    <motion.div key={i} animate={{ scale: [0, 1, 0], opacity: [0, 0.3, 0] }} transition={{ duration: 3, repeat: Infinity, delay: i * 0.6 }} className="absolute bg-purple-400 rounded-full blur-[4px]" style={{ width: '20px', height: '20px', left: `${Math.random()*80}%`, top: `${Math.random()*80}%` }} />
                ))}
            </div>

            {/* Free-Floating Icon with Unique Animation */}
            <motion.div 
                whileHover={
                    colorClass.includes('sky') ? { rotate: 360 } : 
                    colorClass.includes('amber') ? { x: [0, -1, 1, -1, 1, 0] } :
                    { scale: 1.15 }
                }
                transition={{ duration: colorClass.includes('sky') ? 1.5 : 0.2 }}
                className={cn(
                    "transition-all duration-500 shrink-0 relative z-10 flex items-center justify-center",
                    horizontal ? "" : "mb-4",
                    "group-hover:drop-shadow-[0_0_8px_currentColor]"
                )}
            >
                <Icon className={cn(
                    "transition-all duration-500",
                    horizontal ? "w-4 h-4" : "w-6 h-6", 
                    colorClass?.replace('bg-', 'text-')
                )} />
            </motion.div>

            <div className={cn("flex flex-col min-w-0 pr-1 relative z-10", horizontal ? "items-start text-left" : "items-center")}>
                <span className={cn(
                    "font-black text-white tracking-tighter tabular-nums mb-0.5 drop-shadow-sm leading-none whitespace-nowrap transition-all duration-500", 
                    horizontal ? "text-lg" : "text-2xl",
                    "group-hover:drop-shadow-[0_0_10px_white]"
                )}>
                    {value}
                </span>
                <span className="text-[8.5px] font-black text-zinc-500 uppercase tracking-[0.15em] group-hover:text-zinc-300 transition-all duration-500 leading-none truncate w-full">
                    {label}
                </span>
            </div>

            {/* Reactive Corner */}
            <div className={cn(
                "absolute bottom-1 right-1 w-2 h-2 border-r border-b border-white/10 rounded-br-[1px] transition-all duration-500",
                "group-hover:border-white/40 group-hover:w-3 group-hover:h-3"
            )} />

            {/* Top Gloss Line */}
            <motion.div 
                className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                initial={{ x: "-100%" }}
                whileHover={{ x: "100%" }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
        </motion.div>
    );
};

const formatFocusedTime = (totalMinutes: number) => {
    if (totalMinutes < 60) return `${totalMinutes}m`;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
};

const ProductivitySquare = ({ level }: { level: number }) => (
    <div
        className={cn(
            "w-2.5 h-2.5 rounded-[2px] transition-all duration-700 relative group/sq",
            level === 0 ? "bg-white/[0.03]" : "bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.2)]"
        )}
        style={{ opacity: level === 0 ? 1 : Math.min(0.3 + (level * 0.7), 1) }}
    >
        {level > 0 && (
            <div className="absolute inset-0 bg-purple-400 blur-[2px] opacity-0 group-hover/sq:opacity-50 transition-opacity" />
        )}
    </div>
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

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [editNickname, setEditNickname] = useState("");
    const [editBio, setEditBio] = useState("");
    const [isSaving, setIsSaving] = useState(false);

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
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setUserData(data);
                    // Pre-fill edit state
                    setEditName(data.displayName || "");
                    setEditNickname(data.nickname || "");
                    setEditBio(data.bio || "");
                }
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
                minutes: totalMins,
                tooltip: `${format(date, 'MMM d')}: ${formatFocusedTime(totalMins)} focused`
            });
        }
        return grid;
    }, [sessions]);

    const monthDays = useMemo(() => {
        const now = new Date();
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        const days = eachDayOfInterval({ start, end });

        // Add padding for the first day of the week
        const firstDayShift = getDay(start);
        const padding = Array(firstDayShift).fill(null);

        return [
            ...padding,
            ...days.map(date => ({
                date,
                isToday: isSameDay(date, now),
                hasActivity: sessions.some(s => isSameDay(s.completedAt.toDate(), date)),
                day: format(date, 'd')
            }))
        ];
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

    const handleSaveProfile = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            await updateUserProfile(user.uid, {
                displayName: editName,
                nickname: editNickname,
                bio: editBio
            });
            toast.success("Profile saved!");
            setIsEditing(false);
        } catch (e) {
            toast.error("Failed to save.");
        } finally {
            setIsSaving(false);
        }
    };

    const getCroppedImgBase64 = async (imageSrc: string, pixelCrop: any): Promise<string | null> => {
        const img = new Image();
        img.src = imageSrc;
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        
        // High quality scale
        canvas.width = 512; 
        canvas.height = 512;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(
            img, 
            pixelCrop.x, 
            pixelCrop.y, 
            pixelCrop.width, 
            pixelCrop.height, 
            0, 
            0, 
            512, 
            512
        );
        return canvas.toDataURL("image/jpeg", 0.92);
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
            <div className="flex flex-col flex-1 bg-zinc-950 min-h-screen relative overflow-hidden" style={{ fontFamily: '__nextjs-Geist' }}>
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
        <div className="flex flex-col flex-1 bg-zinc-950 min-h-screen relative overflow-x-hidden" style={{ fontFamily: '__nextjs-Geist' }}>
            <Noise />

            {/* Immersive Background Elements */}
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full h-screen pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            </div>

            <main className="relative z-10 flex flex-col items-center pb-32 px-6 w-full flex-1 max-w-6xl mx-auto pt-20">

                {/* --- IDENTITY HUB --- */}
                <section className="w-full flex flex-col lg:flex-row items-center lg:items-start gap-12 mb-20 px-2 relative">
                    <div className="flex-1 flex flex-col md:flex-row items-center md:items-start gap-12 w-full">
                        
                        {/* Avatar & Actions Side */}
                        <div className="flex flex-col items-center gap-6 shrink-0 z-20">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                                className="relative group"
                            >
                                <div className="absolute -inset-8 bg-purple-500/10 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                                
                                <div className="relative">
                                    {/* Geometric frame decoration */}
                                    <Avatar className="w-40 h-40 md:w-48 md:h-48 rounded-2xl border border-white/10 group-hover:border-purple-500/40 group-hover:shadow-[0_0_30px_rgba(168,85,247,0.2)] relative z-10 overflow-hidden transition-all duration-700 shadow-2xl">
                                        <AvatarImage
                                            src={userData?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
                                            className="object-cover w-full h-full scale-100 transition-transform duration-1000 ease-out rounded-2xl"
                                        />
                                        <AvatarFallback className="bg-zinc-900 font-black text-6xl text-white rounded-2xl transition-all group-hover:bg-zinc-800">
                                            {user.displayName?.charAt(0) || "D"}
                                        </AvatarFallback>

                                        {isEditing && (
                                            <label className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-all cursor-pointer z-30">
                                                <Camera className="w-10 h-10 text-white mb-3" />
                                                <span className="text-[10px] font-black tracking-widest uppercase">Update Scan</span>
                                                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                            </label>
                                        )}
                                    </Avatar>
                                </div>
                            </motion.div>

                            {/* Action Buttons Container - Perfectly aligned under Avatar */}
                            {!isEditing && (
                                <div className="flex flex-col gap-2.5 w-32 md:w-40 items-center z-30">
                                    <motion.div 
                                        whileHover={{ scale: 1.02, y: -2 }} 
                                        whileTap={{ scale: 0.98 }} 
                                        className="w-full"
                                    >
                                        <Button
                                            onClick={() => setIsEditing(true)}
                                            className="w-full h-9 rounded-full bg-zinc-100 text-zinc-950 hover:bg-white font-black text-[9px] tracking-widest transition-all border border-white/20 relative shadow-xl overflow-hidden group/btn"
                                        >
                                            <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-25deg] -translate-x-full group-hover/btn:animate-shine transition-transform" />
                                            <div className="flex items-center justify-center gap-2 relative z-10 uppercase">
                                                <Pencil className="w-2.5 h-2.5" />
                                                Edit Profile
                                            </div>
                                        </Button>
                                    </motion.div>

                                    <motion.div 
                                        whileHover={{ scale: 1.02, y: -1 }} 
                                        whileTap={{ scale: 0.98 }} 
                                        className="w-full"
                                    >
                                        <Button
                                            variant="ghost"
                                            className="w-full h-9 rounded-full border border-white/5 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-all backdrop-blur-xl group/btn relative overflow-hidden text-[9px] font-black tracking-widest"
                                        >
                                            <div className="flex items-center justify-center gap-2 uppercase relative z-10">
                                                <Share2 className="w-2.5 h-2.5 transition-transform group-hover/btn:rotate-12" />
                                                Share Vault
                                            </div>
                                        </Button>
                                    </motion.div>
                                </div>
                            )}
                        </div>

                        {/* Text Identity Section */}
                        <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left pt-4 h-full">
                            {isEditing ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex flex-col items-center md:items-start gap-6 w-full max-w-xl"
                                >
                                    <input
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        placeholder="Identity Name"
                                        className="bg-transparent border-b border-white/10 text-4xl md:text-5xl font-black text-white tracking-tighter focus:outline-none focus:border-white/30 transition-all w-full py-1 h-16 uppercase"
                                    />

                                    <textarea
                                        value={editBio}
                                        onChange={e => setEditBio(e.target.value)}
                                        placeholder="System Architect | Digital Curator"
                                        rows={2}
                                        className="bg-transparent border-b border-white/5 text-sm font-medium text-zinc-400 leading-relaxed focus:outline-none focus:border-white/20 transition-all w-full py-2 resize-none"
                                    />

                                    <div className="flex items-center gap-4 mt-4">
                                        <Button
                                            onClick={handleSaveProfile}
                                            disabled={isSaving}
                                            className="h-12 px-10 rounded-2xl bg-white text-black hover:bg-zinc-200 font-black uppercase tracking-widest text-[10px] shadow-[0_0_40px_rgba(255,255,255,0.1)] transition-all flex items-center gap-2"
                                        >
                                            {isSaving ? "Syncing..." : "Commit Changes"}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            onClick={() => setIsEditing(false)}
                                            className="h-12 px-8 rounded-2xl border border-white/10 text-zinc-400 font-black uppercase tracking-widest text-[10px] hover:bg-white/5 transition-all"
                                        >
                                            Abort
                                        </Button>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex flex-col items-center md:items-start w-full max-w-2xl"
                                >
                                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter mb-4 uppercase drop-shadow-[0_0_40px_rgba(255,255,255,0.1)] mt-2">
                                        {userData?.displayName || "New Pilot"}
                                    </h1>

                                    <p className="text-zinc-400 text-sm md:text-base font-medium leading-[1.8] mb-10 max-w-xl">
                                        {userData?.bio || "System Architect and Digital Curator focusing on high-fidelity procedural environments and neural interface aesthetics. Architecting the void since 2024."}
                                    </p>
                                </motion.div>
                            )}
                        </div>
                    </div>

                    {/* Quick Stats Column - Custom Stacked Layout */}
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="grid grid-cols-2 gap-3 w-full lg:w-[360px] shrink-0"
                    >
                        {/* Streak: Spans 2x width (top) - Horizontal */}
                        <div className="col-span-2">
                            <StatCard
                                icon={Flame}
                                label="Combustion Streak"
                                value={`${streakCount} Days`}
                                colorClass="bg-red-500"
                                delay={0.1}
                                horizontal={true}
                                lottie="https://lottie.host/d45a67bc-112f-44fa-96d8-7bbb5b0424a0/ISj7KzGPJL.lottie"
                            />
                        </div>

                        {/* Middle row: Two horizontal cards side-by-side */}
                        <StatCard
                            icon={Zap}
                            label="Sessions"
                            value={userData?.totalPomodoros || 0}
                            colorClass="bg-amber-500"
                            delay={0.2}
                            horizontal={true}
                            lottie="https://lottie.host/744101ff-3133-4079-924b-56b7ba413dc2/cG4FlIP6px.lottie"
                        />
                        <StatCard
                            icon={Clock}
                            label="Active Uptime"
                            value={formatFocusedTime(userData?.totalMinutes || 0)}
                            colorClass="bg-sky-500"
                            delay={0.3}
                            horizontal={true}
                            lottie="https://lottie.host/6d8cee47-05d6-4d85-a3e4-34ab0969f50f/OmVO7S6zrr.lottie"
                        />

                        {/* Deployment: Spans 2x width (bottom) - Horizontal */}
                        <div className="col-span-2">
                            <StatCard
                                icon={Calendar}
                                label="Joined since"
                                value={userData?.createdAt?.seconds ? format(new Date(userData.createdAt.seconds * 1000), "MMM yyyy") : "---"}
                                colorClass="bg-purple-500"
                                delay={0.4}
                                horizontal={true}
                            />
                        </div>
                    </motion.div>
                </section>

                {/* --- OPERATIONAL SUBSTRATE (Bento Grid) --- */}
                <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

                    {/* Neural Activity (Heatmap) */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.6, duration: 0.8 }}
                        className="lg:col-span-8 bg-zinc-900/10 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-10 flex flex-col shadow-2xl relative overflow-hidden group"
                    >
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

                        <div className="flex items-center justify-between mb-10 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-zinc-900 border border-white/5 shadow-inner group-hover:border-purple-500/30 transition-colors">
                                    <Activity className="w-5 h-5 text-purple-400 group-hover:animate-pulse" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Neural Activity</h3>
                                    <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-0.5">Focus density over past 140 cycles</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-zinc-950/50 px-4 py-2 rounded-full border border-white/5">
                                <span className="text-[9px] uppercase text-zinc-600 font-extrabold tracking-tighter">Low</span>
                                <div className="flex gap-1.5 items-center">
                                    <div className="w-2.5 h-2.5 rounded-sm bg-white/[0.03]" />
                                    <div className="w-2.5 h-2.5 rounded-sm bg-purple-500/20" />
                                    <div className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
                                </div>
                                <span className="text-[9px] uppercase text-zinc-600 font-extrabold tracking-tighter">Peak</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 justify-center py-6 px-4 bg-zinc-950/20 rounded-[2rem] border border-white/[0.02] mb-8 relative">
                            {/* Grid background lines */}
                            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

                            {productivityData.map((day, i) => (
                                <div key={i} title={day.tooltip} className="relative z-10">
                                    <ProductivitySquare level={day.level} />
                                </div>
                            ))}
                        </div>

                        <div className="mt-auto flex items-center justify-between pt-8 border-t border-white/[0.03]">
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full border border-emerald-500/20 flex items-center justify-center bg-emerald-500/5">
                                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                                </div>
                                <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">
                                    Neural efficiency <span className="text-emerald-400">+12.4%</span> vs prev cycle
                                </span>
                            </div>
                            <Button variant="ghost" className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400 hover:text-purple-300 hover:bg-purple-500/5 px-6 rounded-full transition-all">
                                [ ANALYZE LOGS ]
                            </Button>
                        </div>
                    </motion.div>

                    {/* Streak Calendar Terminal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.7, duration: 0.8 }}
                        className="lg:col-span-4 bg-zinc-900/10 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-8 flex flex-col shadow-2xl relative overflow-hidden group"
                    >
                        <div className="flex items-center justify-between mb-8 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-zinc-900 border border-white/5 shadow-inner">
                                    <Calendar className="w-5 h-5 text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">{format(new Date(), 'MMMM')}</h3>
                                    <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-0.5">Deployment Timeline</p>
                                </div>
                            </div>
                            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                        </div>

                        <div className="grid grid-cols-7 gap-2 mb-4">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                                <div key={i} className="text-[9px] font-black text-zinc-700 text-center uppercase py-2">
                                    {day}
                                </div>
                            ))}
                            {monthDays.map((day, i) => (
                                <div key={i} className="aspect-square flex items-center justify-center relative">
                                    {day ? (
                                        <>
                                            {/* Base day indicator */}
                                            <div className={cn(
                                                "w-full h-full rounded-xl flex items-center justify-center text-[10px] font-black transition-all duration-500",
                                                day.hasActivity
                                                    ? "bg-purple-600/20 text-purple-400 border border-purple-500/30"
                                                    : "bg-white/[0.02] text-zinc-700 border border-white/[0.02]",
                                                day.isToday && "ring-1 ring-white/20 border-white/20"
                                            )}>
                                                {day.day}
                                            </div>

                                            {/* Activity pulse */}
                                            {day.hasActivity && (
                                                <div className="absolute inset-0 bg-purple-500/10 blur-[8px] rounded-full scale-75" />
                                            )}

                                            {/* Today indicator bug */}
                                            {day.isToday && (
                                                <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_5px_white]" />
                                            )}
                                        </>
                                    ) : (
                                        <div className="w-full h-full" />
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="mt-auto px-4 py-3 rounded-2xl bg-zinc-950/40 border border-white/[0.02] flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Active Cycles</span>
                                <span className="text-xs font-black text-white">{monthDays.filter(d => d?.hasActivity).length} Days Found</span>
                            </div>
                            <div className="h-8 w-px bg-white/5" />
                            <div className="flex flex-col items-end">
                                <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Integrity</span>
                                <span className="text-xs font-black text-emerald-400">
                                    {Math.round((monthDays.filter(d => d?.hasActivity).length / (monthDays.length - monthDays.filter(d => d === null).length)) * 100)}%
                                </span>
                            </div>
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
                            className="w-full max-w-xl aspect-square bg-zinc-900 border border-white/10 rounded-[3rem] overflow-hidden relative shadow-[0_0_100px_rgba(0,0,0,0.8)]"
                        >
                            <div className="absolute inset-0 pb-24">
                                <Cropper image={image || undefined} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} cropShape="rect" showGrid={false} />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-8 bg-zinc-950/80 backdrop-blur-xl flex items-center justify-between border-t border-white/5">
                                <Button variant="ghost" onClick={() => setShowCropper(false)} className="text-zinc-500 hover:text-white uppercase font-black text-xs tracking-[0.2em]">Abort</Button>
                                <Button onClick={handleUploadCropped} className="bg-purple-600 text-white hover:bg-purple-500 font-black uppercase text-xs tracking-[0.3em] px-10 h-12 rounded-2xl shadow-[0_0_30px_rgba(168,85,247,0.3)]">Confirm Sync</Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
