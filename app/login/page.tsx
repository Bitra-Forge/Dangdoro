"use client";

import { AuthCard } from "@/components/AuthCard";
import { LogIn } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
    const searchParams = useSearchParams();
    const redirect = searchParams.get("redirect") || "/profile";

    return (
        <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
            {/* Background radial glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none" />

            <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 w-full flex-1">
                <header className="flex flex-col items-center gap-4 text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.4)]">
                            <LogIn className="w-4 h-4 text-sky-500" />
                        </div>
                        <span className="text-2xl font-black tracking-tight text-white uppercase italic">Access Core</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white uppercase italic leading-none drop-shadow-lg">
                        Finalize Your Connection
                    </h1>
                    <p className="text-zinc-500 text-sm font-medium uppercase tracking-[0.2em]">
                        Secure your focus sessions permanently
                    </p>
                </header>

                <div className="w-full max-w-md animate-in fade-in zoom-in duration-1000">
                    <AuthCard redirect={redirect} />
                </div>
            </main>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-zinc-950">
                <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
