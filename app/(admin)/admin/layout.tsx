"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Users,
  ChevronLeft,
  ChevronRight,
  ScrollText,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { DashboardSplashOverlay } from "@/components/dashboard-splash";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getHighQualityAvatarUrl } from "@/lib/utils";
import bgImage from "@/components/ui/4.jpg";

const sidebarLinks = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/changelog", label: "Changelog", icon: FileText },
  { href: "/admin/users", label: "Users", icon: Users },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [profileData, setProfileData] = useState<{
    displayName?: string | null;
    photoURL?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    import("@/lib/db").then(async ({ fetchUserProfiles }) => {
      try {
        const profiles = await fetchUserProfiles([user.uid]);
        if (profiles && profiles.length > 0) {
          setProfileData(profiles[0]);
        }
      } catch (err) {
        console.error("Failed to fetch admin profile:", err);
      }
    });
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }

    user.getIdToken().then((token) => {
      fetch("/api/admin/verify", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (!data.isAdmin) {
            router.replace("/");
          } else {
            setIsAdmin(true);
          }
        })
        .catch(() => router.replace("/"));
    });
  }, [user, loading, router]);

  if (loading || isAdmin === null) {
    return (
      <div className="min-h-screen bg-[#0D0C0A] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <>
      {/* PIN splash — covers the layout until the admin enters their PIN */}
      <DashboardSplashOverlay />

      <div className="min-h-screen bg-[#0D0C0A] flex text-zinc-100 relative overflow-hidden">
        {/* Layout Background Image (only on admin overview) */}
        {pathname === "/admin" && (
          <div className="absolute inset-0 z-0">
            <Image
              src={bgImage}
              alt="Layout Background"
              fill
              priority
              placeholder="blur"
              className="object-cover pointer-events-none"
            />
            {/* Gradients for high legibility */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/15 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/45 pointer-events-none" />
          </div>
        )}

        {/* Sidebar Container */}
        <aside
          className={cn(
            "shrink-0 border-r border-white/[0.08] flex flex-col bg-[#0b0b0a] transition-all duration-300 relative z-40 overflow-visible shadow-2xl",
            isCollapsed ? "w-16" : "w-56",
          )}
        >
          {/* Background Textures & Lighting Wrapper */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {/* Subtle Dark Pixelated Grid Texture matching page background */}
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:8px_8px]" />
            <div className="absolute inset-0 opacity-12 bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:16px_16px]" />

            {/* Very Quiet & Simple Left-Side Light Effect */}
            <div className="absolute inset-y-0 left-0 w-10 bg-[linear-gradient(to_right,rgba(2,52,63,0.2)_0%,transparent_100%)]" />
            <div className="absolute top-1/3 -left-12 w-20 h-44 rounded-full bg-[#02343F]/18 blur-3xl" />
            <div className="absolute bottom-1/4 -left-10 w-[70px] h-32 rounded-full bg-[#F0EDCC]/06 blur-3xl" />
          </div>

          {/* Toggle Collapse Button */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-[20px] top-1/2 -translate-y-1/2 z-[100] w-10 h-10 bg-[#02343F] backdrop-blur-md border-[1.5px] border-[#F0EDCC]/40 hover:border-[#F0EDCC] hover:bg-[#034857] text-[#F0EDCC] rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-90 select-none outline-none after:absolute after:-inset-2 after:rounded-full"
          >
            {isCollapsed ? (
              <ChevronRight className="w-[18px] h-[18px] pointer-events-none" />
            ) : (
              <ChevronLeft className="w-[18px] h-[18px] pointer-events-none" />
            )}
          </button>
          {/* Logo and Brand area */}
          <div className="p-4 border-b border-white/[0.08] h-16 flex items-center overflow-hidden relative z-10 bg-[#0b0b0a]/85 backdrop-blur-sm">
            <Link
              href="/admin"
              className="flex items-center gap-3.5 animate-in fade-in duration-300 group cursor-pointer active:scale-95 transition-transform"
            >
              <Avatar className="w-8 h-8 border border-white/15 shadow-inner shrink-0 group-hover:border-[#F0EDCC] transition-colors">
                <AvatarImage
                  src={getHighQualityAvatarUrl(
                    profileData?.photoURL || user?.photoURL,
                    32,
                  )}
                  className="object-cover"
                />
                <AvatarFallback className="text-[10px] bg-zinc-800 text-zinc-300 font-bold uppercase font-pixelify">
                  {profileData?.displayName?.[0] ||
                    user?.displayName?.[0] ||
                    user?.email?.[0] ||
                    "A"}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="min-w-0 transition-opacity duration-300">
                  <p className="text-sm font-bold text-white leading-none truncate font-pixelify tracking-wide group-hover:text-[#F0EDCC] transition-colors">
                    {profileData?.displayName || user?.displayName || "Admin"}
                  </p>
                  <p className="text-[8px] text-zinc-500 uppercase tracking-widest mt-1 font-pixelify font-bold">
                    Admin
                  </p>
                </div>
              )}
            </Link>
          </div>

          {/* Navigation Section */}
          <nav className="flex-1 p-3 space-y-2 mt-2 relative z-10">
            {sidebarLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                link.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center rounded-[5px] text-xs font-bold font-pixelify uppercase tracking-wider transition-all duration-150 group relative border-[1.5px] select-none active:scale-[0.96] active:translate-y-0.5 cursor-pointer",
                    isCollapsed ? "justify-center p-2.5" : "gap-3 px-3.5 py-3",
                    isActive
                      ? "bg-[#02343F] border-[#F0EDCC] text-[#F0EDCC] shadow-[0_0_14px_rgba(240,237,204,0.3)]"
                      : "border-[#F0EDCC]/30 bg-[#061e24]/70 text-zinc-300 hover:text-white hover:bg-[#02343F]/80 hover:border-[#F0EDCC]/70",
                  )}
                >
                  <Icon className={cn(
                    "w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                    isActive ? "text-[#F0EDCC]" : "text-zinc-400 group-hover:text-[#F0EDCC]"
                  )} />
                  {!isCollapsed && <span>{link.label}</span>}

                  {/* Retro glowing arcade tick on the left edge */}
                  {isActive && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#F0EDCC] rounded-r-[2px] shadow-[0_0_8px_#F0EDCC]" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User Info Bar */}
          {user && (
            <div className="p-3 border-t border-white/[0.08] bg-[#0b0b0a]/90 space-y-1.5 relative z-10 backdrop-blur-sm">
              <div
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2",
                  isCollapsed ? "justify-center" : "",
                )}
              >
                <Avatar size="sm" className="border border-white/10 shrink-0">
                  <AvatarImage
                    src={getHighQualityAvatarUrl(
                      profileData?.photoURL || user.photoURL,
                      32,
                    )}
                  />
                  <AvatarFallback className="text-[10px] bg-zinc-800 text-zinc-300 font-bold uppercase font-pixelify">
                    {profileData?.displayName?.[0] ||
                      user.displayName?.[0] ||
                      user.email?.[0] ||
                      "A"}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-pixelify font-bold text-zinc-200 truncate">
                      {profileData?.displayName ||
                        user.displayName ||
                        "Admin User"}
                    </p>
                    <p className="text-[9px] font-pixelify text-zinc-500 truncate mt-0.5">
                      {user.email || ""}
                    </p>
                  </div>
                )}
              </div>

              <Link
                href="/"
                className={cn(
                  "flex items-center rounded-[5px] text-[10px] font-pixelify font-bold uppercase tracking-wider text-zinc-300 hover:text-[#F0EDCC] bg-[#061e24]/70 hover:bg-[#02343F]/80 border-[1.5px] border-[#F0EDCC]/30 hover:border-[#F0EDCC]/70 transition-all duration-150 select-none active:scale-[0.96] active:translate-y-0.5 cursor-pointer",
                  isCollapsed ? "justify-center p-2" : "gap-2 px-3 py-2.5",
                )}
              >
                <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
                {!isCollapsed && <span>Back to app</span>}
              </Link>
            </div>
          )}
        </aside>

        {/* Main Content Pane */}
        <main
          className={cn(
            "flex-1 relative z-10",
            pathname === "/admin" || pathname.startsWith("/admin/changelog")
              ? "h-screen overflow-hidden p-6 lg:p-8 flex flex-col"
              : "overflow-y-auto p-8 lg:p-10",
          )}
        >
          <div
            className={cn(
              pathname === "/admin" || pathname.startsWith("/admin/changelog")
                ? "h-full w-full flex flex-col flex-1 min-h-0"
                : "max-w-5xl mx-auto space-y-6",
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
