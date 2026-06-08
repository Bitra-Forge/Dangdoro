"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChangelogManager } from "@/components/admin/ChangelogManager";
import { ChangelogSkeleton } from "@/components/admin/LoadingSkeleton";

interface ChangelogEntry {
  id: string;
  title: string;
  content: string;
  createdAt: string | null;
}

export default function AdminChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const loadEntries = async () => {
    try {
      const t = await getToken();
      setToken(t);
      const res = await fetch("/api/admin/changelog", {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      if (data.entries) {
        setEntries(data.entries);
      }
    } catch (err) {
      console.error("Failed to load changelog entries:", err);
      toast.error("Failed to load changelog list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (title: string, content: string): Promise<boolean> => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/changelog", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, content }),
      });
      if (res.ok) {
        toast.success("Changelog entry published successfully");
        loadEntries();
        return true;
      } else {
        const errData = await res.json();
        toast.error(errData.error || "Failed to publish changelog");
        return false;
      }
    } catch {
      toast.error("Failed to publish changelog");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/changelog/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Changelog entry deleted successfully");
        setEntries((prev) => prev.filter((e) => e.id !== id));
      } else {
        toast.error("Failed to delete changelog");
      }
    } catch {
      toast.error("Failed to delete changelog");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="h-6 w-32 rounded bg-white/5 animate-pulse" />
            <div className="h-4 w-48 rounded bg-white/5 animate-pulse" />
          </div>
          <ChangelogSkeleton />
        </div>
      ) : (
        <ChangelogManager
          entries={entries}
          onSubmit={handleSubmit}
          onDelete={handleDelete}
          submitting={submitting}
          deletingId={deletingId}
        />
      )}
    </div>
  );
}
