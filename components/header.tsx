"use client";

import { Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const navLinks = [
  { label: "Timer", href: "/" },
  { label: "Tasks", href: "/tasks" },
  { label: "Stats", href: "/stats" },
  { label: "Settings", href: "/settings" },
];

export function Header() {
  const pathname = usePathname();

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
            <button className="relative p-2 text-muted-foreground hover:text-primary transition-all duration-500 hover:bg-primary/5 rounded-full">
                <Bell className="w-5 h-5" />
                <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-destructive rounded-full" />
            </button>
            <Avatar className="w-10 h-10 border-2 border-primary/20 p-0.5 hover:border-primary transition-colors duration-500 hover:scale-105 transform cursor-pointer">
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>MC</AvatarFallback>
            </Avatar>
        </div>
    </header>
  );
}
