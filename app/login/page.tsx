"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
    const { openAuthVault } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        openAuthVault();
        const redirect = searchParams.get("redirect") || "/";
        router.replace(redirect);
    }, [openAuthVault, router, searchParams]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-zinc-950">
            <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
        </div>
    );
}
