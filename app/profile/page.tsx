"use client";

import { useEffect, useState } from "react";
import { User, LogOut, Mail, Shield, Zap, Clock, Calendar } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { logOut } from "@/lib/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";

export default function ProfilePage() {
    const { user } = useAuth();
    const [userData, setUserData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            const fetchProfile = async () => {
                setLoading(true);
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    setUserData(userDoc.data());
                }
                setLoading(false);
            };
            fetchProfile();
        }
    }, [user]);

    const handleSignOut = async () => {
        try {
            await logOut();
            toast.success("Signed out successfully.");
        } catch (error) {
            toast.error("Error signing out.");
        }
    };

    if (!user || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-950">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none" />

            <main className="relative z-10 flex flex-col items-center pt-24 pb-32 px-4 w-full flex-1">
                <div className="w-full max-w-4xl flex flex-col items-center">
                    <div className="relative group">
                        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                        <Avatar className="w-32 h-32 border-4 border-white/10 p-1 relative z-10 shadow-2xl">
                            <AvatarImage src={user.photoURL || "https://github.com/shadcn.png"} />
                            <AvatarFallback className="bg-zinc-900 text-3xl font-black">{userData?.displayName?.slice(0, 2) || "G"}</AvatarFallback>
                        </Avatar>
                    </div>

                    <h1 className="mt-8 text-4xl font-black text-white tracking-tighter uppercase italic drop-shadow-lg">
                        {userData?.displayName || "Guest Master"}
                    </h1>
                    <p className="text-zinc-500 font-bold uppercase tracking-[0.3em] text-xs mt-2 flex items-center gap-2">
                        {user.isAnonymous ? (
                            <>
                                <Shield className="w-3 h-3 text-amber-500" /> Anonymous Account
                            </>
                        ) : (
                            <>
                                <Shield className="w-3 h-3 text-emerald-500" /> Verified Focus Hero
                            </>
                        )}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-16 mb-12">
                        <div className="bg-zinc-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center shadow-xl group hover:bg-white/5 transition-all">
                            <Zap className="w-8 h-8 text-amber-400 mb-4 group-hover:scale-110 transition-transform" />
                            <span className="text-4xl font-black text-white">{userData?.totalPomodoros || 0}</span>
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">Sessions Completed</span>
                        </div>
                        <div className="bg-zinc-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center shadow-xl group hover:bg-white/5 transition-all">
                            <Clock className="w-8 h-8 text-sky-400 mb-4 group-hover:scale-110 transition-transform" />
                            <span className="text-4xl font-black text-white">{userData?.totalMinutes || 0}</span>
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">Focus Minutes</span>
                        </div>
                        <div className="bg-zinc-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center shadow-xl group hover:bg-white/5 transition-all">
                            <Calendar className="w-8 h-8 text-purple-400 mb-4 group-hover:scale-110 transition-transform" />
                            <span className="text-sm font-black text-white mt-4 uppercase italic">
                                {userData?.createdAt?.seconds ? format(new Date(userData.createdAt.seconds * 1000), "MMM yyyy") : "Join Date"}
                            </span>
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">Member Since</span>
                        </div>
                    </div>

                    <div className="w-full space-y-4 max-w-2xl">
                        <div className="bg-zinc-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-xl">
                            <h2 className="text-xl font-black text-white uppercase italic tracking-tighter mb-8">Account Details</h2>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <Mail className="w-5 h-5 text-zinc-500" />
                                        <span className="font-bold text-zinc-300">Email</span>
                                    </div>
                                    <span className="text-zinc-500 font-bold">{user.email || "No Email (Guest)"}</span>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <Shield className="w-5 h-5 text-zinc-500" />
                                        <span className="font-bold text-zinc-300">Auth Method</span>
                                    </div>
                                    <span className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">
                                        {user.providerData[0]?.providerId || "anonymous"}
                                    </span>
                                </div>
                            </div>

                            {!user.isAnonymous && (
                                <Button
                                    onClick={handleSignOut}
                                    variant="outline"
                                    className="w-full mt-8 h-14 rounded-2xl border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10 transition-all font-black uppercase tracking-widest"
                                >
                                    <LogOut className="mr-2 w-5 h-5" /> Sign Out
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
