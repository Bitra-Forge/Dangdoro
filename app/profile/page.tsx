"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { logOut, linkAnonymousToGoogle } from "@/lib/auth";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadProfilePicture, updateProfilePictureBase64 } from "@/lib/db";
import { Camera, Shield, Zap, Clock, Calendar, LogOut, ChevronRight, Mail } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";
import { AuthRequired } from "@/components/auth-required";
import Cropper from "react-easy-crop";

export default function ProfilePage() {
    const { user, loading: authLoading } = useAuth();
    const [userData, setUserData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Cropping State
    const [image, setImage] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [showCropper, setShowCropper] = useState(false);

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            setLoading(true);

            // Lazy Sync: Ensure guest profile exists before listening to it
            if (user.isAnonymous) {
                const { syncUserProfile } = await import("@/lib/db");
                await syncUserProfile(user);
            }

            const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
                if (docSnap.exists()) {
                    setUserData(docSnap.data());
                }
                setLoading(false);
            });

            return unsub;
        };

        let unsubscribe: (() => void) | undefined;
        fetchData().then(unsub => { unsubscribe = unsub; });

        return () => { if (unsubscribe) unsubscribe(); };
    }, [user, authLoading]);

    const handleConnectGoogle = async () => {
        if (!user) return;
        try {
            await linkAnonymousToGoogle(user);
            toast.success("Account successfully connected!");
        } catch (error: any) {
            toast.error(error.message || "Failed to connect.");
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        const objectUrl = URL.createObjectURL(file);
        setImage(objectUrl);
        setShowCropper(true);
    };

    const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    const getCroppedImgBase64 = async (imageSrc: string, pixelCrop: any): Promise<string | null> => {
        const image = new Image();
        if (!imageSrc.startsWith('blob:') && !imageSrc.startsWith('data:')) {
            image.crossOrigin = "anonymous";
        }
        image.src = imageSrc;

        try {
            await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = reject;
            });
        } catch (err) {
            return null;
        }

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        // Resize for Base64 efficiency (150x150 is plenty for an avatar)
        canvas.width = 150;
        canvas.height = 150;

        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            150,
            150
        );

        // High compression (0.6) to keep text small
        return canvas.toDataURL("image/jpeg", 0.6);
    };

    const handleUploadCropped = async () => {
        if (!image || !croppedAreaPixels || !user) return;

        try {
            toast.loading("Forging your new identity...", { id: "upload" });
            const base64Image = await getCroppedImgBase64(image, croppedAreaPixels);

            if (!base64Image) throw new Error("Failed to process image");

            await updateProfilePictureBase64(user.uid, base64Image);

            toast.success("Identity updated!", { id: "upload" });
            setShowCropper(false);

            if (image.startsWith('blob:')) {
                URL.revokeObjectURL(image);
            }
            setImage(null);
        } catch (error) {
            console.error("Crop error:", error);
            toast.error("Failed to update picture.", { id: "upload" });
        }
    };

    const handleSignOut = async () => {
        try {
            localStorage.setItem("manual-sign-out", "true");
            await logOut();
            toast.success("Signed out successfully.");
        } catch (error) {
            toast.error("Error signing out.");
        }
    };

    if (authLoading || (user && loading)) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-950">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none" />
                <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 w-full flex-1">
                    <AuthRequired
                        title="Identity Locked"
                        description="Your focus stats and records are temporary. Connect with Google to establish your permanent legacy."
                    />
                </main>
            </div>
        );
    }
    return (
        <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none" />

            <main className="relative z-10 flex flex-col items-center pt-24 pb-32 px-4 w-full flex-1">
                {/* Profile Header */}
                <div className="flex flex-col items-center mb-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <div className="relative group mb-8">
                        <div className="absolute -inset-4 bg-gradient-to-r from-sky-500/20 to-purple-500/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        <Avatar className="w-32 h-32 border-4 border-white/10 shadow-2xl relative z-10 overflow-visible">
                            <div className="absolute inset-0 rounded-full overflow-hidden">
                                <AvatarImage src={userData?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} className="object-cover w-full h-full" />
                                <AvatarFallback className="bg-zinc-900 font-black text-2xl text-white">
                                    {user.displayName?.charAt(0) || "F"}
                                </AvatarFallback>
                            </div>

                            {/* Upload Overlay */}
                            <label className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer rounded-full z-20">
                                <Camera className="w-8 h-8 text-white" />
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    onClick={(e) => (e.target as any).value = null} // Allow re-selecting same file
                                />
                            </label>
                        </Avatar>

                        <div className="absolute -bottom-2 -right-2 bg-zinc-950 border border-white/10 p-2 rounded-xl shadow-xl z-20">
                            {user.isAnonymous ? (
                                <Zap className="w-4 h-4 text-amber-500" />
                            ) : (
                                <Shield className="w-4 h-4 text-emerald-500" />
                            )}
                        </div>
                    </div>

                    <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic drop-shadow-lg">
                        {userData?.displayName || "Guest Master"}
                    </h1>
                </div>

                <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
                    <div className="bg-zinc-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center shadow-xl group hover:bg-white/5 transition-all">
                        <Zap className="w-8 h-8 text-amber-400 mb-4 group-hover:scale-110 transition-transform" />
                        <span className="text-3xl font-black text-white mt-4 italic tracking-tighter">
                            {userData?.totalPomodoros || 0}
                        </span>
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">Sessions Completed</span>
                    </div>

                    <div className="bg-zinc-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center shadow-xl group hover:bg-white/5 transition-all">
                        <Clock className="w-8 h-8 text-sky-400 mb-4 group-hover:scale-110 transition-transform" />
                        <span className="text-3xl font-black text-white mt-4 italic tracking-tighter">
                            {userData?.totalMinutes || 0}
                        </span>
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

                {/* Connect Account Alert if Anonymous */}
                {user.isAnonymous && (
                    <div className="w-full max-w-2xl p-6 bg-amber-500/5 border border-amber-500/10 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                                <Shield className="w-6 h-6 text-amber-500" />
                            </div>
                            <div className="text-left">
                                <h3 className="text-sm font-black text-white uppercase italic tracking-tight">Temporary Session</h3>
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
                                    Connect with Google to save your focus sessions permanently.
                                </p>
                            </div>
                        </div>
                        <Button
                            onClick={handleConnectGoogle}
                            className="h-12 px-8 rounded-xl bg-amber-500 text-black hover:bg-amber-400 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-amber-500/20 whitespace-nowrap"
                        >
                            Connect Google
                        </Button>
                    </div>
                )}

                {/* Cropping Modal */}
                {showCropper && image && (
                    <div className="fixed inset-0 z-[100] bg-zinc-950/90 backdrop-blur-xl flex items-center justify-center p-4">
                        <div className="w-full max-w-xl aspect-square bg-zinc-900 border border-white/10 rounded-[3rem] overflow-hidden relative shadow-2xl">
                            <div className="absolute inset-0 pb-20">
                                <Cropper
                                    image={image}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={1}
                                    onCropChange={setCrop}
                                    onCropComplete={onCropComplete}
                                    onZoomChange={setZoom}
                                    cropShape="round"
                                    showGrid={false}
                                />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-6 bg-zinc-900/80 backdrop-blur-md flex items-center justify-between border-t border-white/5">
                                <Button
                                    variant="ghost"
                                    onClick={() => setShowCropper(false)}
                                    className="text-zinc-500 hover:text-white uppercase font-black text-xs tracking-widest"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleUploadCropped}
                                    className="bg-white text-black hover:bg-zinc-200 font-black uppercase text-xs tracking-widest px-8 rounded-xl"
                                >
                                    Confirm Adjustment
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
