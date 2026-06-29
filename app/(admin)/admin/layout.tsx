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
            "shrink-0 border-r border-white/[0.06] flex flex-col bg-zinc-900/40 backdrop-blur-md transition-all duration-300 relative z-10",
            isCollapsed ? "w-16" : "w-56",
          )}
        >
          {/* Toggle Collapse Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-[18px] top-1/2 -translate-y-1/2 z-50 w-9 h-9 bg-white/[0.06] backdrop-blur-md border border-white/10 hover:bg-white/[0.12] hover:border-white/20 text-white/70 hover:text-white rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md select-none"
          >
            {isCollapsed ? (
              <ChevronRight className="w-[18px] h-[18px]" />
            ) : (
              <ChevronLeft className="w-[18px] h-[18px]" />
            )}
          </button>

          {/* Logo and Brand area */}
          <div className="p-4 border-b border-white/[0.05] h-16 flex items-center overflow-hidden">
            <Link
              href="/admin"
              className="flex items-center gap-3.5 animate-in fade-in duration-300"
            >
              <Avatar className="w-8 h-8 border border-white/15 shadow-inner shrink-0">
                <AvatarImage
                  src={getHighQualityAvatarUrl(
                    profileData?.photoURL || user?.photoURL,
                    32,
                  )}
                  className="object-cover"
                />
                <AvatarFallback className="text-[10px] bg-zinc-800 text-zinc-300 font-bold uppercase">
                  {profileData?.displayName?.[0] ||
                    user?.displayName?.[0] ||
                    user?.email?.[0] ||
                    "A"}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="min-w-0 transition-opacity duration-300">
                  <p className="text-sm font-black text-white leading-none truncate">
                    {profileData?.displayName || user?.displayName || "Admin"}
                  </p>
                  <p className="text-[7.5px] text-zinc-500 uppercase tracking-widest mt-1">
                    Admin
                  </p>
                </div>
              )}
            </Link>
          </div>

          {/* Navigation Section */}
          <nav className="flex-1 p-3 space-y-1.5 mt-2">
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
                    "flex items-center rounded-[5px] text-xs font-bold tracking-wide transition-all duration-200 group relative border",
                    isCollapsed ? "justify-center p-2.5" : "gap-3 px-3.5 py-3",
                    isActive
                      ? "bg-white/[0.06] border-white/[0.12] text-white shadow-inner"
                      : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02] hover:border-white/[0.06]",
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105 duration-200" />
                  {!isCollapsed && <span>{link.label}</span>}

                  {/* Visual active tick on the left edge */}
                  {isActive && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-r-full shadow-[0_0_8px_white]" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User Info Bar */}
          {user && (
            <div className="p-3 border-t border-white/[0.05] bg-zinc-950/20">
              <div
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2",
                  isCollapsed ? "justify-center" : "",
                )}
              >
                <Avatar size="sm" className="border border-white/10">
                  <AvatarImage
                    src={getHighQualityAvatarUrl(
                      profileData?.photoURL || user.photoURL,
                      32,
                    )}
                  />
                  <AvatarFallback className="text-[10px] bg-zinc-800 text-zinc-300 font-bold uppercase">
                    {profileData?.displayName?.[0] ||
                      user.displayName?.[0] ||
                      user.email?.[0] ||
                      "A"}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] ubuntu-bold font-black text-zinc-300 truncate">
                      {profileData?.displayName ||
                        user.displayName ||
                        "Admin User"}
                    </p>
                    <p className="text-[9px] text-zinc-600 truncate mt-0.5">
                      {user.email || ""}
                    </p>
                  </div>
                )}
              </div>

              <Link
                href="/"
                className={cn(
                  "flex items-center mt-1.5 rounded-xl text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] transition-all duration-200 select-none",
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
