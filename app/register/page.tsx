"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BackgroundTheme } from "@/components/background-theme";
import { AuthCard } from "@/components/AuthCard";

function RegisterContent() {
    const searchParams = useSearchParams();
    const redirect = searchParams.get("redirect") || "/";

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-16">
            <div className="w-full max-w-md">
                <AuthCard redirect={redirect} initialEmailMode="signup" />
                <p className="text-sm text-zinc-400 text-center mt-4">
                    Already have an account?{" "}
                    <Link href="/login" className="text-white hover:text-zinc-200 transition-colors">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default function RegisterPage() {
    return (
        <BackgroundTheme>
            <Suspense fallback={
                <div className="flex items-center justify-center min-h-screen bg-zinc-950">
                    <div className="w-10 h-10 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
                </div>
            }>
                <RegisterContent />
            </Suspense>
        </BackgroundTheme>
    );
}
