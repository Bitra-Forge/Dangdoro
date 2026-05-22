"use client";

import React from "react";
import { User, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";

interface AuthRequiredProps {
    title: string;
    description: string;
}

export function AuthRequired({ title, description }: AuthRequiredProps) {
    const { openAuthVault } = useAuth();

    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 animate-in fade-in duration-700">
            <div className="w-14 h-14 bg-zinc-900 border border-white/5 rounded-full flex items-center justify-center mb-6 shadow-sm relative group">
                <div className="absolute inset-0 bg-white/[0.02] rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                <User className="w-6 h-6 text-zinc-500 relative z-10" />
            </div>

            <h2 className="text-xl font-bold text-white text-center mb-3 tracking-tight uppercase">
                {title}
            </h2>
            
            <p className="text-zinc-500 text-[10px] md:text-xs text-center max-w-[360px] mb-8 leading-relaxed font-bold uppercase tracking-widest truncate">
                {description}
            </p>

            <Button
                onClick={openAuthVault}
                className="h-10 px-8 rounded-full bg-white text-black hover:bg-zinc-200 transition-all font-bold uppercase tracking-tighter"
                style={{ fontSize: "13px" }}
            >
                <LogIn className="mr-2 w-4 h-4" /> Sign In
            </Button>
        </div>
    );
}
