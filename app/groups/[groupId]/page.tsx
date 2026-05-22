"use client";

import { use } from "react";
import { GroupWorkspace } from "@/components/groups/GroupWorkspace";
import { BackgroundTheme } from "@/components/background-theme";
import { AuthRequired } from "@/components/auth-required";
import { useAuth } from "@/components/AuthProvider";
import { Space_Grotesk } from "next/font/google";
import { cn } from "@/lib/utils";

const spaceGrotesk = Space_Grotesk({
    subsets: ["latin"],
    variable: "--font-space-grotesk",
    weight: ["300", "400", "500", "600", "700"],
});

export default function GroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
    const { groupId } = use(params);
    const { user, loading } = useAuth();

    if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>;

    if (!user || user.isAnonymous) return (
        <div className="flex flex-col flex-1 bg-zinc-950 font-sans min-h-screen relative overflow-hidden">
            <BackgroundTheme showSettings={false} />
            <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 w-full flex-1">
                <AuthRequired title="Groups restricted" description="Sign in to join focus groups." />
            </main>
        </div>
    );

    return (
        <BackgroundTheme showSettings={false}>
            <div className={cn("relative min-h-screen flex flex-col overflow-x-hidden group-page-radius", spaceGrotesk.variable, "font-sans")} style={{ "--font-sans": "var(--font-space-grotesk)" } as React.CSSProperties}>
                <main className="relative z-10 flex flex-col w-full flex-1">
                    <GroupWorkspace groupId={groupId} />
                </main>
            </div>
        </BackgroundTheme>
    );
}
