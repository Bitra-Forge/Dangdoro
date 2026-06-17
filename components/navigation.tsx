"use client";

import { Timer, ClipboardList, Settings, Trophy, User, Users, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const navLinks = [
    { id: "nav-timer", label: "Timer", href: "/", icon: Timer },
    { id: "nav-tasks", label: "Tasks", href: "/tasks", icon: ClipboardList },
    { id: "nav-groups", label: "Groups", href: "/groups", icon: Users },
    { id: "nav-leaderboard", label: "Leaderboard", href: "/leaderboard", icon: Trophy },
    { id: "nav-profile", label: "Profile", href: "/profile", icon: User },
    { id: "nav-settings", label: "Settings", href: "/settings", icon: Settings },
];

export function Navigation() {
    const pathname = usePathname();
    const { user, loading, openAuthVault } = useAuth();

    // Show guest navigation (only Timer and Sign In button) if user state is loaded and user is guest/anonymous
    const showGuestNav = !loading && (!user || user.isAnonymous);

    return (
        <div>
            <nav className="flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 bg-zinc-900/40 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl">
                {navLinks
                    .filter((link) => {
                        if (showGuestNav) {
                            return link.id === "nav-timer" || link.id === "nav-settings";
                        }
                        return true;
                    })
                    .map((link) => {
                        const Icon = link.icon;
                        const isActive = pathname === link.href;

                        return (
                            <Link
                                id={link.id}
                                key={link.label}
                                href={link.href}
                                className={cn(
                                    "relative flex items-center py-1.5 sm:py-2 rounded-xl transition-all duration-300 group px-3 md:px-4 gap-0 md:gap-2",
                                    "flex",
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
                                    isActive ? "hidden md:inline-block max-w-20 opacity-100 ml-1" : "hidden opacity-0"
                                )}>
                                    {link.label}
                                </span>

                                {isActive && (
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full shadow-[0_0_10px_white]" />
                                )}
                            </Link>
                        );
                    })}

                {showGuestNav && (
                    <button
                        id="nav-signin"
                        onClick={openAuthVault}
                        className={cn(
                            "relative flex items-center py-1.5 sm:py-2 rounded-xl transition-all duration-300 group px-3 md:px-4 gap-0 md:gap-2 cursor-pointer text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
                        )}
                    >
                        <LogIn className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                        <span className="text-xs font-bold tracking-wide transition-all duration-300 overflow-hidden hidden md:inline-block ml-1">
                            Sign In
                        </span>
                    </button>
                )}
            </nav>
        </div>
    );
}
