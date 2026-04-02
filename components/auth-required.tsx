"use client";

import React from "react";
import { LogIn, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter, usePathname } from "next/navigation";

interface AuthRequiredProps {
    title: string;
    description: string;
}

export function AuthRequired({ title, description }: AuthRequiredProps) {
    const router = useRouter();
    const pathname = usePathname();

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in zoom-in duration-700">
            <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl relative group">
                <div className="absolute inset-0 bg-sky-500/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                <Lock className="w-8 h-8 text-sky-400 relative z-10" />
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-white uppercase italic tracking-tighter text-center mb-4">
                {title}
            </h2>
            <p className="text-zinc-500 text-sm font-medium uppercase tracking-[0.2em] text-center max-w-sm mb-12 leading-relaxed">
                {description}
            </p>

            <Button
                onClick={() => router.push(`/login?redirect=${encodeURIComponent(pathname)}`)}
                className="h-16 px-10 rounded-2xl bg-white text-black hover:bg-zinc-200 transition-all font-black uppercase tracking-widest shadow-[0_20px_50px_rgba(255,255,255,0.1)] hover:scale-[1.05] active:scale-95"
            >
                <LogIn className="mr-2 w-5 h-5" /> Open My Vault
            </Button>

            <p className="mt-8 text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">
                Secure Your Connection
            </p>
        </div>
    );
}
