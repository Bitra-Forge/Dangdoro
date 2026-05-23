"use client";

import { Timer, ClipboardList, Settings, Trophy, User, Users, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useEffect, useState } from "react";

const navLinks = [
    { label: "Timer", href: "/", icon: Timer },
    { label: "Tasks", href: "/tasks", icon: ClipboardList },
    { label: "Groups", href: "/groups", icon: Users },
    { label: "Leaderboard", href: "/leaderboard", icon: Trophy },
    { label: "Profile", href: "/profile", icon: User },
    { label: "Settings", href: "/settings", icon: Settings },
];

export function Navigation() {
    const pathname = usePathname();
    const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);
    const [isMobileView, setIsMobileView] = useState(false);

    useEffect(() => {
        const checkSizes = () => {
            setIsMobileOrTablet(window.innerWidth < 1024);
            setIsMobileView(window.innerWidth < 768);
        };
        checkSizes();
        window.addEventListener("resize", checkSizes);
        return () => window.removeEventListener("resize", checkSizes);
    }, []);

    const activeLinks = isMobileOrTablet ? navLinks.filter(l => l.href !== "/tasks") : navLinks;

    return (
        <div>
            <nav className="flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 bg-zinc-900/40 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl">

                {activeLinks.map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.href;

                    return (
                        <Link
                            key={link.label}
                            href={link.href}
                            className={cn(
                                "relative flex items-center py-1.5 sm:py-2 rounded-xl transition-all duration-300 group",
                                isMobileView ? "px-3 gap-0" : "gap-1.5 sm:gap-2 px-2.5 sm:px-4",
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
                                isActive && !isMobileView ? "max-w-20 opacity-100 ml-1" : "max-w-0 opacity-0"
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
