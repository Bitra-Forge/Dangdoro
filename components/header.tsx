"use client";

import { User, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/components/AuthProvider";
import { NotificationsMenu } from "@/components/notifications-menu";

const navLinks = [
    { label: "Timer", href: "/" },
    { label: "Tasks", href: "/tasks" },
    { label: "Settings", href: "/settings" },
];

export function Header() {
    const pathname = usePathname();
    const { user, loading } = useAuth();

    return (
        <header className="fixed top-0 left-0 right-0 z-50 h-20 bg-background/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-12 transition-all duration-500">
            <div className="flex items-center gap-12">
                <h1 className="text-3xl font-black tracking-tighter text-primary select-none cursor-default hover:scale-105 transition-transform duration-500">
                    Dangdoro
                </h1>

                <nav className="hidden lg:flex items-center gap-12 text-sm font-bold tracking-widest uppercase text-muted-foreground/40">
                    {navLinks.map((link) => (
                        <Link
                            key={link.label}
                            href={link.href}
                            className={cn(
                                "relative group transition-colors hover:text-primary duration-500",
                                pathname === link.href ? "text-primary font-black" : ""
                            )}
                        >
                            {link.label}
                            {pathname === link.href && (
                                <div className="absolute -bottom-2 left-0 right-1/2 h-1 bg-primary rounded-full animate-in zoom-in duration-500" />
                            )}
                            <div className="absolute -bottom-2 left-0 right-0 h-1 bg-primary/20 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 rounded-full" />
                        </Link>
                    ))}
                </nav>
            </div>

            <div className="flex items-center gap-6">
                <div className="hidden md:flex flex-col items-end mr-2 text-right">
                    <span className="text-[10px] font-black text-white uppercase italic tracking-tighter leading-none">
                        {loading ? "Detecting..." : (user?.displayName || "Initializng...")}
                    </span>
                    <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                        {user?.isAnonymous ? "Guest Session" : (user ? "Verified Hero" : "Offline")}
                    </span>
                </div>

                <a
                    href="https://ko-fi.com/morales002"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Support Dangdoro"
                    className="p-2 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 hover:border-rose-500 rounded-xl transition-all duration-300 transform active:scale-90 flex items-center justify-center group shadow-lg shadow-rose-500/0 hover:shadow-rose-500/20"
                >
                    <Heart className="w-4 h-4 text-rose-400 group-hover:text-black transition-colors duration-300 group-hover:scale-110 transition-transform" />
                </a>

                <NotificationsMenu />

                <Link href="/profile">
                    <Avatar className="w-10 h-10 border-2 border-primary/20 p-0.5 hover:border-primary transition-colors duration-500 hover:scale-105 transform cursor-pointer">
                        <AvatarImage src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid || 'default'}`} />
                        <AvatarFallback className="bg-zinc-900 text-[10px] font-black">{user?.displayName?.slice(0, 2) || "!!"}</AvatarFallback>
                    </Avatar>
                </Link>
            </div>
        </header>
    );
}
