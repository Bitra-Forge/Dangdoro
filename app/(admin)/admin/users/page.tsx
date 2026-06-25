"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { UsersTable } from "@/components/admin/UsersTable";
import { TableSkeleton } from "@/components/admin/LoadingSkeleton";

interface UserData {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  isAnonymous: boolean;
  totalPomodoros: number;
  totalMinutes: number;
  banned: boolean;
  createdAt: string | null;
  lastActive: string | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [search, setSearch] = useState("");
  const [banningUid, setBanningUid] = useState<string | null>(null);

  const getToken = async () => {
    const { getAuth } = await import("firebase/auth");
    const auth = getAuth();
    // Wait for the user to load if not initialized yet
    return new Promise<string>((resolve) => {
      const checkUser = () => {
        const u = auth.currentUser;
        if (u) {
          u.getIdToken().then(resolve);
        } else {
          setTimeout(checkUser, 100);
        }
      };
      checkUser();
    });
  };

  const loadUsers = async (searchTerm?: string) => {
    try {
      const t = await getToken();
      setToken(t);
      const params = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : "";
      const res = await fetch(`/api/admin/users${params}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error("Failed to load user list:", err);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      if (search) loadUsers(search);
      else loadUsers();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleToggleBan = async (user: UserData) => {
    setBanningUid(user.uid);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid: user.uid, banned: !user.banned }),
      });
      if (res.ok) {
        toast.success(user.banned ? "User unbanned successfully" : "User banned successfully");
        setUsers((prev) =>
          prev.map((u) =>
            u.uid === user.uid ? { ...u, banned: !u.banned } : u
          )
        );
      } else {
        const errData = await res.json();
        toast.error(errData.error || "Failed to update user status");
      }
    } catch {
      toast.error("Failed to update user status");
    } finally {
      setBanningUid(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-black text-white">Users</h1>
        <p className="text-xs text-zinc-500 mt-1">Manage user account access and view statistics</p>
      </div>

      {/* Main Content Area */}
      {loading && users.length === 0 ? (
        <div className="space-y-4">
          <div className="h-12 w-full rounded bg-white/5 animate-pulse" />
          <TableSkeleton />
        </div>
      ) : (
        <UsersTable
          users={users}
          search={search}
          setSearch={setSearch}
          onToggleBan={handleToggleBan}
          banningUid={banningUid}
        />
      )}
    </div>
  );
}
