"use client";

import { Timer, ClipboardList, BarChart3, Settings, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
    { label: "Timer", href: "/", icon: Timer },
    { label: "Tasks", href: "/tasks", icon: ClipboardList },
    { label: "Leaderboard", href: "/leaderboard", icon: Trophy },
    { label: "Stats", href: "/stats", icon: BarChart3 },
    { label: "Profile", href: "/profile", icon: User },
    { label: "Settings", href: "/settings", icon: Settings },
];

export function Navigation() {
    const pathname = usePathname();

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
            <nav className="flex items-center gap-2 p-2 bg-zinc-900/40 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl">
                {navLinks.map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.href;

                    return (
                        <Link
                            key={link.label}
                            href={link.href}
                            className={cn(
                                "relative flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 group",
                                isActive
                                    ? "bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                                    : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
                            )}
                        >
                            <Icon className={cn(
                                "w-5 h-5 transition-transform duration-300",
                                isActive ? "scale-110" : "group-hover:scale-110"
                            )} />
                            <span className={cn(
                                "text-xs font-bold tracking-wide transition-all duration-300 overflow-hidden",
                                isActive ? "max-w-20 opacity-100 ml-1" : "max-w-0 opacity-0"
                            )}>
                                {link.label}
                            </span>

                            {isActive && (
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full shadow-[0_0_10px_white]" />
                            )}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
